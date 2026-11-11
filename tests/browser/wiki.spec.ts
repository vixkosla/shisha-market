import { test, expect, type Page } from "@playwright/test";
import { getWikiSlugs } from "../../src/lib/wiki";

const notebookEnabled = process.env.E2E_WIKI_NOTEBOOK_ENABLED === "true";

async function expectNoNotebook(page: Page) {
  await expect(page.locator(".wiki-notebook, .wiki-side-notebook, .wiki-outline-notes, .wiki-margin-note, .wiki-route-counter, .wiki-journey-footnote, .wiki-article-toolbar")).toHaveCount(0);
  await expect(page.getByRole("button", {name: /Сохранённое|Сохранить статью|Статья сохранена|Отметить прочитанным/})).toHaveCount(0);
  await expect(page.locator('a[href="#my-notes"]')).toHaveCount(0);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), page.url()).toBe(true);
}

async function expectReadableMobileContribution(page: Page) {
  const heading = page.getByRole("heading", { name: "На карте есть место для ваших знаний", exact: true });
  const contribution = page.getByRole("complementary").filter({ has: heading });
  const copy = await heading.boundingBox();
  const action = await contribution.getByRole("link", { name: "Как редактировать", exact: true }).boundingBox();
  expect(copy).not.toBeNull();
  expect(action).not.toBeNull();
  expect(copy!.width).toBeGreaterThanOrEqual(200);
  expect(action!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height);
}

test("every discovered wiki article opens and related links and the local editing guide remain connected", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydrat|same key|Each child/i.test(message.text())) errors.push(message.text()); });
  await page.goto("/wiki");
  await expect(page.getByRole("heading", { name: "Атлас кальянного мира", exact: true })).toBeVisible();
  const links = await page.getByRole("list", { name: /^Статьи:/ }).getByRole("link").evaluateAll((items) => items.map((item) => item.getAttribute("href")!));
  expect(links.sort()).toEqual(getWikiSlugs().map((slug) => `/wiki/${slug}`).sort());
  for (const href of links) {
    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
    expect(await response.text(), href).toMatch(/<article[^>]*aria-labelledby="wiki-article-title"/);
  }
  await page.getByRole("list", { name: "Статьи: Производители" }).getByRole("link", { name: /^Darkside(?:\s|$)/ }).click();
  await expect(page).toHaveURL(/\/wiki\/brands\/darkside$/);
  await expect(page.getByRole("heading", { name: "Darkside", exact: true })).toBeVisible();
  await page.getByRole("article").getByRole("link", { name: "Табак", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/categories\/tobacco$/);
  await expect(page.getByRole("heading", { name: "Табак для кальяна", exact: true })).toBeVisible();
  await page.getByRole("article").getByRole("link", { name: "Кальяны", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/categories\/hookahs$/);
  await page.locator(".wiki-masthead").getByRole("link", { name: "Как редактировать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Как редактировать Shisha Market Wiki", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Пример кода, прокручивается по горизонтали" }).filter({ hasText: "[Текст ссылки](relative/path.md)" })).toBeVisible();
  await page.getByRole("navigation", { name: "Навигация по разделам" }).getByRole("link", { name: "Руководства", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki#guide$/);
  await expect(page.getByRole("heading", { name: "Руководства", exact: true })).toBeInViewport();
  const missing = await page.request.get("/wiki/brands/missing-article");
  expect(missing.status()).toBe(404);
  expect(errors).toEqual([]);
});

test("directory search, group filters, zero state and map destinations work by keyboard", async ({ page }) => {
  await page.goto("/wiki");
  const search = page.getByRole("searchbox", { name: "Найти статью" });
  await search.fill("dArKsIdE");
  await expect(page.getByRole("list", { name: "Статьи: Производители" }).getByRole("link", { name: /^Darkside(?:\s|$)/ })).toBeVisible();
  await expect(page.getByRole("list", { name: /^Статьи:/ }).getByRole("link")).toHaveCount(1);
  await search.fill("водяной фильтр");
  const descriptionMatch = page.getByRole("list", { name: "Статьи: Категории товаров" }).getByRole("link", { name: /^Кальяны(?:\s|$)/ });
  await expect(descriptionMatch).toBeVisible();
  await expect(descriptionMatch).toContainText("водяной фильтр");
  await search.fill("неттакойстатьи987654");
  await expect(page.getByRole("heading", { name: "Нет совпадений по вашему запросу" })).toBeVisible();
  await page.getByRole("button", { name: "Показать все статьи" }).click();
  await expect(search).toHaveValue("");
  const groups = page.getByRole("navigation", { name: "Разделы энциклопедии" });
  await groups.getByRole("button", { name: /Руководства/ }).focus();
  await page.keyboard.press("Enter");
  await expect(groups.getByRole("button", { name: /Руководства/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("list", { name: "Статьи: Производители" })).toHaveCount(0);
  await search.fill("Darkside");
  await expect(page.getByRole("heading", { name: "Нет совпадений по вашему запросу" })).toBeVisible();
  await expect(page.getByText("Попробуйте другое название, измените выбранный раздел или вернитесь ко всему указателю.")).toBeVisible();
  await search.fill("");
  await page.getByRole("list", { name: "Статьи: Руководства" }).getByRole("link", { name: /^Как редактировать Shisha Market Wiki(?:\s|$)/ }).click();
  await expect(page).toHaveURL(/\/wiki\/guide\/contributing$/);
  await page.getByRole("navigation", { name: "Навигация по разделам" }).getByRole("link", { name: "Руководства", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Руководства", exact: true })).toBeInViewport();
  await groups.getByRole("button", { name: /Все статьи/ }).click();
  const map = page.getByRole("navigation", { name: "Маршрут знакомства", exact: true });
  await map.getByRole("link", { name: /Чаши/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/wiki\/categories\/bowls$/);
  await expect(page.getByRole("heading", { name: "Чаши", exact: true })).toBeVisible();
});

test("map destinations never overlap or leave the map across responsive breakpoints", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/wiki");
  const map = page.getByRole("navigation", { name: "Маршрут знакомства", exact: true });
  const expectedDestinations = await map.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(expectedDestinations.length).toBeGreaterThan(1);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  for (const width of [320, 390, 560, 561, 640, 768, 800, 801, 1000, 1150, 1151, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const layout = await map.evaluate((navigation) => {
      const bounds = navigation.parentElement!.getBoundingClientRect();
      const links = [...navigation.querySelectorAll("a")].map((link) => {
        const rect = link.getBoundingClientRect();
        return { href: link.getAttribute("href"), name: link.textContent, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
      return { map: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }, links };
    });
    expect(layout.links.map((link) => link.href), `Destinations at ${width}px`).toEqual(expectedDestinations);
    for (const link of layout.links) {
      expect(link.width, `${link.name} width at ${width}px`).toBeGreaterThan(0);
      expect(link.height, `${link.name} height at ${width}px`).toBeGreaterThan(0);
      expect(link.left, `${link.name} left at ${width}px`).toBeGreaterThanOrEqual(layout.map.left - 0.5);
      expect(link.right, `${link.name} right at ${width}px`).toBeLessThanOrEqual(layout.map.right + 0.5);
      expect(link.top, `${link.name} top at ${width}px`).toBeGreaterThanOrEqual(layout.map.top - 0.5);
      expect(link.bottom, `${link.name} bottom at ${width}px`).toBeLessThanOrEqual(layout.map.bottom + 0.5);
    }
    for (let i = 0; i < layout.links.length; i++) {
      for (let j = i + 1; j < layout.links.length; j++) {
        const first = layout.links[i];
        const second = layout.links[j];
        const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
        const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
        expect(overlapX > 0.5 && overlapY > 0.5, `${first.name} overlaps ${second.name} at ${width}px`).toBe(false);
      }
    }
  }
});

test("the atlas keeps a generous reading scale and wiki chrome does not leak to other pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [[1440, 900], [1366, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/wiki");
    await page.evaluate(() => document.fonts.ready);
    // The user explicitly preferred the earlier atlas scale over a one-screen directory.
    await expect(page.locator(".wiki-entry")).toHaveCount(getWikiSlugs().length);
    expect(await page.locator(".wiki-intro-copy h1").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(width > 800 ? 44 : 34);
    expect((await page.locator(".wiki-map").boundingBox())!.height).toBeGreaterThanOrEqual(220);
    expect((await page.locator(".wiki-entry").first().boundingBox())!.height).toBeGreaterThanOrEqual(76);
    await expect(page.locator(".wiki-entry-copy > span").first()).toHaveCSS("-webkit-line-clamp", "2");
    expect(await page.locator(".wiki-entry-copy > span").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
    const menu = page.getByRole("navigation", { name: "Разделы энциклопедии" });
    for (const button of await menu.getByRole("button").all()) {
      expect((await button.boundingBox())!.height, `Comfortable menu target at ${width}px`).toBeGreaterThanOrEqual(44);
    }
    if (width > 800) {
      expect(await menu.evaluate((element) => Number.parseFloat(getComputedStyle(element).rowGap))).toBeGreaterThanOrEqual(6);
      expect(await page.locator(".wiki-entry-list").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
      const brands = await page.locator("#brands").boundingBox();
      const categories = await page.locator("#categories").boundingBox();
      expect(categories!.y).toBeGreaterThan(brands!.y + brands!.height);
    }
    expect(await page.locator(".wiki-entry-copy strong").first().evaluate((entry) => Number.parseFloat(getComputedStyle(entry).fontSize))).toBeGreaterThanOrEqual(16);
    await expectNoOverflow(page);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/brand");
  const header = page.locator(".site-header");
  const originalHeight = await header.evaluate((element) => element.getBoundingClientRect().height);
  await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "Вики", exact: true }).click();
  await expect(page.locator(".wiki-atlas")).toBeVisible();
  expect(await header.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(originalHeight);
  await page.locator(".site-footer").getByRole("link", { name: "Брендбук", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Брендбук", exact: true })).toBeVisible();
  expect(await header.evaluate((element) => element.getBoundingClientRect().height)).toBe(originalHeight);

  await page.goto("/wiki/categories/hookahs");
  const table = page.getByRole("region", { name: "Таблица: Основные элементы", exact: true });
  expect(await table.locator("td").first().evaluate((cell) => Number.parseFloat(getComputedStyle(cell).paddingTop))).toBeGreaterThanOrEqual(10);
  expect(await page.locator(".wiki-content p").last().evaluate((paragraph) => Number.parseFloat(getComputedStyle(paragraph).fontSize))).toBeGreaterThanOrEqual(15);
});

test("deferred wiki notebook is hidden without touching old data, and still works when explicitly enabled", async ({ page }) => {
  if (!notebookEnabled) {
    await page.goto("/wiki");
    const original = JSON.stringify({"categories/hookahs": {saved: true, read: true, note: "Прежняя локальная заметка"}});
    await page.evaluate(value => localStorage.setItem("shisha-market:wiki-notebook:v1", value), original);
    for (const path of ["/wiki", "/wiki/categories/hookahs", "/wiki/brands/kaloud", "/wiki/brands/nuke"]) {
      await page.goto(path);
      await expectNoNotebook(page);
      await page.reload();
      await expectNoNotebook(page);
      expect(await page.evaluate(() => localStorage.getItem("shisha-market:wiki-notebook:v1"))).toBe(original);
    }
    await page.goto("/wiki");
    await page.getByRole("searchbox", {name: "Найти статью"}).fill("Альфа Хука");
    await expect(page.locator('.wiki-entry[href="/wiki/brands/alpha-hookah"]')).toBeVisible();
    return;
  }
  await page.goto("/wiki/categories/hookahs");
  await page.getByRole("button", { name: "Сохранить статью", exact: true }).click();
  await expect(page.getByRole("button", { name: "Статья сохранена", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Отметить прочитанным", exact: true }).click();
  const notes = page.getByRole("region", { name: "Мои заметки", exact: true });
  const note = notes.getByRole("textbox", { name: "Заметка к статье" });
  await note.fill("Проверить размеры своей чаши перед выбором.");
  await expect(notes.getByRole("status")).toHaveText("Есть несохранённые изменения");
  await notes.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(notes.getByRole("status")).toHaveText("Заметка сохранена в этом браузере");
  expect(await notes.getByRole("status").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await expect(notes.getByText("В этом браузере", { exact: true })).toBeVisible();
  await page.reload();
  await expect(note).toHaveValue("Проверить размеры своей чаши перед выбором.");
  await expect(page.getByRole("button", { name: "Статья сохранена", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Прочитано", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("navigation", { name: "Навигация по разделам" }).getByRole("link", { name: "Атлас", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Маршрут знакомства", exact: true }).getByRole("link", { name: /Кальяны.*Прочитано/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Разделы энциклопедии" }).getByRole("button", { name: /Сохранённое/ }).click();
  await page.getByRole("list", { name: "Статьи: Категории товаров" }).getByRole("link", { name: /^Кальяны(?:\s|$)/ }).click();
  await expect(page).toHaveURL(/\/wiki\/categories\/hookahs$/);
  await notes.getByRole("button", { name: "Очистить", exact: true }).click();
  await page.getByRole("button", { name: "Статья сохранена", exact: true }).click();
  await page.getByRole("button", { name: "Прочитано", exact: true }).click();
  await page.reload();
  await expect(note).toHaveValue("");
  await expect(page.getByRole("button", { name: "Сохранить статью", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Отметить прочитанным", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("failed browser storage is unused while deferred and keeps unsaved notes available when enabled", async ({ page }) => {
  await page.addInitScript(enabled => {
    const original = Storage.prototype.setItem;
    const originalGet = Storage.prototype.getItem;
    const trackedWindow = window as unknown as {wikiNotebookAccesses: number};
    trackedWindow.wikiNotebookAccesses = 0;
    Storage.prototype.getItem = function (key) {
      if (!enabled && key === "shisha-market:wiki-notebook:v1") {
        trackedWindow.wikiNotebookAccesses++;
        throw new DOMException("Storage unavailable", "SecurityError");
      }
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "shisha-market:wiki-notebook:v1") {
        trackedWindow.wikiNotebookAccesses++;
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  }, notebookEnabled);
  await page.goto("/wiki/brands/kaloud");
  if (!notebookEnabled) {
    for (const path of ["/wiki/brands/kaloud", "/wiki", "/wiki/categories/hookahs"]) {
      await page.goto(path);
      await expectNoNotebook(page);
      await expect(page.locator(".wiki-storage-warning")).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as {wikiNotebookAccesses: number}).wikiNotebookAccesses)).toBe(0);
    }
    return;
  }
  await page.getByRole("button", { name: "Сохранить статью", exact: true }).click();
  await expect(page.getByRole("button", { name: "Сохранить статью", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Не удалось сохранить");
  const notes = page.getByRole("region", { name: "Мои заметки", exact: true });
  await notes.getByRole("textbox", { name: "Заметка к статье" }).fill("Несохранённый текст");
  await notes.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(notes.getByRole("status")).toHaveText("Не удалось сохранить заметку. Текст остаётся в поле.");
  await expect(notes.getByRole("textbox")).toHaveValue("Несохранённый текст");
});

test("mobile contents, readable tables, list markers and every article fit the viewport", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/wiki", ...getWikiSlugs().map((slug) => `/wiki/${slug}`)]) {
    await page.goto(route);
    await expectNoOverflow(page);
    if (route === "/wiki") await expectReadableMobileContribution(page);
  }
  await page.goto("/wiki/categories/hookahs");
  const disclosure = page.getByText("Содержание", { exact: true }).filter({ visible: true });
  await disclosure.click();
  const toc = page.getByRole("navigation", { name: "Содержание", exact: true });
  await toc.getByRole("link", { name: "Материалы", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Материалы", exact: true })).toBeInViewport();
  await expect(toc.getByRole("link", { name: "Материалы", exact: true })).toHaveAttribute("aria-current", "location");
  expect(await page.getByRole("article").locator("ul").first().evaluate((list) => getComputedStyle(list).listStyleType)).toBe("disc");
  const table = page.getByRole("region", { name: /^Таблица:/ }).first();
  expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(table).toHaveAccessibleName("Таблица: Основные элементы");
  expect(await table.locator("td").first().evaluate((cell) => getComputedStyle(cell).overflowWrap)).toBe("normal");
  await page.screenshot({ path: testInfo.outputPath("wiki-mobile.png"), fullPage: true });
  const wideTable = page.getByRole("region", { name: /^Таблица: Типы соединений/ });
  expect(await wideTable.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(wideTable).toHaveAccessibleDescription("Прокрутите таблицу вбок");
  await wideTable.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => wideTable.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("wiki-inspection-mobile.png"), fullPage: true });
  await page.goto("/wiki/guide/contributing");
  expect(await page.getByRole("article").locator("ol").first().evaluate((list) => getComputedStyle(list).listStyleType)).toBe("decimal");
  await page.getByText("Содержание", { exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("navigation", { name: "Содержание", exact: true }).getByRole("link", { name: "Раздел", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Содержание", exact: true }).getByRole("link", { name: "Подраздел", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("wiki-guide-mobile.png"), fullPage: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/wiki", "/wiki/categories/hookahs", "/wiki/guide/contributing"]) {
      await page.goto(route);
      await expectNoOverflow(page);
      if (width === 320 && route === "/wiki") await expectReadableMobileContribution(page);
      if (width === 1440 && route === "/wiki/categories/hookahs") {
        await expect(page.getByRole("region", { name: /^Таблица: Типы соединений/ })).toHaveAccessibleName("Таблица: Типы соединений");
        await expect(page.getByText("Прокрутите таблицу вбок", { exact: true })).toHaveCount(0);
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});
