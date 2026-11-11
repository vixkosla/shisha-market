import {describe, expect, it} from "vitest";
import {getWikiArticle, getWikiDirectory, getWikiSlugs} from "@/lib/wiki";
import {filterWikiEntries} from "@/lib/wiki-catalog";
import {closesWikiFence, getWikiHeadings, openingWikiFence, resolveWikiLink, type WikiFence} from "@/lib/wiki-markdown";
import {WIKI_PENDING_REVIEW} from "@/lib/wiki-review";
import {NextRequest} from "next/server";
import {proxy} from "@/proxy";

describe("wiki editorial boundaries", () => {
  it("backs up withheld-reference metadata with an HTTP indexing directive, without changing ready pages", () => {
    for (const slug of WIKI_PENDING_REVIEW) expect(proxy(new NextRequest(`https://shisha-market.com/wiki/${slug}`)).headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(proxy(new NextRequest("https://shisha-market.com/wiki/brands/alpha-hookah")).headers.get("X-Robots-Tag")).toBeNull();
    expect(proxy(new NextRequest("https://shisha-market.com/legal/privacy")).headers.get("X-Robots-Tag")).toBe("noindex, follow, nosnippet");
  });
  it("keeps unverified legacy identities accessible and explicitly marked, rather than fabricating their history", () => {
    expect(WIKI_PENDING_REVIEW.size).toBe(5);
    for (const slug of WIKI_PENDING_REVIEW) {
      const article = getWikiArticle(slug)!;
      expect(article, slug).toBeTruthy();
      expect(article.reviewPending, slug).toBe(true);
      expect(getWikiDirectory().find(entry => entry.slug === slug)?.reviewPending).toBe(true);
      expect(article.content, slug).toMatch(/не подтвержд|не установлен|неподтвержд|неподтверждён/);
    }
  });

  it("requires a source section and a review date for every publishable manufacturer article and category", () => {
    for (const slug of getWikiSlugs().filter(slug => /^(brands|categories)\//.test(slug))) {
      const article = getWikiArticle(slug)!;
      if (article.reviewPending) continue;
      expect(article.content, slug).toContain("## Источники");
      expect(article.content, slug).toContain("22 октября 2026");
      const sources = article.content.split("## Источники")[1];
      expect(sources, slug).toMatch(/\]\(https:\/\//);
      expect(article.content, slug).not.toMatch(/\*\*Модели:\*\*|\*\*Крепость:\*\*|\*\*Цена:\*\*/);
    }
  });

  it("keeps only editorial guides and never rediscovers removed generic search articles", () => {
    const removed = ["buying-used-hookah", "compatibility", "photos", "pricing", "posting", "listing-status", "glossary"];
    expect(getWikiSlugs().filter(slug => slug.startsWith("guide/"))).toEqual(["guide/contributing", "guide/style-guide"]);
    for (const slug of removed) expect(getWikiArticle(`guide/${slug}`)).toBeNull();
    const entries = getWikiDirectory();
    expect(filterWikiEntries(entries, "Альфа Хука", "brands").map(entry => entry.slug)).toContain("brands/alpha-hookah");
    expect(filterWikiEntries(entries, "Материалы", "categories").map(entry => entry.slug)).toContain("categories/hookahs");
  });

  it("does not pad reference articles with generic second-hand selling checklists or empty sections", () => {
    for (const slug of getWikiSlugs().filter(slug => /^(brands|categories)\//.test(slug))) {
      const content = getWikiArticle(slug)!.content;
      expect(content, slug).not.toMatch(/^## (?:Что указать при продаже|Как описать б\/у|Что проверить у б\/у|Проверка б\/у|Как проверить комплект|Что уточнить у продавца|Чаша Tangiers в б\/у)/m);
      expect(content.trimEnd().split("\n").at(-1), slug).not.toMatch(/^## /);
    }
  });

  it("keeps internal article links and fragment identifiers valid outside code examples", () => {
    for (const slug of getWikiSlugs()) {
      let fence: WikiFence | null = null;
      for (const line of getWikiArticle(slug)!.content.split("\n")) {
        if (fence) {if (closesWikiFence(line, fence)) fence = null; continue;}
        fence = openingWikiFence(line);
        if (fence) continue;
        for (const match of line.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
          const href = resolveWikiLink(match[1], slug);
          if (!href.startsWith("/wiki/")) continue;
          const url = new URL(href, "https://wiki.invalid");
          const target = getWikiArticle(url.pathname.slice("/wiki/".length));
          expect(target, `${slug} → ${href}`).not.toBeNull();
          if (url.hash) expect(getWikiHeadings(target!.content).map(heading => heading.id), href).toContain(decodeURIComponent(url.hash.slice(1)));
        }
      }
    }
  });
});
