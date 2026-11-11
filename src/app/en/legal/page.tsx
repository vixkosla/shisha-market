import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_DATE_EN,
  LEGAL_VERSION,
  legalLinksEn,
} from "@/lib/legal";
import { legalLaunchReady } from "@/server/legal-policy";

export const metadata: Metadata = {
  title: "Rules and documents",
  alternates: {
    canonical: "/en/legal",
    languages: { ru: "/legal", en: "/en/legal" },
  },
};

export default function EnglishLegalIndex() {
  const ready = legalLaunchReady();
  return (
    <section className="narrow wide page-section legal-copy">
      <p className="eyebrow">PLATFORM RULES</p>
      <h1 className="page-title">Rules and documents</h1>
      <p>
        Shisha Market is an information marketplace for private listings. Users
        communicate on their own; the site does not take orders or payments and
        does not support deals.
      </p>
      <p className="muted small">
        Edition of {LEGAL_DATE_EN} · {LEGAL_VERSION}
      </p>
      {!ready && (
        <div className="notice">
          <strong>Preliminary edition</strong>
          <p>
            The documents are prepared, but public registration is not open.
            Operator details and public launch conditions have not yet been
            confirmed.
          </p>
        </div>
      )}
      <p>
        <Link href="/brand">Brandbook and photography (in Russian) →</Link>
      </p>
      <nav className="legal-grid" aria-label="Legal documents">
        {Object.entries(legalLinksEn).map(([slug, title]) => (
          <Link className="panel" key={slug} href={`/en/legal/${slug}`}>
            {title} →
          </Link>
        ))}
      </nav>
      <p className="muted small">
        The consent forms for data processing and publication are currently
        available in Russian only:{" "}
        <Link href="/legal/consent">consent to processing</Link>,{" "}
        <Link href="/legal/publication">consent to publication</Link>. English
        registration is not open yet.
      </p>
      <Link href="/support" className="button button-outline">
        Reports and complaints
      </Link>
      <p className="muted small">
        <Link href="/legal">Русская версия</Link>
      </p>
    </section>
  );
}
