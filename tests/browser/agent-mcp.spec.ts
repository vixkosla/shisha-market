import {test, expect, type Page} from "@playwright/test";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {mkdtemp, readFile, mkdir, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import sharp from "sharp";

async function login(page: Page, email: string) {
  await page.getByLabel("Электронная почта").fill(email);
  for (const name of [/Мне исполнилось/, /Принимаю пользовательское/, /Даю отдельное/]) await page.getByRole("checkbox", {name}).check();
  const started = Date.now();
  const sent = page.waitForResponse(response => response.url().endsWith("/api/auth/email-otp/send-verification-otp") && response.request().method() === "POST");
  await page.getByRole("button", {name: "Получить код", exact: true}).click();
  expect((await sent).ok()).toBe(true);
  let code = "";
  await expect.poll(async () => {
    const rows = (await readFile(".data/e2e-mailbox.jsonl", "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
    code = rows.findLast(row => row.email === email && row.time >= started)?.otp || "";
    return !!code;
  }).toBe(true);
  await page.getByLabel("Код из письма").fill(code);
  await page.getByRole("button", {name: "Войти", exact: true}).click();
  await expect(page).toHaveURL(/\/account\/mcp\?request=/);
}

test("ordinary users connect through browser approval, manage their own listings and revoke access", async ({page, browser, request}, testInfo) => {
  test.setTimeout(180000);
  const base = String(testInfo.project.use.baseURL);
  const directory = await mkdtemp(join(tmpdir(), "shisha-personal-mcp-"));
  const shotDir = "docs/reviews/user-mcp-2026-11-07";
  await mkdir(shotDir, {recursive: true});
  const image = join(directory, "synthetic.webp");
  await sharp({create: {width: 640, height: 480, channels: 3, background: "#b0c5a0"}}).webp().toFile(image);
  const first = new Client({name: "personal-agent-one", version: "1.0.0"});
  const second = new Client({name: "personal-agent-two", version: "1.0.0"});
  const other = await browser.newContext({baseURL: base});
  const otherPage = await other.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
    return client.callTool({name, arguments: args});
  }
  async function data(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const result = await call(client, name, args);
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
    return JSON.parse((result.content as {text: string}[])[0].text);
  }
  try {
    for (const [client, file] of [[first, "one.json"], [second, "two.json"]] as const) {
      await client.connect(new StdioClientTransport({command: process.execPath, args: [resolve("mcp/user.mjs")], env: {...process.env, SHISHA_APP_URL: base, SHISHA_USER_AUTH_FILE: join(directory, file)} as Record<string, string>, stderr: "pipe"}));
    }
    const tools = (await first.listTools()).tools.map(tool => tool.name);
    expect(tools).toHaveLength(11);
    expect(tools).not.toContain("moderate_listing");
    expect(tools).not.toContain("list_pending");
    expect((await call(first, "list_my_listings")).isError).toBe(true);
    const pair = await data(first, "connect_account", {name: "Мой тестовый помощник"});
    expect(pair).not.toHaveProperty("deviceSecret");
    expect(await data(first, "finish_connection")).toEqual({status: "pending"});
    await page.goto(String(pair.verificationUrl));
    await login(page, `mcp-first-${Date.now()}@e2e.example.test`);
    await page.getByLabel("Код от вашего агента").fill(String(pair.userCode));
    await page.getByRole("checkbox", {name: /Разрешаю этому агенту/}).check();
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height: 1000});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path: `${shotDir}/connect-${width}.png`, fullPage: true});
    }
    await page.getByRole("button", {name: "Подключить агента", exact: true}).click();
    await expect(page.getByRole("status")).toContainText(/Доступ разрешён|Подключение.*разрешено/);
    const linked = await data(first, "finish_connection");
    expect(linked).toMatchObject({status: "connected", role: "member"});
    expect(JSON.stringify(linked)).not.toContain("smu_");
    expect((await stat(join(directory, "one.json"))).mode & 0o777).toBe(0o600);
    const saved = JSON.parse(await readFile(join(directory, "one.json"), "utf8"));
    const secondPair = await data(second, "connect_account", {name: "Другой пользователь"});
    await otherPage.goto(String(secondPair.verificationUrl));
    await login(otherPage, `mcp-second-${Date.now()}@e2e.example.test`);
    await otherPage.getByLabel("Код от вашего агента").fill(String(secondPair.userCode));
    await otherPage.getByRole("checkbox", {name: /Разрешаю этому агенту/}).check();
    await otherPage.getByRole("button", {name: "Подключить агента", exact: true}).click();
    await expect(otherPage.getByRole("status")).toContainText(/Доступ разрешён|Подключение.*разрешено/);
    await data(second, "finish_connection");
    const rules = await data(first, "get_publication_rules");
    const acceptance = {version: rules.version, fullName: "Synthetic Test Person", personalItem: true, adult: true, contact: true, city: true, conditions: ""};
    const fields = {title: "Синтетический личный аксессуар MCP", description: "Тестовые данные для проверки личного MCP. Не предложение продажи.", category: "accessories", city: "Москва", price: "1250.50", contactUrl: "https://t.me/synthetic_user_test", photos: [image]};
    expect((await call(first, "create_listing", fields)).isError).toBe(true);
    expect((await call(first, "create_listing", {...fields, acceptance, publish: true})).isError).toBe(true);
    const created = await data(first, "create_listing", {...fields, acceptance});
    const id = String(created.id);
    expect(created).toMatchObject({status: "pending", revision: 1});
    expect((await request.get(`/listings/${id}`)).status()).toBe(404);
    expect((await data(second, "list_my_listings")).items).toEqual([]);
    for (const name of ["get_listing", "update_listing", "archive_listing"]) {
      expect((await call(second, name, {id, revision: 1, acceptance, title: "Must not change"})).isError).toBe(true);
    }
    const item = await data(first, "get_listing", {id});
    const photoId = String((item.photos as {id: string}[])[0].id);
    expect((await call(first, "get_listing_photo", {id, photoId})).content).toEqual([expect.objectContaining({type: "image", mimeType: "image/webp"})]);
    expect((await call(second, "get_listing_photo", {id, photoId})).isError).toBe(true);
    expect((await request.get(`/api/member/listings/${id}/photos/${photoId}`)).status()).toBe(401);
    expect((await request.get("/api/operator/listings", {headers: {authorization: `Bearer ${saved.token}`}})).status()).toBe(401);
    const updated = await data(first, "update_listing", {id, revision: 1, acceptance, price: "999.25"});
    expect(updated).toMatchObject({status: "pending", revision: 2});
    expect(await data(first, "get_listing", {id})).toMatchObject({price: "999.25"});
    expect((await call(first, "update_listing", {id, revision: 1, acceptance, price: "1"})).isError).toBe(true);
    const operatorToken = (await readFile(".data/e2e-operator-token", "utf8")).trim();
    expect((await request.post(`/api/operator/listings/${id}`, {headers: {authorization: `Bearer ${operatorToken}`}, data: {decision: "published", revision: 2}})).status()).toBe(200);
    expect((await request.get(`/listings/${id}`)).status()).toBe(200);
    await data(first, "archive_listing", {id, revision: 2});
    expect((await request.get(`/listings/${id}`)).status()).toBe(404);
    await page.goto("/account/mcp");
    await page.getByRole("button", {name: "Отозвать доступ", exact: true}).click();
    await expect(page.getByText("Доступ отозван", {exact: true})).toBeVisible();
    expect((await call(first, "list_my_listings")).isError).toBe(true);
    expect(await data(second, "get_account")).toMatchObject({role: "member"});
    await data(second, "disconnect_account");
    expect((await call(second, "list_my_listings")).isError).toBe(true);
    await page.goto("/mcp");
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height: 1000});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path: `${shotDir}/guide-${width}.png`, fullPage: true});
    }
    expect(errors).toEqual([]);
  } finally {await first.close(); await second.close(); await other.close();}
});
