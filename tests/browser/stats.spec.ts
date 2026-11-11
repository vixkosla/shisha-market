import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import type { PublicStats } from "@/server/public-stats";

// Public values observed on /stats before this layout change. Render the actual
// presentation component with its route's CSS; no production tokens or test
// data switches are introduced into the application.
const report: PublicStats = {
  refreshedAt: "2026-10-21T12:58:05.264Z",
  counterId: 113672611,
  metrika: {
    ok: true, startDate: "2026-09-23", endDate: "2026-10-20",
    visits: 6, users: 6, pageviews: 6,
    sources: [{ label: "Прямые заходы", visits: 6 }],
    devices: [{ label: "ПК", visits: 5 }, { label: "Смартфоны", visits: 1 }],
  },
  google: {
    ok: true, startDate: "2026-09-23", endDate: "2026-10-20",
    clicks: 0, impressions: 0, queries: [],
  },
};

async function showReport(page: Page, data: PublicStats) {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Статистика", exact: true })).toBeVisible();
  // Playwright rewrites imported JSX into component-test descriptors. Render in
  // a plain Node process so React receives the application's actual elements.
  const html = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import {readFileSync} from 'node:fs';
    import {createElement} from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {StatsOverview} from './src/components/stats-overview.tsx';
    process.stdout.write(renderToStaticMarkup(createElement(StatsOverview, {
      report: JSON.parse(readFileSync(0, 'utf8')),
    })));
  `], { input: JSON.stringify(data), encoding: "utf8" });
  await page.locator("main").evaluate((main, markup) => { main.innerHTML = markup; }, html);
}

test("stats layout separates sources and fits desktop, tablet and narrow phones", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await showReport(page, report);
  const visits = page.getByRole("article", { name: "Яндекс Метрика" });
  const search = page.getByRole("article", { name: "Google Search Console" });
  await expect(visits.locator("dd")).toHaveText(["6", "6", "6"]);
  await expect(search.locator("dd")).toHaveText(["0", "0"]);
  await expect(search).toContainText("Google не передал запросы за этот период");
  await expect(page.locator("time")).toHaveAttribute("datetime", report.refreshedAt);
  await expect(page.locator("time")).toContainText("МСК");
  for (const width of [1440, 1051, 1050, 1024, 768, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px page overflow`).toBe(true);
    const geometry = await page.locator(".stats-source").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
    }));
    if (width > 1050) {
      expect(Math.abs(geometry[0].y - geometry[1].y)).toBeLessThan(1);
      expect(geometry[1].x - geometry[0].right).toBeGreaterThanOrEqual(20);
    } else expect(geometry[1].y - geometry[0].bottom).toBeGreaterThanOrEqual(17);
    const columns = await page.locator(".stats-metrics-search").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(2);
    if (width === 1440 || width === 390)
      await page.screenshot({ path: testInfo.outputPath(`stats-${width}.png`), fullPage: true, animations: "disabled" });
  }
  expect(errors).toEqual([]);
});

test("stats route shows unavailable sources without inventing zero totals", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.locator(".stats-unavailable")).toHaveCount(2);
  await expect(page.locator(".stats-metric")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("banner").getByRole("link", { name: "Объявления", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Хорошим вещам");
});

test("stats breakdowns keep long labels readable and zero reports distinct from errors", async ({ page }) => {
  const data: PublicStats = {
    ...report,
    metrika: {
      ok: true, startDate: "2026-09-23", endDate: "2026-10-20",
      visits: 0, users: 0, pageviews: 0, sources: [], devices: [],
    },
    google: {
      ok: true, startDate: "2026-09-23", endDate: "2026-10-20",
      clicks: 3, impressions: 22,
      queries: [{ label: "очень-длинный-поисковый-запрос-без-пробелов-для-проверки-мобильной-верстки", visits: 3 }],
    },
  };
  await showReport(page, data);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".stats-source-visits dd")).toHaveText(["0", "0", "0"]);
    await expect(page.locator(".stats-unavailable")).toHaveCount(0);
    await expect(page.getByText(data.google.ok ? data.google.queries[0].label : "")).toBeVisible();
  }
});
