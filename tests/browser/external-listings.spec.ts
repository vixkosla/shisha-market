import {expect, test} from "@playwright/test";
import {getExternalListings} from "../../src/lib/external-listings";

test("external offers have working source, seller and removal paths without masquerading as user listings", async ({page}, testInfo) => {
  const items = getExternalListings();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("[data-external-listing]")).toHaveCount(items.length);
  if (!items.length) {
    await expect(page.locator("[data-external-listings]")).toHaveCount(0);
    return;
  }
  const retained = page.locator('[data-external-listing="hookah-guru-118"]');
  await expect(retained).toHaveAttribute("data-external-state", "needs_review");
  await expect(retained).toContainText("Актуальность нужно уточнить");
  await expect(retained.locator("time").first()).toHaveAttribute("datetime", "2026-10-18T20:38:13Z");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 1000});
    const section = page.locator("[data-external-listings]");
    await section.scrollIntoViewIfNeeded();
    await expect(section).toContainText("наличие и условия уточняйте напрямую");
    for (const item of items) {
      const card = page.locator(`[data-external-listing="${item.id}"]`);
      await expect(card).toContainText("Внешнее объявление");
      await expect(card.locator("time")).toHaveCount(2);
      await expect(card.getByRole("link", {name: `Написать продавцу: ${item.title}`, exact: true})).toHaveAttribute("href", item.contactUrl);
      await expect(card.getByRole("link", {name: `Фото и оригинал: ${item.title}`, exact: true})).toHaveAttribute("href", item.sourceUrl);
      await expect(card.locator('a[href^="/listings/"]')).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await page.screenshot({path: testInfo.outputPath(`external-${width}.png`)});
  }
  const first = page.locator("[data-external-listing]").first();
  // Intercept the public destination to test the actual click without contacting a seller.
  await page.context().route(items[0].contactUrl, route => route.fulfill({contentType: "text/html", body: "<title>Public seller link</title>"}));
  const popupPromise = page.waitForEvent("popup");
  await first.getByRole("link", {name: `Написать продавцу: ${items[0].title}`, exact: true}).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toBe(items[0].contactUrl);
  await popup.close();
  await first.getByRole("link", {name: "Неактуально или нужно удалить?"}).click();
  await expect(page.locator("#external-report")).toContainText(items[0].title);
  await expect(page.locator('#external-report a[href^="mailto:"]')).toHaveAttribute("href", new RegExp(encodeURIComponent(items[0].id)));
  await page.goto("/?city=Уфа&category=hookahs&q=darkside");
  await expect(page.locator("[data-external-listing]")).toHaveCount(1);
  await expect(page.locator(".empty-state")).toHaveCount(0);
  await page.goto("/?category=bowls");
  await expect(page.locator("[data-external-listing]")).toHaveCount(0);
  await page.goto("/en");
  await expect(page.locator("[data-external-listings]")).toContainText("External listing");
  expect(errors).toEqual([]);
});
