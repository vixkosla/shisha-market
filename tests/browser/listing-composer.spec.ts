import { expect, test } from "@playwright/test";

const body = [
  { t: "start", generating: false },
  { t: "status", lane: "answer", state: "done", text: "Ответ готов" },
  { t: "done" },
].map(event => JSON.stringify(event)).join("\n") + "\n";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/live?*", route => route.fulfill({ status: 200, contentType: "application/x-ndjson", body }));
});

test("«продаю …» in the bar opens the listing form in place and the preview follows the typing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Поиск по сайту" }).fill("Продаю HOOB Atom");
  await page.getByRole("button", { name: "Заполнить объявление" }).click();
  await expect(page).toHaveURL(/\?sell=1$/);
  const form = page.getByRole("region", { name: "Новое объявление" });
  await expect(form.getByLabel("Название")).toHaveValue("HOOB Atom");
  const preview = page.getByRole("complementary", { name: "Так объявление увидят посетители" });
  await expect(preview.getByRole("heading", { name: "HOOB Atom" })).toBeVisible();
  await form.getByLabel("Город").fill("Казань");
  await form.getByLabel("Цена, ₽").fill("9000");
  await expect(preview).toContainText("Казань");
  await expect(preview).toContainText(/9\s000\s₽/);
  // A guest fills the text; photos and consents come after login, and the draft survives the trip.
  await expect(form.getByRole("button", { name: "Войти и продолжить" })).toBeVisible();
  await expect(form.getByLabel("Ссылка для связи")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Продаю HOOB Atom" })).toBeVisible();
});

test("the start block opens an empty form and Close returns to the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Заполнить здесь" }).click();
  const form = page.getByRole("region", { name: "Новое объявление" });
  await expect(form.getByLabel("Название")).toHaveValue("");
  await form.getByRole("button", { name: "Закрыть" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#catalog")).toBeVisible();
});

test("pasted text unfolds into fields and the atlas names the brand next to the preview", async ({ page }) => {
  await page.goto("/?sell=1");
  const form = page.getByRole("region", { name: "Новое объявление" });
  await form.getByLabel(/Вставьте его целиком/).fill("HOOB Atom чёрный — 9 000 ₽\n\nПользовался полгода, без сколов, в комплекте коробка. Москва.");
  await form.getByRole("button", { name: "Разложить по полям" }).click();
  await expect(form.getByLabel("Название", { exact: true })).toHaveValue("HOOB Atom чёрный");
  await expect(form.getByLabel("Цена, ₽")).toHaveValue("9000");
  await expect(form.getByLabel("Город")).toHaveValue("Москва");
  await expect(form.getByRole("combobox", { name: "Категория", exact: true })).toHaveValue("hookahs");
  const understood = form.getByRole("region", { name: "Что поняли из текста" });
  await expect(understood).toContainText("HOOB · модель Atom");
  await understood.getByRole("button", { name: "Взять" }).click();
  await expect(form.getByLabel("Название", { exact: true })).toHaveValue("Кальян HOOB Atom чёрный");
  await expect(page.getByRole("region", { name: "Из атласа брендов: HOOB" })).toContainText("Россия");
});

test("a tobacco listing is flagged while typing", async ({ page }) => {
  await page.goto("/?sell=1");
  const form = page.getByRole("region", { name: "Новое объявление" });
  await form.getByLabel("Название", { exact: true }).fill("Табак для кальяна");
  await expect(form.getByRole("alert")).toContainText("не принимаются");
});
