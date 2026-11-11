import { cleanFollowUp, type LiveBrand, type LiveEvent, type LiveLane, type LiveLaneState, type LiveShelfItem, type LiveSource, type LiveWikiGroup } from "@/lib/live-search";
import { LIVE_TERMS, type BrandCard, type Chunk, type KnowledgeFact } from "./corpus";
import { INJECTION_REPLY, NOT_FOUND_REPLY, TOBACCO_REPLY, gateQuery } from "./guard";
import type { LlmStream } from "./llm";
import { LANE_PROMPTS, LANE_TOKENS, userMessage } from "./prompts";
import { matchCity, search, type Hit } from "./retrieve";
import { ROUTE_PROFILES, routeQuery } from "./router";
import { mentionsTobacco, topicOf, type Topic } from "./topics";
import { cacheKey, readCache, writeCache, type CachedAnswer } from "./cache";
import { categoryNames } from "@/lib/i18n";
import { normalize } from "./text";

const RUBRICS: Record<string, string> = {
  "categories/hookahs": "Кальяны",
  "categories/bowls": "Чаши",
  "categories/accessories": "Аксессуары",
  "categories/charcoal": "Уголь",
  "categories/tobacco": "Табак: справка",
};
/** Pauses before retrying a lane the provider refused; together they stay well inside the generation timeout. */
const RETRY_DELAYS_MS = [800, 2000];
const SIDE_CONTEXT_SIZE = 3;
const FACT_ENTITIES = 4;
const TIMELINE_SIZE = 10;
const PEOPLE_SIZE = 4;
/** Questions about the site itself: answered from the rules, without a note or a seller checklist. */
const RULES_QUERY = /размещ|публик|правил|запрещ|модерац|подать объявл|можно ли продавать|оплат/;
const FALLBACK_SHELF = 4;
const GENERATION_TIMEOUT_MS = 60_000;

export type LiveInput = {
  query: string;
  /** False while the visitor is typing: only the free lanes run, no paid call is made. */
  generate: boolean;
  staticChunks: readonly Chunk[];
  /** Atlas brand cards; a query naming one of them gets a card beside the answer. */
  brands?: readonly BrandCard[];
  loadListings: () => Promise<Chunk[]>;
  llm: LlmStream | null;
  acquire: () => (() => void) | null;
  emit: (event: LiveEvent) => void;
  signal: AbortSignal;
};

function plural(count: number, one: string, few: string, many: string) {
  const tail = count % 100;
  const last = count % 10;
  if (tail >= 11 && tail <= 14) return many;
  if (last === 1) return one;
  return last >= 2 && last <= 4 ? few : many;
}

function wikiGroups(hits: readonly Hit[]): LiveWikiGroup[] {
  const seen = new Set<string>();
  const groups = new Map<string, LiveWikiGroup>();
  for (const { chunk } of hits) {
    if (chunk.kind !== "wiki" || !chunk.slug || seen.has(chunk.slug) || seen.size >= 8) continue;
    seen.add(chunk.slug);
    const rubric = RUBRICS[chunk.slug] ?? "Производители";
    const group = groups.get(rubric) ?? { rubric, items: [] };
    group.items.push({ slug: chunk.slug, title: chunk.title.split(":")[0], description: chunk.description ?? "", href: chunk.href, pending: Boolean(chunk.pending) });
    groups.set(rubric, group);
  }
  return [...groups.values()];
}

function shelfResult(listings: readonly Chunk[], query: string) {
  const all = listings.flatMap(item => (item.shelf ? [item.shelf] : []));
  const cities = matchCity(listings, query);
  const pool = cities.size ? listings.filter(item => item.shelf && cities.has(item.shelf.city)) : listings;
  const matched = search(pool, query).flatMap(hit => (hit.chunk.shelf ? [hit.chunk.shelf] : []));
  if (matched.length || cities.size) return { items: matched.slice(0, 8), exact: true };
  return { items: all.slice(0, FALLBACK_SHELF) satisfies LiveShelfItem[], exact: false };
}

/** Listings of the named brands only, narrowed to an asked city; none is an honest answer, not a cue for random goods. */
function brandShelf(listings: readonly Chunk[], brands: readonly BrandCard[], query: string) {
  if (!listings.length) return { items: [] as LiveShelfItem[], exact: false };
  const own = listings.filter(item => item.shelf && brands.some(brand => brand.aliases.some(alias => aliasAt(normalize(item.shelf?.title ?? ""), alias) >= 0)));
  const cities = matchCity(own, query);
  const pool = cities.size ? own.filter(item => item.shelf && cities.has(item.shelf.city)) : own;
  return { items: pool.flatMap(item => (item.shelf ? [item.shelf] : [])).slice(0, 8), exact: true };
}

/** The newest listings of one rubric: what a bare «чаши» or «bowls» should show. */
function categoryShelf(listings: readonly Chunk[], category: "hookahs" | "bowls" | "accessories") {
  const label = categoryNames.ru[category];
  if (!listings.length) return { items: [] as LiveShelfItem[], exact: false };
  return { items: listings.flatMap(item => (item.shelf && item.shelf.categoryLabel === label ? [item.shelf] : [])).slice(0, 8), exact: true };
}

function sourcesFor(hits: readonly Hit[]): LiveSource[] {
  return hits.map((hit, index) => ({ n: index + 1, title: hit.chunk.title.replace(/^Объявление: /, ""), href: hit.chunk.href, external: hit.chunk.external }));
}

function contextFor(items: readonly { hit: Hit; n: number }[]) {
  return items.map(({ hit, n }) => `[${n}] ${hit.chunk.contextTitle ?? hit.chunk.title}\n${hit.chunk.text}`).join("\n\n");
}

/** Only the entities the query is really about: a shared word like "кальян" must not fill the chronicle. */
function factsOf(hits: readonly Hit[]): KnowledgeFact[] {
  const entities = new Set<string>();
  for (const hit of hits) {
    const entity = hit.chunk.facts?.[0]?.entity;
    if (entity && entities.size < FACT_ENTITIES) entities.add(entity);
  }
  const seen = new Set<string>();
  return hits.flatMap(hit => hit.chunk.facts ?? []).filter(fact => entities.has(fact.entity) && !seen.has(fact.id) && Boolean(seen.add(fact.id)));
}

function timelineFrom(hits: readonly Hit[]) {
  const dated = factsOf(hits).filter(fact => fact.year !== null).slice(0, TIMELINE_SIZE);
  if (dated.length < 2) return [];
  return dated.sort((a, b) => (a.year as number) - (b.year as number)).map(fact => ({ year: fact.year as number, text: fact.fact, href: fact.source.url, label: fact.source.label }));
}

function peopleFrom(hits: readonly Hit[]) {
  const names = new Set<string>();
  return factsOf(hits).filter(fact => fact.type === "person" && !names.has(fact.entity) && Boolean(names.add(fact.entity))).slice(0, PEOPLE_SIZE).map(fact => ({ name: fact.entity, text: fact.fact, href: fact.source.url, label: fact.source.label }));
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const BRAND_LIMIT = 3;

const aliasAt = (text: string, alias: string) => text.search(new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(alias)}`, "u"));

/** Every brand a text names, in the order it names them, by alias at a word start so «калауда» still matches. */
export function matchBrands(query: string, cards: readonly BrandCard[]): BrandCard[] {
  const text = normalize(query);
  const found = cards.flatMap(card => {
    const at = Math.min(...card.aliases.map(alias => aliasAt(text, alias)).filter(index => index >= 0));
    return Number.isFinite(at) ? [{ card, at }] : [];
  });
  return found.sort((a, b) => a.at - b.at).slice(0, BRAND_LIMIT).map(({ card }) => card);
}

const toLiveBrand = (card: BrandCard): LiveBrand => ({ slug: card.slug, name: card.name, kind: card.kind, wiki: card.wiki, site: card.site, logo: card.logo, rows: card.rows, legend: card.legend });

export function brandsFrom(query: string, cards: readonly BrandCard[]): LiveBrand[] {
  return matchBrands(query, cards).map(toLiveBrand);
}

/** What leads the note: a rubric's article and entities, or the named brands' wiki pages and entities. */
export type Lead = { slugs: string[]; entities: string[]; exclude?: Topic["exclude"] };

export function leadOf(topic: Topic | null, brands: readonly BrandCard[]): Lead | null {
  if (topic) return { slugs: [topic.slug], entities: topic.entities, exclude: topic.exclude };
  if (brands.length) return { slugs: brands.flatMap(brand => (brand.wikiSlug ? [brand.wikiSlug] : [])), entities: brands.flatMap(brand => brand.entities) };
  return null;
}

const TOPIC_ENTITY_CHUNKS = 8;

/**
 * Encyclopedia first. A rubric query is led by the rubric's wiki article and its knowledge entities,
 * taken from the whole base even when the words miss them; every query then gets its best wiki article
 * and encyclopedia fact ahead of the rest.
 */
export function encyclopediaFirst(hits: readonly Hit[], spec: Lead | null, pool: readonly Chunk[] = []): Hit[] {
  const score = hits[0]?.score ?? 1;
  const asHit = (chunk: Chunk) => hits.find(hit => hit.chunk === chunk) ?? { chunk, score };
  const lead: Hit[] = spec
    ? [
        ...spec.slugs.flatMap(slug => pool.filter(chunk => chunk.slug === slug).slice(0, 2)).map(asHit),
        ...spec.entities.flatMap(entity => pool.filter(chunk => chunk.facts?.[0]?.entity === entity)).slice(0, TOPIC_ENTITY_CHUNKS).map(asHit),
      ]
    : [];
  const floor = (hits[0]?.score ?? 0) * 0.5;
  const strong = (kind: (chunk: Chunk) => boolean) => hits.find(hit => kind(hit.chunk) && hit.score >= floor && !lead.includes(hit) && !spec?.exclude?.(hit.chunk));
  for (const hit of [strong(chunk => chunk.kind === "wiki"), strong(chunk => chunk.kind === "knowledge" && chunk.sourceKind === "encyclopedia")]) if (hit) lead.push(hit);
  const rest = hits.filter(hit => !lead.includes(hit) && !spec?.exclude?.(hit.chunk));
  return [...lead, ...rest];
}

const QUESTION = /\?|^(как|что|кто|где|когда|почему|зачем|сколько|какой|какая|какие|каким|чем|откуда|есть ли|можно|расскажи|покажи|история|сравни)(\s|$)/u;

/** A bare term is not a question: the model gets «what is it and where did it come from», the shelf and wiki still use the term. */
export function modelQuestion(query: string): string {
  const text = query.trim();
  if (text.split(/\s+/).length > 1 || QUESTION.test(normalize(text))) return text;
  return `Что такое «${text}»: что это, как устроено и откуда появилось?`;
}

export async function runLiveSearch(input: LiveInput) {
  const { query, emit, signal } = input;
  const status = (lane: LiveLane, state: LiveLaneState, text: string) => emit({ t: "status", lane, state, text });
  const gate = gateQuery(query);
  const key = cacheKey(query);
  // A repeated question is replayed from memory: no model call and no share of the daily budget.
  const cached = input.generate && gate === "ok" ? readCache(key) : undefined;
  const release = !cached && input.generate && gate === "ok" && input.llm ? input.acquire() : null;
  const generating = Boolean(release || cached);
  emit({ t: "start", generating });
  try {
    status("wiki", "work", "Читаю вики");
    status("shelf", "work", "Смотрю витрину");
    if (input.generate) status("answer", "work", "Ищу ответ");
    if (generating) {
      status("journal", "work", "Пишу заметку");
      status("check", "work", "Составляю проверку");
    } else {
      status("journal", "off", "Заметки не будет");
      status("check", "off", "Проверки не будет");
    }

    // A catalog outage leaves the shelf empty; the wiki and rules can still answer.
    const listings = await input.loadListings().catch((error: unknown) => {
      console.error("Live search shelf failed", error instanceof Error ? error.message : "unknown");
      return [] as Chunk[];
    });
    if (signal.aborted) return;
    const topic = topicOf(query);
    const tobacco = mentionsTobacco(query);
    const named = topic ? [] : matchBrands(query, input.brands ?? []);
    const hits = encyclopediaFirst(search([...input.staticChunks, ...listings], query), leadOf(topic, named), input.staticChunks);
    const groups = wikiGroups(hits);
    const articleCount = groups.reduce((sum, group) => sum + group.items.length, 0);
    emit({ t: "wiki", groups });
    status("wiki", "done", articleCount ? `Вики: ${articleCount} ${plural(articleCount, "статья", "статьи", "статей")}` : "В вики ничего");
    const rulesQuery = RULES_QUERY.test(normalize(query));
    const route = routeQuery(query);
    // A refusal or an off-topic query must not sit next to goods.
    const none = { items: [] as LiveShelfItem[], exact: false };
    const shelf = gate !== "ok" || !hits.length || rulesQuery || tobacco ? none
      : topic ? (topic.listing ? categoryShelf(listings, topic.listing) : none)
      : named.length ? brandShelf(listings, named, query)
      : route === "general" ? shelfResult(listings, query) : none;
    emit({ t: "shelf", ...shelf });
    status("shelf", "done", shelf.exact ? `Витрина: ${shelf.items.length} ${plural(shelf.items.length, "объявление", "объявления", "объявлений")}` : "Витрина: совпадений нет");
    const text = normalize(`${query} ${hits.slice(0, 4).map(hit => hit.chunk.title).join(" ")}`);
    emit({ t: "terms", items: LIVE_TERMS.filter(term => term.match.test(text)).slice(0, 4).map(({ term, text: definition, href }) => ({ term, text: definition, href })) });

    if (gate === "ok") {
      emit({ t: "timeline", items: timelineFrom(hits) });
      emit({ t: "people", items: peopleFrom(hits) });
      emit({ t: "brand", items: named.map(toLiveBrand) });
    }

    if (!input.generate) return;
    if (gate !== "ok") {
      emit({ t: "replace", text: gate === "tobacco" ? TOBACCO_REPLY : INJECTION_REPLY, kind: "fixed" });
      status("answer", "done", "Ответ готов");
      return;
    }
    if (!hits.length) {
      emit({ t: "replace", text: NOT_FOUND_REPLY, kind: "notfound" });
      status("answer", "done", "В базе нет");
      status("journal", "off", "Заметки не будет");
      status("check", "off", "Проверки не будет");
      return;
    }
    const ranked = rulesQuery ? [...hits.filter(hit => hit.chunk.kind === "rules"), ...hits.filter(hit => hit.chunk.kind !== "rules")] : hits;
    // A rubric gets a reference note, not a two-line answer; a seller checklist only where the rubric is sold and tobacco is not mentioned.
    // A brand gets the same reference note as a rubric: its story, its people, its devices, and questions for the seller.
    const base = topic ? { ...ROUTE_PROFILES.history, check: Boolean(topic.listing) } : named.length ? { ...ROUTE_PROFILES.history, check: true } : ROUTE_PROFILES[route];
    const profile = tobacco ? { ...base, check: false } : base;
    const top = ranked.slice(0, profile.contextSize);
    if (cached) {
      emit({ t: "sources", items: sourcesFor(top) });
      const done = { answer: "Ответ готов", journal: "Заметка готова", check: "Проверка готова" } as const;
      for (const name of ["answer", "journal", "check"] as const) {
        const text = cached.lanes[name];
        if (cached.off.includes(name) || text === undefined) {
          status(name, "off", "Не нужно");
          continue;
        }
        emit({ t: "delta", lane: name, text });
        status(name, "done", done[name]);
      }
      if (cached.follow.length) emit({ t: "follow", items: cached.follow });
      return;
    }
    if (!release || !input.llm) {
      const best = ranked[0].chunk;
      emit({ t: "replace", text: best.text, kind: "excerpt", href: best.href });
      status("answer", "done", "Выдержка из базы");
      return;
    }

    emit({ t: "sources", items: sourcesFor(top) });
    const numbered = top.map((hit, index) => ({ hit, n: index + 1 }));
    // Side lanes need less, and only what fits them; [n] stays the same as in the answer.
    const sideContext = (keep: (chunk: Chunk) => boolean) => contextFor(numbered.filter(item => keep(item.hit.chunk)).slice(0, SIDE_CONTEXT_SIZE));
    const contexts = {
      answer: contextFor(numbered),
      // A search for goods gets the shelf, not an essay stitched from unrelated articles.
      journal: rulesQuery || top[0].chunk.kind === "listing" ? "" : sideContext(chunk => chunk.kind === "wiki" || chunk.kind === "knowledge"),
      check: rulesQuery || !profile.check ? "" : sideContext(chunk => chunk.kind === "wiki" || chunk.kind === "listing"),
      follow: sideContext(() => true),
    };
    const llm = input.llm;
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(Number(process.env.LIVE_LLM_TIMEOUT_MS) || GENERATION_TIMEOUT_MS)]);
    const lane = async (name: keyof typeof contexts, onText: (text: string) => void) => {
      const prompt = name === "answer" ? profile.answerPrompt : name;
      for await (const text of llm([{ role: "system", content: LANE_PROMPTS[prompt] }, { role: "user", content: userMessage(contexts[name], modelQuestion(query)) }], { maxTokens: LANE_TOKENS[prompt], signal: timeout })) onText(text);
    };
    const record: CachedAnswer = { lanes: {}, off: [], follow: [] };
    let failed = false;
    const textLane = async (name: "answer" | "journal" | "check", done: string) => {
      if (!contexts[name]) {
        record.off.push(name);
        status(name, "off", "Не нужно");
        return;
      }
      try {
        status(name, "work", name === "answer" ? "Пишу ответ" : name === "journal" ? "Пишу заметку" : "Составляю проверку");
        const write = (delta: string) => {
          record.lanes[name] = (record.lanes[name] ?? "") + delta;
          emit({ t: "delta", lane: name, text: delta });
        };
        // The provider's shared pool answers 429 in bursts: a lane that failed before its first word
        // waits and tries again; a half-written lane is not restarted.
        for (let attempt = 0; ; attempt += 1) {
          try {
            await lane(name, write);
            break;
          } catch (error) {
            if (signal.aborted || record.lanes[name] || attempt >= RETRY_DELAYS_MS.length) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
          }
        }
        status(name, "done", done);
      } catch {
        failed = true;
        if (signal.aborted) return;
        status(name, "off", "Не получилось");
        if (name === "answer") emit({ t: "replace", text: top[0].chunk.text, kind: "excerpt", href: top[0].chunk.href });
      }
    };
    const follow = async () => {
      let text = "";
      try {
        await lane("follow", delta => { text += delta; });
      } catch {
        return;
      }
      const items = text.split("\n").flatMap(line => cleanFollowUp(line) ?? []).filter(line => gateQuery(line) === "ok").slice(0, 3);
      record.follow = items;
      if (items.length && !signal.aborted) emit({ t: "follow", items });
    };
    await Promise.all([textLane("answer", "Ответ готов"), textLane("journal", "Заметка готова"), textLane("check", "Проверка готова"), follow()]);
    // Only a complete, uninterrupted generation is worth replaying.
    if (!failed && !signal.aborted && record.lanes.answer) writeCache(key, record);
  } finally {
    release?.();
    if (!signal.aborted) emit({ t: "done" });
  }
}
