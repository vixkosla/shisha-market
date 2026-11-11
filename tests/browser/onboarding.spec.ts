import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

async function codeFor(page: Page, email: string) {
  await page.getByLabel("Электронная почта").fill(email);
  for (const name of [/Мне исполнилось/, /Принимаю пользовательское/, /Даю отдельное/]) await page.getByRole("checkbox", {name}).check();
  let started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    started = Date.now();
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/auth/email-otp/send-verification-otp") && response.request().method() === "POST");
    await page.getByRole("button", {name: "Получить код", exact: true}).click();
    const response = await waiting;
    if (response.status() !== 429) {expect(response.ok()).toBe(true); break;}
    await page.waitForTimeout(Number(response.headers()["retry-after"] ?? response.headers()["x-retry-after"] ?? 60) * 1000 + 1100);
  }
  await expect(page.getByLabel("Код из письма")).toBeFocused();
  let otp = "";
  await expect.poll(async () => {
    const lines = (await readFile(".data/e2e-mailbox.jsonl", "utf8")).trim().split("\n").map(line => JSON.parse(line));
    otp = lines.findLast(mail => mail.email === email && mail.time >= started)?.otp ?? "";
    return !!otp;
  }).toBe(true);
  return otp;
}

async function signIn(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const button = page.getByRole("button", {name: /^Войти$|^Повторить вход через/});
    await expect(button).toBeEnabled({timeout: 65000});
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/auth/sign-in/email-otp") && response.request().method() === "POST");
    await button.click();
    const response = await waiting;
    if (response.status() !== 429) {expect(response.ok()).toBe(true); return;}
    await expect(page.getByRole("main").getByRole("alert")).toContainText("отсчёта");
    await page.waitForTimeout(Number(response.headers()["retry-after"] ?? response.headers()["x-retry-after"] ?? 60) * 1000 + 1100);
  }
  throw new Error("Sign-in did not recover after its retry window");
}

test("first visitor returns to the form, restores a private draft, reviews photos and reaches a public listing", async ({page, browser}) => {
  test.setTimeout(180000);
  const review = "docs/reviews/onboarding-2026-10-22";
  await mkdir(review, {recursive: true});
  await page.setViewportSize({width: 390, height: 844});
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", {name: "Подать объявление", exact: true}).click();
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fnew$/);
  await expect(page.getByText(/После входа сразу откроется форма/)).toBeVisible();
  await page.screenshot({path: `${review}/after-login-mobile.png`, fullPage: true});
  const otp = await codeFor(page, `onboarding-${Date.now()}@e2e.example.test`);
  await expect(page.getByRole("status")).toContainText("Код отправлен");
  await expect(page.getByRole("button", {name: /Отправить снова через/})).toBeDisabled();
  await page.getByLabel("Код из письма").fill(otp === "000000" ? "111111" : "000000");
  await page.getByRole("button", {name: "Войти", exact: true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Код неверный");
  await page.getByLabel("Код из письма").evaluate((input, value) => {
    const transfer = new DataTransfer(); transfer.setData("text", `${value.slice(0, 3)} ${value.slice(3)}`);
    input.dispatchEvent(new ClipboardEvent("paste", {clipboardData: transfer, bubbles: true, cancelable: true}));
  }, otp);
  await expect(page.getByLabel("Код из письма")).toHaveValue(otp);
  await signIn(page);
  await expect(page).toHaveURL(/\/listings\/new$/);
  await page.getByLabel("Название", {exact: true}).fill("Синтетическая чаша первого автора");
  await page.getByRole("combobox", {name: "Категория", exact: true}).selectOption("bowls");
  await page.getByLabel("Описание", {exact: true}).fill("Синтетическая вещь для проверки пути пользователя; не предложение продажи.");
  await page.getByLabel("Город", {exact: true}).fill("Москва");
  await page.getByLabel("Цена, ₽").fill("2500");
  await page.getByLabel("Ссылка для связи").fill("https://vk.ru/synthetic_contact");
  await page.getByLabel("ФИО для согласия").fill("Синтетический Автор Черновика");
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("shisha:listing-draft:")).length)).toBe(1);
  const raw = await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("shisha:listing-draft:")).map(key => sessionStorage.getItem(key)).join(""));
  expect(raw).not.toMatch(/Синтетический Автор Черновика|synthetic_contact|consentName/);
  await page.reload();
  await page.getByRole("button", {name: "Восстановить черновик"}).click();
  await expect(page.getByLabel("Название", {exact: true})).toHaveValue("Синтетическая чаша первого автора");
  await expect(page.getByLabel("Ссылка для связи")).toBeEmpty();
  await expect(page.getByLabel("ФИО для согласия")).toBeEmpty();
  await expect(page.getByRole("checkbox", {name: /Разрешаю публикацию указанной ссылки/})).not.toBeChecked();
  const buffer = await sharp({create: {width: 640, height: 480, channels: 3, background: "#bd8e6d"}}).png().toBuffer();
  await page.getByLabel("Фотографии", {exact: true}).setInputFiles({name: "first.png", mimeType: "image/png", buffer});
  await page.getByLabel("Фотографии", {exact: true}).setInputFiles({name: "detail.png", mimeType: "image/png", buffer});
  await expect(page.locator('form img[src^="blob:"]')).toHaveCount(2);
  const detail = await page.getByAltText("Новое фото 2", {exact: true}).getAttribute("src");
  await page.getByRole("button", {name: "Сделать обложкой"}).click();
  await expect(page.getByAltText("Новое фото 1", {exact: true})).toHaveAttribute("src", detail!);
  await page.getByLabel("Фотографии", {exact: true}).setInputFiles(Array.from({length: 7}, (_, i) => ({name: `too-many-${i}.png`, mimeType: "image/png", buffer})));
  await expect(page.getByRole("main").getByRole("alert")).toContainText("не больше 6");
  await expect(page.locator('form img[src^="blob:"]')).toHaveCount(2);
  await page.getByRole("button", {name: "Удалить новое фото 2", exact: true}).click();
  await expect(page.locator('form img[src^="blob:"]')).toHaveCount(1);
  await page.getByLabel("Ссылка для связи").fill("https://vk.ru/synthetic_contact");
  await page.getByLabel("ФИО для согласия").fill("Синтетический Автор Проверки");
  for (const name of [/Разрешаю публикацию указанной ссылки/, /Разрешаю публикацию страны/, /Это моя личная вещь/, /Мне исполнилось/]) await page.getByRole("checkbox", {name}).check();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBe(true);
  }
  await page.screenshot({path: `${review}/after-form-desktop.png`, fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: `${review}/after-form-mobile.png`, fullPage: true});
  await page.getByRole("button", {name: "Отправить на проверку", exact: true}).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+$/);
  await expect(page.getByText(/Объявление сохранено и отправлено на ручную проверку/)).toBeVisible();
  const path = new URL(page.url()).pathname;
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("shisha:listing-draft:")).length)).toBe(0);
  await page.screenshot({path: `${review}/after-pending-mobile.png`, fullPage: true});
  const guest = await browser.newContext();
  const reviewer = await browser.newContext({baseURL: "http://127.0.0.1:4388"});
  try {
    expect((await guest.request.get(`http://127.0.0.1:4388${path}`)).status()).toBe(404);
    const moderator = await reviewer.newPage();
    await moderator.goto("/login");
    const code = await codeFor(moderator, "moderator@e2e.example.test");
    await moderator.getByLabel("Код из письма").fill(code);
    await signIn(moderator);
    await expect(moderator).toHaveURL(/\/account$/);
    await moderator.goto("/admin");
    const item = moderator.locator("article.review-item").filter({has: moderator.locator(`a[href="${path}"]`)});
    await item.getByRole("button", {name: "Одобрить", exact: true}).click();
    await expect(item).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("link", {name: /Связаться с продавцом/})).toBeVisible();
    expect((await guest.request.get(`http://127.0.0.1:4388${path}`)).status()).toBe(200);
    await page.getByRole("button", {name: "Снять объявление", exact: true}).click();
    await expect(page).toHaveURL(/\/account$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await guest.request.get(`http://127.0.0.1:4388${path}`)).status()).toBe(404);
  } finally {await guest.close(); await reviewer.close();}
  expect(errors).toEqual([]);
});
