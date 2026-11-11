import { expect, test } from "@playwright/test";

const body = [
  { t: "start", generating: true },
  { t: "status", lane: "wiki", state: "done", text: "Вики: 1 статья" },
  { t: "wiki", groups: [{ rubric: "Аксессуары", items: [{ slug: "categories/accessories", title: "Аксессуары", description: "Комплектующие.", href: "/wiki/categories/accessories", pending: false }] }] },
  { t: "shelf", exact: true, items: [{ id: "ext", title: "HOOB Atom", city: "Москва", priceLabel: "9 000 ₽", categoryLabel: "Кальяны", href: "https://example.test/post", external: true, note: "С другой площадки.", coverId: null }] },
  { t: "terms", items: [{ term: "HMD", text: "Устройство контроля жара.", href: "/wiki/categories/accessories" }] },
  { t: "sources", items: [{ n: 1, title: "Аксессуары", href: "/wiki/categories/accessories", external: false }] },
  { t: "delta", lane: "answer", text: "HMD — устройство контроля жара [1]." },
  { t: "status", lane: "answer", state: "done", text: "Ответ готов" },
  { t: "delta", lane: "journal", text: "Почему слово калауд обманчиво\nМарка и разговорное слово не одно и то же [1]." },
  { t: "delta", lane: "check", text: "- Версия устройства [1]" },
  { t: "follow", items: ["Что такое Lotus"] },
  { t: "done" },
].map(event => JSON.stringify(event)).join("\n") + "\n";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/live?*", route => route.fulfill({ status: 200, contentType: "application/x-ndjson", body }));
});

test("typing scrolls the bar to the top over the live spread and Escape brings the catalog back", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "С чего начать" })).toBeVisible();
  const input = page.getByRole("searchbox", { name: "Поиск по сайту" });
  await input.fill("Что такое HMD");
  await expect(page.getByRole("heading", { level: 1, name: "Что такое HMD" })).toBeVisible();
  // The hero stays above; the catalog and the starting blocks give way to the results.
  await expect(page.locator("#catalog")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "С чего начать" })).toBeHidden();
  await expect.poll(async () => (await input.boundingBox())?.y ?? 999).toBeLessThan(60);
  await expect(page).toHaveURL(/\?ask=/);
  const answer = page.getByRole("region", { name: "Результаты поиска" }).locator("article");
  await expect(answer).toContainText("устройство контроля жара");
  await expect(answer.getByRole("link", { name: "1", exact: true })).toHaveAttribute("href", "/wiki/categories/accessories");
  await expect(page.getByRole("heading", { name: "Почему слово калауд обманчиво" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Что проверить у продавца" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Витрина объявлений" }).getByRole("link", { name: /HOOB Atom/ })).toHaveAttribute("rel", /nofollow/);
  await expect(page.getByRole("term")).toContainText("HMD");
  await page.keyboard.press("Escape");
  await expect(page.locator("#catalog")).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page).toHaveURL(/\/$/);
});

test("a shared link opens the spread and the back button leaves it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Что такое HMD" }).click();
  await expect(page.locator("#catalog")).toBeHidden();
  await page.goBack();
  await expect(page.locator("#catalog")).toBeVisible();
  await page.goto("/?ask=" + encodeURIComponent("Что такое HMD"));
  await expect(page.getByRole("heading", { level: 1, name: "Что такое HMD" })).toBeVisible();
  await expect(page.locator("#catalog")).toBeHidden();
});

test("the spread stays within a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto("/?ask=" + encodeURIComponent("Что такое HMD"));
  await expect(page.getByRole("heading", { name: "Вики по рубрикам" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
