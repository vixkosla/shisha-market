import { test, expect } from "@playwright/test";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("official MCP client: create → private photo review → reject → correct → approve → withdraw", async ({page, request}) => {
  test.setTimeout(90000);
  const token = (await readFile(".data/e2e-operator-token", "utf8")).trim();
  const directory = await mkdtemp(join(tmpdir(), "shisha-mcp-journey-"));
  const photo = join(directory, "synthetic.png");
  const replacement = join(directory, "synthetic-detail.png");
  await sharp({create: {width: 640, height: 480, channels: 3, background: "#b6bfa5"}}).png().toFile(photo);
  await sharp({create: {width: 400, height: 600, channels: 3, background: "#c49677"}}).png().toFile(replacement);
  const client = new Client({name: "shisha-end-to-end-test", version: "1.0.0"});
  const transport = new StdioClientTransport({command: process.execPath, args: [resolve("mcp/listings.mjs")], env: {SHISHA_APP_URL: "http://127.0.0.1:4388", SHISHA_OPERATOR_TOKEN: token}, stderr: "pipe"});
  async function call(name: string, args: Record<string, unknown> = {}) {
    return client.callTool({name, arguments: args});
  }
  function data(result: Awaited<ReturnType<typeof call>>): Record<string, unknown> {
    expect(result.isError, result.isError ? JSON.stringify(result.content) : undefined).not.toBe(true);
    const content = result.content as {type: string; text?: string}[];
    return JSON.parse(content.find(block => block.type === "text")!.text!);
  }
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(7);
    const created = data(await call("create_listing", {title: "Синтетическая чаша через MCP", description: "Синтетическое описание для сквозной проверки, не предложение продажи.", category: "bowls", city: "Москва", price: "2500", contactUrl: "https://vk.ru/mcp_test", photos: [photo]}));
    const id = String(created.id);
    expect(created.status).toBe("pending");
    expect(created.revision).toBe(1);
    expect((await request.get(`/listings/${id}`)).status()).toBe(404);
    expect(data(await call("list_pending")).items).toEqual(expect.arrayContaining([expect.objectContaining({id, revision: 1})]));
    const pending = data(await call("get_listing", {id}));
    expect(pending.publiclyVisible).toBe(false);
    expect(pending.canEdit).toBe(true);
    expect(pending).not.toHaveProperty("email");
    expect(pending).not.toHaveProperty("fullName");
    const photos = pending.photos as {id: string; url: string}[];
    expect((await request.get(`/media/${photos[0].id}`)).status()).toBe(404);
    expect((await request.get(`/api/operator/listings/${id}/photos/${photos[0].id}`)).status()).toBe(401);
    const image = await call("get_listing_photo", {id, photoId: photos[0].id});
    expect(image.isError).not.toBe(true);
    expect(image.content).toEqual([expect.objectContaining({type: "image", mimeType: "image/webp"})]);
    const photoData = image.content as {data: string}[];
    expect((await sharp(Buffer.from(photoData[0].data, "base64")).metadata()).width).toBe(640);
    data(await call("moderate_listing", {id, decision: "rejected", revision: 1, note: "Уточните состояние и добавьте фото детали"}));
    expect(data(await call("get_listing", {id})).moderationNote).toContain("Уточните");
    const corrected = data(await call("update_listing", {id, revision: 1, description: "Исправленное синтетическое описание, состояние и все дефекты перечислены.", price: "1900", photos: [replacement]}));
    expect(corrected).toMatchObject({id, status: "pending", revision: 2});
    const stale = await call("moderate_listing", {id, decision: "published", revision: 1});
    expect(stale.isError).toBe(true);
    const current = data(await call("get_listing", {id}));
    const currentPhotos = current.photos as {id: string}[];
    expect(currentPhotos).toHaveLength(2);
    for (const photo of currentPhotos) expect((await call("get_listing_photo", {id, photoId: photo.id})).isError).not.toBe(true);
    data(await call("moderate_listing", {id, decision: "published", revision: 2}));
    expect(data(await call("get_listing", {id})).publiclyVisible).toBe(true);
    await page.goto(`/listings/${id}`);
    await expect(page.getByRole("heading", {name: "Синтетическая чаша через MCP", exact: true})).toBeVisible();
    await expect(page.locator(".gallery img")).toHaveCount(2);
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {value: {writeText: () => Promise.reject(new Error("synthetic denial"))}, configurable: true}));
    await page.getByRole("button", {name: "Скопировать ссылку на объявление"}).click();
    await expect(page.getByLabel("Ссылка на объявление", {exact: true})).toHaveValue(`http://127.0.0.1:4388/listings/${id}`);
    expect((await call("archive_listing", {id, revision: 1})).isError).toBe(true);
    expect(data(await call("archive_listing", {id, revision: 2})).status).toBe("archived");
    expect((await request.get(`/listings/${id}`)).status()).toBe(404);
    expect((await request.get(`/media/${photos[0].id}`)).status()).toBe(404);
    expect((await call("update_listing", {id, revision: 2, title: "Нельзя восстановить снятое"})).isError).toBe(true);
  } finally { await client.close(); }
});
