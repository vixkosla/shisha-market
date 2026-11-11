export const draftFields = ["title", "description", "category", "subcategory", "brand", "model", "country", "condition", "city", "price"] as const;
/** Added later: a draft saved before them simply has them empty. */
const laterFields = new Set<string>(["subcategory", "brand", "model"]);
export type ListingDraftFields = Record<(typeof draftFields)[number], string>;

export function encodeListingDraft(fields: Partial<ListingDraftFields>, now = Date.now()) {
  // Never persist contact details, full names, photos or consent checkboxes.
  return JSON.stringify({ version: 1, savedAt: now, fields: Object.fromEntries(draftFields.map(key => [key, fields[key] ?? ""])) });
}

export function decodeListingDraft(raw: string, now = Date.now()): ListingDraftFields | null {
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > now + 60000 || now - value.savedAt > 86400000 || !value.fields) return null;
    const fields = Object.fromEntries(draftFields.map(key => [key, value.fields[key] ?? (laterFields.has(key) ? "" : undefined)]));
    if (!draftFields.every(key => typeof fields[key] === "string" && fields[key].length <= (key === "description" ? 5000 : 200))) return null;
    return fields as ListingDraftFields;
  } catch { return null; }
}

export function hasDraftContent(fields: Pick<ListingDraftFields, "title" | "description" | "city" | "price">) {
  return [fields.title, fields.description, fields.city, fields.price].some(value => value.trim());
}
