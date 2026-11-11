/* Authenticated media must bypass the shared Next image cache. */
/* eslint-disable @next/next/no-img-element */
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, asc } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { listings, photos, favorites } from "@/server/db/schema";
import { currentUser } from "@/server/session";
import {
  canRead,
  formatPrice,
  categories,
  statusLabels,
  isModerator,
} from "@/lib/listings";
import { countries, LEGAL_VERSION } from "@/lib/legal";
import { listingMarketAllowed } from "@/server/legal-policy";
import { archiveAction, favoriteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { ShareListing } from "@/components/share-listing";
import { exampleListingCopy, isExampleListing } from "@/lib/listing-examples";
import { readListing as readSmart } from "@/lib/listing-smart";
import { smartAtlas } from "@/server/listing-atlas";
import { BrandNote } from "@/components/brand-note";
import { subcategoryLabel } from "@/lib/listing-taxonomy";

const readListing = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const actor = await currentUser();
  const db = await getDatabase();
  const [item] = await db.select().from(listings).where(eq(listings.id, id));
  if (!item || !canRead(item.status, item.ownerId, actor)) notFound();
  if (
    actor?.id !== item.ownerId &&
    !(actor && isModerator(actor)) &&
    (!listingMarketAllowed(item) || item.legalVersion !== LEGAL_VERSION)
  )
    notFound();
  const images = await db
    .select()
    .from(photos)
    .where(eq(photos.listingId, id))
    .orderBy(asc(photos.position));
  return { item, images, actor, db };
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { item } = await readListing((await params).id);
  const example = isExampleListing(item.id);
  return {
    title: example ? `${item.title} — пример объявления` : item.title,
    description: example ? exampleListingCopy.ru.noticeText : item.description.slice(0, 160),
    alternates: { canonical: `/listings/${item.id}` },
    robots: {index: item.status === "published" && !example, follow: item.status === "published"},
  };
}
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { item, images, actor, db } = await readListing((await params).id);
  const example = isExampleListing(item.id);
  const exampleCopy = exampleListingCopy.ru;
  const saved = actor
    ? (
        await db
          .select()
          .from(favorites)
          .where(
            and(
              eq(favorites.listingId, item.id),
              eq(favorites.userId, actor.id),
            ),
          )
      ).length > 0
    : false;
  return (
    <section className="page-section">
      <Link href="/" className="text-link">
        ← Все объявления
      </Link>
      {example && <aside className="listing-example-notice" aria-label="Пример объявления">
        <strong>{exampleCopy.noticeTitle}</strong>
        <p>{exampleCopy.noticeText}</p>
        <Link className="text-link" href="/listings/new">{exampleCopy.createLabel} →</Link>
      </aside>}
      {item.status !== "published" && (
        <p className="notice status-notice">
          {statusLabels[item.status]}. Объявление не показывается в публичном
          каталоге.
          {item.moderationNote && ` Комментарий: ${item.moderationNote}`}
          {actor?.id === item.ownerId && item.status === "pending" && <> Объявление сохранено и отправлено на ручную проверку. При отказе вы увидите причину и сможете исправить карточку. <Link className="text-link" href="/account">Мои объявления и статус →</Link></>}
        </p>
      )}
      <div className="detail-grid">
        <div className="gallery">
          {images.map((image, i) => example ? (
            <figure key={image.id} className="gallery-example-photo">
              <img src={`/media/${image.id}`} alt={`${item.title} — пример оформления, фото ${i + 1}`} width={image.width} height={image.height} />
              <figcaption className="listing-example-label">{exampleCopy.photoLabel}</figcaption>
            </figure>
          ) : (
            <img
              key={image.id}
              src={`/media/${image.id}`}
              alt={`${item.title} — фото ${i + 1}`}
              width={image.width}
              height={image.height}
            />
          ))}
        </div>
        <div className="detail-info">
          <p className="eyebrow">
            {[categories[item.category as keyof typeof categories], subcategoryLabel(item.category, item.subcategory), item.brand, item.model].filter(Boolean).join(" / ")} /{" "}
            {item.condition === "new" ? "Новое" : "Б/у"}
          </p>
          <h1 className="page-title">{item.title}</h1>
          {example && <p className="listing-example-caption">{exampleCopy.caption}</p>}
          <p className="detail-price">{example && <span className="listing-example-price-label">{exampleCopy.priceLabel}</span>}{formatPrice(item.priceKopecks)}</p>
          <p className="muted">
            {countries[item.country as keyof typeof countries]} · {item.city}
          </p>
          <hr />
          <p className="description">{item.description}</p>
          {(() => {
            // The make the title names, from the atlas; the same card the seller saw in the preview.
            const atlas = smartAtlas();
            const named = item.brand ? readSmart({ title: item.brand, description: "" }, atlas).brand : null;
            const smart = named ? null : readSmart({ title: item.title, description: "" }, atlas);
            const brand = named ?? smart?.brand ?? null;
            return brand ? <BrandNote brand={brand} model={item.model ?? smart?.model ?? null} /> : null;
          })()}
          {item.status === "published" && !example && (
            <>
              <a
                className="button button-primary"
                href={item.contactUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Связаться с продавцом ↗
              </a>
              <form action={favoriteAction.bind(null, item.id, !saved)}>
                <Button variant="outline">
                  {saved ? "Убрать из избранного" : "В избранное"}
                </Button>
              </form>
              <p className="muted small">
                Договорённости заключаются напрямую с продавцом. Площадка не
                принимает оплату за товар.
              </p>
              <p className="muted small">
                Контакт предоставлен только для обращения по существу
                объявления. Массовый сбор и рекламные рассылки запрещены.
                {item.contactConditions &&
                  ` Дополнительные условия автора: ${item.contactConditions}`}
              </p>
              <Link className="text-link" href={`/support?listing=${item.id}`}>
                Пожаловаться на объявление
              </Link>
              {listingMarketAllowed(item) && item.legalVersion === LEGAL_VERSION && <ShareListing path={`/listings/${item.id}`} />}
            </>
          )}
          {actor?.id === item.ownerId && item.status !== "archived" && (
            <Link className="button button-outline" href={`/listings/${item.id}/edit`}>
              {item.status === "rejected" ? "Исправить и отправить повторно" : "Редактировать объявление"}
            </Link>
          )}
          {actor?.id === item.ownerId && item.status !== "archived" && (
            <form action={archiveAction}>
              <input type="hidden" name="id" value={item.id} />
              <Button variant="ghost">Снять объявление</Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
