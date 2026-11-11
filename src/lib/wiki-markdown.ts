export interface WikiHeading {
  id: string;
  title: string;
  level: 2 | 3;
  line: number;
}

export interface WikiFence {
  marker: string;
  length: number;
}

export function openingWikiFence(line: string): WikiFence | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return match ? { marker: match[1][0], length: match[1].length } : null;
}

export function closesWikiFence(line: string, fence: WikiFence): boolean {
  const trimmed = line.trim();
  return trimmed.length >= fence.length && [...trimmed].every((char) => char === fence.marker);
}

export function wikiPlainText(text: string): string {
  return text.replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+#+\s*$/, "").trim();
}

/** The renderer and contents share line positions, fence handling and unique IDs. */
export function getWikiHeadings(content: string): WikiHeading[] {
  const headings: WikiHeading[] = [];
  const used = new Set<string>();
  let fence: WikiFence | null = null;
  content.split("\n").forEach((line, index) => {
    if (fence) {
      if (closesWikiFence(line, fence)) fence = null;
      return;
    }
    fence = openingWikiFence(line);
    if (fence) return;
    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!match) return;
    const title = wikiPlainText(match[2]);
    const base = title.toLocaleLowerCase("ru").normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/[\s-]+/g, "-") || "раздел";
    let id = base;
    let duplicate = 2;
    while (used.has(id)) id = `${base}-${duplicate++}`;
    used.add(id);
    headings.push({ id, title, level: match[1].length as 2 | 3, line: index });
  });
  return headings;
}

export function resolveWikiLink(href: string, articleSlug: string): string {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href) || !/\.md(?:[?#]|$)/.test(href)) return href;
  const url = new URL(href, `https://wiki.invalid/wiki/${articleSlug}`);
  url.pathname = url.pathname.replace(/\.md$/, "");
  if (url.pathname === "/wiki/index") url.pathname = "/wiki";
  return `${url.pathname}${url.search}${url.hash}`;
}
