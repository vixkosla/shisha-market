import {afterEach, describe, expect, it, vi} from "vitest";
import {getWikiArticle, getWikiSlugs} from "@/lib/wiki";
import {articleDescription, serializeStructuredData, wikiArticleMetadata, wikiArticleStructuredData} from "@/lib/wiki-seo";
import {EXAMPLE_LISTING_IDS} from "@/lib/listing-examples";

const mocks = vi.hoisted(() => ({publicListings: vi.fn()}));
vi.mock("@/server/db", () => ({getDatabase: async () => ({})}));
vi.mock("@/server/listings", () => ({listPublicSitemapEntries: mocks.publicListings}));
import sitemap from "@/app/sitemap";

afterEach(() => {vi.unstubAllEnvs(); vi.useRealTimers();});

describe("wiki metadata", () => {
  it("gives each article its own canonical URL, bounded plain description and social preview", () => {
    for (const slug of getWikiSlugs()) {
      const article = getWikiArticle(slug)!;
      const metadata = wikiArticleMetadata(article);
      expect(metadata.alternates?.canonical).toBe(`/wiki/${slug}`);
      expect(metadata.description).toBeTruthy();
      expect(metadata.description!.length).toBeLessThanOrEqual(180);
      expect(metadata.description).not.toMatch(/\*\*|\]\(/);
      expect(metadata.openGraph).toMatchObject({type: "article", url: `/wiki/${slug}`});
      expect(metadata.robots).toEqual({index: !article.reviewPending, follow: true});
      expect(Date.parse(article.modifiedAt)).not.toBeNaN();
    }
    expect(articleDescription({title: "Тема", description: "Длинный текст ".repeat(100)})).toHaveLength(178);
  });
  it("uses visible article breadcrumbs and does not invent a named author, ratings or publication date", () => {
    vi.stubEnv("APP_URL", "https://shisha-market.com/");
    const article = getWikiArticle("guide/contributing")!;
    const [content, breadcrumbs] = wikiArticleStructuredData(article);
    expect(content).toMatchObject({"@type": "Article", headline: article.title, dateModified: article.modifiedAt, mainEntityOfPage: "https://shisha-market.com/wiki/guide/contributing"});
    expect(content).not.toHaveProperty("author");
    expect(content).not.toHaveProperty("datePublished");
    expect(content).not.toHaveProperty("aggregateRating");
    expect(breadcrumbs.itemListElement).toEqual([
      {"@type": "ListItem", position: 1, name: "Атлас", item: "https://shisha-market.com/wiki"},
      {"@type": "ListItem", position: 2, name: "Руководства", item: "https://shisha-market.com/wiki#guide"},
      {"@type": "ListItem", position: 3, name: article.title, item: "https://shisha-market.com/wiki/guide/contributing"},
    ]);
  });
  it("prevents structured data from closing its HTML script element", () => {
    const unsafe = {title: "</script><script>alert(1)</script>"};
    const serialized = serializeStructuredData(unsafe);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(unsafe);
  });
});

describe("complete and stable sitemap", () => {
  it("does not advertise launch examples as real listings in the search sitemap", async () => {
    mocks.publicListings.mockResolvedValue([...EXAMPLE_LISTING_IDS.map(id => ({id})), {id: "real-user-listing"}]);
    const urls = (await sitemap()).map(entry => entry.url);
    for (const id of EXAMPLE_LISTING_IDS) expect(urls.some(url => url.endsWith(`/listings/${id}`))).toBe(false);
    expect(urls.some(url => url.endsWith("/listings/real-user-listing"))).toBe(true);
  });
  it("includes all wiki articles once, current public listings, and excludes private/operator documents", async () => {
    vi.stubEnv("APP_URL", "https://shisha-market.com/");
    const updatedAt = new Date("2026-10-01T10:00:00Z");
    mocks.publicListings.mockResolvedValue([{id: "public-fixture", updatedAt, publishedAt: updatedAt}]);
    const entries = await sitemap();
    const urls = entries.map(entry => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://shisha-market.com/wiki");
    for (const slug of getWikiSlugs()) {
      const url = `https://shisha-market.com/wiki/${slug}`;
      if (getWikiArticle(slug)!.reviewPending) expect(urls).not.toContain(url);
      else expect(urls).toContain(url);
    }
    expect(entries.find(entry => entry.url.endsWith("/listings/public-fixture"))?.lastModified).toEqual(updatedAt);
    expect(urls.some(url => /\/(?:privacy|consent|publication|contact)(?:$|\?)/.test(url))).toBe(false);
    expect(urls.some(url => /\/(?:login|account|admin|stats|support|mcp)$/.test(url))).toBe(false);
    expect(entries.find(entry => entry.url === "https://shisha-market.com/")?.lastModified).toBeUndefined();
  });
  it("does not claim articles changed again when the sitemap is requested later", async () => {
    mocks.publicListings.mockResolvedValue([]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const first = await sitemap();
    vi.setSystemTime(new Date("2026-11-08T00:00:00Z"));
    expect(await sitemap()).toEqual(first);
  });
});
