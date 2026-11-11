import { expect, test } from "@playwright/test";

test("operator documents remain accessible but are excluded from search indexing", async ({ page, request }) => {
  const operatorPaths = [
    "/legal/privacy",
    "/legal/consent",
    "/legal/publication",
    "/legal/contact",
    "/en/legal/privacy",
    "/en/legal/contact",
  ];
  for (const path of operatorPaths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(response?.headers()["x-robots-tag"], path).toBe("noindex, follow, nosnippet");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, follow, nosnippet",
    );
  }

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  for (const path of operatorPaths) expect(xml).not.toContain(path);
  for (const path of ["/legal/rules", "/legal/terms", "/legal/cookies", "/en/legal/rules"])
    expect(xml).toContain(path);

  // Crawlers must be able to fetch these documents to see the noindex rule.
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toMatch(/Disallow:\s*\/(?:en\/)?legal/);
  await page.goto("/legal");
  await page.getByRole("link", { name: "Оператор и обращения →", exact: true }).click();
  await expect(page).toHaveURL(/\/legal\/contact$/);

  for (const path of ["/", "/legal/rules", "/en/legal/rules"]) {
    const response = await page.goto(path);
    expect(response?.headers()["x-robots-tag"], path).toBeUndefined();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  }
});
