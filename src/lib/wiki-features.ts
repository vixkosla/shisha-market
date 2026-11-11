/** Opt-in only. Evaluated by server pages; no public query-string override. */
export function wikiNotebookEnabled(value?: string): boolean {
  return value === "true";
}
