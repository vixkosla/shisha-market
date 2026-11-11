import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_VERSION } from "@/lib/legal";
import { listingInput } from "@/lib/listings";
import { createEmbeddedDatabase } from "@/server/db";
import { legalAcceptances, listings, moderationEvents, photos, user } from "@/server/db/schema";
import { createOperatorListing } from "@/server/listings";
import { publishListingToVk } from "@/server/vk";

vi.mock("@/server/storage", () => ({
  readPhoto: vi.fn(async () => Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64",
  )),
}));

const client = new PGlite();
const db = createEmbeddedDatabase(client);
const operatorId = "synthetic-operator";
const input = listingInput.parse({
  title: "Синтетическая тестовая чаша",
  description: "Синтетическое объявление для проверки транзакций, не предложение продажи.",
  category: "bowls", country: "RU", city: "Москва", price: "2500", condition: "used",
  contactUrl: "https://vk.ru/test_profile",
});
const image = () => ({ storageKey: `${randomUUID()}.webp`, width: 1, height: 1 });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(user).values({ id: operatorId, name: "Synthetic operator", email: "operator@example.test", role: "admin" });
  await db.insert(legalAcceptances).values(["terms", "processing"].map(kind => ({
    id: randomUUID(), userId: operatorId, kind, version: LEGAL_VERSION, evidence: { synthetic: true },
  })));
});
beforeEach(() => {
  vi.stubEnv("LEGAL_CONTACT_EMAIL", "operator@example.test");
  vi.stubEnv("VK_GROUP_TOKEN", "");
  vi.stubEnv("VK_GROUP_ID", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
afterAll(() => client.close());

describe("operator publication transaction", () => {
  it("commits the listing, photo, consent and decision together", async () => {
    const result = await createOperatorListing(db, input, [image()], true);
    expect(result.status).toBe("published");
    const [item] = await db.select().from(listings).where(eq(listings.id, result.id));
    expect(item.publishedAt).toBeInstanceOf(Date);
    expect(await db.select().from(photos).where(eq(photos.listingId, result.id))).toHaveLength(1);
    expect(await db.select().from(legalAcceptances).where(eq(legalAcceptances.listingId, result.id))).toHaveLength(1);
    expect(await db.select().from(moderationEvents).where(eq(moderationEvents.listingId, result.id))).toMatchObject([
      { decision: "published", listingRevision: 1, actorId: operatorId },
    ]);
  });

  it("rolls back creation as well when writing the moderation decision fails", async () => {
    const before = await db.select({ id: listings.id }).from(listings);
    const photo = image();
    await db.execute(sql`CREATE FUNCTION synthetic_moderation_failure() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'synthetic moderation failure'; END;
    $$ LANGUAGE plpgsql`);
    await db.execute(sql`CREATE TRIGGER synthetic_moderation_failure BEFORE INSERT ON moderation_events
      FOR EACH ROW EXECUTE FUNCTION synthetic_moderation_failure()`);
    try {
      await expect(createOperatorListing(db, input, [photo], true)).rejects.toThrow();
      expect(await db.select({ id: listings.id }).from(listings)).toEqual(before);
      expect(await db.select().from(photos).where(eq(photos.storageKey, photo.storageKey))).toHaveLength(0);
    } finally {
      await db.execute(sql`DROP TRIGGER synthetic_moderation_failure ON moderation_events`);
      await db.execute(sql`DROP FUNCTION synthetic_moderation_failure()`);
    }
  });
});

describe("concurrent VK publication", () => {
  it("sends one post when two workers publish the same listing", async () => {
    const { id } = await createOperatorListing(db, input, [image()], true);
    vi.stubEnv("VK_GROUP_TOKEN", "synthetic-token");
    vi.stubEnv("VK_GROUP_ID", "90328237");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("photos.getWallUploadServer"))
        return Response.json({ response: { upload_url: "https://upload.vk.test/1" } });
      if (target === "https://upload.vk.test/1")
        return Response.json({ photo: "[]", server: 123, hash: "hash" });
      if (target.includes("photos.saveWallPhoto"))
        return Response.json({ response: [{ id: 777, owner_id: -90328237 }] });
      if (target.includes("wall.post")) return Response.json({ response: { post_id: 42 } });
      throw new Error("Unexpected synthetic request");
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await Promise.all([publishListingToVk(db, id), publishListingToVk(db, id)]);
    expect(result.filter(Boolean)).toEqual(["42"]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("wall.post"))).toHaveLength(1);
    const [item] = await db.select().from(listings).where(eq(listings.id, id));
    expect(item.vkPostId).toBe("42");
  });
});
