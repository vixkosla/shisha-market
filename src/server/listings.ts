import { randomUUID } from "node:crypto";
import {
  and,
  or,
  eq,
  desc,
  asc,
  sql,
  inArray,
  ilike,
  count,
  gte,
} from "drizzle-orm";
import type { Database } from "./db";
import { tryPublishListingToVk } from "./vk";
import {
  listings,
  photos,
  favorites,
  moderationEvents,
  user,
  legalAcceptances,
} from "./db/schema";
import {
  DomainError,
  isModerator,
  listingRevision,
  type Actor,
  type ListingInput,
} from "@/lib/listings";
import {
  publicationAcceptance,
  type PublicationAcceptance,
  LEGAL_VERSION,
} from "@/lib/legal";
import {
  allowedMarkets,
  assertListingPolicy,
  legalConfiguration,
  listingMarketAllowed,
} from "./legal-policy";
import { legalDocuments } from "./legal-documents";
import { requireAccountAcceptance } from "./legal-acceptance";

export type PhotoInput = { storageKey: string; width: number; height: number };
export async function createListing(
  db: Database,
  actor: Actor,
  input: ListingInput,
  images: PhotoInput[],
  acceptance: PublicationAcceptance,
) {
  return saveNewListing(db, actor, input, images, acceptance);
}

async function saveNewListing(
  db: Database,
  actor: Actor,
  input: ListingInput,
  images: PhotoInput[],
  acceptance: PublicationAcceptance,
  publicationNote?: string,
) {
  if (publicationNote !== undefined && !isModerator(actor))
    throw new DomainError("Недостаточно прав.");
  const consent = publicationAcceptance.safeParse(acceptance);
  if (!consent.success) throw new DomainError(consent.error.issues[0].message);
  assertListingPolicy(input);
  if (!images.length || images.length > 6)
    throw new DomainError("Добавьте от 1 до 6 фотографий.");
  await requireAccountAcceptance(db, actor.id);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    // Serialize creation for this account so concurrent requests cannot bypass the quota.
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, actor.id))
      .for("update");
    const [recent] = await tx
      .select({ total: count() })
      .from(listings)
      .where(
        and(
          eq(listings.ownerId, actor.id),
          gte(listings.createdAt, new Date(Date.now() - 86400000)),
        ),
      );
    if (recent.total >= 20)
      throw new DomainError("Лимит — 20 объявлений в сутки.");
    await tx.insert(listings).values({
      id,
      ownerId: actor.id,
      ...input,
      priceKopecks: input.price,
      status: publicationNote === undefined ? "pending" : "published",
      moderationNote: publicationNote ?? null,
      publishedAt: publicationNote === undefined ? null : new Date(),
      contactConditions: consent.data.conditions,
      legalVersion: LEGAL_VERSION,
    });
    await tx.insert(photos).values(
      images.map((image, position) => ({
        id: randomUUID(),
        listingId: id,
        ...image,
        position,
      })),
    );
    await tx.insert(legalAcceptances).values({
      id: randomUUID(),
      userId: actor.id,
      listingId: id,
      kind: "publication",
      version: LEGAL_VERSION,
      evidence: {
        ...consent.data,
        revision: 1,
        contactUrl: input.contactUrl,
        city: input.city,
        country: input.country,
        configuration: legalConfiguration(),
        document: legalDocuments().publication,
      },
    });
    if (publicationNote !== undefined)
      await tx.insert(moderationEvents).values({
        id: randomUUID(),
        listingId: id,
        actorId: actor.id,
        decision: "published",
        listingRevision: 1,
        note: publicationNote,
      });
  });
  if (publicationNote !== undefined) await tryPublishListingToVk(db, id);
  return id;
}
export async function moderateListing(
  db: Database,
  actor: Actor,
  id: string,
  decision: "published" | "rejected",
  note: string,
  expectedRevision: number,
) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  if (!listingRevision.safeParse(expectedRevision).success)
    throw new DomainError("Обновите очередь проверки: нужна актуальная версия объявления.");
  if (!["published", "rejected"].includes(decision))
    throw new DomainError("Некорректное решение.");
  if (note.length > 1000 || (decision === "rejected" && note.trim().length < 3))
    throw new DomainError("Укажите причину отклонения (3–1000 символов).");
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .for("update");
    if (!item || item.status !== "pending")
      throw new DomainError("Объявление уже обработано или не найдено.");
    if (item.revision !== expectedRevision)
      throw new DomainError("Автор изменил объявление. Обновите очередь и проверьте новую версию, включая фотографии.");
    if (decision === "published") {
      assertListingPolicy(item);
      if (item.legalVersion !== LEGAL_VERSION)
        throw new DomainError("Нет согласия с актуальной редакцией правил.");
    }
    const changed = await tx
      .update(listings)
      .set({
        status: decision,
        moderationNote: note.trim() || null,
        publishedAt: decision === "published" ? new Date() : null,
      })
      .where(and(eq(listings.id, id), eq(listings.status, "pending")))
      .returning();
    if (!changed.length)
      throw new DomainError("Объявление уже обработано или не найдено.");
    await tx.insert(moderationEvents).values({
      id: randomUUID(),
      listingId: id,
      actorId: actor.id,
      decision,
      listingRevision: item.revision,
      note: note.trim() || null,
    });
  });
  if (decision === "published") await tryPublishListingToVk(db, id);
}
export async function archiveListing(db: Database, actor: Actor, id: string) {
  const changed = await db
    .update(listings)
    .set({ status: "archived" })
    .where(and(eq(listings.id, id), eq(listings.ownerId, actor.id)))
    .returning();
  if (!changed.length) throw new DomainError("Объявление не найдено.");
}
export async function setFavorite(
  db: Database,
  actor: Actor,
  id: string,
  saved: boolean,
) {
  if (!saved) {
    await db
      .delete(favorites)
      .where(and(eq(favorites.userId, actor.id), eq(favorites.listingId, id)));
    return;
  }
  const [item] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.status, "published")));
  if (
    !item ||
    item.legalVersion !== LEGAL_VERSION ||
    !listingMarketAllowed(item)
  )
    throw new DomainError("Объявление недоступно.");
  await db
    .insert(favorites)
    .values({ userId: actor.id, listingId: id })
    .onConflictDoNothing();
}
export type CatalogFilters = {
  q?: string;
  category?: string;
  city?: string;
  page?: string;
};
function publicListingWhere() {
  const markets = allowedMarkets();
  if (!markets.length) return null;
  return and(
    eq(listings.status, "published"),
    eq(listings.legalVersion, LEGAL_VERSION),
    or(
      ...markets.map((market) =>
        and(
          eq(listings.country, market.country),
          inArray(listings.category, market.categories),
        ),
      ),
    )!,
  );
}
export async function listPublicSitemapEntries(
  db: Database,
  limit = 5000,
) {
  const where = publicListingWhere();
  if (!where) return [];
  return db
    .select({
      id: listings.id,
      publishedAt: listings.publishedAt,
      updatedAt: listings.updatedAt,
    })
    .from(listings)
    .where(where)
    .orderBy(desc(listings.publishedAt), desc(listings.id))
    .limit(Math.min(5000, Math.max(1, Math.floor(limit))));
}
export async function getCatalog(db: Database, filters: CatalogFilters) {
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(filters.page) || 1)),
  );
  const query = (filters.q ?? "").trim().slice(0, 120);
  const where = publicListingWhere();
  if (!where) return { items: [], page, hasNext: false };
  const conditions = [where];
  if (filters.category)
    conditions.push(eq(listings.category, filters.category.slice(0, 40)));
  if (filters.city?.trim())
    conditions.push(
      ilike(
        listings.city,
        filters.city
          .trim()
          .slice(0, 80)
          .replace(/[\\%_]/g, "\\$&"),
      ),
    );
  if (query)
    conditions.push(
      sql`to_tsvector('russian', ${listings.title} || ' ' || ${listings.description}) @@ websearch_to_tsquery('russian', ${query})`,
    );
  const rows = await db
    .select()
    .from(listings)
    .where(and(...conditions))
    .orderBy(desc(listings.publishedAt), desc(listings.id))
    .limit(13)
    .offset((page - 1) * 12);
  return {
    items: await withCovers(db, rows.slice(0, 12)),
    page,
    hasNext: rows.length > 12,
  };
}
export async function withCovers(
  db: Database,
  rows: (typeof listings.$inferSelect)[],
) {
  const covers = rows.length
    ? await db
        .select()
        .from(photos)
        .where(
          and(
            inArray(
              photos.listingId,
              rows.map((row) => row.id),
            ),
            eq(photos.position, 0),
          ),
        )
    : [];
  return rows.map((row) => ({
    ...row,
    coverId: covers.find((cover) => cover.listingId === row.id)?.id,
  }));
}

export async function operatorActor(db: Database): Promise<Actor> {
  const email = legalConfiguration().email;
  const [row] = await db.select().from(user).where(eq(user.email, email));
  if (!row) throw new DomainError("Оператор ещё не входил в аккаунт.");
  if (!isModerator(row))
    throw new DomainError("Почта оператора не имеет прав модератора.");
  return { id: row.id, role: row.role };
}

export async function createOperatorListing(
  db: Database,
  input: ListingInput,
  images: PhotoInput[],
  publish: boolean,
) {
  const actor = await operatorActor(db);
  const id = await saveNewListing(db, actor, input, images, operatorPublicationAcceptance(), publish ? "Служебная публикация оператора." : undefined);
  return { id, status: publish ? "published" : "pending", revision: 1, url: `${legalConfiguration().siteUrl.replace(/\/$/, "")}/listings/${id}` };
}

export function operatorPublicationAcceptance(): PublicationAcceptance {
  const operator = legalConfiguration().operator || "Оператор площадки";
  return {
    version: LEGAL_VERSION,
    fullName: operator.slice(0, 160),
    personalItem: true,
    adult: true,
    contact: true,
    city: true,
    conditions: "Служебная публикация оператора.",
  };
}

export async function listPendingListings(db: Database, actor: Actor) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  return db
    .select({
      id: listings.id,
      title: listings.title,
      city: listings.city,
      category: listings.category,
      revision: listings.revision,
      createdAt: listings.createdAt,
      updatedAt: listings.updatedAt,
    })
    .from(listings)
    .where(eq(listings.status, "pending"))
    .orderBy(asc(listings.updatedAt), asc(listings.id))
    .limit(50);
}
