import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LEGAL_DATE,
  LEGAL_VERSION,
  hasEnglishLegal,
  legalLinks,
} from "@/lib/legal";
import { legalDocuments } from "@/server/legal-documents";
import { legalConfiguration, legalLaunchReady } from "@/server/legal-policy";
import {
  hasOperatorLegalDetails,
  operatorLegalRobots,
} from "@/lib/legal-indexing";

function documentKey(slug: string) {
  if (!Object.hasOwn(legalLinks, slug)) notFound();
  return slug as keyof typeof legalLinks;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}): Promise<Metadata> {
  const key = documentKey((await params).document);
  return {
    title: legalLinks[key],
    ...(hasOperatorLegalDetails(key) ? { robots: operatorLegalRobots } : {}),
    alternates: {
      canonical: `/legal/${key}`,
      languages: hasEnglishLegal(key)
        ? { ru: `/legal/${key}`, en: `/en/legal/${key}` }
        : { ru: `/legal/${key}` },
    },
  };
}
export default async function LegalDocument({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const key = documentKey((await params).document);
  const config = legalConfiguration();
  return (
    <article className="narrow wide page-section legal-copy">
      <Link href="/legal" className="text-link">
        ← Все документы
      </Link>
      <h1 className="page-title">{legalLinks[key]}</h1>
      <p className="muted small">
        Редакция от {LEGAL_DATE} · {LEGAL_VERSION}
        {hasEnglishLegal(key) && (
          <>
            {" · "}
            <Link href={`/en/legal/${key}`}>English version</Link>
          </>
        )}
      </p>
      {!legalLaunchReady() && (
        <p className="notice">
          Предварительная редакция. Реквизиты и условия публичного запуска ещё
          не подтверждены. Это не сообщение о начале приёма реальных
          пользователей.
        </p>
      )}
      {legalDocuments()[key].map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
      {key === "contact" && config.email && (
        <p>
          <a className="text-link" href={`mailto:${config.email}`}>
            Написать оператору
          </a>
        </p>
      )}
      <nav className="legal-nav" aria-label="Другие документы">
        {Object.entries(legalLinks)
          .filter(([slug]) => slug !== key)
          .map(([slug, title]) => (
            <Link href={`/legal/${slug}`} key={slug}>
              {title}
            </Link>
          ))}
      </nav>
    </article>
  );
}
