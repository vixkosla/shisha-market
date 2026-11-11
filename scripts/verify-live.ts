import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.LIVE_URL ?? "https://SERVER_IP";
const reviewDir = ".data/review-vps";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1080 },
  proxy: process.env.LIVE_PROXY ? { server: process.env.LIVE_PROXY } : undefined,
});
await context.tracing.start({ screenshots: true, snapshots: true });
await mkdir(reviewDir, { recursive: true, mode: 0o700 });
try {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED")
      console.info("Request failed:", new URL(request.url()).pathname, request.failure()?.errorText);
  });
  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  const onIpPreview = new URL(baseURL).hostname === "SERVER_IP";
  if (onIpPreview) expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Хорошим вещам");
  await page.screenshot({ path: `${reviewDir}/desktop.png`, fullPage: true });
  await page.getByRole("link", { name: "Войти", exact: true }).click();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.goto("/listings/new");
  await expect(page).toHaveURL(`${baseURL}/login`);
  for (const path of ["/account", "/favorites", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(`${baseURL}/login`);
  }
  await page.goto("/");
  await page.getByRole("textbox", { name: "Что ищем?" }).fill("чаша");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Пока ничего не нашлось" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${reviewDir}/mobile.png`, fullPage: true });
  // Use the same real browser TLS/network path, including an optional SOCKS proxy.
  // Do not disable certificate validation in the separate Node request client.
  const health = await page.evaluate(async () => {
    const response = await fetch("/api/health");
    return { status: response.status, body: await response.json() };
  });
  expect(health.status).toBe(200);
  expect(health.body).toEqual({ status: "ok" });
  expect(await page.evaluate(async () => (await fetch("/api/auth/get-session")).status)).toBe(200);
  expect(await page.evaluate(async () => (await fetch("/media/nonexistent")).status)).toBe(404);
  expect(errors).toEqual([]);
  console.info(`Trusted HTTPS (${process.env.LIVE_PROXY ? "isolated SSH proxy" : "direct network"}), desktop/mobile layout, actual navigation/search, private route redirects, open email sign-in, health and browser errors: passed.`);
} finally {
  await context.tracing.stop({ path: `${reviewDir}/trace.zip` });
  await browser.close();
}
