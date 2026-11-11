import type { NextRequest } from "next/server";
import { LIVE_QUERY_MAX, LIVE_QUERY_MIN, type LiveEvent } from "@/lib/live-search";
import { brandCards, listingChunks, staticChunks } from "@/server/live-search/corpus";
import { acquireGeneration, allowRequest } from "@/server/live-search/limits";
import { createLlmStream, llmConfig } from "@/server/live-search/llm";
import { runLiveSearch } from "@/server/live-search/run";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, LIVE_QUERY_MAX);
  if (query.length < LIVE_QUERY_MIN) return Response.json({ error: "Запрос слишком короткий." }, { status: 400 });
  // Caddy overwrites X-Forwarded-For; the application binds only to loopback.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip)) return Response.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429, headers: { "Retry-After": "60" } });

  const config = llmConfig();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: LiveEvent) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          abort.abort();
        }
      };
      try {
        await runLiveSearch({
          query,
          generate: request.nextUrl.searchParams.get("gen") === "1",
          staticChunks: staticChunks(),
          brands: brandCards(),
          loadListings: () => listingChunks(),
          llm: config ? createLlmStream(config) : null,
          acquire: () => acquireGeneration(),
          emit,
          signal: abort.signal,
        });
      } catch (error) {
        if (!abort.signal.aborted) console.error("Live search failed", error instanceof Error ? error.message : "unknown");
      } finally {
        try {
          controller.close();
        } catch {
          // The client has already gone away.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Robots-Tag": "noindex",
    },
  });
}
