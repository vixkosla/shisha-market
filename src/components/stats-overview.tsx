import type { CSSProperties } from "react";
import type { PublicStats } from "@/server/public-stats";

const number = new Intl.NumberFormat("ru-RU");
const date = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const timestamp = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});

function Period({ start, end }: { start: string; end: string }) {
  return <p className="stats-period">{date.formatRange(new Date(start), new Date(end))}</p>;
}

function Metric({ label, value, featured = false }: {
  label: string; value: number; featured?: boolean;
}) {
  return <div className={featured ? "stats-metric stats-metric-featured" : "stats-metric"}>
    <dt>{label}</dt>
    <dd>{number.format(value)}</dd>
  </div>;
}

function Breakdown({ title, rows, unit, empty }: {
  title: string;
  rows: { label: string; visits: number }[];
  unit: string;
  empty: string;
}) {
  const maximum = Math.max(1, ...rows.map(row => row.visits));
  return <section className="stats-breakdown" aria-label={title}>
    <div className="stats-breakdown-heading"><h3>{title}</h3><span>{unit}</span></div>
    {rows.length ? <ul className="stats-breakdown-list">
      {rows.map(row => <li key={row.label}>
        <div className="stats-breakdown-value"><span>{row.label}</span><strong>{number.format(row.visits)}</strong></div>
        <span className="stats-bar" aria-hidden="true" style={{ "--stats-bar-width": `${Math.max(0, row.visits) / maximum * 100}%` } as CSSProperties} />
      </li>)}
    </ul> : <p className="stats-empty">{empty}</p>}
  </section>;
}

function SourceStatus({ ok }: { ok: boolean }) {
  return <span className={ok ? "stats-status" : "stats-status stats-status-unavailable"}>
    <span aria-hidden="true" />{ok ? "Данные получены" : "Данные недоступны"}
  </span>;
}

function Unavailable({ message }: { message: string }) {
  return <div className="stats-unavailable">
    <p>Не удалось загрузить отчёт</p>
    <span>{message}</span>
    <small>Статистика появится после восстановления доступа к источнику.</small>
  </div>;
}

function StatsHeading() {
  return <header className="stats-page-heading">
      <div>
        <p className="eyebrow">ПЛОЩАДКА В ЦИФРАХ</p>
        <h1 id="stats-title">Статистика</h1>
        <p className="stats-intro">Посещаемость Shisha Market и переходы из поиска.<br />Открытые данные из Яндекс Метрики и Google Search Console.</p>
      </div>
      <div className="stats-window"><span aria-hidden="true" />Обзор за 28 дней</div>
  </header>;
}

export function StatsLoading() {
  return <section className="stats-page" aria-labelledby="stats-title" aria-busy="true">
    <StatsHeading />
    <p className="stats-loading-label" role="status">Получаем статистику…</p>
    <div className="stats-layout" aria-hidden="true">
      {["Яндекс Метрика", "Google Search Console"].map((title, index) =>
        <div className="stats-source stats-source-loading" key={title}>
          <p className="stats-kicker">{index === 0 ? "01 / ПОСЕЩАЕМОСТЬ" : "02 / ВИДИМОСТЬ В ПОИСКЕ"}</p>
          <h2>{title}</h2>
          <div className={`stats-metrics ${index === 0 ? "stats-metrics-visits" : "stats-metrics-search"}`}>
            {Array.from({ length: index === 0 ? 3 : 2 }, (_, key) =>
              <div className="stats-metric stats-placeholder" key={key} />)}
          </div>
          <div className="stats-placeholder stats-placeholder-line" />
          <div className="stats-placeholder stats-placeholder-line" />
        </div>)}
    </div>
  </section>;
}

export function StatsOverview({ report }: { report: PublicStats }) {
  const { metrika, google } = report;
  return <section className="stats-page" aria-labelledby="stats-title">
    <StatsHeading />

    <div className="stats-layout">
      <article className="stats-source stats-source-visits" aria-labelledby="stats-visits-title">
        <header className="stats-source-heading">
          <div><p className="stats-kicker">01 / ПОСЕЩАЕМОСТЬ</p><h2 id="stats-visits-title">Яндекс Метрика</h2></div>
          <SourceStatus ok={metrika.ok} />
        </header>
        {metrika.ok ? <>
          <Period start={metrika.startDate} end={metrika.endDate} />
          <dl className="stats-metrics stats-metrics-visits">
            <Metric label="Визиты" value={metrika.visits} featured />
            <Metric label="Посетители" value={metrika.users} />
            <Metric label="Просмотры" value={metrika.pageviews} />
          </dl>
          <div className="stats-breakdowns">
            <Breakdown title="Источники переходов" rows={metrika.sources} unit="Визиты" empty="За этот период источники не переданы." />
            <Breakdown title="Устройства" rows={metrika.devices} unit="Визиты" empty="За этот период данные об устройствах не переданы." />
          </div>
        </> : <Unavailable message={metrika.message} />}
        <p className="stats-source-note">Только посещения shisha-market.com <span>Счётчик {report.counterId}</span></p>
      </article>

      <article className="stats-source stats-source-search" aria-labelledby="stats-search-title">
        <header className="stats-source-heading">
          <div><p className="stats-kicker">02 / ВИДИМОСТЬ В ПОИСКЕ</p><h2 id="stats-search-title">Google Search Console</h2></div>
          <SourceStatus ok={google.ok} />
        </header>
        {google.ok ? <>
          <Period start={google.startDate} end={google.endDate} />
          <dl className="stats-metrics stats-metrics-search">
            <Metric label="Клики" value={google.clicks} />
            <Metric label="Показы" value={google.impressions} />
          </dl>
          <Breakdown title="Поисковые запросы" rows={google.queries} unit="Клики" empty="Google не передал запросы за этот период. Общие показы и клики учитываются отдельно." />
        </> : <Unavailable message={google.message} />}
        <p className="stats-source-note">Показы — появление сайта в Google.<br />Клики — переходы из результатов поиска.</p>
      </article>
    </div>

    <footer className="stats-footnote">
      <p>Последние 28 завершённых дней. Данные обновляются раз в 5 минут.</p>
      <p>Обновлено <time dateTime={report.refreshedAt}>{timestamp.format(new Date(report.refreshedAt))} МСК</time></p>
    </footer>
  </section>;
}
