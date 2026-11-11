import { llmsIndex } from "@/lib/llms";

export const dynamic = "force-dynamic";

export function GET() {
  const origin = (process.env.APP_URL ?? "http://127.0.0.1:4387").replace(
    /\/$/,
    "",
  );
  return new Response(llmsIndex(origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
