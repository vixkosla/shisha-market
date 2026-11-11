"use client";

import { WikiLink as Link } from "./wiki-link";
import { useRef, useState } from "react";
import { ArrowDown, ArrowRight, Bookmark, Check, ChevronDown, Compass, Map, NotebookPen, Search, X } from "lucide-react";
import { filterWikiEntries, normalizeWikiSearch, WIKI_GROUPS, WIKI_ROUTE, wikiArticleCount, type WikiDirectoryEntry } from "@/lib/wiki-catalog";
import { AtlasCompass, WikiSymbol } from "./wiki-symbol";
import { useWikiNotebook } from "./use-notebook";

function MatchTitle({ title, query }: { title: string; query: string }) {
  const needle = query.trim();
  const index = title.toLocaleLowerCase("ru").indexOf(needle.toLocaleLowerCase("ru"));
  if (!needle || index < 0) return title;
  return <>{title.slice(0, index)}<mark>{title.slice(index, index + needle.length)}</mark>{title.slice(index + needle.length)}</>;
}

function descriptionExcerpt(description: string, query: string): string {
  const text = description.trim();
  if (!text) return "";
  const search = normalizeWikiSearch(query);
  const normalized = normalizeWikiSearch(text);
  let match = search ? normalized.indexOf(search) : -1;
  if (match < 0 && search) {
    const positions = search.split(/\s+/).map((word) => normalized.indexOf(word)).filter((position) => position >= 0);
    if (positions.length) match = Math.min(...positions);
  }
  const start = match > 50 ? text.lastIndexOf(" ", match - 25) + 1 : 0;
  const limit = start + Math.max(180, search.length + 65);
  const boundary = text.lastIndexOf(" ", limit);
  const end = text.length > limit ? boundary > start ? boundary : limit : text.length;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function ReadingMap({ entries, notebookEnabled }: { entries: WikiDirectoryEntry[]; notebookEnabled: boolean }) {
  const { entries: personal, ready } = useWikiNotebook(notebookEnabled);
  const stops = WIKI_ROUTE.flatMap((slug) => entries.find((entry) => entry.slug === slug) ?? []);
  const readCount = stops.filter((entry) => personal[entry.slug]?.read).length;
  return (
    <section className="wiki-journey" aria-labelledby="wiki-journey-title">
      <div className="wiki-journey-heading">
        <div><span className="wiki-eyebrow"><Map size={15} aria-hidden="true" /> Маршрут знакомства</span><h2 id="wiki-journey-title">От первой темы — к целой картине</h2></div>
        {notebookEnabled && <span className="wiki-route-counter">{ready ? readCount : 0} / {stops.length}<span>прочитано</span></span>}
      </div>
      <div className="wiki-map">
        <svg className="wiki-map-drawing" viewBox="0 0 800 280" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path d="M-30 210C25 178 20 125 96 122S126 8 218 24S265 98 341 80S464 8 501 44S580 83 610 57S763 92 831 15M-5 235C48 205 38 153 102 147S145 36 215 50S274 125 350 107S463 34 495 70S582 111 620 87S765 119 821 44M-20 263C56 237 63 179 119 169S155 68 219 78S279 152 355 133S454 64 497 98S578 139 631 116S759 147 820 71" stroke="currentColor" strokeWidth="0.8" />
          <path d="M89 146C125 146 156 50 259 50S370 144 420 123S550 131 637 178S524 260 385 215" stroke="var(--wiki-accent)" strokeWidth="1.5" strokeDasharray="4 7" className="wiki-route-line" />
          <path d="M708 204Q718 198 728 204T748 204M695 220Q705 214 715 220T735 220M722 235Q732 229 742 235T762 235" stroke="currentColor" />
        </svg>
        <AtlasCompass className="wiki-map-compass" />
        <nav className="wiki-map-destinations" aria-label="Маршрут знакомства">
          {stops.map((entry, index) => {
            const read = personal[entry.slug]?.read;
            return (
              <Link key={entry.slug} href={`/wiki/${entry.slug}`} className={`wiki-map-stop wiki-map-stop-${index + 1}${read ? " is-read" : ""}`}>
                <span className="wiki-map-pin"><WikiSymbol name={entry.slug.split("/").at(-1)!} size={24} /><span className="wiki-map-number">{read ? <Check size={11} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span></span>
                <span className="wiki-map-stop-name">{entry.title}<span>{read ? "Прочитано" : "Открыть тему"}<ArrowRight size={12} aria-hidden="true" /></span></span>
              </Link>
            );
          })}
        </nav>
        <span className="wiki-map-caption">Карта тем · выбирайте любую точку</span>
      </div>
      {notebookEnabled && <p className="wiki-journey-footnote"><span className="wiki-map-legend-dot" /> Отмечайте темы прочитанными — маршрут сохранится в этом браузере.</p>}
    </section>
  );
}

export function WikiDirectory({ entries, notebookEnabled = false }: { entries: WikiDirectoryEntry[]; notebookEnabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const notebook = useWikiNotebook(notebookEnabled);
  const saved = new Set(entries.filter((entry) => notebook.entries[entry.slug]?.saved).map((entry) => entry.slug));
  const matches = filterWikiEntries(entries, query, filter, saved);
  const known = WIKI_GROUPS.map((group) => ({ ...group, icon: group.icon as string }));
  const additional = [...new Set(entries.map((entry) => entry.category))].filter((id) => !known.some((group) => group.id === id));
  const groups = [...known, ...additional.map((id) => ({ id, title: entries.find((entry) => entry.category === id)!.categoryLabel, description: "Материалы энциклопедии", icon: "other" }))];
  const isExploring = filter === "all" && !query.trim();

  function reset() { setQuery(""); setFilter("all"); inputRef.current?.focus(); }

  return (
    <div className="wiki-directory-grid">
      <header className="wiki-directory-heading">
        <div className="wiki-intro-copy">
          <div><span className="wiki-eyebrow">Знания, которые складываются в карту</span><h1>Атлас <em>кальянного мира</em></h1><p>Производители, модели, устройство и комплектующие. Справочные материалы с источниками{notebookEnabled ? " и личный блокнот для заметок." : "."}</p></div>
          <AtlasCompass className="wiki-intro-compass" />
        </div>
        <div className="wiki-search" role="search">
          <Search size={21} aria-hidden="true" />
          <label className="wiki-sr-only" htmlFor="wiki-search-input">Найти статью</label>
          <input id="wiki-search-input" ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, бренд или тема…" aria-controls="wiki-directory-results" autoComplete="off" />
          {query ? <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Очистить поиск"><X size={18} aria-hidden="true" /></button> : <span className="wiki-search-count">{wikiArticleCount(entries.length)}</span>}
        </div>
      </header>

      <aside className="wiki-directory-sidebar" aria-label="Навигатор атласа">
        <p className="wiki-eyebrow wiki-side-label">Оглавление атласа</p>
        <nav className="wiki-filters" aria-label="Разделы энциклопедии">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}><Compass size={18} aria-hidden="true" /><span>Все статьи</span><small>{entries.length}</small></button>
          {groups.map((group) => <button type="button" key={group.id} aria-pressed={filter === group.id} onClick={() => setFilter(group.id)}><WikiSymbol name={group.icon} size={18} /><span>{group.id === "categories" ? "Категории" : group.id === "brands" ? "Бренды" : group.title}</span><small>{entries.filter((entry) => entry.category === group.id).length}</small></button>)}
          {notebookEnabled && <button type="button" aria-pressed={filter === "saved"} onClick={() => setFilter("saved")}><Bookmark size={18} aria-hidden="true" /><span>Сохранённое</span><small>{saved.size}</small></button>}
        </nav>
        {notebookEnabled && <div className="wiki-side-notebook"><NotebookPen size={23} strokeWidth={1.5} aria-hidden="true" /><h2>Ваш полевой блокнот</h2><p>Сохраняйте статьи и оставляйте личные заметки на полях.</p><span>Только в этом браузере.<br />Без регистрации.</span></div>}
        <details className="wiki-atlas-help">
          <summary>Как устроен атлас<ChevronDown size={16} aria-hidden="true" /></summary>
          <p>Карта соединяет вводные темы. В указателе — все статьи по алфавиту. Поиск учитывает названия, описания и первые разделы. Неподтверждённые справки помечены «На проверке».</p>
          <Link href="/wiki/guide/contributing">Как редактировать <ArrowRight size={14} aria-hidden="true" /></Link>
          <Link href="/support#suggest">Предложить улучшение <ArrowRight size={14} aria-hidden="true" /></Link>
        </details>
      </aside>

      <div className="wiki-directory-content">
        {notebookEnabled && notebook.error && <p role="status" className="wiki-storage-warning">{notebook.error}</p>}
        {isExploring && <ReadingMap entries={entries} notebookEnabled={notebookEnabled} />}
        <section className="wiki-directory" data-browse={isExploring} aria-labelledby="wiki-directory-title" id="wiki-directory-results">
          <div className="wiki-directory-title-row">
            <div><span className="wiki-eyebrow">Указатель / А—Я · A—Z</span><h2 id="wiki-directory-title">{filter === "saved" ? "Мои закладки" : query.trim() ? "Результаты поиска" : "Все знания по полкам"}</h2></div>
            <p role="status" aria-live="polite" className="wiki-results-count">{wikiArticleCount(matches.length)}<ArrowDown size={15} aria-hidden="true" /></p>
          </div>
          {matches.length === 0 ? (
            <div className="wiki-empty-state">{filter === "saved" && !query.trim() ? <Bookmark size={27} strokeWidth={1.4} aria-hidden="true" /> : <Search size={27} strokeWidth={1.4} aria-hidden="true" />}<h3>{filter === "saved" && !query.trim() ? "Первая закладка ещё впереди" : "Нет совпадений по вашему запросу"}</h3><p>{filter === "saved" && !query.trim() ? "Откройте статью и нажмите «Сохранить статью». Она появится в этом разделе." : "Попробуйте другое название, измените выбранный раздел или вернитесь ко всему указателю."}</p><button type="button" className="wiki-action" onClick={reset}>Показать все статьи<ArrowRight size={16} aria-hidden="true" /></button></div>
          ) : <div className="wiki-directory-groups">{groups.map((group) => {
            const articles = matches.filter((entry) => entry.category === group.id);
            if (!articles.length) return null;
            return (
              <section className="wiki-directory-group" id={group.id} key={group.id} aria-labelledby={`wiki-group-${group.id}`}>
                <header><span className="wiki-group-icon"><WikiSymbol name={group.icon} size={23} /></span><div><h3 id={`wiki-group-${group.id}`}>{group.title}</h3><p>{group.description}</p></div><span className="wiki-group-count">{articles.length}</span></header>
                <ul className="wiki-entry-list" aria-label={`Статьи: ${group.title}`}>
                  {articles.map((entry) => <li key={entry.slug}><Link href={`/wiki/${entry.slug}`} className="wiki-entry"><span className="wiki-entry-initial" aria-hidden="true">{entry.title[0].toLocaleUpperCase("ru")}</span><span className="wiki-entry-copy"><strong><MatchTitle title={entry.title} query={query} />{entry.reviewPending && <small className="wiki-review-badge">На проверке</small>}</strong>{entry.description.trim() && <span><MatchTitle title={descriptionExcerpt(entry.description, query)} query={query} /></span>}</span><span className="wiki-entry-marks">{notebook.entries[entry.slug]?.note && <NotebookPen size={15} aria-label="Есть личная заметка" />}{saved.has(entry.slug) && <Bookmark size={15} fill="currentColor" aria-label="Сохранено" />}{notebook.entries[entry.slug]?.read && <Check size={16} aria-label="Прочитано" />}<ArrowRight className="wiki-entry-arrow" size={17} aria-hidden="true" /></span></Link></li>)}
                </ul>
              </section>
            );
          })}</div>}
        </section>
        <aside className="wiki-contribute"><span className="wiki-contribute-symbol"><NotebookPen size={28} strokeWidth={1.4} aria-hidden="true" /></span><div><h2>На карте есть место для ваших знаний</h2><p>Заметили неточность или хотите дополнить тему?</p></div><Link href="/wiki/guide/contributing">Как редактировать<ArrowRight size={18} aria-hidden="true" /></Link></aside>
      </div>
    </div>
  );
}
