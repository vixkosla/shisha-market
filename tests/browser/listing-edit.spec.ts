import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

test.use({actionTimeout: 15000});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(email);
  for (const name of [/Мне исполнилось/, /Принимаю пользовательское/, /Даю отдельное/])
    await page.getByRole("checkbox", { name }).check();
  let started = Date.now();
  // Real OTP throttling is intentionally enabled on the isolated server. Several
  // browser users share loopback, so respect Retry-After instead of disabling it.
  for (let attempt = 0; attempt < 3; attempt++) {
    started = Date.now();
    const sent = page.waitForResponse(response => response.url().endsWith("/api/auth/email-otp/send-verification-otp") && response.request().method() === "POST");
    const sendButton = page.getByRole("button", {name: /Получить код|Повторить через/});
    await expect(sendButton).toBeEnabled({timeout: 65000});
    await sendButton.click();
    const response = await sent;
    if (response.status() !== 429) {
      expect(response.ok(), "OTP request should succeed").toBe(true);
      break;
    }
    // The installed Better Auth returns X-Retry-After, while other versions may
    // use Retry-After. With neither header, wait its full 60-second OTP window.
    const retryAfter = Number(response.headers()["retry-after"] ?? response.headers()["x-retry-after"] ?? 60);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    await page.waitForTimeout(retryAfter * 1000 + 1100);
  }
  await expect(page.getByLabel("Код из письма")).toBeVisible();
  let otp = "";
  await expect.poll(async () => {
    const lines = (await readFile(".data/e2e-mailbox.jsonl", "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    otp = lines.map(line => JSON.parse(line)).findLast(mail => mail.email === email && mail.time >= started)?.otp ?? "";
    return !!otp;
  }).toBe(true);
  await page.getByLabel("Код из письма").fill(otp);
  await page.getByRole("button", {name: "Войти", exact: true}).click();
  await expect(page).toHaveURL(/\/account$/);
}
async function consent(page: Page) {
  await page.getByLabel("ФИО для согласия").fill("Синтетический Автор Проверки");
  for (const name of [/Разрешаю публикацию указанной ссылки/, /Разрешаю публикацию страны/, /Это моя личная вещь/, /Мне исполнилось/])
    await page.getByRole("checkbox", {name}).check();
}
async function create(page: Page, title: string) {
  await page.goto("/listings/new");
  await page.getByLabel("Название", {exact: true}).fill(title);
  await page.getByRole("combobox", {name: "Категория", exact: true}).selectOption("accessories");
  await page.getByLabel("Город", {exact: true}).fill("Москва");
  await page.getByLabel("Цена, ₽").fill("2500,50");
  await page.getByRole("textbox", {name: "Описание", exact: true}).fill("Синтетическая запись для проверки исправлений, не предложение продажи.");
  await page.getByLabel("Ссылка для связи").fill("https://vk.ru/edit_test");
  const buffer = await sharp({create: {width: 640, height: 480, channels: 3, background: "#bcc5ac"}}).png().toBuffer();
  await page.getByLabel("Фотографии").setInputFiles({name: "synthetic.png", mimeType: "image/png", buffer});
  await consent(page);
  await page.getByRole("button", {name: "Отправить на проверку", exact: true}).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+$/);
  return page.url();
}

test("owner edits, stale tabs, rejected correction and photo replacement stay behind repeat moderation", async ({page, browser}, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page, `edit-${Date.now()}@e2e.example.test`);
  const listingUrl = await create(page, "Синтетическая вещь для исправления");
  const oldMedia = (await page.locator(".gallery img").getAttribute("src"))!;
  const guest = await browser.newContext({baseURL: "http://127.0.0.1:4388"});
  const reviewer = await browser.newContext({baseURL: "http://127.0.0.1:4388"});
  const guestPage = await guest.newPage();
  const moderator = await reviewer.newPage();
  const staleOwner = await page.context().newPage();
  try {
    await guestPage.goto(`${listingUrl}/edit`);
    await expect(guestPage).toHaveURL(/\/login\?next=/);
    await login(moderator, "moderator@e2e.example.test");
    await moderator.goto(`${listingUrl}/edit`);
    await expect(moderator.getByRole("heading", {name: "Здесь пока ничего нет"})).toBeVisible();
    await moderator.goto("/admin");
    const item = moderator.locator("article.review-item").filter({has: moderator.locator(`a[href="${new URL(listingUrl).pathname}"]`)});
    await item.getByRole("button", {name: "Одобрить", exact: true}).click();
    await expect(item).toHaveCount(0);
    expect((await guest.request.get(oldMedia)).status()).toBe(200);
    await page.goto(listingUrl);
    await page.getByRole("link", {name: "Редактировать объявление", exact: true}).click();
    await expect(page.getByLabel("Название", {exact: true})).toHaveValue("Синтетическая вещь для исправления");
    await expect(page.getByLabel("Цена, ₽")).toHaveValue("2500.50");
    await expect(page.getByRole("checkbox", {name: /Разрешаю публикацию указанной ссылки/})).not.toBeChecked();
    await expect(page.getByRole("checkbox", {name: "Оставить фото 1"})).toBeChecked();
    await page.screenshot({path: testInfo.outputPath("edit-desktop.png"), fullPage: true, caret: "initial"});
    await staleOwner.goto(`${listingUrl}/edit`);
    await page.getByLabel("Название", {exact: true}).fill("Исправленная синтетическая вещь");
    await page.getByLabel("Цена, ₽").fill("1999,50");
    await consent(page);
    await page.getByRole("button", {name: "Сохранить и отправить на проверку"}).click();
    await expect(page).toHaveURL(listingUrl);
    await expect(page.getByText(/На проверке\. Объявление/)).toBeVisible();
    expect((await guest.request.get(oldMedia)).status()).toBe(404);
    expect((await page.request.get(oldMedia)).status()).toBe(200);
    await guestPage.goto("/?q=Исправленная");
    await expect(guestPage.getByRole("heading", {name: "Исправленная синтетическая вещь"})).toHaveCount(0);

    await staleOwner.getByLabel("Название", {exact: true}).fill("Устаревший текст нельзя перезаписать");
    await consent(staleOwner);
    await staleOwner.getByRole("button", {name: "Сохранить и отправить на проверку"}).click();
    await expect(staleOwner.getByRole("main").getByRole("alert")).toContainText("другой вкладке");
    await expect(staleOwner.getByLabel("Название", {exact: true})).toHaveValue("Устаревший текст нельзя перезаписать");

    await moderator.goto("/admin");
    await expect(item).toContainText("Версия 2");
    await page.goto(`${listingUrl}/edit`);
    await page.getByRole("textbox", {name: "Описание", exact: true}).fill("Ещё одно синтетическое уточнение состояния. Модератор обязан перечитать новую версию.");
    await consent(page);
    await page.getByRole("button", {name: "Сохранить и отправить на проверку"}).click();
    await expect(page).toHaveURL(listingUrl);
    await item.getByRole("button", {name: "Одобрить", exact: true}).click();
    await expect(item.getByRole("alert")).toContainText("Автор изменил");
    expect((await guest.request.get(oldMedia)).status()).toBe(404);
    await moderator.reload();
    await expect(item).toContainText("Версия 3");
    await item.getByLabel("Комментарий модератора").fill("Нужно заменить синтетическую фотографию");
    await item.getByRole("button", {name: "Отклонить", exact: true}).click();
    await expect(item).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/Комментарий: Нужно заменить/)).toBeVisible();
    await page.getByRole("link", {name: "Исправить и отправить повторно"}).click();
    await page.setViewportSize({width: 390, height: 844});
    await page.getByRole("checkbox", {name: "Оставить фото 1"}).uncheck();
    const buffer = await sharp({create: {width: 480, height: 640, channels: 3, background: "#b84a30"}}).png().toBuffer();
    await page.getByLabel("Новые фотографии").setInputFiles({name: "replacement.png", mimeType: "image/png", buffer});
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({width, height: 844});
      const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].flatMap(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.right > innerWidth + 1 ? [{tag: element.tagName, className: element.className, href: element.getAttribute("href"), right: Math.round(rect.right)}] : [];
      }));
      expect(overflow, `edit at ${width}px`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({width: 390, height: 844});
    await page.screenshot({path: testInfo.outputPath("edit-mobile.png"), fullPage: true, caret: "initial"});
    await consent(page);
    await page.getByRole("button", {name: "Сохранить и отправить на проверку"}).click();
    await expect(page).toHaveURL(listingUrl);
    const newMedia = (await page.locator(".gallery img").getAttribute("src"))!;
    expect(newMedia).not.toBe(oldMedia);
    expect((await page.request.get(oldMedia)).status()).toBe(404);
    expect((await page.request.get(newMedia)).status()).toBe(200);
    expect((await guest.request.get(newMedia)).status()).toBe(404);
    await moderator.reload();
    await expect(item).toContainText("Версия 4");
    await item.getByRole("button", {name: "Одобрить", exact: true}).click();
    await expect(item).toHaveCount(0);
    await guestPage.goto(listingUrl);
    await expect(guestPage.getByRole("heading", {name: "Исправленная синтетическая вещь"})).toBeVisible();
    await expect(guestPage.getByRole("link", {name: "Редактировать объявление"})).toHaveCount(0);
    expect((await guest.request.get(newMedia)).status()).toBe(200);
    expect((await guest.request.get(oldMedia)).status()).toBe(404);
    await page.reload();
    await page.getByRole("button", {name: "Снять объявление", exact: true}).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.goto(`${listingUrl}/edit`);
    await expect(page.getByText(/Для восстановления/)).toBeVisible();
    await expect(page.getByRole("button", {name: "Сохранить и отправить на проверку"})).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await staleOwner.close(); await guest.close(); await reviewer.close(); }
});

test("failed photo processing keeps the original publication and the owner's typed corrections", async ({page, browser}) => {
  test.setTimeout(150000);
  await login(page, `edit-failure-${Date.now()}@e2e.example.test`);
  const listingUrl = await create(page, "Синтетическая проверка ошибки загрузки");
  const originalMedia = (await page.locator(".gallery img").getAttribute("src"))!;
  const reviewer = await browser.newContext({baseURL: "http://127.0.0.1:4388"});
  const moderator = await reviewer.newPage();
  try {
    await login(moderator, "moderator@e2e.example.test");
    await moderator.goto("/admin");
    const item = moderator.locator("article.review-item").filter({has: moderator.locator(`a[href="${new URL(listingUrl).pathname}"]`)});
    await item.getByRole("button", {name: "Одобрить", exact: true}).click();
    await expect(item).toHaveCount(0);
    await page.goto(`${listingUrl}/edit`);
    await page.getByLabel("Название", {exact: true}).fill("Мои правки не должны потеряться");
    await page.getByRole("checkbox", {name: "Оставить фото 1"}).uncheck();
    const valid = await sharp({create: {width: 100, height: 100, channels: 3, background: "#cccccc"}}).png().toBuffer();
    await page.getByLabel("Новые фотографии").setInputFiles([
      {name: "valid.png", mimeType: "image/png", buffer: valid},
      {name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image")},
    ]);
    await consent(page);
    await page.getByRole("button", {name: "Сохранить и отправить на проверку"}).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Не удалось прочитать фото");
    expect(await page.getByLabel("Новые фотографии").evaluate((input: HTMLInputElement) => input.files?.length)).toBe(2);
    await expect(page.getByLabel("Название", {exact: true})).toHaveValue("Мои правки не должны потеряться");
    await expect(page.getByRole("checkbox", {name: "Оставить фото 1"})).not.toBeChecked();
    await page.getByRole("link", {name: "Отмена", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Синтетическая проверка ошибки загрузки"})).toBeVisible();
    await expect(page.getByText(/На проверке\. Объявление/)).toHaveCount(0);
    expect((await page.request.get(originalMedia)).status()).toBe(200);
  } finally { await reviewer.close(); }
});

test("category, subcategory, make and model are read from the title, saved and shown on the listing", async ({page}) => {
  test.setTimeout(120000);
  await login(page, `taxonomy-${Date.now()}@e2e.example.test`);
  await page.goto("/listings/new");
  await page.getByLabel("Название", {exact: true}).fill("HOOB Atom чёрный");
  await expect(page.getByRole("combobox", {name: "Категория", exact: true})).toHaveValue("hookahs");
  await expect(page.getByRole("combobox", {name: "Подкатегория", exact: true})).toHaveValue("complete");
  await expect(page.getByLabel("Марка", {exact: true})).toHaveValue("HOOB");
  await expect(page.getByLabel("Модель", {exact: true})).toHaveValue("Atom");
  // A hand-picked subcategory stays put while the title keeps changing.
  await page.getByRole("combobox", {name: "Подкатегория", exact: true}).selectOption("shaft");
  await page.getByLabel("Название", {exact: true}).fill("HOOB Atom чёрный, только шахта");
  await expect(page.getByRole("combobox", {name: "Подкатегория", exact: true})).toHaveValue("shaft");
  await page.getByLabel("Город", {exact: true}).fill("Москва");
  await page.getByLabel("Цена, ₽").fill("9000");
  await page.getByRole("textbox", {name: "Описание", exact: true}).fill("Синтетическая запись для проверки подкатегорий, не предложение продажи.");
  await page.getByLabel("Ссылка для связи").fill("https://vk.ru/taxonomy_test");
  const buffer = await sharp({create: {width: 640, height: 480, channels: 3, background: "#bcc5ac"}}).png().toBuffer();
  await page.getByLabel("Фотографии").setInputFiles({name: "synthetic.png", mimeType: "image/png", buffer});
  await consent(page);
  await page.getByRole("button", {name: "Отправить на проверку", exact: true}).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+$/);
  await expect(page.locator(".detail-info .eyebrow")).toContainText("Кальяны / Шахта отдельно / HOOB / Atom");
  await expect(page.getByRole("region", {name: "Из атласа брендов: HOOB"})).toBeVisible();
  await page.getByRole("link", {name: "Редактировать объявление", exact: true}).click();
  await expect(page.getByRole("combobox", {name: "Подкатегория", exact: true})).toHaveValue("shaft");
  await expect(page.getByLabel("Марка", {exact: true})).toHaveValue("HOOB");
  await expect(page.getByLabel("Модель", {exact: true})).toHaveValue("Atom");
});
