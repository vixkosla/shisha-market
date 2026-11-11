"use client";

import { WikiLink as Link } from "./wiki-link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Bookmark, Check, ChevronDown, ChevronRight, CircleCheck, List, NotebookPen, PencilLine, Save, Trash2 } from "lucide-react";
import { WIKI_ROUTE, wikiArticleCount, type WikiDirectoryEntry } from "@/lib/wiki-catalog";
import type { WikiHeading } from "@/lib/wiki-markdown";
import { updateWikiPersonalEntry, useWikiNotebook } from "./use-notebook";
import { WikiSymbol } from "./wiki-symbol";

function Contents({ headings, active, onNavigate }: { headings: WikiHeading[]; active: string; onNavigate: (id: string) => void }) {
  let section = 0;
  return <nav aria-label="Содержание"><ol className="wiki-toc-list">{headings.map((heading) => {
    if (heading.level === 2) section++;
    return <li key={heading.id} className={heading.level === 3 ? "wiki-toc-subsection" : ""}><a href={`#${heading.id}`} aria-current={active === heading.id ? "location" : undefined} onClick={() => onNavigate(heading.id)}>{heading.level === 2 && <span aria-hidden="true">{String(section).padStart(2, "0")}</span>}{heading.title}</a></li>;
  })}</ol></nav>;
}

function Notebook({ slug }: { slug: string }) {
  const notebook = useWikiNotebook();
  const stored = notebook.entries[slug]?.note ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const value = draft ?? stored;
  const dirty = draft !== null && draft !== stored;

  function save() {
    if (updateWikiPersonalEntry(slug, { note: value })) {
      setDraft(null);
      setMessage(value ? "Заметка сохранена в этом браузере" : "Пустая заметка сохранена");
    } else setMessage("Не удалось сохранить заметку. Текст остаётся в поле.");
  }

  function clear() {
    if (updateWikiPersonalEntry(slug, { note: "" })) {
      setDraft(null);
      setMessage("Заметка очищена в этом браузере");
    } else setMessage("Не удалось очистить сохранённую заметку.");
  }

  return (
    <section id="my-notes" className="wiki-notebook" aria-labelledby="wiki-notebook-title">
      <div className="wiki-notebook-heading"><NotebookPen size={25} strokeWidth={1.5} aria-hidden="true" /><div><span className="wiki-eyebrow">Личный полевой блокнот</span><h2 id="wiki-notebook-title">Мои заметки</h2></div><span className="wiki-personal-stamp">В этом браузере</span></div>
      <p id="wiki-notebook-description">Мысли и пометки к этой статье. Хранятся только в этом браузере и не добавляются в энциклопедию.</p>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label htmlFor="wiki-note">Заметка к статье</label>
        <textarea id="wiki-note" value={value} onChange={(event) => { setDraft(event.target.value); setMessage(""); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); save(); } }} placeholder="Что хочется запомнить или проверить позже?" rows={3} maxLength={10000} aria-describedby="wiki-notebook-description wiki-note-status" />
        <div className="wiki-note-actions"><button className="wiki-action wiki-action-primary" type="submit" disabled={!notebook.ready}><Save size={16} aria-hidden="true" />Сохранить заметку</button><button type="button" className="wiki-action wiki-action-quiet" onClick={clear} disabled={!notebook.ready || (!value && !stored)}><Trash2 size={15} aria-hidden="true" />Очистить</button></div>
        <div className="wiki-note-meta"><p id="wiki-note-status" role="status">{message || (dirty ? "Есть несохранённые изменения" : notebook.error ? "Сохранение недоступно" : stored ? "Сохранено в этом браузере" : "Записей пока нет")}</p><span>Ctrl / ⌘ + Enter — сохранить</span></div>
      </form>
    </section>
  );
}

export function WikiArticleReader({ entry, headings, directory, children, notebookEnabled = false }: { entry: WikiDirectoryEntry; headings: WikiHeading[]; directory: WikiDirectoryEntry[]; children?: ReactNode; notebookEnabled?: boolean }) {
  const notebook = useWikiNotebook(notebookEnabled);
  const personal = notebook.entries[entry.slug];
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);
  const [actionStatus, setActionStatus] = useState("");
  const peers = directory.filter((item) => item.category === entry.category);
  const routeIndex = WIKI_ROUTE.findIndex((slug) => slug === entry.slug);
  const route = WIKI_ROUTE.flatMap((slug) => directory.find((item) => item.slug === slug) ?? []);

  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      const body = document.getElementById("wiki-prose");
      if (!body) return;
      const top = body.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, body.offsetHeight - window.innerHeight + 120);
      setProgress(Math.min(100, Math.max(0, Math.round((window.scrollY - top + 120) / distance * 100))));
      let current = "";
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= 150) current = heading.id;
      }
      setActive(current);
    }
    function schedule() { if (!frame) frame = window.requestAnimationFrame(measure); }
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    const body = document.getElementById("wiki-prose");
    if (body) observer.observe(body);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); observer.disconnect(); };
  }, [headings]);

  function toggle(kind: "saved" | "read") {
    const next = !personal?.[kind];
    if (updateWikiPersonalEntry(entry.slug, { [kind]: next })) setActionStatus(kind === "saved" ? next ? "Статья добавлена в ваши закладки" : "Статья удалена из закладок" : next ? "Статья отмечена прочитанной" : "Отметка о прочтении снята");
    else setActionStatus("Изменение не сохранено.");
  }

  return (
    <>
      <nav className="wiki-breadcrumbs" aria-label="Навигация по разделам"><Link href="/wiki">Атлас</Link><ChevronRight size={13} aria-hidden="true" /><Link href={`/wiki#${entry.category}`}>{entry.categoryLabel}</Link><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">{entry.title}</span></nav>
      <header className="wiki-article-heading">
        <div className="wiki-article-kicker"><span className="wiki-eyebrow"><WikiSymbol name={entry.category} size={17} />{entry.categoryLabel}</span>{routeIndex >= 0 && <span className="wiki-route-tag">Точка {String(routeIndex + 1).padStart(2, "0")} / {route.length}</span>}</div>
        <h1 id="wiki-article-title">{entry.title}</h1>
        {entry.reviewPending && <p className="wiki-review-note">Справка на проверке. Производитель пока не подтверждён первоисточником; прежние неподтверждённые характеристики убраны. Страница доступна по ссылке, но закрыта от поисковой индексации.</p>}
        {notebookEnabled && <div className="wiki-article-toolbar" role="group" aria-label="Действия со статьёй">
          <button type="button" className={`wiki-action${personal?.saved ? " is-selected" : ""}`} aria-pressed={!!personal?.saved} disabled={!notebook.ready} onClick={() => toggle("saved")}><Bookmark size={17} fill={personal?.saved ? "currentColor" : "none"} aria-hidden="true" />{personal?.saved ? "Статья сохранена" : "Сохранить статью"}</button>
          <button type="button" className={`wiki-action${personal?.read ? " is-selected" : ""}`} aria-pressed={!!personal?.read} disabled={!notebook.ready} onClick={() => toggle("read")}><CircleCheck size={17} aria-hidden="true" />{personal?.read ? "Прочитано" : "Отметить прочитанным"}</button>
          <a href="#my-notes" className="wiki-action wiki-action-quiet"><NotebookPen size={17} aria-hidden="true" />Мои заметки{personal?.note && <span className="wiki-note-dot" aria-label="Есть заметка" />}</a>
          <Link href="/wiki/guide/contributing" className="wiki-action wiki-action-edit"><PencilLine size={16} aria-hidden="true" />Как редактировать</Link>
        </div>}
        {notebookEnabled && <p className="wiki-sr-only" role="status">{actionStatus}</p>}
        {notebookEnabled && notebook.error && <p className="wiki-storage-warning" role="alert">{notebook.error}</p>}
      </header>

      <div className="wiki-article-layout">
        <aside className="wiki-outline-desktop" aria-label="Навигация по статье"><div className="wiki-outline-sticky"><div className="wiki-outline-title"><List size={17} aria-hidden="true" /><h2>Содержание</h2></div><Contents headings={headings} active={active} onNavigate={setActive} /><div className="wiki-reading-progress"><label htmlFor="wiki-progress">По статье <span>{progress}%</span></label><progress id="wiki-progress" value={progress} max={100} aria-label="Прогресс чтения" /></div>{notebookEnabled && <a href="#my-notes" className="wiki-outline-notes"><NotebookPen size={16} aria-hidden="true" />К моим заметкам<ArrowRight size={14} aria-hidden="true" /></a>}</div></aside>
        <div className="wiki-reading-column">
          <details className="wiki-outline-mobile"><summary><List size={18} aria-hidden="true" /><span>Содержание</span><span className="wiki-mobile-progress">{progress}%</span><ChevronDown size={17} aria-hidden="true" /></summary><Contents headings={headings} active={active} onNavigate={setActive} /></details>
          <article id="wiki-prose" className="wiki-article-body" aria-labelledby="wiki-article-title">{children}</article>
          <div className="wiki-reading-end"><span aria-hidden="true">✦</span><span>Конец статьи — начало следующего открытия</span></div>
          {notebookEnabled && <Notebook key={entry.slug} slug={entry.slug} />}
          <section className="wiki-source-note" aria-labelledby="wiki-source-title"><PencilLine size={21} aria-hidden="true" /><div><h2 id="wiki-source-title">Дополнить эту страницу</h2><p><Link href="/wiki/guide/contributing">Как редактировать вики</Link> · <Link href="/support#suggest">Предложить улучшение</Link></p><p className="wiki-source-path">Файл статьи: <code>content/wiki/{entry.slug}.md</code></p></div></section>
        </div>
        <aside className="wiki-article-margin" aria-label="Продолжение чтения">
          <div className="wiki-margin-journey"><span className="wiki-eyebrow">Продолжить путь</span><h2>{routeIndex >= 0 ? "На карте тем" : "Загляните в основы"}</h2><nav aria-label="Темы маршрута"><ol>{route.map((item, index) => <li key={item.slug}><Link href={`/wiki/${item.slug}`} aria-current={item.slug === entry.slug ? "page" : undefined}><span className={`wiki-small-route-pin${notebook.entries[item.slug]?.read ? " is-read" : ""}`}>{notebook.entries[item.slug]?.read ? <Check size={12} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><span>{item.title}</span>{item.slug === entry.slug && <span className="wiki-sr-only"> — вы здесь</span>}</Link></li>)}</ol></nav></div>
          <details className="wiki-peer-directory"><summary><span><WikiSymbol name={entry.category} size={17} />В этом разделе<small>{wikiArticleCount(peers.length)}</small></span><ChevronDown size={17} aria-hidden="true" /></summary><nav aria-label={`В этом разделе: ${entry.categoryLabel}`}><ul>{peers.map((peer) => <li key={peer.slug}><Link href={`/wiki/${peer.slug}`} aria-current={peer.slug === entry.slug ? "page" : undefined}>{peer.title}</Link></li>)}</ul></nav></details>
          {notebookEnabled && <p className="wiki-margin-note"><Bookmark size={18} strokeWidth={1.5} aria-hidden="true" />Возвращайтесь к важному: ваши закладки ждут в разделе «Сохранённое» на главной карте.</p>}
        </aside>
      </div>
    </>
  );
}
