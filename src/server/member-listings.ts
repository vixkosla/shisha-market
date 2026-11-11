import {and, asc, eq} from "drizzle-orm";
import type {Database} from "./db";
import {listings, photos} from "./db/schema";
import type {Actor} from "@/lib/listings";
import {AgentError} from "./agent-auth";
import {listingMarketAllowed} from "./legal-policy";
import {LEGAL_VERSION} from "@/lib/legal";
import {appUrl} from "./auth";

export async function inspectMemberListing(db: Database, actor: Actor, id: string) {
  const [row] = await db.select().from(listings).where(and(eq(listings.id, id), eq(listings.ownerId, actor.id)));
  if (!row) throw new AgentError("Объявление не найдено.", 404);
  const images = await db.select({id: photos.id, width: photos.width, height: photos.height, position: photos.position})
    .from(photos).where(eq(photos.listingId, id)).orderBy(asc(photos.position));
  return {id: row.id, title: row.title, description: row.description, category: row.category, country: row.country, city: row.city,
    price: (row.priceKopecks / 100).toFixed(2), condition: row.condition, contactUrl: row.contactUrl, contactConditions: row.contactConditions,
    status: row.status, revision: row.revision, moderationNote: row.moderationNote, canEdit: row.status !== "archived",
    publiclyVisible: row.status === "published" && row.legalVersion === LEGAL_VERSION && listingMarketAllowed(row), photos: images,
    url: `${appUrl()}/listings/${id}`};
}
export async function archiveMemberListing(db: Database, actor: Actor, id: string, revision: number) {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(listings).where(and(eq(listings.id, id), eq(listings.ownerId, actor.id))).for("update");
    if (!row) throw new AgentError("Объявление не найдено.", 404);
    if (row.revision !== revision) throw new AgentError("Объявление изменилось. Получите актуальный revision.", 409);
    await tx.update(listings).set({status: "archived"}).where(eq(listings.id, id));
    return {id, status: "archived", revision};
  });
}
