export const WIKI_GROUPS = [
  { id: "brands", title: "Производители", description: "Алфавитный указатель брендов", icon: "brands" },
  { id: "categories", title: "Категории товаров", description: "Темы для знакомства с устройством кальянного мира", icon: "categories" },
  { id: "guide", title: "Руководства", description: "Редактирование и оформление материалов вики", icon: "guide" },
] as const;

export interface WikiDirectoryEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  sectionCount: number;
  outline: string[];
  reviewPending?: boolean;
}

export const WIKI_ROUTE = ["categories/hookahs", "categories/bowls", "categories/tobacco", "categories/charcoal", "categories/accessories"] as const;

export function normalizeWikiSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
}

export function filterWikiEntries(entries: WikiDirectoryEntry[], query: string, filter: string, saved: ReadonlySet<string> = new Set()): WikiDirectoryEntry[] {
  const words = normalizeWikiSearch(query).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (filter === "saved" && !saved.has(entry.slug)) return false;
    if (filter !== "all" && filter !== "saved" && entry.category !== filter) return false;
    const haystack = normalizeWikiSearch(`${entry.title} ${entry.description} ${entry.outline.join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function wikiArticleCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? "статей" : last === 1 ? "статья" : last >= 2 && last <= 4 ? "статьи" : "статей";
  return `${count} ${noun}`;
}
