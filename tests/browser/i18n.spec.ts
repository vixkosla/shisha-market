import { expect, test } from "@playwright/test";

test("language switching updates the shared chrome and keeps the current document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "English version", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("navigation", { name: "Main navigation", exact: true })).toBeVisible();
  await page.goto("/legal/rules");
  await page.getByRole("link", { name: "English version", exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/legal\/rules$/);
  await expect(page.getByRole("heading", { name: "Listing Rules" })).toBeVisible();
  await page.getByRole("link", { name: "Русская версия", exact: true }).first().click();
  await expect(page).toHaveURL(/\/legal\/rules$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.goto("/?q=bowl&category=bowls&city=Москва&page=2#catalog");
  await page.getByRole("link", { name: "English version", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?/);
  const query = new URL(page.url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({ q: "bowl", category: "bowls", city: "Москва", page: "2" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("contentinfo")).toContainText("Developed by");
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Wiki", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("navigation", { name: "Основная навигация", exact: true })).toBeVisible();
});

test("English scaffold, agent resources and canonical metadata", async ({
  page,
  request,
}) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good things",
  );
  await expect(page.getByRole("link", { name: "Русская версия" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/en$/,
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="ru"]'),
  ).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);

  await page.goto("/en/mcp");
  await expect(
    page.getByRole("heading", { name: "MCP for your listings" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.getByRole("link", { name: "/ai/status" })).toHaveAttribute(
    "href",
    "/ai/status",
  );

  await page.goto("/mcp");
  await expect(
    page.getByRole("heading", { name: "Объявления через ИИ" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "/llms.txt" })).toHaveAttribute(
    "href",
    "/llms.txt",
  );

  await page.goto("/en/legal");
  await expect(
    page.getByRole("heading", { name: "Rules and documents" }),
  ).toBeVisible();
  await page.goto("/en/legal/rules");
  await expect(
    page.getByRole("heading", { name: "Listing Rules" }),
  ).toBeVisible();
  await page.goto("/legal/rules");
  await expect(
    page.locator('main a[href="/en/legal/rules"]', {
      hasText: "English version",
    }),
  ).toBeVisible();

  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(llms.headers()["content-type"]).toContain("text/plain");
  expect(await llms.text()).toContain("/ai/status");

  const full = await request.get("/llms-full.txt");
  expect(full.ok()).toBe(true);
  expect(await full.text()).toContain("moderate_listing");

  const status = await request.get("/ai/status");
  expect(status.ok()).toBe(true);
  const body = (await status.json()) as {
    mcp: { tools: string[] };
    analytics: { yandexMetrika: { counterId: number } };
    agentResources: { llms: string };
  };
  expect(body.mcp.tools).toContain("list_my_listings");
  expect(body.mcp.tools).not.toContain("moderate_listing");
  expect(body.analytics.yandexMetrika.counterId).toBe(113672611);
  expect(body.agentResources.llms).toBe("/llms.txt");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toContain("Disallow: /mcp");
  expect(robots).toContain("Disallow: /stats");
});
