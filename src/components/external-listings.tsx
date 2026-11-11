import {ArrowUpRight, MapPin, MessageCircle} from "lucide-react";
import {externalListingCopy, externalListingState, type ExternalListing} from "@/lib/external-listings";
import {formatPrice} from "@/lib/listings";
import type {Locale} from "@/lib/i18n";
import styles from "./external-listings.module.css";

function displayDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

export function ExternalListings({items, locale, now}: {items: readonly ExternalListing[]; locale: Locale; now?: Date}) {
  if (!items.length) return null;
  const copy = externalListingCopy[locale];
  return <section className={styles.section} aria-labelledby="external-listings-title" data-external-listings>
    <div className={styles.heading}>
      <h3 id="external-listings-title">{copy.title}</h3>
      <span className={styles.count}>{items.length}</span>
    </div>
    <p className={styles.intro}>{copy.intro}</p>
    <div className={styles.grid}>
      {items.map(item => {
        const state = externalListingState(item, now);
        const status = copy.states[state];
        const canContact = state === "listed" || state === "needs_review";
        return <article key={item.id} className={styles.card} data-external-listing={item.id} data-external-state={state}>
        <div className={styles.topline}>
          <span className={styles.badge}>{copy.badge}</span>
          <span className={styles.city}><MapPin size={14} aria-hidden />{item.city[locale]}</span>
        </div>
        <h4>{item.title}</h4>
        <p className={styles.summary}>{item.summary[locale]}</p>
        <p className={styles.status}><strong>{status.label}</strong><span>{status.detail}</span></p>
        <div className={styles.price}><span>{copy.price}</span><strong>{formatPrice(item.priceKopecks)}</strong></div>
        <dl className={styles.meta}>
          <div><dt>{copy.source}</dt><dd><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName}<ArrowUpRight size={13} aria-hidden /></a></dd></div>
          <div><dt>{copy.published}</dt><dd><time dateTime={item.publishedAt}>{displayDate(item.publishedAt, locale)}</time></dd></div>
          <div><dt>{copy.checked}</dt><dd><time dateTime={item.checkedAt}>{displayDate(item.checkedAt, locale)}</time></dd></div>
        </dl>
        <div className={styles.actions}>
          {canContact && <a className="button button-primary" href={item.contactUrl} target="_blank" rel="noopener noreferrer" aria-label={`${copy.contact}: ${item.title}`}><MessageCircle size={16} aria-hidden />{copy.contact}</a>}
          <a className={styles.original} href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${copy.original}: ${item.title}`}>{copy.original}<ArrowUpRight size={15} aria-hidden /></a>
        </div>
        <a className={styles.report} href={`/support?external=${encodeURIComponent(item.id)}#external-report`}>{copy.report}</a>
      </article>})}
    </div>
  </section>;
}
