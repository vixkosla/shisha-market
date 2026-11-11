import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/session";
import { getDatabase } from "@/server/db";
import { favorites, listings } from "@/server/db/schema";
import { withCovers } from "@/server/listings";
import { ListingCard } from "@/components/listing-card";
import { listingMarketAllowed } from "@/server/legal-policy";
import { LEGAL_VERSION } from "@/lib/legal";
export const metadata = { title: "Избранное" };
export default async function FavoritesPage() {
  const actor = await requireUser();
  const db = await getDatabase();
  const rows = await db
    .select({ item: listings })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .where(
      and(eq(favorites.userId, actor.id), eq(listings.status, "published")),
    )
    .orderBy(desc(favorites.createdAt))
    .limit(100);
  const items = await withCovers(
    db,
    rows
      .map((row) => row.item)
      .filter(
        (item) =>
          item.legalVersion === LEGAL_VERSION && listingMarketAllowed(item),
      ),
  );
  return (
    <section className="page-section">
      <p className="eyebrow">СОХРАНЁННЫЕ НАХОДКИ</p>
      <h1 className="page-title">Избранное</h1>
      <p className="page-intro">
        До 100 последних сохранённых объявлений. Снятые с публикации здесь не
        отображаются.
      </p>
      {items.length ? (
        <div className="listing-grid">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>Пока пусто</h3>
          <p>
            Добавляйте интересные объявления в избранное, чтобы вернуться к ним
            позже.
          </p>
        </div>
      )}
    </section>
  );
}
