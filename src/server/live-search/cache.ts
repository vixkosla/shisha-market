import { normalize } from "./text";

/** What a finished generation produced, replayed as the same events without a model call. */
export type CachedAnswer = {
  lanes: Partial<Record<"answer" | "journal" | "check", string>>;
  off: ("answer" | "journal" | "check")[];
  follow: string[];
};

const TTL_MS = Number(process.env.LIVE_CACHE_TTL_MS) || 6 * 60 * 60_000;
const LIMIT = 500;
const store = new Map<string, { at: number; value: CachedAnswer }>();

/** Case, spacing, «ё» and punctuation do not change the question. A deploy restarts the process and empties the cache. */
export function cacheKey(query: string) {
  return normalize(query).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function readCache(key: string, now = Date.now()): CachedAnswer | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (now - entry.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  // Least recently used goes first when the store is full.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function writeCache(key: string, value: CachedAnswer, now = Date.now()) {
  store.set(key, { at: now, value });
  while (store.size > LIMIT) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function resetLiveCache() {
  store.clear();
}
