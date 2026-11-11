import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/session";
import { getDatabase } from "@/server/db";
import { listings } from "@/server/db/schema";
import { withCovers } from "@/server/listings";
import { ListingCard } from "@/components/listing-card";
import { SignOut } from "@/components/auth-client";
export const metadata = { title: "Мои объявления" };
export default async function AccountPage() {
  const actor = await requireUser();
  const db = await getDatabase();
  const rows = await withCovers(
    db,
    await db
      .select()
      .from(listings)
      .where(eq(listings.ownerId, actor.id))
      .orderBy(desc(listings.createdAt))
      .limit(100),
  );
  return (
    <section className="page-section">
      <div className="section-heading account-heading">
        <div>
          <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
          <h1 className="page-title">Мои объявления</h1>
          <p className="muted">{actor.email}</p>
        </div>
        <div className="account-actions"><Link className="button button-primary" href="/listings/new">Подать объявление</Link><SignOut /></div>
      </div>
      <p><Link className="text-link" href="/account/mcp">Мои ИИ-агенты: подключение и отзыв доступа →</Link></p>
      <p>
        <Link className="text-link" href="/support">
          Мои обращения, управление данными и отзыв согласия →
        </Link>
      </p>
      {rows.some(item => item.status === "pending") && <p className="notice">Объявления «На проверке» уже сохранены, но ещё не видны посетителям. Откройте карточку, чтобы проверить фото или исправить текст. После решения модератора статус и комментарий появятся здесь.</p>}
      {rows.length ? (
        <>
          <p className="muted small">Последние 100 объявлений</p>
          <div className="listing-grid">
            {rows.map((item) => (
              <ListingCard key={item.id} item={item} showStatus />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>Ваше первое объявление — впереди</h3>
          <p>Добавьте фотографии и расскажите о вещи.</p>
          <Link href="/listings/new" className="button button-primary">
            Подать объявление
          </Link>
        </div>
      )}
    </section>
  );
}
