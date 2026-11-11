/* Images are normalized on upload; authenticated media must bypass the shared Next image cache. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { formatPrice } from "@/lib/listings";
import { cardCopy, categoryNames, statusNames, type Locale } from "@/lib/i18n";
import type { listings } from "@/server/db/schema";
import { exampleListingCopy, isExampleListing } from "@/lib/listing-examples";
export function ListingCard({
  item,
  showStatus = false,
  locale = "ru",
}: {
  item: typeof listings.$inferSelect & { coverId?: string };
  showStatus?: boolean;
  locale?: Locale;
}) {
  const copy = cardCopy[locale];
  const example = isExampleListing(item.id);
  const exampleCopy = exampleListingCopy[locale];
  return (
    <Link className={`listing-card${example ? " is-example" : ""}`} data-example={example ? "true" : undefined} href={`/listings/${item.id}`}>
      <div className="card-image">
        {item.coverId ? (
          <img
            src={`/media/${item.coverId}`}
            alt={item.title}
            loading="lazy"
            width={600}
            height={480}
          />
        ) : (
          <span>{copy.noPhoto}</span>
        )}
        {example && <span className="listing-example-label">{exampleCopy.photoLabel}</span>}
        {(!example || showStatus) && <span className="image-label">
          {showStatus
            ? statusNames[locale][item.status]
            : item.condition === "new"
              ? copy.conditionNew
              : copy.conditionUsed}
        </span>}
      </div>
      <div className="card-body">
        {example && <p className="listing-example-caption">{exampleCopy.caption}</p>}
        <span className="eyebrow">
          {categoryNames[locale][item.category as keyof typeof categoryNames.ru]}
          {item.brand ? ` · ${item.brand}` : ""}
        </span>
        <h3>
          {item.title}
          <ArrowUpRight size={19} aria-hidden />
        </h3>
        {example && <span className="listing-example-price-label">{exampleCopy.priceLabel}</span>}
        <strong className="price">{formatPrice(item.priceKopecks)}</strong>
        <p className="muted city">
          <MapPin size={14} aria-hidden />
          {item.city}
        </p>
      </div>
    </Link>
  );
}
