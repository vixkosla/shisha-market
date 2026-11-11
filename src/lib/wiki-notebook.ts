export const WIKI_NOTEBOOK_KEY = "shisha-market:wiki-notebook:v1";

export interface WikiPersonalEntry { saved?: boolean; read?: boolean; note?: string }
export type WikiNotebook = Record<string, WikiPersonalEntry>;
type NotebookStorage = Pick<Storage, "getItem" | "setItem">;

export function readWikiNotebook(storage: NotebookStorage): WikiNotebook {
  const raw = storage.getItem(WIKI_NOTEBOOK_KEY);
  if (raw === null) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid wiki notebook");
  const entries: WikiNotebook = {};
  for (const [slug, value] of Object.entries(data)) {
    if (!/^[a-z\d-]+(?:\/[a-z\d-]+)*$/i.test(slug) || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    entries[slug] = { saved: entry.saved === true, read: entry.read === true, note: typeof entry.note === "string" ? entry.note : "" };
  }
  return entries;
}

/** Read before each write so another tab's edits are retained. Throws on failure. */
export function writeWikiPersonalEntry(storage: NotebookStorage, slug: string, patch: WikiPersonalEntry): WikiNotebook {
  const entries = readWikiNotebook(storage);
  const next = { ...entries, [slug]: { ...entries[slug], ...patch } };
  storage.setItem(WIKI_NOTEBOOK_KEY, JSON.stringify(next));
  return next;
}
