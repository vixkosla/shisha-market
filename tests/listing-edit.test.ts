import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, asc, eq } from "drizzle-orm";
import { createEmbeddedDatabase } from "@/server/db";
import { legalAcceptances, listings, moderationEvents, photos, user } from "@/server/db/schema";
import { archiveListing, createListing, getCatalog, listPublicSitemapEntries, moderateListing } from "@/server/listings";
import { updateListing } from "@/server/listing-edit";
import { submitRequest, resolveRequest } from "@/server/support";
import { listingInput, type Actor } from "@/lib/listings";
import { LEGAL_VERSION, type PublicationAcceptance } from "@/lib/legal";

const client = new PGlite();
const db = createEmbeddedDatabase(client);
const input = listingInput.parse({
  title: "Тестовая керамическая чаша", description: "Синтетическая вещь для проверки редактирования, не предложение продажи.",
  category: "bowls", country: "RU", city: "Москва", price: "2500,50", condition: "used", contactUrl: "https://vk.ru/edit_test",
});
const consent: PublicationAcceptance = { version: LEGAL_VERSION, fullName: "Синтетический Автор", personalItem: true, adult: true, contact: true, city: true, conditions: "Только по существу объявления" };
const image = () => ({ storageKey: `${randomUUID()}.webp`, width: 100, height: 100 });
beforeAll(async () => { await migrate(db, {migrationsFolder: "drizzle"}); await migrate(db, {migrationsFolder: "drizzle"}); });
afterAll(() => client.close());
async function fixture() {
  const owner: Actor = {id: randomUUID(), role: "member"};
  const stranger: Actor = {id: randomUUID(), role: "member"};
  const moderator: Actor = {id: randomUUID(), role: "moderator"};
  await db.insert(user).values([owner, stranger, moderator].map(actor => ({...actor, email: `${actor.id}@example.test`, name: "Synthetic test"})));
  await db.insert(legalAcceptances).values(["terms", "processing"].map(kind => ({id: randomUUID(), userId: owner.id, kind, version: LEGAL_VERSION, evidence: {synthetic: true}})));
  const id = await createListing(db, owner, input, [image()], consent);
  const read = async () => (await db.select().from(listings).where(eq(listings.id, id)))[0];
  const readPhotos = () => db.select().from(photos).where(eq(photos.listingId, id)).orderBy(asc(photos.position));
  const oldPhotos = await readPhotos();
  const edit = (revision = 1, changes = {}) => updateListing(db, owner, id, revision, {...input, ...changes}, [oldPhotos[0].id], [], consent);
  return {owner, stranger, moderator, id, read, readPhotos, oldPhotos, edit};
}

describe("listing revisions and repeat moderation", () => {
  it("atomically hides a published edit and records fresh consent for its version", async () => {
    const f = await fixture();
    await moderateListing(db, f.moderator, f.id, "published", "Проверено", 1);
    expect((await getCatalog(db, {})).items.some(row => row.id === f.id)).toBe(true);
    const result = await updateListing(db, f.owner, f.id, 1, {...input, title: "Уточнённая тестовая чаша", price: 199950, contactUrl: "https://t.me/edit_test"}, [f.oldPhotos[0].id], [image()], consent);
    expect(result).toEqual({revision: 2, removedKeys: []});
    expect(await f.read()).toMatchObject({status: "pending", revision: 2, publishedAt: null, moderationNote: null, priceKopecks: 199950});
    const nextPhotos = await f.readPhotos();
    expect(nextPhotos).toHaveLength(2);
    expect(nextPhotos[0].id).toBe(f.oldPhotos[0].id);
    expect(nextPhotos.map(p => p.position)).toEqual([0, 1]);
    expect((await getCatalog(db, {})).items.some(row => row.id === f.id)).toBe(false);
    expect((await listPublicSitemapEntries(db)).some(row => row.id === f.id)).toBe(false);
    const evidence = await db.select().from(legalAcceptances).where(eq(legalAcceptances.listingId, f.id));
    expect(evidence).toHaveLength(2);
    expect(evidence.some(row => row.evidence.revision === 2 && row.evidence.contactUrl === "https://t.me/edit_test")).toBe(true);
  });
  it("lets the owner correct a rejection without erasing the earlier decision", async () => {
    const f = await fixture();
    await moderateListing(db, f.moderator, f.id, "rejected", "Уточните состояние", 1);
    await f.edit();
    expect(await f.read()).toMatchObject({status: "pending", revision: 2, moderationNote: null});
    await moderateListing(db, f.moderator, f.id, "published", "Исправлено", 2);
    const events = await db.select().from(moderationEvents).where(eq(moderationEvents.listingId, f.id)).orderBy(asc(moderationEvents.createdAt));
    expect(events.map(row => [row.decision, row.listingRevision])).toEqual([["rejected", 1], ["published", 2]]);
  });
  it("rejects edits by another member and even a non-owner moderator", async () => {
    const f = await fixture();
    for (const actor of [f.stranger, f.moderator]) {
      await db.insert(legalAcceptances).values(["terms", "processing"].map(kind => ({id: randomUUID(), userId: actor.id, kind, version: LEGAL_VERSION, evidence: {synthetic: true}})));
      await expect(updateListing(db, actor, f.id, 1, input, [f.oldPhotos[0].id], [], consent)).rejects.toThrow("не найдено");
    }
    expect((await f.read()).revision).toBe(1);
  });
  it("does not overwrite a newer save from another tab", async () => {
    const f = await fixture();
    const outcomes = await Promise.allSettled([f.edit(1, {title: "Первая новая версия"}), f.edit(1, {title: "Вторая новая версия"})]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await f.read()).revision).toBe(2);
  });
  it("blocks a stale moderation decision instead of approving unseen changes", async () => {
    const f = await fixture();
    await f.edit();
    await expect(moderateListing(db, f.moderator, f.id, "published", "", 1)).rejects.toThrow("Автор изменил");
    expect((await f.read()).status).toBe("pending");
    expect(await db.select().from(moderationEvents).where(eq(moderationEvents.listingId, f.id))).toHaveLength(0);
    await moderateListing(db, f.moderator, f.id, "published", "", 2);
    expect((await f.read()).status).toBe("published");
  });
  it("rejects foreign/duplicate photos and invalid photo totals without changing the listing", async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(updateListing(db, f.owner, f.id, 1, input, [other.oldPhotos[0].id], [], consent)).rejects.toThrow("не принадлежит");
    await expect(updateListing(db, f.owner, f.id, 1, input, [f.oldPhotos[0].id, f.oldPhotos[0].id], [], consent)).rejects.toThrow("список");
    await expect(updateListing(db, f.owner, f.id, 1, input, [], [], consent)).rejects.toThrow("1 до 6");
    await expect(updateListing(db, f.owner, f.id, 1, input, [f.oldPhotos[0].id], Array.from({length: 6}, image), consent)).rejects.toThrow("1 до 6");
    expect(await f.readPhotos()).toEqual(f.oldPhotos);
    expect((await f.read()).revision).toBe(1);
  });
  it("replaces a removed photo and returns only committed obsolete storage keys", async () => {
    const f = await fixture();
    const next = image();
    expect(await updateListing(db, f.owner, f.id, 1, input, [], [next], consent)).toEqual({revision: 2, removedKeys: [f.oldPhotos[0].storageKey]});
    const saved = await f.readPhotos();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({...next, position: 0});
    expect(saved[0].id).not.toBe(f.oldPhotos[0].id);
  });
  it("rolls back text, photos and consent together on a storage-key conflict", async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(updateListing(db, f.owner, f.id, 1, {...input, title: "Не сохранять эти правки"}, [], [other.oldPhotos[0]], consent)).rejects.toThrow();
    expect(await f.read()).toMatchObject({title: input.title, revision: 1});
    expect(await f.readPhotos()).toEqual(f.oldPhotos);
    expect(await db.select().from(legalAcceptances).where(eq(legalAcceptances.listingId, f.id))).toHaveLength(1);
  });
  it("requires current account/publication consent and the same category policy", async () => {
    const f = await fixture();
    await expect(updateListing(db, f.owner, f.id, 1, input, [f.oldPhotos[0].id], [], {...consent, version: "old"} as unknown as PublicationAcceptance)).rejects.toThrow();
    await expect(f.edit(1, {title: "Запрещённый никотин"})).rejects.toThrow("не принимаются");
    await db.delete(legalAcceptances).where(and(eq(legalAcceptances.userId, f.owner.id), eq(legalAcceptances.kind, "processing")));
    await expect(f.edit()).rejects.toThrow("подтвердите вход");
    expect((await f.read()).revision).toBe(1);
  });
  it("cannot revive archived, withdrawn or moderator-hidden content", async () => {
    const f = await fixture();
    await archiveListing(db, f.owner, f.id);
    await expect(f.edit()).rejects.toThrow("снято");
    const withdrawn = await fixture();
    await Promise.allSettled([withdrawn.edit(), submitRequest(db, withdrawn.owner, {kind: "withdraw", listingId: "", message: "Отзываю согласие на публикацию моих данных"})]);
    expect((await withdrawn.read()).status).toBe("archived");
    await expect(withdrawn.edit((await withdrawn.read()).revision)).rejects.toThrow("снято");
    const hidden = await fixture();
    const request = await submitRequest(db, hidden.owner, {kind: "appeal", listingId: hidden.id, message: "Синтетическое обращение для проверки снятия"});
    await resolveRequest(db, hidden.moderator, request, "Синтетическая публикация снята модератором", true);
    await expect(hidden.edit()).rejects.toThrow("снято");
  });
  it("bounds repeated submissions and rejects missing or fractional revisions", async () => {
    const f = await fixture();
    for (const revision of [0, NaN, 1.5]) await expect(f.edit(revision)).rejects.toThrow("Обновите");
    await db.insert(legalAcceptances).values(Array.from({length: 19}, () => ({id: randomUUID(), userId: f.owner.id, kind: "publication", version: LEGAL_VERSION, evidence: {synthetic: true}})));
    await expect(f.edit()).rejects.toThrow("Лимит");
    expect((await f.read()).revision).toBe(1);
  });
});
