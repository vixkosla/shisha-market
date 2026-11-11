import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByRole("checkbox", { name: "Мне исполнилось 18 лет." }).check();
  await page
    .getByRole("checkbox", { name: /Принимаю пользовательское соглашение/ })
    .check();
  await page.getByRole("checkbox", { name: /Даю отдельное/ }).check();
  let started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const button = page.getByRole("button", { name: /^Получить код$|^Повторить через/ });
    await expect(button).toBeEnabled({ timeout: 65000 });
    started = Date.now();
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/auth/email-otp/send-verification-otp") && response.request().method() === "POST");
    await button.click();
    const response = await waiting;
    if (response.status() !== 429) {
      expect(response.ok()).toBe(true);
      break;
    }
    await expect(button).toBeDisabled();
  }
  await expect(page.getByLabel("Код из письма")).toBeVisible();
  let otp = "";
  await expect
    .poll(async () => {
      const lines = (
        await readFile(".data/e2e-mailbox.jsonl", "utf8").catch(() => "")
      )
        .trim()
        .split("\n")
        .filter(Boolean);
      const mail = lines
        .map((line) => JSON.parse(line))
        .findLast((mail) => mail.email === email && mail.time >= started);
      otp = mail?.otp ?? "";
      return !!otp;
    })
    .toBe(true);
  await page.getByLabel("Код из письма").fill(otp);
  for (let attempt = 0; attempt < 3; attempt++) {
    const button = page.getByRole("button", { name: /^Войти$|^Повторить вход через/ });
    await expect(button).toBeEnabled({ timeout: 65000 });
    const waiting = page.waitForResponse(response => response.url().endsWith("/api/auth/sign-in/email-otp") && response.request().method() === "POST");
    await button.click();
    const response = await waiting;
    if (response.status() !== 429) {
      expect(response.ok()).toBe(true);
      break;
    }
    await expect(button).toBeDisabled();
  }
  await expect(page).toHaveURL(/\/account$/);
}

test("desktop/mobile catalog and protected navigation", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Хорошим вещам есть продолжение." }),
  ).toBeVisible();
  const robots = await page.request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("<urlset");
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    caret: "initial",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Чаши", exact: true }).click();
  await expect(page).toHaveURL(/category=bowls/);
  await expect(page.getByText("Пока ничего не нашлось")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("home-mobile.png"),
    caret: "initial",
    fullPage: true,
  });
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Подать объявление", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fnew$/);
  expect(errors).toEqual([]);
});

test("email sign-in → photo → private review → publish → favorite → archive", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text()))
      errors.push(message.text());
  });
  const email = `owner-${Date.now()}@e2e.example.test`;
  await login(page, email);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Подать объявление", exact: true })
    .click();
  await page
    .getByLabel("Название", { exact: true })
    .fill("Тестовый предмет для проверки");
  await page
    .getByRole("combobox", { name: "Категория", exact: true })
    .selectOption("accessories");
  await page.getByLabel("Город", { exact: true }).fill("Москва");
  await page.getByLabel("Цена, ₽").fill("2500,50");
  await page
    .getByLabel("Описание", { exact: true })
    .fill(
      "Синтетические данные автоматического теста. Это не предложение продажи.",
    );
  await page.getByLabel("Ссылка для связи").fill("https://vk.ru/e2e_test");
  const buffer = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "#bcc5ac" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Фотографии")
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer });
  await page.getByLabel("ФИО для согласия").fill("Синтетический Автор Теста");
  await page
    .getByRole("checkbox", { name: /Разрешаю публикацию указанной ссылки/ })
    .check();
  await page
    .getByRole("checkbox", { name: /Разрешаю публикацию страны/ })
    .check();
  await page.getByRole("checkbox", { name: /Это моя личная вещь/ }).check();
  await page.getByRole("checkbox", { name: "Мне исполнилось 18 лет." }).check();
  await page.getByRole("button", { name: "Отправить на проверку" }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+$/);
  const listingUrl = page.url();
  await expect(page.getByText(/На проверке\. Объявление/)).toBeVisible();
  const media = await page.locator(".gallery img").first().getAttribute("src");
  expect((await page.request.get(media!)).status()).toBe(200);
  const guest = await browser.newContext({ baseURL: "http://127.0.0.1:4388" });
  expect((await guest.request.get(media!)).status()).toBe(404);
  const guestPage = await guest.newPage();
  await guestPage.goto(listingUrl);
  await expect(
    guestPage.getByRole("heading", { name: "Здесь пока ничего нет" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Здесь пока ничего нет" }),
  ).toBeVisible();
  const reviewer = await browser.newContext({
    baseURL: "http://127.0.0.1:4388",
  });
  const moderator = await reviewer.newPage();
  await login(moderator, "moderator@e2e.example.test");
  await moderator.getByRole("link", { name: "Модерация", exact: true }).click();
  await moderator
    .getByRole("button", { name: "Одобрить", exact: true })
    .click();
  await expect(
    moderator.getByRole("heading", { name: "Все объявления проверены" }),
  ).toBeVisible();
  await guestPage.goto("/?q=предмет&city=Москва&category=accessories");
  await expect(
    guestPage.getByRole("heading", { name: "Тестовый предмет для проверки" }),
  ).toBeVisible();
  expect((await guest.request.get(media!)).status()).toBe(200);
  await page.goto(listingUrl);
  await page.getByRole("button", { name: "В избранное", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Убрать из избранного" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Избранное", exact: true })
    .click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(
    page.getByRole("heading", { name: "Тестовый предмет для проверки" }),
  ).toBeVisible();
  await page.goto(listingUrl);
  await page.screenshot({
    path: testInfo.outputPath("listing-published.png"),
    // Playwright's default caret hiding mutates input styles during hydration.
    caret: "initial",
    fullPage: true,
  });
  // A reader can report the listing, without exposing their complaint to its owner.
  const reporter = await browser.newContext({
    baseURL: "http://127.0.0.1:4388",
  });
  const reporterPage = await reporter.newPage();
  await login(reporterPage, `reporter-${Date.now()}@e2e.example.test`);
  await reporterPage.goto(listingUrl);
  await reporterPage
    .getByRole("link", { name: "Пожаловаться на объявление" })
    .click();
  await reporterPage
    .getByLabel("Суть обращения")
    .fill("Синтетическая жалоба для проверки закрытого канала");
  await reporterPage
    .getByRole("button", { name: "Отправить обращение" })
    .click();
  await expect(reporterPage.getByRole("status")).toContainText(
    "Обращение принято",
  );
  await page.goto("/support");
  await expect(
    page.getByText("Синтетическая жалоба для проверки закрытого канала", {
      exact: true,
    }),
  ).toHaveCount(0);
  await moderator.goto("/admin");
  await expect(
    moderator.getByText("Синтетическая жалоба для проверки закрытого канала", {
      exact: true,
    }),
  ).toBeVisible();
  await moderator
    .getByLabel("Ответ заявителю")
    .fill("Тестовое обращение рассмотрено, нарушений не обнаружено");
  await moderator
    .getByRole("button", { name: "Ответить и закрыть", exact: true })
    .click();
  await reporterPage.reload();
  await expect(
    reporterPage.getByText(/Ответ: Тестовое обращение рассмотрено/),
  ).toBeVisible();
  await page.getByLabel("Тип обращения").selectOption("withdraw");
  await page
    .getByLabel("Суть обращения")
    .fill("Отзываю согласие на публикацию моих данных");
  await page.getByRole("button", { name: "Отправить обращение" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Все ваши объявления сняты",
  );
  await guestPage.goto("/");
  await expect(
    guestPage.getByRole("heading", { name: "Тестовый предмет для проверки" }),
  ).toHaveCount(0);
  expect((await guest.request.get(media!)).status()).toBe(404);
  await guest.close();
  await reviewer.close();
  await reporter.close();
  expect(errors).toEqual([]);
});

test("legal documents, separate consent, developer credit and mobile support", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const credit = page.getByRole("link", { name: "SonicXBoy", exact: true });
  await expect(credit).toHaveAttribute("href", "https://sonicxboy.dev");
  await expect(
    page.getByRole("link", { name: "Исходный код", exact: true }),
  ).toHaveAttribute("href", "https://github.com/vixkosla/shisha-market");
  await expect(
    page.getByRole("link", { name: "Предложить улучшение", exact: true }),
  ).toHaveAttribute("href", "/support#suggest");
  expect((await page.request.get("/sonicxboy-mark.svg")).status()).toBe(200);
  expect((await page.request.get("/brand/bowl.jpg")).status()).toBe(200);
  await expect(
    page.getByRole("img", { name: "Терракотовая чаша, тонкая струйка дыма" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Брендбук", exact: true }).first(),
  ).toHaveAttribute("href", "/brand");
  await page.goto("/brand");
  await expect(page.getByRole("heading", { name: "Брендбук" })).toBeVisible();
  await expect(page.getByText("Terracotta")).toBeVisible();
  await page
    .getByRole("link", { name: "Правила и документы", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Правила и документы" }),
  ).toBeVisible();
  for (const [slug, title] of Object.entries({
    terms: "Пользовательское соглашение",
    rules: "Правила публикации",
    privacy: "Политика обработки данных",
    consent: "Согласие на обработку данных",
    publication: "Согласие на публикацию данных",
    cookies: "Файлы cookie",
    contact: "Оператор и обращения",
  })) {
    await page.goto(`/legal/${slug}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Написать оператору", exact: true }),
  ).toHaveAttribute("href", "mailto:hello@shisha-market.com");
  await page.goto("/support");
  await expect(
    page.getByRole("heading", { name: "Предложение площадке" }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Что добавить, упростить или поправить на площадке")
    .fill("Сделайте фильтр по городу заметнее на главной странице.");
  await page.getByRole("button", { name: "Отправить предложение" }).click();
  await expect(page.getByRole("status")).toContainText("Предложение принято");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/legal/privacy", "/support", "/login"]) {
    await page.goto(path);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  for (const checkbox of await page.getByRole("checkbox").all())
    await expect(checkbox).not.toBeChecked();
  await page.getByLabel("Электронная почта").fill("unchecked@e2e.example.test");
  await page.getByRole("button", { name: "Получить код" }).click();
  await expect(page.getByLabel("Код из письма")).toHaveCount(0);
  const missing = await page.request.post(
    "/api/auth/email-otp/send-verification-otp",
    {
      headers: {
        Origin: "http://127.0.0.1:4388",
        "x-forwarded-for": "192.0.2.99",
      },
      data: { email: "unchecked@e2e.example.test", type: "sign-in" },
    },
  );
  expect(missing.status()).toBe(400);
  await page.goto("/login");
  await page.screenshot({
    path: testInfo.outputPath("legal-login-mobile.png"),
    caret: "initial",
    fullPage: true,
  });
  await page.goto("/legal/privacy");
  await page.screenshot({
    path: testInfo.outputPath("legal-privacy-mobile.png"),
    caret: "initial",
    fullPage: true,
  });
  await page.goto("/legal/not-a-document");
  await expect(
    page.getByRole("heading", { name: "Здесь пока ничего нет" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
