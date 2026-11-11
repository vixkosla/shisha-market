import fs from "fs";
import path from "path";
import { getWikiArticle, getWikiSlugs } from "@/lib/wiki";
import { wikiPlainText } from "@/lib/wiki-markdown";
import { categoryNames } from "@/lib/i18n";
import { formatPrice } from "@/lib/listings";
import { isExampleListing } from "@/lib/listing-examples";
import { externalListingState, getExternalListings } from "@/lib/external-listings";
import type { LiveBrand, LiveBrandLogo, LiveShelfItem, LiveTerm } from "@/lib/live-search";
import { normalize } from "./text";
import { legalDocuments } from "@/server/legal-documents";
import { getDatabase } from "@/server/db";
import { getCatalog } from "@/server/listings";

export type SourceKind = "encyclopedia" | "official" | "research" | "press" | "community" | "blog" | "retailer";
export type KnowledgeFact = {
  id: string;
  entity: string;
  aliases: string[];
  type: "history" | "brand" | "person" | "community" | "product" | "trend" | "market" | "regulation" | "research";
  year: number | null;
  fact: string;
  source: { url: string; label: string; kind: SourceKind };
  checkedAt: string;
};

const SOURCE_NOTES: Record<SourceKind, string> = {
  encyclopedia: "энциклопедия",
  official: "сайт бренда",
  research: "исследование",
  press: "пресса",
  community: "сообщество",
  blog: "блог",
  retailer: "магазин",
};

export type Chunk = {
  kind: "wiki" | "rules" | "listing" | "knowledge";
  title: string;
  /** What retrieval reads instead of the title, when the title carries a source name. */
  indexTitle?: string;
  text: string;
  href: string;
  external: boolean;
  slug?: string;
  description?: string;
  pending?: boolean;
  shelf?: LiveShelfItem;
  keywords?: string;
  /** How the model sees the fragment: the source must not read as part of the name. */
  contextTitle?: string;
  sourceKind?: SourceKind;
  facts?: KnowledgeFact[];
};

const SKIPPED_SECTIONS = new Set(["Источники", "См. также", "Границы площадки", "Размещение объявлений"]);
const CACHE_MS = 5 * 60_000;
const MAX_CHUNK = 900;
let cached: { at: number; chunks: Chunk[] } | null = null;

function splitParagraphs(text: string) {
  const parts: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n\s*\n/)) {
    if (current && current.length + paragraph.length > MAX_CHUNK) {
      parts.push(current);
      current = paragraph;
    } else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) parts.push(current);
  return parts;
}

export function knowledgeFacts(): KnowledgeFact[] {
  const file = path.join(process.cwd(), "content", "knowledge", "facts.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf-8").split("\n").filter(Boolean).map(line => JSON.parse(line) as KnowledgeFact);
}

type AtlasBrand = {
  slug: string;
  name: string;
  kind: string;
  aliases: string[];
  wiki?: string;
  site?: string;
  logo: LiveBrandLogo | null;
  rows: { label: string; value: string; fact: string }[];
  legend: string[];
  entities?: string[];
};
/** Server side of a brand card: how queries and listings name it, and which wiki page and knowledge entities lead its note. */
export type BrandCard = LiveBrand & { aliases: string[]; entities: string[]; wikiSlug: string | null };

let brandCache: { at: number; cards: BrandCard[] } | null = null;

/** Brand level of the atlas: content/atlas/brands.json, each row backed by a fact id from the knowledge base. */
export function brandCards(now = Date.now()): BrandCard[] {
  if (brandCache && now - brandCache.at < CACHE_MS) return brandCache.cards;
  const file = path.join(process.cwd(), "content", "atlas", "brands.json");
  const atlas = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as AtlasBrand[]) : [];
  const facts = new Map(knowledgeFacts().map(fact => [fact.id, fact]));
  const cards = atlas.map(brand => ({
    slug: brand.slug,
    name: brand.name,
    kind: brand.kind,
    aliases: brand.aliases.map(alias => normalize(alias)),
    entities: brand.entities ?? [],
    wikiSlug: brand.wiki ?? null,
    wiki: brand.wiki ? `/wiki/${brand.wiki}` : null,
    site: brand.site ?? null,
    logo: brand.logo ?? null,
    rows: brand.rows.flatMap(row => {
      const fact = facts.get(row.fact);
      return fact ? [{ label: row.label, value: row.value, href: fact.source.url, source: fact.source.label }] : [];
    }),
    legend: brand.legend.flatMap(id => {
      const fact = facts.get(id);
      return fact ? [{ text: fact.fact, href: fact.source.url, label: fact.source.label, own: fact.source.kind === "official" }] : [];
    }),
  }));
  brandCache = { at: now, cards };
  return cards;
}

/** One chunk per entity and source, so every fragment has a single honest attribution. */
function knowledgeChunks(): Chunk[] {
  const groups = new Map<string, KnowledgeFact[]>();
  for (const fact of knowledgeFacts()) {
    const key = `${fact.entity}|${fact.source.url}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const chunks: Chunk[] = [];
  for (const facts of groups.values()) {
    const { entity, aliases, source } = facts[0];
    const base = { kind: "knowledge" as const, title: `${entity}: ${source.label}`, indexTitle: entity, href: source.url, external: true, keywords: aliases.join(" "), contextTitle: `${entity} (источник: ${source.label}) [${SOURCE_NOTES[source.kind]}]`, sourceKind: source.kind };
    let part: KnowledgeFact[] = [];
    let size = 0;
    const flush = () => {
      if (part.length) chunks.push({ ...base, text: part.map(item => (item.year ? `${item.year}: ${item.fact}` : item.fact)).join("\n"), facts: part });
      part = [];
      size = 0;
    };
    for (const fact of facts) {
      if (size + fact.fact.length > MAX_CHUNK) flush();
      part.push(fact);
      size += fact.fact.length;
    }
    flush();
  }
  return chunks;
}

/** Wiki articles (without editor guides), the publication rules and verified knowledge facts. */
export function staticChunks(now = Date.now()): Chunk[] {
  if (cached && now - cached.at < CACHE_MS) return cached.chunks;
  const chunks: Chunk[] = [];
  for (const slug of getWikiSlugs()) {
    if (!/^(brands|categories)\//.test(slug)) continue;
    const article = getWikiArticle(slug);
    if (!article) continue;
    const base = { kind: "wiki" as const, href: `/wiki/${slug}`, external: false, slug, description: article.description, pending: article.reviewPending };
    const sections = article.content.split(/^## (.+)$/m);
    const add = (title: string, body: string) => {
      const plain = wikiPlainText(body.replace(/^# .+$/m, ""));
      for (const part of splitParagraphs(plain)) if (part.trim().length >= 30) chunks.push({ ...base, title, text: part.trim() });
    };
    add(article.title, sections[0]);
    for (let index = 1; index < sections.length; index += 2) {
      const heading = sections[index].trim();
      if (!SKIPPED_SECTIONS.has(heading)) add(`${article.title}: ${heading}`, sections[index + 1]);
    }
  }
  for (const section of legalDocuments().rules) {
    for (const text of section.paragraphs) chunks.push({ kind: "rules", title: `Правила публикации: ${section.heading}`, text, href: "/legal/rules", external: false });
  }
  chunks.push(...knowledgeChunks());
  cached = { at: now, chunks };
  return chunks;
}

/** Published member listings and checked external pointers. Launch examples are never offered. */
export async function listingChunks(now = new Date()): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  const database = await getDatabase();
  for (let page = 1; page <= 3; page += 1) {
    const catalog = await getCatalog(database, { page: String(page) });
    for (const item of catalog.items) {
      if (isExampleListing(item.id)) continue;
      const categoryLabel = categoryNames.ru[item.category as keyof typeof categoryNames.ru] ?? "";
      const priceLabel = formatPrice(item.priceKopecks);
      const shelf: LiveShelfItem = { id: item.id, title: item.title, city: item.city, priceLabel, categoryLabel, href: `/listings/${item.id}`, external: false, note: null, coverId: item.coverId ?? null };
      const make = [item.brand && `Марка: ${item.brand}.`, item.model && `Модель: ${item.model}.`].filter(Boolean).join(" ");
      chunks.push({ kind: "listing", title: `Объявление: ${item.title}`, text: `${categoryLabel}. ${item.title}. ${make ? `${make} ` : ""}Город: ${item.city}. Цена в объявлении: ${priceLabel}. ${item.description.slice(0, 500)} Наличие уточняйте у продавца.`, href: shelf.href, external: false, shelf });
    }
    if (!catalog.hasNext) break;
  }
  for (const item of getExternalListings({}, now)) {
    if (externalListingState(item, now) === "sold" || externalListingState(item, now) === "unavailable") continue;
    const categoryLabel = categoryNames.ru[item.category];
    const priceLabel = formatPrice(item.priceKopecks);
    const city = item.city.ru;
    const shelf: LiveShelfItem = { id: item.id, title: item.title, city, priceLabel, categoryLabel, href: item.sourceUrl, external: true, note: `С другой площадки: ${item.sourceName}. Наличие уточняйте у продавца.`, coverId: null };
    chunks.push({ kind: "listing", title: `Объявление: ${item.title}`, text: `${categoryLabel}. Объявление с другой площадки (${item.sourceName}). ${item.title}. Город: ${city}. Цена в объявлении: ${priceLabel}. ${item.summary.ru} Опубликовано ${item.publishedAt.slice(0, 10)}. Сайт не гарантирует, что вещь ещё продаётся.`, href: item.sourceUrl, external: true, shelf });
  }
  return chunks;
}

/** Definitions taken from the wiki articles they link to; shown without any model. */
export const LIVE_TERMS: readonly (LiveTerm & { match: RegExp })[] = [
  { term: "HMD", text: "Устройство контроля жара, Heat Management Device. Название класса устройств, а не марка.", href: "/wiki/categories/accessories", match: /\bhmd\b|контрол\w* жара|хмд/ },
  { term: "Lotus", text: "Линейка устройств контроля жара Kaloud, а не тип чаши.", href: "/wiki/categories/bowls", match: /lotus|лотус/ },
  { term: "Фаннел", text: "Чаша с приподнятым центральным отверстием.", href: "/wiki/categories/bowls", match: /фаннел|phunnel/ },
  { term: "Глазурь", text: "Покрытие поверхности керамической чаши.", href: "/wiki/categories/bowls", match: /глазур/ },
  { term: "Колба", text: "Нижняя ёмкость, с которой соединяется шахта.", href: "/wiki/categories/hookahs", match: /колб/ },
  { term: "Шахта", text: "Основная вертикальная часть кальяна.", href: "/wiki/categories/hookahs", match: /шахт/ },
  { term: "Погружная трубка", text: "Нижняя часть шахты, входящая в колбу.", href: "/wiki/categories/hookahs", match: /погружн/ },
];
