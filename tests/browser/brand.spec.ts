import { expect, test } from "@playwright/test";

test("brandbook section links navigate and focus their headings, and links return to the wiki and site", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/brand");
  await expect(page.getByRole("heading", { name: "Брендбук", exact: true })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Разделы брендбука" });
  const sections = [
    ["Знак", "sign", "Знакомое сочетание"],
    ["Цвет", "palette", "Тепло и равновесие"],
    ["Шрифт", "type", "У каждого шрифта своя роль"],
    ["Движение", "motion", "Немного живого характера"],
    ["Фото", "photo", "Предмет, фактура, свет"],
    ["Файлы", "files", "Нужный файл под рукой"],
  ];
  for (const [name, id, heading] of sections) {
    const link = navigation.getByRole("link", { name, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/brand#${id}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeFocused();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeInViewport();
  }
  const onward = page.getByRole("navigation", { name: "Продолжить знакомство" });
  await onward.getByRole("link", { name: "К началу" }).click();
  await expect(page.getByRole("heading", { name: "Брендбук", exact: true })).toBeFocused();
  await onward.getByRole("link", { name: "Открыть вики" }).click();
  await expect(page).toHaveURL(/\/wiki$/);
  await expect(page.getByRole("heading", { name: "Атлас кальянного мира", exact: true })).toBeVisible();
  await page.goto("/brand");
  await onward.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  expect(errors).toEqual([]);
});

test("size controls change the actual logo geometry and the clear-space guide shows its measured padding", async ({ page }) => {
  await page.goto("/brand");
  await page.evaluate(() => document.fonts.ready);
  const sample = page.getByRole("img", { name: "Логотип Shisha Market: фургон-лавка с полосатым навесом, надписью, шамсой и печатью BACK" });
  const sizes = page.getByRole("group", { name: "Размер образца знака" });
  const large = await sample.boundingBox();
  await sizes.getByRole("button", { name: "Обычный", exact: true }).click();
  const standard = await sample.boundingBox();
  await sizes.getByRole("button", { name: "Компактный", exact: true }).focus();
  await page.keyboard.press("Space");
  const compact = await sample.boundingBox();
  expect(large!.width).toBeGreaterThan(standard!.width);
  expect(standard!.width).toBeGreaterThan(compact!.width);
  expect(large!.width / large!.height).toBeCloseTo(compact!.width / compact!.height, 1);
  await expect(sizes.getByRole("button", { name: "Компактный", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Показать поля", exact: true }).click();
  await expect(page.getByRole("button", { name: "Скрыть поля", exact: true })).toBeVisible();
  await expect(page.getByText("Поле x/2 вокруг композиции; x — модуль знака.", { exact: true })).toBeVisible();
  const space = page.locator("[data-guides]");
  await expect(space).toHaveAttribute("data-guides", "true");
  expect(await space.evaluate((element) => {
    const style = getComputedStyle(element);
    return Number.parseFloat(style.paddingLeft) / Number.parseFloat(style.fontSize);
  })).toBeCloseTo(0.5, 2);
  await page.getByRole("button", { name: "Скрыть поля", exact: true }).click();
  await expect(space).toHaveAttribute("data-guides", "false");
  for (const size of [16, 32, 64]) {
    const icon = await page.getByRole("img", { name: `Шамса размером ${size} на ${size} пикселей` }).boundingBox();
    expect(icon!.width).toBe(size);
    expect(icon!.height).toBe(size);
  }
});

test("every palette button copies its exact HEX through the browser clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/brand");
  const colors = [
    ["Terracotta", "#bf4726"],
    ["Ember", "#f0b090"],
    ["Clay", "#7a2c18"],
    ["Olive", "#29362d"],
    ["Cream", "#f6f5f1"],
  ];
  const palette = page.getByRole("region", { name: "Тепло и равновесие" });
  for (const [name, hex] of colors) {
    const button = palette.getByRole("button", { name: `Скопировать ${name} ${hex}`, exact: true });
    await expect(button).not.toHaveAccessibleDescription(/скопирован/);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(palette.getByRole("status")).toHaveText(`${name}: ${hex} скопирован.`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(hex);
  }
  const cream = page.getByRole("list", { name: "Фирменная палитра" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Cream", exact: true }) });
  const swatch = cream.locator("[aria-hidden='true']").first();
  await expect(swatch).toHaveCSS("background-color", "rgb(246, 245, 241)");
  expect(await swatch.evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(1);
});

test("clipboard denial offers the selected value for manual copying and never reports success", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    });
  });
  await page.goto("/brand");
  await page.getByRole("button", { name: "Скопировать Ember #f0b090", exact: true }).click();
  const palette = page.getByRole("region", { name: "Тепло и равновесие" });
  await expect(palette.getByRole("status")).toContainText("Не удалось скопировать");
  await expect(palette.getByRole("status")).not.toContainText("скопирован.");
  const fallback = page.getByRole("textbox", { name: "HEX для ручного копирования" });
  await expect(fallback).toHaveValue("#f0b090");
  await expect(fallback).toBeFocused();
  expect(await fallback.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd])).toEqual([0, 7]);
});

test("motion starts paused, plays and freezes on request, and stops for reduced motion without altering the header", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/brand");
  const article = page.getByRole("article", { name: "Брендбук", exact: true });
  const motion = page.getByRole("region", { name: "Немного живого характера" });
  const motionStage = motion.getByRole("img", { name: "Шамса: оливковая звезда, терракотовое ядро и светлая точка", exact: true });
  const ring = motion.locator(".shamsa-ring");
  const signRing = article.locator("#sign .shamsa-ring");
  await expect(ring).toHaveCSS("animation-play-state", "paused");
  await expect(motionStage).toHaveAttribute("data-playing", "false");
  await expect(signRing).toHaveCSS("animation-play-state", "paused");
  await expect(page.locator(".site-header .shamsa-ring")).toHaveCSS("animation-play-state", "running");
  const initial = await ring.evaluate((element) => getComputedStyle(element).transform);
  await motion.getByRole("button", { name: "Воспроизвести движение", exact: true }).click();
  await expect(motionStage).toHaveAttribute("data-playing", "true");
  await expect(ring).toHaveCSS("animation-play-state", "running");
  await expect.poll(() => ring.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initial);
  await motion.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(motionStage).toHaveAttribute("data-playing", "false");
  await expect(ring).toHaveCSS("animation-play-state", "paused");
  const paused = await ring.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(150);
  expect(await ring.evaluate((element) => getComputedStyle(element).transform)).toBe(paused);
  await expect(signRing).toHaveCSS("animation-play-state", "paused");
  await expect(page.locator(".site-header .shamsa-ring")).toHaveCSS("animation-play-state", "running");
  await motion.getByRole("button", { name: "Воспроизвести движение", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion.getByRole("button", { name: "Движение отключено", exact: true })).toBeDisabled();
  await expect(ring).toHaveCSS("animation-name", "none");
  await expect(motion.getByRole("status")).toContainText("В системе включено уменьшение движения");
  await page.reload();
  await expect(motion.getByRole("button", { name: "Движение отключено", exact: true })).toBeDisabled();
  await expect(ring).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(motion.getByRole("button", { name: "Воспроизвести движение", exact: true })).toBeEnabled();
  await expect(motionStage).toHaveAttribute("data-playing", "false");
  await expect(ring).toHaveCSS("animation-play-state", "paused");
});

test("all download links return their actual public assets and useful filenames", async ({ page }) => {
  await page.goto("/brand");
  const files = [
    { name: "SVG Фургон-лавка Вектор · фон логотипа", url: "/brand/market-van.svg", type: "image/svg+xml", filename: "shisha-market-van.svg" },
    { name: "SVG Символ шамсы Вектор · только символ", url: "/brand-mark.svg", type: "image/svg+xml", filename: "shisha-market-shamsa.svg" },
    { name: "PNG Иконка сайта 32 × 32 px · прозрачный фон", url: "/favicon.png", type: "image/png", filename: "shisha-market-icon-32.png" },
    { name: "JPG Фотография чаши 712 × 690 px", url: "/brand/bowl.jpg", type: "image/jpeg", filename: "shisha-market-bowl.jpg" },
    { name: "JPG Фотография жара 1024 × 1024 px", url: "/brand/ember.jpg", type: "image/jpeg", filename: "shisha-market-ember.jpg" },
  ];
  for (const file of files) {
    const link = page.getByRole("link", { name: file.name, exact: true });
    await expect(link).toHaveAttribute("href", file.url);
    await expect(link).toHaveAttribute("download", file.filename);
    const response = await page.request.get(file.url);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(file.type);
    const downloadPromise = page.waitForEvent("download");
    await link.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(file.filename);
    expect(await download.failure()).toBeNull();
  }
});

test("the full guide, large sign, palette and all controls fit narrow and wide viewports", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/brand");
  const article = page.getByRole("article", { name: "Брендбук", exact: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Крупный", exact: true }).click();
    if (await page.getByRole("button", { name: "Показать поля", exact: true }).count()) {
      await page.getByRole("button", { name: "Показать поля", exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px page overflow`).toBe(true);
    for (const logo of await page.locator(".lockup").all()) {
      await expect(logo.locator(".lockup-van")).toHaveCSS("background-image", /\/brand\/market-van\.svg/);
      const shape = await logo.evaluate((element) => {
        const van = element.getBoundingClientRect();
        const lettering = element.querySelector(".lockup-row")!.getBoundingClientRect();
        return { right: (lettering.right - van.left) / van.width, bottom: (lettering.bottom - van.top) / van.height };
      });
      expect(shape.right, `Lettering stays behind the cab at ${width}px`).toBeLessThan(0.71);
      expect(shape.bottom, `Lettering stays above the wheels at ${width}px`).toBeLessThan(0.73);
    }
    if (width === 320) {
      const logo = await page.locator(".site-header .brand").boundingBox();
      const posting = await page.locator(".header-create").boundingBox();
      expect(Math.abs(logo!.y + logo!.height / 2 - posting!.y - posting!.height / 2)).toBeLessThan(2);
    }
    const overflowing = await article.locator("*").evaluateAll((elements) => elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
    }).map((element) => element.tagName));
    expect(overflowing, `${width}px brandbook overflow`).toEqual([]);
    const undersized = await article.locator("button, a").evaluateAll((elements) => elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).map((element) => element.textContent?.trim()));
    expect(undersized, `${width}px touch targets`).toEqual([]);
    await page.getByRole("navigation", { name: "Разделы брендбука" }).getByRole("link", { name: "Цвет", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Тепло и равновесие", exact: true })).toBeInViewport();
  }
});
