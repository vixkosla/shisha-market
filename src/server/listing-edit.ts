import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { DomainError, keptPhotoIds, listingRevision, type Actor, type ListingInput } from "@/lib/listings";
import { LEGAL_VERSION, publicationAcceptance, type PublicationAcceptance } from "@/lib/legal";
import type { Database } from "./db";
import { legalAcceptances, listings, photos, user } from "./db/schema";
import { requireAccountAcceptance } from "./legal-acceptance";
import { assertListingPolicy, legalConfiguration } from "./legal-policy";
import { legalDocuments } from "./legal-documents";
import type { PhotoInput } from "./listings";

export async function updateListing(
  db: Database,
  actor: Actor,
  id: string,
  expectedRevision: number,
  input: ListingInput,
  keepIds: string[],
  images: PhotoInput[],
  acceptance: PublicationAcceptance,
) {
  const consent = publicationAcceptance.safeParse(acceptance);
  if (!consent.success) throw new DomainError(consent.error.issues[0].message);
  if (!listingRevision.safeParse(expectedRevision).success)
    throw new DomainError("Обновите страницу объявления и повторите отправку.");
  if (!keptPhotoIds.safeParse(keepIds).success || new Set(keepIds).size !== keepIds.length)
    throw new DomainError("Некорректный список фотографий.");
  if (keepIds.length + images.length < 1 || keepIds.length + images.length > 6)
    throw new DomainError("Оставьте от 1 до 6 фотографий.");
  assertListingPolicy(input);

  return db.transaction(async (tx) => {
    // Same account-first lock order as creation and consent withdrawal.
    const [account] = await tx.select({ id: user.id }).from(user)
      .where(eq(user.id, actor.id)).for("update");
    if (!account) throw new DomainError("Сначала войдите в аккаунт.");
    await requireAccountAcceptance(tx, actor.id);
    const [item] = await tx.select().from(listings)
      .where(and(eq(listings.id, id), eq(listings.ownerId, actor.id))).for("update");
    if (!item) throw new DomainError("Объявление не найдено.");
    // Archived includes moderator takedowns and withdrawn consent; never revive it here.
    if (item.status === "archived")
      throw new DomainError("Объявление снято с публикации. Для восстановления обратитесь в поддержку.");
    if (item.revision !== expectedRevision)
      throw new DomainError("Объявление уже изменено в другой вкладке. Скопируйте свои правки и откройте актуальную версию.");
    const [recent] = await tx.select({ total: count() }).from(legalAcceptances).where(and(
      eq(legalAcceptances.userId, actor.id),
      eq(legalAcceptances.kind, "publication"),
      gte(legalAcceptances.createdAt, new Date(Date.now() - 86400000)),
    ));
    if (recent.total >= 20)
      throw new DomainError("Лимит отправок на проверку исчерпан. Попробуйте позже.");

    const previous = await tx.select().from(photos)
      .where(eq(photos.listingId, id)).orderBy(asc(photos.position));
    if (keepIds.some((photoId) => !previous.some((photo) => photo.id === photoId)))
      throw new DomainError("Фотография не принадлежит этому объявлению.");
    const kept = previous.filter((photo) => keepIds.includes(photo.id));
    const removed = previous.filter((photo) => !keepIds.includes(photo.id));
    const revision = item.revision + 1;
    await tx.update(listings).set({
      ...input,
      priceKopecks: input.price,
      status: "pending",
      revision,
      publishedAt: null,
      moderationNote: null,
      contactConditions: consent.data.conditions,
      legalVersion: LEGAL_VERSION,
    }).where(eq(listings.id, id));
    // Rebuild positions atomically, preserving IDs of retained photos and their URLs.
    await tx.delete(photos).where(eq(photos.listingId, id));
    await tx.insert(photos).values([
      ...kept,
      ...images.map((image) => ({ ...image, id: randomUUID() })),
    ].map((photo, position) => ({ ...photo, listingId: id, position })));
    await tx.insert(legalAcceptances).values({
      id: randomUUID(), userId: actor.id, listingId: id, kind: "publication",
      version: LEGAL_VERSION,
      evidence: {
        ...consent.data, revision, contactUrl: input.contactUrl,
        city: input.city, country: input.country,
        configuration: legalConfiguration(), document: legalDocuments().publication,
      },
    });
    return { revision, removedKeys: removed.map((photo) => photo.storageKey) };
  });
}
