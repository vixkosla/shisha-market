import Link from "next/link";
import { LEGAL_DATE, LEGAL_VERSION, legalLinks } from "@/lib/legal";
import { launchBlockers, legalLaunchReady } from "@/server/legal-policy";

export const metadata = {
  title: "Правила и документы",
  alternates: {
    canonical: "/legal",
    languages: { ru: "/legal", en: "/en/legal" },
  },
};
export default function LegalIndex() {
  const ready = legalLaunchReady();
  return (
    <section className="narrow wide page-section legal-copy">
      <p className="eyebrow">ПРАВИЛА ПЛОЩАДКИ</p>
      <h1 className="page-title">Правила и документы</h1>
      <p>
        Shisha Market — информационная площадка частных объявлений. Пользователи
        общаются самостоятельно; сайт не принимает заказы и оплату и не
        сопровождает сделки.
      </p>
      <p className="muted small">
        Редакция от {LEGAL_DATE} · {LEGAL_VERSION} ·{" "}
        <Link href="/en/legal">English version</Link>
      </p>
      {!ready && (
        <div className="notice">
          <strong>Предварительный режим</strong>
          <p>
            Документы подготовлены, но публичная регистрация не открыта. До
            запуска необходимо заполнить и проверить:
          </p>
          <ul>
            {launchBlockers().map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <Link href="/brand">Брендбук знака и съёмки →</Link>
      </p>
      <nav className="legal-grid" aria-label="Юридические документы">
        {Object.entries(legalLinks).map(([slug, title]) => (
          <Link className="panel" key={slug} href={`/legal/${slug}`}>
            {title} →
          </Link>
        ))}
      </nav>
      <Link href="/support" className="button button-outline">
        Обращения и жалобы
      </Link>
    </section>
  );
}
