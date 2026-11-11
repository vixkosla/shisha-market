export type LlmConfig = { url: string; key?: string; model: string };
export type LlmMessage = { role: "system" | "user"; content: string };
export type LlmStream = (messages: LlmMessage[], options: { maxTokens: number; signal: AbortSignal }) => AsyncIterable<string>;

/** Any OpenAI-compatible endpoint: a pay-per-token API or a rented Ollama. Unset means no generation. */
export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const url = env.LIVE_LLM_URL?.trim().replace(/\/+$/, "");
  const model = env.LIVE_LLM_MODEL?.trim();
  if (!url || !model) return null;
  return { url, model, key: env.LIVE_LLM_KEY?.trim() || undefined };
}

/** Removes a leading <think> block even when its tags are split across chunks. */
export function thinkingFilter() {
  let buffer = "";
  let state: "start" | "inside" | "text" = "start";
  return (chunk: string) => {
    if (state === "text") return chunk;
    buffer += chunk;
    if (state === "start") {
      const head = buffer.trimStart();
      if ("<think>".startsWith(head) && head.length < 7) return "";
      if (!head.startsWith("<think>")) {
        state = "text";
        const out = head;
        buffer = "";
        return out;
      }
      state = "inside";
    }
    const end = buffer.indexOf("</think>");
    if (end < 0) {
      buffer = buffer.slice(-8);
      return "";
    }
    state = "text";
    const out = buffer.slice(end + 8).trimStart();
    buffer = "";
    return out;
  };
}

export function createLlmStream(config: LlmConfig, fetchImpl: typeof fetch = fetch): LlmStream {
  const hosted = /openrouter\.ai/.test(config.url);
  return async function* stream(messages, { maxTokens, signal }) {
    const response = await fetchImpl(`${config.url}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}) },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: 0.1,
        max_tokens: maxTokens,
        ...(hosted ? { provider: { data_collection: "deny" }, reasoning: { enabled: false } } : { reasoning_effort: "none" }),
      }),
    });
    if (!response.ok || !response.body) throw new Error(`LLM HTTP ${response.status}`);
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const strip = thinkingFilter();
    let pending = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      pending += value;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data || data === "[DONE]") continue;
        let text = "";
        let failure: unknown;
        try {
          const event = JSON.parse(data);
          // OpenRouter reports an upstream failure (e.g. 429 from the provider) inside a 200 stream.
          failure = event.error;
          text = event.choices?.[0]?.delta?.content ?? "";
        } catch {
          continue;
        }
        if (failure) throw new Error(`LLM stream error ${(failure as { code?: unknown }).code ?? ""}`.trim());
        const out = text ? strip(text) : "";
        if (out) yield out;
      }
    }
  };
}
