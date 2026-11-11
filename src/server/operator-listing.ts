import { and, asc, eq } from "drizzle-orm";
import type { Database } from "./db";
import { listings, photos } from "./db/schema";
import { DomainError, isModerator, type Actor } from "@/lib/listings";
import { legalConfiguration, listingMarketAllowed } from "./legal-policy";
import { LEGAL_VERSION } from "@/lib/legal";

export async function inspectOperatorListing(db: Database, actor: Actor, id: string) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  const [item] = await db.select().from(listings).where(eq(listings.id, id));
  if (!item) throw new DomainError("Объявление не найдено.");
  const images = await db.select({id: photos.id, width: photos.width, height: photos.height, position: photos.position})
    .from(photos).where(eq(photos.listingId, id)).orderBy(asc(photos.position));
  const origin = legalConfiguration().siteUrl.replace(/\/$/, "");
  return {
    id: item.id, title: item.title, description: item.description, category: item.category,
    country: item.country, city: item.city, price: (item.priceKopecks / 100).toFixed(2), condition: item.condition,
    contactUrl: item.contactUrl, contactConditions: item.contactConditions, status: item.status,
    revision: item.revision, moderationNote: item.moderationNote, canEdit: item.ownerId === actor.id && item.status !== "archived",
    url: `${origin}/listings/${id}`, publiclyVisible: item.status === "published" && listingMarketAllowed(item) && item.legalVersion === LEGAL_VERSION,
    photos: images.map(photo => ({...photo, url: `${origin}/api/operator/listings/${id}/photos/${photo.id}`})),
    nextStep: item.status === "pending" ? "Проверьте текст и get_listing_photo для всех фото. Затем передайте текущий revision в moderate_listing."
      : item.status === "rejected" ? "Исправьте своё объявление через update_listing с текущим revision: оно вернётся на проверку."
      : item.status === "published" ? "Объявление опубликовано. Правки потребуют повторной модерации." : "Публикация снята; восстановление — через поддержку.",
  };
}

export async function archiveOperatorListing(db: Database, actor: Actor, id: string, revision: number) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  await db.transaction(async tx => {
    const [item] = await tx.select().from(listings).where(and(eq(listings.id, id), eq(listings.ownerId, actor.id))).for("update");
    if (!item) throw new DomainError("Можно снять только собственное объявление оператора.");
    if (item.revision !== revision) throw new DomainError("Объявление изменилось. Получите актуальную версию перед снятием.");
    await tx.update(listings).set({status: "archived"}).where(eq(listings.id, id));
  });
  return {id, status: "archived", revision};
}
