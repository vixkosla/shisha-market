import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { getDatabase } from "@/server/db";
import { listings, photos } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { allowedMarkets } from "@/server/legal-policy";
import { hasCurrentAccountAcceptance } from "@/server/legal-acceptance";
import { loginHref } from "@/lib/login-return";
import { z } from "zod";

export const metadata = { title: "Редактировать объявление", robots: { index: false, follow: false } };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const actor = await requireUser(`/listings/${id}/edit`);
  const db = await getDatabase();
  const [item] = await db.select().from(listings)
    .where(and(eq(listings.id, id), eq(listings.ownerId, actor.id)));
  if (!item) notFound();
  if (!(await hasCurrentAccountAcceptance(db, actor.id))) redirect(loginHref(`/listings/${id}/edit`, true));
  const images = await db.select({ id: photos.id, width: photos.width, height: photos.height })
    .from(photos).where(eq(photos.listingId, id)).orderBy(asc(photos.position));
  const markets = allowedMarkets();
  return (
    <section className="narrow wide page-section">
      <Link className="text-link" href={`/listings/${id}`}>← К объявлению</Link>
      <p className="eyebrow">ПРОДОЛЖЕНИЕ ИСТОРИИ · ВЕРСИЯ {item.revision}</p>
      <h1 className="page-title">Редактировать объявление</h1>
      <p className="page-intro">Уточните детали, замените фотографии и отправьте новую версию на проверку.</p>
      {item.status === "archived" ? (
        <p className="notice">Объявление снято с публикации. Для восстановления <Link href={`/support?listing=${id}`}>обратитесь в поддержку</Link>.</p>
      ) : !markets.length ? (
        <p className="notice">Публикация пока закрыта. <Link href="/legal">Условия запуска</Link>.</p>
      ) : (
        <>
          {item.moderationNote && <p className="notice">Комментарий модератора: {item.moderationNote}</p>}
          <ListingForm key={`${id}-${item.revision}`} markets={markets} initial={{
            id, revision: item.revision, title: item.title, description: item.description,
            category: item.category, subcategory: item.subcategory, brand: item.brand, model: item.model,
            condition: item.condition, country: item.country,
            city: item.city, price: (item.priceKopecks / 100).toFixed(2),
            contactUrl: item.contactUrl, contactConditions: item.contactConditions,
            photos: images,
          }} />
        </>
      )}
    </section>
  );
}
