import {expect, test} from "@playwright/test";
import {EXAMPLE_LISTING_IDS} from "../../src/lib/listing-examples";

test("launch examples are unmistakable on photos and detail pages, never offer contact or enter the sitemap", async ({page, request}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const path = `/listings/${EXAMPLE_LISTING_IDS[0]}`;
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 844], [768, 1000]]) {
    await page.setViewportSize({width, height});
    await page.goto("/");
    const card = page.locator(`a.listing-card[href="${path}"]`);
    await expect(card).toHaveAttribute("data-example", "true");
    await expect(card.locator(".listing-example-label")).toHaveText("Пример объявления · не продаётся");
    await expect(card).toContainText("Условная цена");
    await expect(page.locator(".listing-example-notice")).toContainText("не предложения о продаже");
    await card.scrollIntoViewIfNeeded();
    const badge = (await card.locator(".listing-example-label").boundingBox())!;
    const photo = (await card.locator(".card-image").boundingBox())!;
    expect(badge.width).toBeGreaterThan(200);
    expect(badge.y).toBeGreaterThanOrEqual(photo.y);
    expect(badge.y + badge.height).toBeLessThanOrEqual(photo.y + photo.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await card.screenshot({path: testInfo.outputPath(`example-card-${width}.png`)});
    await card.click();
    await expect(page.locator(".listing-example-notice")).toContainText("не предложения о продаже");
    await expect(page.locator(".gallery-example-photo .listing-example-label")).toHaveCount(1);
    await expect(page.locator(".gallery-example-photo img")).toBeVisible();
    await expect.poll(() => page.locator(".gallery-example-photo img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.getByRole("link", {name: /Связаться с продавцом/})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "В избранное", exact: true})).toHaveCount(0);
    await expect(page.locator(".detail-price")).toContainText("Условная цена");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await page.screenshot({path: testInfo.outputPath(`example-detail-${width}.png`), fullPage: true});
  }
  await page.goto("/en");
  const english = page.locator(`a.listing-card[href="${path}"]`);
  await expect(english.locator(".listing-example-label")).toHaveText("Example listing · not for sale");
  await expect(english).toContainText("Illustrative price");
  await expect(page.locator(".listing-example-notice")).toContainText("not offers for sale");
  const response = await request.get(path, {headers: {"User-Agent": "Googlebot"}});
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(path);
  expect(errors).toEqual([]);
});
