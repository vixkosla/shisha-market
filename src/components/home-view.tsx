/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, Search, PackageOpen } from "lucide-react";
import { getDatabase } from "@/server/db";
import { getCatalog, type CatalogFilters } from "@/server/listings";
import {
  catalogHref,
  categoryNames,
  home,
  localePath,
  type Locale,
} from "@/lib/i18n";
import { ListingCard } from "@/components/listing-card";
import { exampleListingCopy, isExampleListing } from "@/lib/listing-examples";
import {externalListingCopy, getExternalListings} from "@/lib/external-listings";
import {ExternalListings} from "@/components/external-listings";
import {LiveHome} from "@/components/live-search/live-home";
import {LIVE_QUERY_MAX, LIVE_QUERY_MIN} from "@/lib/live-search";
import {currentUser} from "@/server/session";
import {allowedMarkets} from "@/server/legal-policy";
import {hasCurrentAccountAcceptance} from "@/server/legal-acceptance";
import {loginHref} from "@/lib/login-return";
import {brandCards, listingChunks} from "@/server/live-search/corpus";
import {smartAtlas} from "@/server/listing-atlas";

/** Popular hookah brands for the start block, in this order; each must exist in the atlas. */
const POPULAR_BRANDS = ["hoob", "wookah", "alpha-hookah", "maklaud", "union-hookah", "khalil-mamoon"];

export async function HomeView({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters: CatalogFilters = Object.fromEntries(
    ["q", "category", "city", "page"].map((key) => [
      key,
      typeof params[key] === "string" ? params[key] : undefined,
    ]),
  );
  const catalog = await getCatalog(await getDatabase(), filters);
  const copy = home[locale];
  const filtered = Boolean(filters.q || filters.category || filters.city);
  const hasExamples = catalog.items.some(item => isExampleListing(item.id));
  const examplesOnly = catalog.items.length > 0 && catalog.items.every(item => isExampleListing(item.id));
  const exampleCopy = exampleListingCopy[locale];
  const externalItems = getExternalListings(filters);
  const externalCopy = externalListingCopy[locale];
  const hero = (
    <section key="hero" className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="dot" /> {copy.heroEyebrow}
        </p>
        <h1>
          {copy.heroTitle[0]}
          <br />
          {copy.heroTitle[1]}
          <em>{copy.heroTitle[2]}</em>
        </h1>
        <p className="hero-description">
          {copy.heroDescription[0]}
          <br />
          {copy.heroDescription[1]}
        </p>
        <Link className="text-link" href="/listings/new">
          {copy.heroLink} <ArrowUpRight size={19} aria-hidden />
        </Link>
      </div>
      <aside className="hero-photo">
        <img src="/brand/bowl.jpg" alt={copy.heroAlt} />
        <p>
          {copy.heroNote}
          <Link href="/brand">{copy.heroBrand}</Link>
        </p>
      </aside>
    </section>
  );
  const rest = (
    <>
      <p className="notice">
        {copy.notice} <Link href={localePath(locale, "/legal")}>{copy.noticeLink}</Link>
        {copy.formNote ? <span className="muted small"> {copy.formNote}</span> : null}
      </p>
      <section id="catalog" className="catalog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.catalogEyebrow}</p>
            <h2>{externalItems.length ? externalCopy.catalogTitle : examplesOnly ? exampleCopy.catalogTitle : copy.catalogTitle}</h2>
          </div>
          <span className="muted small">{externalItems.length ? externalCopy.catalogBadge : examplesOnly ? exampleCopy.catalogBadge : copy.catalogBadge}</span>
        </div>
        {/* The Russian home already has the live search on top; a second
            catalog search bar there only duplicated it. */}
        {locale !== "ru" && <form action={localePath(locale, "/")} className="search-form">
          <label className="search-field">
            <Search size={19} aria-hidden />
            <span className="sr-only">{copy.searchLabel}</span>
            <input
              name="q"
              placeholder={copy.searchPlaceholder}
              defaultValue={filters.q}
              maxLength={120}
            />
          </label>
          <label className="city-field">
            <span className="sr-only">{copy.cityLabel}</span>
            <input
              name="city"
              placeholder={copy.cityPlaceholder}
              defaultValue={filters.city}
              maxLength={80}
            />
          </label>
          {filters.category && (
            <input type="hidden" name="category" value={filters.category} />
          )}
          <button className="button button-primary">{copy.searchButton}</button>
        </form>}
        <nav className="categories" aria-label={copy.categoriesLabel}>
          <Link
            className={!filters.category ? "chip selected" : "chip"}
            href={catalogHref(locale, {})}
          >
            {copy.allListings}
          </Link>
          {Object.entries(categoryNames[locale]).map(([key, value]) => (
            <Link
              key={key}
              className={filters.category === key ? "chip selected" : "chip"}
              href={catalogHref(locale, { category: key })}
            >
              {value}
            </Link>
          ))}
        </nav>
        <ExternalListings items={externalItems} locale={locale} />
        {externalItems.length > 0 && catalog.items.length > 0 && <h3>{examplesOnly ? exampleCopy.catalogTitle : locale === "ru" ? "На Shisha Market" : "On Shisha Market"}</h3>}
        {hasExamples && <aside className="listing-example-notice" aria-label={exampleCopy.catalogTitle}>
          <strong>{exampleCopy.noticeTitle}</strong>
          <p>{exampleCopy.noticeText}</p>
          <Link className="text-link" href="/listings/new">{exampleCopy.createLabel} →</Link>
        </aside>}
        {catalog.items.length ? (
          <div className="listing-grid">
            {catalog.items.map((item) => (
              <ListingCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        ) : externalItems.length ? null : (
          <div className="empty-state">
            <PackageOpen size={38} strokeWidth={1.2} aria-hidden />
            <h3>{filtered ? copy.emptyFilteredTitle : copy.emptyTitle}</h3>
            <p>{filtered ? copy.emptyFilteredText : copy.emptyText}</p>
            <Link
              href={filtered ? catalogHref(locale, {}) : "/listings/new"}
              className="button button-outline"
            >
              {filtered ? copy.resetFilters : copy.firstListing}
            </Link>
          </div>
        )}
        {(catalog.page > 1 || catalog.hasNext) && (
          <nav className="pagination" aria-label={copy.paginationLabel}>
            {catalog.page > 1 && (
              <Link href={catalogHref(locale, filters, catalog.page - 1)}>
                {copy.back}
              </Link>
            )}
            <span>{copy.pageLabel(catalog.page)}</span>
            {catalog.hasNext && (
              <Link href={catalogHref(locale, filters, catalog.page + 1)}>
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>
      <section className="principles">
        {copy.principles.map((item, index) => (
          <div key={item.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </div>
        ))}
      </section>
    </>
  );
  // The live search corpus is Russian; /en keeps the plain catalog.
  if (locale !== "ru") return <>{hero}{rest}</>;
  const asked = typeof params.ask === "string" ? params.ask.trim().slice(0, LIVE_QUERY_MAX) : "";
  // The listing form opens in place under the bar; publishing needs an account with current terms.
  const markets = allowedMarkets();
  const user = markets.length ? await currentUser() : null;
  const accepted = user ? await hasCurrentAccountAcceptance(await getDatabase(), user.id) : false;
  const sell = !markets.length ? null
    : user && accepted ? { markets, draftKey: `shisha:listing-draft:${user.id}`, atlas: smartAtlas() }
    : { markets, guestLogin: loginHref("/listings/new", Boolean(user)), atlas: smartAtlas() };
  // Start blocks: the newest goods (own first, then checked external) and logos of popular brands.
  const goods = (await listingChunks()).flatMap(chunk => (chunk.shelf ? [chunk.shelf] : []));
  const atlas = brandCards();
  const starts = {
    fresh: goods.slice(0, 4),
    total: goods.length,
    brands: POPULAR_BRANDS.flatMap(slug => {
      const brand = atlas.find(card => card.slug === slug);
      return brand ? [{ name: brand.name, logo: brand.logo }] : [];
    }),
  };
  return <LiveHome initialAsk={asked.length >= LIVE_QUERY_MIN ? asked : ""} initialSell={params.sell === "1"} sell={sell} starts={starts} hero={hero}>{rest}</LiveHome>;
}
