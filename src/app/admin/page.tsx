import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { requireUser } from "@/server/session";
import { getDatabase } from "@/server/db";
import { listings } from "@/server/db/schema";
import { isModerator, formatPrice } from "@/lib/listings";
import { ReviewForm } from "@/components/review-form";
import { ResolveSupportForm } from "@/components/support-form";
import { ResolveSuggestionForm } from "@/components/suggestion-form";
import { requestsFor, suggestionsFor } from "@/server/support";
import { requestKinds, countries } from "@/lib/legal";
export const metadata = { title: "Модерация" };
export default async function AdminPage() {
  const actor = await requireUser();
  if (!isModerator(actor)) notFound();
  const db = await getDatabase();
  const requests = await requestsFor(db, actor, true);
  const ideas = await suggestionsFor(db, actor);
  const items = await db
    .select()
    .from(listings)
    .where(eq(listings.status, "pending"))
    .orderBy(asc(listings.updatedAt), asc(listings.id))
    .limit(50);
  return (
    <section className="narrow wide page-section">
      <p className="eyebrow">ДЛЯ МОДЕРАТОРОВ</p>
      <h1 className="page-title">Очередь проверки</h1>
      <p className="page-intro">
        Первые 50 объявлений в порядке поступления. Все решения записываются в
        журнал.
      </p>
      <p className="notice">
        Проверяйте предмет и фотографии, признаки коммерческой торговли, чужие
        данные и условия публикации контакта. Не одобряйте предложение только по
        галочке автора. <Link href="/legal/rules">Правила →</Link>
      </p>
      {!items.length && (
        <div className="empty-state">
          <h3>Все объявления проверены</h3>
        </div>
      )}
      {items.map((item) => (
        <article className="panel review-item" key={item.id}>
          <Link href={`/listings/${item.id}`} className="text-link">
            <h2>{item.title} ↗</h2>
          </Link>
          <p>
            {formatPrice(item.priceKopecks)} · {item.city}
          </p>
          <p className="description">{item.description}</p>
          <p className="muted small">
            Страна: {countries[item.country as keyof typeof countries]} ·
            Категория: {item.category} · Согласие:{" "}
            {item.legalVersion ?? "отсутствует"} · Версия {item.revision}
          </p>
          {item.contactConditions && (
            <p className="notice">
              Условия распространения контакта: {item.contactConditions}.
              Одобряйте только если площадка может их выполнить.
            </p>
          )}
          <ReviewForm key={item.revision} id={item.id} revision={item.revision} />
        </article>
      ))}
      <h2>Обращения пользователей</h2>
      {!requests.length && <p className="muted">Открытых обращений нет.</p>}
      {requests.map((item) => (
        <article className="panel review-item" key={item.id}>
          <h3>{requestKinds[item.kind as keyof typeof requestKinds]}</h3>
          <p className="muted small">Номер: {item.id}</p>
          <p className="description">{item.message}</p>
          {item.listingId && (
            <Link className="text-link" href={`/listings/${item.listingId}`}>
              Связанное объявление →
            </Link>
          )}
          <ResolveSupportForm id={item.id} listing={!!item.listingId} />
        </article>
      ))}
      <h2>Предложения</h2>
      {!ideas.length && <p className="muted">Открытых предложений нет.</p>}
      {ideas.map((item) => (
        <article className="panel review-item" key={item.id}>
          <h3>Предложение площадке</h3>
          <p className="muted small">Номер: {item.id}</p>
          {item.contact ? (
            <p className="muted small">Контакт: {item.contact}</p>
          ) : (
            <p className="muted small">Контакт не указан</p>
          )}
          <p className="description">{item.message}</p>
          <ResolveSuggestionForm id={item.id} />
        </article>
      ))}
    </section>
  );
}
