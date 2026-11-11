import fs from "fs";
import path from "path";
import { WIKI_GROUPS, type WikiDirectoryEntry } from "./wiki-catalog";
import { getWikiHeadings, wikiPlainText } from "./wiki-markdown";
import { wikiReviewPending } from "./wiki-review";

export interface WikiArticle {
  slug: string;
  title: string;
  description: string;
  content: string;
  path: string;
  category: string | null;
  categoryLabel: string | null;
  modifiedAt: string;
  reviewPending: boolean;
}

const wikiDir = path.join(process.cwd(), "content", "wiki");

const categoryMap: Record<string, string> = Object.fromEntries(WIKI_GROUPS.map((group) => [group.id, group.title]));

function parseMarkdownTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? wikiPlainText(match[1]) : "Без названия";
}

function parseMarkdownDescription(content: string): string {
  // Get first paragraph after title
  const lines = content.split("\n");
  let foundTitle = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && line.trim() !== "" && !line.startsWith("#")) {
      return wikiPlainText(line);
    }
  }
  return "";
}

export function getWikiSlugs(): string[] {
  const slugs: string[] = [];

  function scanDir(dir: string, prefix = ""): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "index.md" || entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const slug = prefix
          ? `${prefix}/${entry.name.replace(/\.md$/, "")}`
          : entry.name.replace(/\.md$/, "");
        slugs.push(slug);
      }
    }
  }

  scanDir(wikiDir);
  return slugs.sort();
}

export function getWikiDirectory(): WikiDirectoryEntry[] {
  return getWikiSlugs().flatMap((slug) => {
    const article = readWikiArticle(slug);
    if (!article) return [];
    const sections = getWikiHeadings(article.content).filter((heading) => heading.level === 2);
    return [{ slug: article.slug, title: article.title, description: article.description, category: article.category ?? "other", categoryLabel: article.categoryLabel ?? "Статьи", sectionCount: sections.length, outline: sections.slice(0, 3).map((heading) => heading.title), reviewPending: article.reviewPending }];
  }).sort((a, b) => a.title.localeCompare(b.title, "ru", { numeric: true, sensitivity: "base" }));
}

export function getWikiArticle(slug: string): WikiArticle | null {
  if (!getWikiSlugs().includes(slug)) return null;
  return readWikiArticle(slug);
}

// Only called with a discovered/allowlisted slug. Avoid scanning the directory again
// for every article when rendering the atlas; no process cache hides file changes.
function readWikiArticle(slug: string): WikiArticle | null {
  const filePath = path.join(wikiDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const title = parseMarkdownTitle(content);
  const description = parseMarkdownDescription(content);

  const parts = slug.split("/");
  const categoryDir = parts.length > 1 ? parts[0] : null;

  return {
    slug,
    title,
    description,
    content,
    path: slug,
    category: categoryDir,
    categoryLabel: categoryDir ? categoryMap[categoryDir] || categoryDir : null,
    modifiedAt: fs.statSync(filePath).mtime.toISOString(),
    reviewPending: wikiReviewPending(slug),
  };
}
