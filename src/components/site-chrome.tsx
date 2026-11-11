"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { catalogHref, chrome, localePath, type Locale } from "@/lib/i18n";
import { hasEnglishLegal } from "@/lib/legal";

function useLocale(): Locale {
  const pathname = usePathname();
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ru";
}

export function SiteHeader({
  signedIn,
  moderator,
  origin,
}: {
  signedIn: boolean;
  moderator: boolean;
  origin: string;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams();
  const copy = chrome[locale];
  const target: Locale = locale === "en" ? "ru" : "en";
  const path = locale === "en" ? pathname.slice(3) || "/" : pathname;
  const translated =
    path === "/" || path === "/mcp" || path === "/legal" ||
    (path.startsWith("/legal/") && hasEnglishLegal(path.slice(7)));
  let languageHref = localePath(target, translated ? path : "/");
  if (path === "/" && search.size) {
    languageHref = catalogHref(target, Object.fromEntries(search));
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Shisha Market",
            url: locale === "en" ? `${origin}/en` : `${origin}/`,
            inLanguage: locale,
            description: copy.stripRight,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <a className="skip-link" href="#main">{copy.skip}</a>
      <div className="build-strip">
        <span>{copy.stripLeft}</span>
        <span>{copy.stripRight}</span>
      </div>
      <header className="site-header shell">
        <Link
          href={localePath(locale, "/")}
          className="brand"
          aria-label={copy.brandAria}
        >
          <BrandMark />
        </Link>
        <nav aria-label={copy.navLabel}>
          <Link href={localePath(locale, "/")}>{copy.nav.catalog}</Link>
          <Link href="/wiki">{copy.nav.wiki}</Link>
          <Link href="/stats">{copy.nav.stats}</Link>
          <Link href="/favorites">{copy.nav.favorites}</Link>
          {moderator && <Link href="/admin">{copy.nav.moderation}</Link>}
          <Link href={signedIn ? "/account" : "/login"}>
            {signedIn ? copy.nav.account : copy.nav.login}
          </Link>
          <Link
            href={languageHref}
            className="lang-switch"
            hrefLang={copy.language.hrefLang}
            aria-label={copy.language.aria}
          >
            {copy.language.label}
          </Link>
        </nav>
        <Link href="/listings/new" className="button button-primary header-create">
          <Plus size={18} aria-hidden />
          <span>{copy.cta}</span>
        </Link>
      </header>
    </>
  );
}

export function SiteFooter() {
  const locale = useLocale();
  const copy = chrome[locale];
  return (
    <footer className="site-footer shell">
      <div>
        <BrandMark size="header" />
        <p>{copy.footer.tagline}</p>
      </div>
      <a href="https://vk.ru/shishamarket" target="_blank" rel="noopener noreferrer">
        {copy.footer.community} <ArrowUpRight size={16} aria-hidden />
      </a>
      <a href="https://github.com/vixkosla/shisha-market" target="_blank" rel="noopener noreferrer">
        {copy.footer.source} <ArrowUpRight size={16} aria-hidden />
      </a>
      <Link href="/support#suggest">{copy.footer.suggest}</Link>
      <span className="muted small">{copy.footer.disclaimer}</span>
      <nav className="footer-legal" aria-label={copy.footer.legalNav}>
        <Link href="/brand">{copy.footer.brandbook}</Link>
        <Link href={localePath(locale, "/legal")}>{copy.footer.legal}</Link>
        <Link href={localePath(locale, "/legal/privacy")}>{copy.footer.privacy}</Link>
        <Link href={localePath(locale, "/legal/contact")}>{copy.footer.contact}</Link>
        <Link href="/support">{copy.footer.support}</Link>
        <Link href={localePath(locale, "/mcp")}>{copy.footer.mcp}</Link>
      </nav>
      <p className="developer-credit">
        {copy.footer.credit}{" "}
        <a href="https://sonicxboy.dev">
          <span className="developer-mark" aria-hidden="true" />
          SonicXBoy
        </a>
      </p>
    </footer>
  );
}
