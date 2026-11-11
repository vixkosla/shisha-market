import {expect, test} from "@playwright/test";
import {getWikiArticle, getWikiSlugs} from "../../src/lib/wiki";

test("sitemap contains current references, not private documents or withdrawn general articles", async ({request}) => {
  const first = await request.get("/sitemap.xml");
  expect(first.status()).toBe(200);
  const xml = await first.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls).toContain("http://127.0.0.1:4388/wiki");
  for (const slug of getWikiSlugs()) {
    const url = `http://127.0.0.1:4388/wiki/${slug}`;
    if (getWikiArticle(slug)!.reviewPending) expect(urls).not.toContain(url);
    else expect(urls).toContain(url);
  }
  expect(urls.filter(url => new URL(url).pathname.startsWith("/wiki/"))).toHaveLength(getWikiSlugs().filter(slug => !getWikiArticle(slug)!.reviewPending).length);
  for (const path of ["/legal/privacy", "/legal/consent", "/legal/contact", "/legal/publication", "/en/legal/privacy", "/en/legal/contact", "/login", "/account", "/stats", "/mcp", "/wiki/guide/posting"]) expect(urls.map(url => new URL(url).pathname)).not.toContain(path);
  const home = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].find(match => match[1].includes("<loc>http://127.0.0.1:4388/</loc>"))!;
  expect(home[1]).not.toContain("<lastmod>");
  expect(await (await request.get("/sitemap.xml")).text()).toBe(xml);
});

test("remaining reference articles retain canonical metadata and matching safe structured data", async ({page, request}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const slug of getWikiSlugs()) {
    const response = await request.get(`/wiki/${slug}`, {headers: {"User-Agent": "Googlebot"}});
    expect(response.status(), slug).toBe(200);
    const html = await response.text();
    expect(html, slug).toContain(`rel="canonical" href="http://127.0.0.1:4388/wiki/${slug}"`);
    expect(html, slug).toContain(`name="robots" content="${getWikiArticle(slug)!.reviewPending ? "noindex" : "index"}, follow"`);
  }
  await page.goto("/wiki/brands/alpha-hookah");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://127.0.0.1:4388/wiki/brands/alpha-hookah");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", page.url());
  const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
  const data = structured.flatMap(text => JSON.parse(text));
  const article = data.find(item => item["@type"] === "Article");
  expect(article.mainEntityOfPage).toBe(page.url());
  expect(article.headline).toBe(await page.getByRole("heading", {level: 1}).textContent());
  expect(data.find(item => item["@type"] === "BreadcrumbList").itemListElement.at(-1).item).toBe(page.url());
  await expect(page.getByRole("navigation", {name: "От статьи к действию"})).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBe(true);
  }
  await page.screenshot({path: testInfo.outputPath("wiki-reference-desktop.png"), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: testInfo.outputPath("wiki-reference-mobile.png"), fullPage: true});
  await page.getByRole("link", {name: "Подать объявление", exact: true}).click();
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fnew$/);
  expect((await request.get("/wiki/guide/not-real")).status()).toBe(404);
  expect(errors).toEqual([]);
});
