import {expect, test} from "@playwright/test";

const removed = ["buying-used-hookah", "compatibility", "pricing", "photos", "posting", "listing-status", "glossary"].map(slug => `/wiki/guide/${slug}`);

test("generic search guides are gone, with no funnels or broken guide links left in the interface", async ({page, request}, testInfo) => {
  for (const path of removed) expect((await request.get(path, {headers: {"User-Agent": "Googlebot"}})).status(), path).toBe(404);
  for (const path of ["/", "/wiki", "/wiki/brands/alpha-hookah"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", {name: "Практические руководства"})).toHaveCount(0);
    await expect(page.getByRole("navigation", {name: "От статьи к действию"})).toHaveCount(0);
    const links = await page.locator("a[href]").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
    for (const href of removed) expect(links, path).not.toContain(href);
  }
  await page.goto("/wiki");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBe(true);
  }
  await page.screenshot({path: testInfo.outputPath("wiki-clean-desktop.png")});
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: testInfo.outputPath("wiki-clean-mobile.png")});
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of removed) expect(xml).not.toContain(path);
});

test("unverified stubs stay accessible, noindex and labeled, independently of deferred notes", async ({page, request}) => {
  await page.goto("/wiki");
  const stub = page.locator('.wiki-entry[href="/wiki/brands/nuke"]');
  await expect(stub).toContainText("На проверке");
  await stub.click();
  expect(await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.name)).toMatch(/\/wiki\/brands\/nuke$/);
  await expect.poll(() => page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("content")))).toEqual(["noindex, follow"]);
  await expect(page.locator(".wiki-review-note")).toContainText("Производитель пока не подтверждён");
  if (process.env.E2E_WIKI_NOTEBOOK_ENABLED === "true") {
    const note = page.getByRole("textbox", {name: "Заметка к статье", exact: true});
    await note.fill("Найти первичный каталог");
    await page.getByRole("button", {name: "Сохранить заметку", exact: true}).click();
    await page.reload();
    await expect(note).toHaveValue("Найти первичный каталог");
  } else await expect(page.locator(".wiki-notebook")).toHaveCount(0);
  const response = await request.get("/wiki/brands/nuke");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/wiki/brands/nuke");
});
