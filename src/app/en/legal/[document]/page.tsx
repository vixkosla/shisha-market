import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LEGAL_DATE_EN,
  LEGAL_VERSION,
  hasEnglishLegal,
  legalLinksEn,
} from "@/lib/legal";
import { legalDocumentsEn } from "@/server/legal-documents-en";
import { legalConfiguration, legalLaunchReady } from "@/server/legal-policy";
import {
  hasOperatorLegalDetails,
  operatorLegalRobots,
} from "@/lib/legal-indexing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}): Promise<Metadata> {
  const { document } = await params;
  if (!hasEnglishLegal(document)) return { title: "Documents" };
  return {
    title: legalLinksEn[document],
    ...(hasOperatorLegalDetails(document)
      ? { robots: operatorLegalRobots }
      : {}),
    alternates: {
      canonical: `/en/legal/${document}`,
      languages: {
        ru: `/legal/${document}`,
        en: `/en/legal/${document}`,
      },
    },
  };
}

export default async function EnglishLegalDocument({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  if (!hasEnglishLegal(document)) notFound();
  const key = document;
  const config = legalConfiguration();
  return (
    <article className="narrow wide page-section legal-copy">
      <Link href="/en/legal" className="text-link">
        ← All documents
      </Link>
      <h1 className="page-title">{legalLinksEn[key]}</h1>
      <p className="muted small">
        Edition of {LEGAL_DATE_EN} · {LEGAL_VERSION} ·{" "}
        <Link href={`/legal/${key}`}>Русская версия</Link>
      </p>
      <p className="notice">
        English translation for convenience. The Russian edition prevails; the
        translation does not create additional rights or obligations.
      </p>
      {!legalLaunchReady() && (
        <p className="notice">
          Preliminary edition. Operator details and public launch conditions
          have not yet been confirmed. This is not a notice that real users are
          being accepted.
        </p>
      )}
      {legalDocumentsEn()[key].map((section) => (
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
            Write to the operator
          </a>
        </p>
      )}
      <nav className="legal-nav" aria-label="Other documents">
        {Object.entries(legalLinksEn)
          .filter(([slug]) => slug !== key)
          .map(([slug, title]) => (
            <Link href={`/en/legal/${slug}`} key={slug}>
              {title}
            </Link>
          ))}
      </nav>
    </article>
  );
}
