"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowUpRight, BookOpen, Bot, Library, MapPin, Search, Tag, X } from "lucide-react";
import {
  LIVE_QUERY_MAX,
  LIVE_QUERY_MIN,
  isNotGenerated,
  parseChecklist,
  parseJournal,
  splitCitations,
  trimNotFoundTail,
  type LiveAnswerKind,
  type LiveBrand,
  type LiveEvent,
  type LiveLane,
  type LiveLaneState,
  type LivePersonItem,
  type LiveShelfItem,
  type LiveSource,
  type LiveTerm,
  type LiveTimelineItem,
  type LiveWikiGroup,
} from "@/lib/live-search";
import { ListingComposer } from "@/components/listing-composer";
import type { SmartBrand } from "@/lib/listing-smart";
import styles from "./live-search.module.css";

const INSTANT_MS = 300;
const GENERATE_MS = 1100;
/**
 * Starting points under the empty bar, laid out by weight: goods and selling lead the first row,
 * reference blocks sit smaller below. Tobacco appears only as the rubric reference (wiki and law).
 */
type Ask = { label: string; query?: string };
const ASKS: Record<"ads" | "sell" | "wiki" | "atlas", Ask[]> = {
  ads: [{ label: "Кальян HOOB" }, { label: "Чаша фаннел" }, { label: "Kaloud Lotus" }, { label: "Кальян в Москве" }],
  sell: [{ label: "Продаю HOOB Atom" }, { label: "Что нельзя размещать" }],
  wiki: [{ label: "Что такое HMD" }, { label: "Чем отличаются чаши" }, { label: "Уголь" }, { label: "Табак и закон", query: "табак" }],
  atlas: [{ label: "Кто придумал Kaloud" }, { label: "История HOOB" }, { label: "Khalil Mamoon" }],
};

/** What the server knows for the start blocks: the newest goods and the logos of popular brands. */
export type StartData = {
  fresh: LiveShelfItem[];
  total: number;
  brands: { name: string; logo: { src: string; width: number; height: number; plate: "light" | "dark" } | null }[];
};

const LANE_ORDER: LiveLane[] = ["wiki", "shelf", "answer", "journal", "check"];

type State = {
  running: boolean;
  generating: boolean;
  lanes: Partial<Record<LiveLane, { state: LiveLaneState; text: string }>>;
  wiki: LiveWikiGroup[] | null;
  shelf: { items: LiveShelfItem[]; exact: boolean } | null;
  terms: LiveTerm[];
  timeline: LiveTimelineItem[];
  people: LivePersonItem[];
  brands: LiveBrand[];
  sources: LiveSource[];
  answer: string;
  answerKind: LiveAnswerKind | null;
  answerHref: string | null;
  journal: string;
  check: string;
  follow: string[];
  error: string | null;
};

const EMPTY: State = { running: false, generating: false, lanes: {}, wiki: null, shelf: null, terms: [], timeline: [], people: [], brands: [], sources: [], answer: "", answerKind: null, answerHref: null, journal: "", check: "", follow: [], error: null };

type Action = { type: "begin"; keep: boolean } | { type: "event"; event: LiveEvent } | { type: "fail"; message: string } | { type: "clear" };

function reducer(state: State, action: Action): State {
  if (action.type === "clear") return EMPTY;
  // The same query after typing stops: the free lanes stay while the model starts.
  if (action.type === "begin") return action.keep ? { ...EMPTY, running: true, wiki: state.wiki, shelf: state.shelf, terms: state.terms, timeline: state.timeline, people: state.people, brands: state.brands, lanes: { wiki: state.lanes.wiki, shelf: state.lanes.shelf } } : { ...EMPTY, running: true };
  if (action.type === "fail") return { ...state, running: false, error: action.message };
  const event = action.event;
  switch (event.t) {
    case "start":
      return { ...state, generating: event.generating };
    case "status":
      return { ...state, lanes: { ...state.lanes, [event.lane]: { state: event.state, text: event.text } } };
    case "wiki":
      return { ...state, wiki: event.groups };
    case "shelf":
      return { ...state, shelf: { items: event.items, exact: event.exact } };
    case "terms":
      return { ...state, terms: event.items };
    case "timeline":
      return { ...state, timeline: event.items };
    case "people":
      return { ...state, people: event.items };
    case "brand":
      return { ...state, brands: event.items };
    case "sources":
      return { ...state, sources: event.items };
    case "delta":
      return { ...state, [event.lane]: state[event.lane] + event.text };
    case "replace":
      return { ...state, answer: event.text, answerKind: event.kind, answerHref: event.href ?? null };
    case "follow":
      return { ...state, follow: event.items };
    case "done":
      return { ...state, running: false };
  }
}

function askedFromUrl() {
  return new URLSearchParams(window.location.search).get("ask")?.trim().slice(0, LIVE_QUERY_MAX) ?? "";
}

function morph(change: () => void) {
  type Transition = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
  const view = document as Document & { startViewTransition?: (callback: () => void) => Transition };
  if (view.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // A second morph right after the first skips the first one; its rejected promises are expected.
    const transition = view.startViewTransition(() => flushSync(change));
    for (const step of [transition.ready, transition.finished, transition.updateCallbackDone]) step.catch(() => {});
  } else change();
}

function Cited({ text, sources }: { text: string; sources: LiveSource[] }) {
  return (
    <>
      {splitCitations(text.replace(/\s*\[\d*$/, "")).map((part, index) => {
        if (typeof part === "string") return <span key={index}>{part}</span>;
        const source = sources.find(item => item.n === part);
        if (!source) return null;
        return (
          <sup key={index} className={styles.ref}>
            <a href={source.href} title={source.title} {...(source.external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}>{part}</a>
          </sup>
        );
      })}
    </>
  );
}

/** Knowledge panel of the brand the query names: logo, checked facts, the company's own legend. */
function BrandPanel({ brand }: { brand: LiveBrand }) {
  const out = { target: "_blank", rel: "nofollow noopener noreferrer" } as const;
  return (
    <section className={styles.brand} aria-label={`Справка: ${brand.name}`}>
      <div className={styles.brandPlate} data-plate={brand.logo?.plate ?? "type"}>
        {brand.logo
          ? <img src={brand.logo.src} alt={`Логотип ${brand.name}`} width={brand.logo.width} height={brand.logo.height} />
          : <span className={styles.wordmark}>{brand.name}</span>}
      </div>
      <h2 className={styles.brandName}>{brand.name}</h2>
      <p className={styles.brandKind}>{brand.kind}</p>
      {brand.rows.length > 0 && (
        <dl className={styles.brandRows}>
          {brand.rows.map(row => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value} <a href={row.href} {...out}>{row.source}</a></dd>
            </div>
          ))}
        </dl>
      )}
      {brand.legend.length > 0 && (
        <div className={styles.brandLegend}>
          <h3>Легенда и история</h3>
          <ul>
            {brand.legend.map(item => (
              <li key={item.text}>{item.text} <a href={item.href} {...out}>{item.own ? "по версии компании" : item.label}</a></li>
            ))}
          </ul>
        </div>
      )}
      {(brand.wiki || brand.site) && (
        <p className={styles.brandLinks}>
          {brand.wiki && <Link className="text-link" href={brand.wiki}>Статья в вики</Link>}
          {brand.site && <a className="text-link" href={brand.site} {...out}>Сайт бренда</a>}
        </p>
      )}
      {brand.logo && <p className={styles.small}>Логотип — товарный знак владельца, взят с <a href={brand.logo.source} {...out}>сайта бренда</a>.</p>}
    </section>
  );
}

function ShelfTag({ item }: { item: LiveShelfItem }) {
  const body = (
    <>
      {item.coverId && <img className={styles.tagPhoto} src={`/media/${item.coverId}`} alt="" loading="lazy" width={600} height={480} />}
      <strong className={styles.tagPrice}>{item.priceLabel}</strong>
      <span className={styles.tagTitle}>{item.title}</span>
      <span className={styles.tagMeta}>
        <MapPin size={13} aria-hidden /> {item.city}
      </span>
      {item.note && <span className={styles.tagNote}>{item.note}</span>}
    </>
  );
  return item.external ? (
    <a className={styles.tag} href={item.href} target="_blank" rel="nofollow noopener noreferrer">{body}</a>
  ) : (
    <Link className={styles.tag} href={item.href}>{body}</Link>
  );
}

/** Vertical space between cards; the board's row unit is 2px, so a card's span is its height plus this gap. */
const CARD_GAP = 14;
/** «продаю HOOB Atom» in the bar is an offer to sell: the spread opens the listing form with that title. */
const SELL_INTENT = /^(?:продаю|продам|продать|хочу продать|отдам)\s+(.{2,100})$/iu;

export type SellSetup = { markets: { country: string; categories: string[] }[]; draftKey?: string; guestLogin?: string; atlas?: SmartBrand[] };

/** A long chronicle would stand as one tall column; the rest opens on request. */
const TIMELINE_SHOWN = 5;

/**
 * Packs result cards like Tetris: every card spans as many 2px rows as its height, and the grid
 * fills holes densely. Heights change while the answer streams, so each card is observed.
 */
function packCards(root: HTMLElement) {
  {
    const fit = (card: Element) => {
      const element = card as HTMLElement;
      element.style.gridRowEnd = `span ${Math.max(1, Math.ceil((element.getBoundingClientRect().height + CARD_GAP) / 2))}`;
    };
    const sizes = new ResizeObserver(entries => entries.forEach(entry => fit(entry.target)));
    const watch = () => {
      for (const card of Array.from(root.children)) {
        fit(card);
        sizes.observe(card);
      }
      root.dataset.ready = "1";
    };
    const children = new MutationObserver(watch);
    watch();
    children.observe(root, { childList: true });
    return () => {
      sizes.disconnect();
      children.disconnect();
    };
  }
}

function Spread({ query, state, onAsk, onRetry, onSell }: { query: string; state: State; onAsk: (text: string) => void; onRetry: () => void; onSell?: (title: string) => void }) {
  const selling = onSell ? query.trim().match(SELL_INTENT)?.[1] : undefined;
  const journal = parseJournal(state.journal);
  const checklist = parseChecklist(state.check);
  const showShelf = !state.shelf || state.shelf.exact || state.shelf.items.length > 0;
  const answerPending = !state.answer && state.lanes.answer?.state === "work";
  const answerDone = state.lanes.answer?.state === "done";
  const notFound = state.answerKind === "notfound" || trimNotFoundTail(state.answer).trim().replace(/[«»]/g, "").startsWith("В базе сайта этого нет");
  const journalVisible = journal && !isNotGenerated(state.journal);
  const journalPending = !journal && state.lanes.journal?.state === "work";
  const board = useRef<HTMLDivElement>(null);
  const [fullTimeline, setFullTimeline] = useState(false);
  const timeline = fullTimeline ? state.timeline : state.timeline.slice(0, TIMELINE_SHOWN);
  useLayoutEffect(() => (board.current ? packCards(board.current) : undefined), []);
  return (
    <section className={styles.spread} aria-label="Результаты поиска" aria-busy={state.running}>
      <header className={styles.head}>
        <h1 className={styles.query}>{query}</h1>
        <ul className={styles.desk} aria-live="polite">
          {LANE_ORDER.flatMap(lane => {
            const item = state.lanes[lane];
            return item && item.state !== "off" ? [<li key={lane} className={styles[item.state]}><i className={styles.ember} aria-hidden />{item.text}</li>] : [];
          })}
        </ul>
      </header>

      <div ref={board} className={styles.board}>
      {selling && onSell && (
        <section className={styles.sellCard}>
          <h2 className={styles.laneTitle}>Продаёте?</h2>
          <p>Заполните объявление «{selling}» прямо здесь: слева поля, справа видно, как его увидят покупатели.</p>
          <button type="button" className="button button-primary" onClick={() => onSell(selling)}>Заполнить объявление</button>
        </section>
      )}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error} <button type="button" onClick={onRetry}>Повторить поиск</button>
        </p>
      )}

      {!(selling && notFound && answerDone) && <article className={styles.answer}>
        <h2 className={styles.laneTitle}>Ответ</h2>
        {answerPending && <div className={styles.lines} aria-hidden><span /><span /><span /></div>}
        {state.answerKind === "excerpt" && <p className={styles.small}>Автоответ сейчас выключен. Ближайшая выдержка из базы:</p>}
        {state.answer && <p className={styles.answerText}><Cited text={trimNotFoundTail(state.answer)} sources={state.sources} />{state.running && !answerDone && <i className={styles.cursor} aria-hidden />}</p>}
        {state.answerKind === "excerpt" && state.answerHref && <p className={styles.small}><a className="text-link" href={state.answerHref}>Открыть источник</a></p>}
        {notFound && answerDone && <p className={styles.small}>Знаете ответ? <Link className="text-link" href="/support#suggest">Предложите материал</Link></p>}
        {state.sources.length > 0 && answerDone && !notFound && (
          <p className={styles.sources}>
            Написано автоматически по материалам сайта, проверяйте по источникам:{" "}
            {state.sources.map((source, index) => (
              <span key={source.n}>
                {index > 0 && ", "}
                <a href={source.href} {...(source.external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}>{source.title}</a>
              </span>
            ))}
          </p>
        )}
      </article>}

      {state.brands.map(brand => <BrandPanel key={brand.slug} brand={brand} />)}
      {showShelf && <aside className={styles.shelf} aria-label="Витрина объявлений">
        <h2 className={styles.laneTitle}>Витрина</h2>
        {state.shelf && !state.shelf.exact && state.shelf.items.length > 0 && <p className={styles.small}>Совпадений нет, вот свежее.</p>}
        {state.shelf && state.shelf.items.length === 0 && (
          <p className={styles.small}>Таких объявлений нет. <Link className="text-link" href="/listings/new">Разместить своё</Link></p>
        )}
        {state.shelf && state.shelf.items.length > 0 && <div className={styles.tags}>{state.shelf.items.map(item => <ShelfTag key={item.id} item={item} />)}</div>}
      </aside>}

      {state.timeline.length > 0 && (
        <section className={styles.timeline}>
          <h2 className={styles.laneTitle}>Хроника</h2>
          <ol>
            {timeline.map(item => (
              <li key={`${item.year}-${item.text}`}>
                <time>{item.year}</time>
                <p>{item.text} <a href={item.href} target="_blank" rel="nofollow noopener noreferrer">{item.label}</a></p>
              </li>
            ))}
          </ol>
          {state.timeline.length > TIMELINE_SHOWN && (
            <button type="button" className={styles.more} onClick={() => setFullTimeline(!fullTimeline)}>
              {fullTimeline ? "Свернуть" : `Вся хроника (${state.timeline.length})`}
            </button>
          )}
        </section>
      )}

      {state.people.length > 0 && (
        <section className={styles.people}>
          <h2 className={styles.laneTitle}>Люди</h2>
          <dl>
            {state.people.map(item => (
              <div key={item.name}>
                <dt>{item.name}</dt>
                <dd>{item.text} <a href={item.href} target="_blank" rel="nofollow noopener noreferrer">{item.label}</a></dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {checklist.length > 0 && (
        <section className={styles.check}>
          <h2 className={styles.laneTitle}>Что проверить у продавца</h2>
          <ul>{checklist.map((line, index) => <li key={index}><Cited text={line} sources={state.sources} /></li>)}</ul>
        </section>
      )}

      {state.wiki && state.wiki.length > 0 && (
        <section className={styles.wiki}>
          <h2 className={styles.laneTitle}>Вики по рубрикам</h2>
          {state.wiki.map(group => (
            <div key={group.rubric} className={styles.rubric}>
              <h3>{group.rubric}</h3>
              <ul>
                {group.items.map(item => (
                  <li key={item.slug}>
                    <Link href={item.href}>{item.title === group.rubric ? "Открыть статью" : item.title}</Link>
                    {item.pending && <span className={styles.pending}> на проверке</span>}
                    <p>{item.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {(journalVisible || journalPending) && (
        <section className={styles.journal}>
          <h2 className={styles.laneTitle}>Журнал</h2>
          {journalPending && <div className={styles.lines} aria-hidden><span /><span /></div>}
          {journal && (
            <>
              {journal.title && <h3 className={styles.journalTitle}><Cited text={journal.title} sources={state.sources} /></h3>}
              {journal.body && <p className={styles.journalBody}><Cited text={journal.body} sources={state.sources} /></p>}
            </>
          )}
        </section>
      )}

      {state.terms.length > 0 && (
        <section className={styles.terms}>
          <h2 className={styles.laneTitle}>Термины</h2>
          <dl>
            {state.terms.map(term => (
              <div key={term.term}>
                <dt><Link href={term.href}>{term.term}</Link></dt>
                <dd>{term.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {state.follow.length > 0 && (
        <nav className={styles.follow} aria-label="Похожие вопросы">
          <h2 className={styles.laneTitle}>Спросите дальше</h2>
          <div>{state.follow.map(item => <button key={item} type="button" className="chip" onClick={() => onAsk(item)}>{item}</button>)}</div>
        </nav>
      )}
      </div>
    </section>
  );
}

export function LiveHome({ initialAsk, initialSell = false, sell, starts, hero, children }: { initialAsk: string; initialSell?: boolean; sell?: SellSetup | null; starts?: StartData; hero?: ReactNode; children: ReactNode }) {
  const [value, setValue] = useState(initialAsk);
  const opensSelling = Boolean(sell && initialSell && !initialAsk);
  const [active, setActive] = useState(Boolean(initialAsk) || opensSelling);
  // The listing form takes the results' place under the bar; `seed` is the title typed after «продаю».
  const [selling, setSelling] = useState<{ seed?: string } | null>(opensSelling ? {} : null);
  const [asked, setAsked] = useState(initialAsk);
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");
  const activeRef = useRef(Boolean(initialAsk) || opensSelling);
  const inputRef = useRef<HTMLInputElement>(null);
  // The bar is sticky, so its own box reports 0 once stuck; a plain marker keeps its place in the page.
  const markRef = useRef<HTMLDivElement>(null);

  /** The hero stays on top; once a search starts the page goes down so the bar and the results fill the screen. */
  const toResults = useCallback(() => {
    const mark = markRef.current;
    if (!mark) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: mark.getBoundingClientRect().top + window.scrollY, behavior: reduce ? "instant" : "smooth" });
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    timerRef.current = null;
    generateTimerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    abortRef.current?.abort();
    abortRef.current = null;
  }, [clearTimers]);

  const run = useCallback(async (query: string, generate: boolean) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setAsked(query);
    dispatch({ type: "begin", keep: query === lastQueryRef.current });
    lastQueryRef.current = query;
    try {
      const response = await fetch(`/api/live?q=${encodeURIComponent(query)}${generate ? "&gen=1" : ""}`, { signal: abort.signal });
      if (!response.ok || !response.body) {
        dispatch({ type: "fail", message: response.status === 429 ? "Слишком много запросов. Подождите минуту." : "Поиск не ответил." });
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line) dispatch({ type: "event", event: JSON.parse(line) as LiveEvent });
      }
      dispatch({ type: "event", event: { t: "done" } });
    } catch {
      if (!abort.signal.aborted) dispatch({ type: "fail", message: "Поиск прервался. Проверьте соединение." });
    }
  }, []);

  const enter = useCallback(() => {
    if (activeRef.current) return false;
    activeRef.current = true;
    morph(() => {
      document.documentElement.dataset.live = "1";
      setActive(true);
    });
    requestAnimationFrame(toResults);
    return true;
  }, [toResults]);

  const exit = useCallback((updateUrl: boolean) => {
    cancel();
    if (!activeRef.current) {
      setValue("");
      return;
    }
    activeRef.current = false;
    morph(() => {
      delete document.documentElement.dataset.live;
      setActive(false);
      setSelling(null);
      setValue("");
      setAsked("");
      dispatch({ type: "clear" });
    });
    if (updateUrl) window.history.pushState(null, "", "/");
  }, [cancel]);

  const openSell = useCallback((seed?: string) => {
    cancel();
    const entered = enter();
    setSelling({ seed });
    setValue("");
    if (entered) window.history.pushState(null, "", "/?sell=1");
    else {
      window.history.pushState(null, "", "/?sell=1");
      requestAnimationFrame(toResults);
    }
  }, [cancel, enter, toResults]);

  const ask = useCallback((query: string, generate: boolean) => {
    setSelling(null);
    const entered = enter();
    const url = `/?ask=${encodeURIComponent(query)}`;
    if (entered) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    void run(query, generate);
  }, [enter, run]);

  useEffect(() => {
    const opened = initialAsk ? setTimeout(() => {
      toResults();
      void run(initialAsk, true);
    }, 0) : null;
    if (initialAsk || opensSelling) document.documentElement.dataset.live = "1";
    const shown = opensSelling ? setTimeout(toResults, 0) : null;
    const onPop = () => {
      const query = askedFromUrl();
      if (sell && new URLSearchParams(window.location.search).get("sell") === "1") {
        cancel();
        enter();
        setSelling({});
      } else if (query.length >= LIVE_QUERY_MIN) {
        setSelling(null);
        setValue(query);
        enter();
        void run(query, true);
      } else exit(false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (opened) clearTimeout(opened);
      if (shown) clearTimeout(shown);
      cancel();
      delete document.documentElement.dataset.live;
    };
    // Runs once for the query the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (next: string) => {
    setValue(next);
    clearTimers();
    const query = next.trim();
    if (!query) {
      exit(true);
      return;
    }
    if (query.length < LIVE_QUERY_MIN) return;
    // Free results follow the typing; the paid lanes wait until the visitor stops.
    timerRef.current = setTimeout(() => ask(query, false), INSTANT_MS);
    generateTimerRef.current = setTimeout(() => ask(query, true), GENERATE_MS);
  };

  // Text typed before the page became interactive is already in the field.
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (initialAsk || !typed.trim()) return;
    const picked = setTimeout(() => change(typed), 0);
    return () => clearTimeout(picked);
    // Only the text present at the moment of hydration matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askNow = (query: string) => {
    clearTimers();
    setValue(query);
    ask(query, true);
    inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.root} data-live-mode={active ? "on" : "off"}>
      {hero}
      <div ref={markRef} aria-hidden />
      <div className={styles.barWrap}>
        <form
          className={styles.bar}
          role="search"
          action="/"
          onSubmit={event => {
            event.preventDefault();
            const query = value.trim();
            if (query.length >= LIVE_QUERY_MIN) askNow(query);
          }}
        >
          <Search size={22} aria-hidden />
          <label className="sr-only" htmlFor="live-query">Поиск по сайту</label>
          <input
            ref={inputRef}
            id="live-query"
            name="ask"
            type="search"
            value={value}
            maxLength={LIVE_QUERY_MAX}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Спросите про кальяны, чаши, марки или объявления"
            onChange={event => change(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape") exit(true);
            }}
          />
          {value && (
            <button type="button" className={styles.clear} aria-label="Очистить и вернуться на главную" onClick={() => exit(true)}>
              <X size={20} aria-hidden />
            </button>
          )}
        </form>
      </div>
      {!active && (
        <nav className={styles.starts} aria-label="С чего начать">
          <section className={`${styles.start} ${styles.startAds}`}>
            <h2><Tag size={17} aria-hidden /> Объявления{starts?.total ? <span className={styles.count}>{starts.total} в продаже</span> : null}</h2>
            <p>Б/у вещи от частных продавцов и проверенные объявления с других площадок</p>
            {starts && starts.fresh.length > 0 && (
              <div className={styles.fresh}>
                {starts.fresh.map(item => {
                  const body = (
                    <>
                      <span className={styles.freshPhoto}>
                        {item.coverId ? <img src={`/media/${item.coverId}`} alt="" loading="lazy" width={300} height={240} /> : <span>{item.categoryLabel}</span>}
                      </span>
                      <strong>{item.priceLabel}</strong>
                      <span className={styles.freshTitle}>{item.title}</span>
                      <span className={styles.freshCity}><MapPin size={12} aria-hidden /> {item.city}</span>
                    </>
                  );
                  return item.external
                    ? <a key={item.id} className={styles.freshItem} href={item.href} target="_blank" rel="nofollow noopener noreferrer">{body}</a>
                    : <Link key={item.id} className={styles.freshItem} href={item.href}>{body}</Link>;
                })}
              </div>
            )}
            <div className={styles.startAsks}>
              {ASKS.ads.map(item => <button key={item.label} type="button" className="chip" onClick={() => askNow(item.query ?? item.label)}>{item.label}</button>)}
              <Link className={`text-link ${styles.allLink}`} href="/#catalog" onClick={event => { event.preventDefault(); document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); }}>Весь каталог <ArrowUpRight size={15} aria-hidden /></Link>
            </div>
          </section>
          <section className={`${styles.start} ${styles.startSell}`}>
            <h2><Bot size={17} aria-hidden /> Подать объявление</h2>
            <p>Слева заполняете, справа сразу видно, как объявление увидят покупатели. Без оплаты, с проверкой модератора.</p>
            {sell
              ? <button type="button" className="button button-primary" onClick={() => openSell()}>Заполнить здесь</button>
              : <Link className="button button-primary" href="/listings/new">Заполнить форму</Link>}
            <div className={styles.sellMock} aria-hidden>
              <div><i /><i /><i /><i /></div>
              <b><span /><span /></b>
            </div>
            <div className={styles.startAsks}>
              {ASKS.sell.map(item => <button key={item.label} type="button" className="chip" onClick={() => askNow(item.query ?? item.label)}>{item.label}</button>)}
            </div>
            <Link className={`text-link ${styles.allLink}`} href="/mcp">Через своего ИИ-агента <ArrowUpRight size={15} aria-hidden /></Link>
          </section>
          <div className={styles.startMore}>
            <section className={`${styles.start} ${styles.startPop}`}>
              <h2><Search size={17} aria-hidden /> Популярные кальяны</h2>
              <p>Марки, о которых спрашивают</p>
              <div className={styles.logos}>
                {(starts?.brands ?? []).map(brand => (
                  <button key={brand.name} type="button" className={styles.logo} data-plate={brand.logo?.plate ?? "type"} aria-label={brand.name} onClick={() => askNow(brand.name)}>
                    {brand.logo ? <img src={brand.logo.src} alt="" width={brand.logo.width} height={brand.logo.height} /> : <span>{brand.name}</span>}
                  </button>
                ))}
              </div>
            </section>
            <section className={`${styles.start} ${styles.startWiki}`}>
              <h2><BookOpen size={17} aria-hidden /> Вики</h2>
              <p>Как устроено и как выбрать</p>
              <div className={styles.startAsks}>
                {ASKS.wiki.map(item => <button key={item.label} type="button" className="chip" onClick={() => askNow(item.query ?? item.label)}>{item.label}</button>)}
              </div>
            </section>
            <section className={`${styles.start} ${styles.startAtlas}`}>
              <h2><Library size={17} aria-hidden /> Атлас брендов</h2>
              <p>История, люди, кто что придумал</p>
              <div className={styles.startAsks}>
                {ASKS.atlas.map(item => <button key={item.label} type="button" className="chip" onClick={() => askNow(item.query ?? item.label)}>{item.label}</button>)}
              </div>
            </section>
          </div>
        </nav>
      )}
      {active && selling && sell && (
        <section className={styles.sellSpread} aria-label="Новое объявление">
          <header className={styles.head}>
            <h1 className={styles.query}>Новое объявление</h1>
            <p className={styles.sellIntro}>
              Слева заполняете, справа сразу видно, как объявление увидят покупатели. После отправки его проверит модератор.{" "}
              <button type="button" className={styles.linkButton} onClick={() => exit(true)}>Закрыть</button>
            </p>
          </header>
          <ListingComposer key={selling.seed ?? ""} markets={sell.markets} draftKey={sell.draftKey} guestLogin={sell.guestLogin} atlas={sell.atlas} seed={selling.seed ? { title: selling.seed } : undefined} />
        </section>
      )}
      {active && !selling && <Spread query={asked || value} state={state} onAsk={askNow} onRetry={() => void run(asked, true)} onSell={sell ? openSell : undefined} />}
      <div className={styles.rest} hidden={active}>{children}</div>
    </div>
  );
}
