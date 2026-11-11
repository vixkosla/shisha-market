import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "@/components/markdown";
import { WikiDirectory } from "@/components/wiki/wiki-directory";
import { WikiArticleReader } from "@/components/wiki/wiki-article-reader";
import { getWikiArticle, getWikiDirectory, getWikiSlugs } from "@/lib/wiki";
import { filterWikiEntries, WIKI_ROUTE } from "@/lib/wiki-catalog";
import { getWikiHeadings, resolveWikiLink } from "@/lib/wiki-markdown";
import { readWikiNotebook, writeWikiPersonalEntry, WIKI_NOTEBOOK_KEY } from "@/lib/wiki-notebook";
import { wikiNotebookEnabled } from "@/lib/wiki-features";

describe("wiki directory and route boundary", () => {
  it("discovers every allowed article, sorts titles and uses the same group for breadcrumbs", () => {
    const entries = getWikiDirectory();
    expect(entries.map((entry) => entry.slug).sort()).toEqual(getWikiSlugs());
    expect(entries.map((entry) => entry.title)).toEqual(entries.map((entry) => entry.title).sort((a, b) => a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" })));
    for (const entry of entries) expect(entry.categoryLabel).toBe(getWikiArticle(entry.slug)?.categoryLabel);
    for (const slug of WIKI_ROUTE) expect(entries.some((entry) => entry.slug === slug)).toBe(true);
    for (const slug of ["index", "../package", "brands/../../package", "brands/missing-article", "/brands/kaloud", "brands/kaloud.md"]) expect(getWikiArticle(slug), slug).toBeNull();
  });

  it("searches both descriptions and titles, combines filters and returns a real empty result", () => {
    const entries = getWikiDirectory();
    expect(filterWikiEntries(entries, " daRKside ", "all").map((entry) => entry.slug)).toContain("brands/darkside");
    expect(filterWikiEntries(entries, "водяной фильтр", "categories").map((entry) => entry.slug)).toContain("categories/hookahs");
    expect(filterWikiEntries(entries, "Darkside", "guide")).toEqual([]);
    expect(filterWikiEntries(entries, "совсемнесуществующаястатья", "all")).toEqual([]);
    const saved = new Set(["brands/kaloud", "categories/hookahs"]);
    expect(filterWikiEntries(entries, "", "saved", saved).map((entry) => entry.slug).sort()).toEqual([...saved].sort());
  });

  it("shows existing article descriptions in directory rows", () => {
    const entries = getWikiDirectory().filter((entry) => entry.slug === "categories/hookahs");
    const html = renderToStaticMarkup(createElement(WikiDirectory, { entries }));
    expect(html).toContain("водяной фильтр");
    expect(html).not.toContain("Устройство · Материалы шахты");
  });
});

describe("wiki headings and Markdown", () => {
  const sample = ["# Статья", "", "## Уход и **материалы**", "### Один раздел", "## Уход и материалы", "## Уход и материалы 2", "## Уход и материалы", "```markdown", "## Не оглавление", "```", "~~~", "### Тоже пример", "~~~", "## Финал"].join("\n");

  it("keeps duplicate anchors unique and ignores both fenced example styles", () => {
    const headings = getWikiHeadings(sample);
    expect(headings.map((heading) => heading.id)).toEqual(["уход-и-материалы", "один-раздел", "уход-и-материалы-2", "уход-и-материалы-2-2", "уход-и-материалы-3", "финал"]);
    expect(headings.some((heading) => heading.title.includes("пример") || heading.title.includes("оглавление"))).toBe(false);
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content: sample, articleSlug: "guide/test", skipTitle: true }));
    expect(html).not.toContain("<h1");
    for (const heading of headings) expect(html).toContain(`id="${heading.id}"`);
    expect(html).toContain("## Не оглавление");
    expect(html).not.toContain('id="не-оглавление"');
  });

  it("preserves nested related links, scrollable tables and literal code", () => {
    expect(resolveWikiLink("../categories/hookahs.md#устройство", "brands/darkside")).toBe("/wiki/categories/hookahs#%D1%83%D1%81%D1%82%D1%80%D0%BE%D0%B9%D1%81%D1%82%D0%B2%D0%BE");
    expect(resolveWikiLink("../index.md", "guide/contributing")).toBe("/wiki");
    const hookahs = getWikiArticle("categories/hookahs")!;
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content: hookahs.content, articleSlug: hookahs.slug, skipTitle: true }));
    expect(html).toContain('role="region" tabindex="0" aria-label="Таблица:');
    expect(html).toContain('scope="col"');
    expect(html).toContain('aria-label="Таблица: Основные элементы"');
    expect(html).not.toContain("Прокрутите таблицу вбок");
    expect(html).toContain('href="/wiki/categories/bowls"');
    const guide = getWikiArticle("guide/contributing")!;
    const guideHtml = renderToStaticMarkup(createElement(MarkdownRenderer, { content: guide.content, articleSlug: guide.slug }));
    expect(guideHtml).toContain("<ol>");
    expect(guideHtml).toContain("git checkout -b wiki/my-article");
    expect(guideHtml).not.toContain('href="/wiki/guide/relative/path"');
    expect(getWikiHeadings(guide.content).map((heading) => heading.title)).not.toContain("Раздел");
  });

  it("continues past empty heading markers instead of stalling the parser", () => {
    const content = "## \n### \n\nОбычный абзац\n\n## Настоящий раздел\nТекст после раздела";
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content, articleSlug: "guide/test" }));
    expect(html).toContain("Обычный абзац");
    expect(html).toContain('id="настоящий-раздел"');
    expect(html).toContain("Текст после раздела");
    expect(getWikiHeadings(content).map((heading) => heading.title)).toEqual(["Настоящий раздел"]);
  });
});

describe("browser-local notebook persistence", () => {
  it("requires an explicit opt-in and is disabled for missing or unrecognized configuration", () => {
    for (const value of [undefined, "", "false", "1", "TRUE"]) expect(wikiNotebookEnabled(value)).toBe(false);
    expect(wikiNotebookEnabled("true")).toBe(true);
  });

  it("omits personal tools and their promotional copy from default server-rendered wiki pages", () => {
    const entries = getWikiDirectory();
    const entry = entries.find(item => item.slug === "categories/hookahs")!;
    const directory = renderToStaticMarkup(createElement(WikiDirectory, {entries}));
    const reader = renderToStaticMarkup(createElement(WikiArticleReader, {entry, headings: [], directory: entries}, "Справочный текст"));
    for (const html of [directory, reader]) {
      expect(html).not.toMatch(/Мои заметки|Сохранить статью|Отметить прочитанным|Ваш полевой блокнот|Сохранённое|#my-notes|Отмечайте темы прочитанными|личный блокнот/);
    }
    expect(directory).toContain("Найти статью");
    expect(reader).toContain("Справочный текст");
    expect(reader).toContain("Содержание");
  });

  it("retains the deferred notebook interface behind an explicit component opt-in", () => {
    const entries = getWikiDirectory();
    const entry = entries.find(item => item.slug === "categories/hookahs")!;
    const directory = renderToStaticMarkup(createElement(WikiDirectory, {entries, notebookEnabled: true}));
    const reader = renderToStaticMarkup(createElement(WikiArticleReader, {entry, headings: [], directory: entries, notebookEnabled: true}, "Справочный текст"));
    expect(directory).toContain("Ваш полевой блокнот");
    expect(directory).toContain("Сохранённое");
    expect(reader).toContain("Мои заметки");
    expect(reader).toContain("Сохранить статью");
    expect(reader).toContain("Отметить прочитанным");
  });

  function memoryStorage() {
    const items = new Map<string, string>();
    return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); } };
  }

  it("retains notes, saved/read state and another article when writing or clearing", () => {
    const storage = memoryStorage();
    writeWikiPersonalEntry(storage, "brands/kaloud", { saved: true });
    writeWikiPersonalEntry(storage, "categories/hookahs", { read: true, note: "Проверить размеры" });
    writeWikiPersonalEntry(storage, "brands/kaloud", { note: "Моя заметка" });
    const recovered = readWikiNotebook(storage);
    expect(recovered["brands/kaloud"]).toEqual({ saved: true, read: false, note: "Моя заметка" });
    expect(recovered["categories/hookahs"]).toEqual({ saved: false, read: true, note: "Проверить размеры" });
    writeWikiPersonalEntry(storage, "brands/kaloud", { note: "", saved: false });
    expect(readWikiNotebook(storage)["brands/kaloud"].note).toBe("");
    expect(readWikiNotebook(storage)["categories/hookahs"].note).toBe("Проверить размеры");
  });

  it("does not report success or overwrite data after a failed write or corrupt storage", () => {
    const storage = memoryStorage();
    writeWikiPersonalEntry(storage, "brands/kaloud", { note: "Прежняя заметка" });
    const blocked = { getItem: storage.getItem, setItem: () => { throw new Error("Quota exceeded"); } };
    expect(() => writeWikiPersonalEntry(blocked, "brands/kaloud", { note: "Новая заметка" })).toThrow();
    expect(readWikiNotebook(storage)["brands/kaloud"].note).toBe("Прежняя заметка");
    storage.setItem(WIKI_NOTEBOOK_KEY, "invalid json");
    expect(() => writeWikiPersonalEntry(storage, "brands/kaloud", { saved: true })).toThrow();
    expect(storage.getItem(WIKI_NOTEBOOK_KEY)).toBe("invalid json");
    expect(() => readWikiNotebook({ getItem: () => { throw new Error("Denied"); }, setItem: storage.setItem })).toThrow();
  });
});
