/**
 * Reads a listing as the seller types: brand and model from the atlas, rubric, price, city,
 * a tobacco warning and what the description still lacks. Pure code, no model: the text never
 * leaves the browser. Shared by the form, its preview and the published listing page.
 */
import { detectSubcategory } from "./listing-taxonomy";

export type ListingCategory = "hookahs" | "bowls" | "accessories";

export type SmartBrand = {
  slug: string;
  name: string;
  kind: string;
  /** Lower-case spellings, Latin and Cyrillic. */
  aliases: string[];
  logo: { src: string; width: number; height: number; plate: "light" | "dark" } | null;
  rows: { label: string; value: string; href: string; source: string }[];
  wiki: string | null;
  /** From the shop-catalog directory (makes.json): what the make sells, its models and where it was seen. */
  categories?: ListingCategory[];
  models?: string[];
  sources?: string[];
  /** false: the name is a common word, offered as a suggestion but never guessed from text. */
  match?: boolean;
  /** «hmd» for a make known for heat management, «hose» for hoses: the subcategory when the title names none. */
  mainSubcategory?: string | null;
  /** true when the card comes from the checked atlas (facts behind every row). */
  atlas?: boolean;
};

export type SmartReading = {
  brand: SmartBrand | null;
  model: string | null;
  category: ListingCategory | null;
  /** Second level inside the category, from the title. */
  subcategory: string | null;
  /** Where the rubric came from, to explain the automatic choice. */
  categoryFrom: "title" | "brand" | "description" | null;
  price: string | null;
  city: string | null;
  tobacco: boolean;
  checklist: { key: string; label: string; done: boolean }[];
  /** «Кальян HOOB Atom» when the title names the brand and model but not the thing. */
  suggestedTitle: string | null;
};

const lower = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (pattern: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(${pattern})(?=[^\\p{L}\\p{N}]|$)`, "u");

/** Brand kinds that are goods; lounge chains and services in the atlas are not sold here. */
const KIND_CATEGORY: Record<string, ListingCategory> = {
  "Кальяны": "hookahs",
  "Кальяны ручной работы": "hookahs",
  "Устройства контроля жара": "accessories",
  "Чаши": "bowls",
};

/** The thing itself, by stems. The earliest one in the title is the head noun: «Чаша для кальяна HOOB» is a bowl. */
const THINGS: { category: ListingCategory; pattern: RegExp; word: string }[] = [
  { category: "bowls", pattern: /чаш|фаннел|phunnel|убивашк|bowl/gu, word: "Чаша" },
  { category: "accessories", pattern: /калауд|kaloud|лотус|lotus|(?<![a-z])hmd(?![a-z])|хмд|шланг|мундштук|щипц|колб|блюдц|уплотнител|переходник|диффузор|клапан|аксессуар/gu, word: "" },
  { category: "hookahs", pattern: /кальян|шахт|hookah|shisha|наргиле/gu, word: "Кальян" },
];

const TOBACCO = /табак|табач|никотин|вейп|vape|снюс|сигарет|жидкост[ьи] для|pod[- ]?систем|смес[ьи] для кур/u;

/** Big cities by stem; anything else is taken from «г. Название». */
const CITIES: [RegExp, string][] = [
  [/москв/u, "Москва"], [/санкт[- ]?петербург|петербург|(?<!\p{L})спб(?!\p{L})|(?<!\p{L})питер/u, "Санкт-Петербург"], [/новосибирск/u, "Новосибирск"],
  [/екатеринбург|(?<!\p{L})екб(?!\p{L})/u, "Екатеринбург"], [/казан[ьи]/u, "Казань"], [/нижн(?:ий|ем|его) новгород/u, "Нижний Новгород"],
  [/челябинск/u, "Челябинск"], [/самар[аеуы]/u, "Самара"], [/(?<!\p{L})омск/u, "Омск"], [/ростов/u, "Ростов-на-Дону"], [/(?<!\p{L})уф[аеуы](?!\p{L})/u, "Уфа"],
  [/красноярск/u, "Красноярск"], [/воронеж/u, "Воронеж"], [/(?<!\p{L})перм[ьи]/u, "Пермь"], [/волгоград/u, "Волгоград"], [/краснодар/u, "Краснодар"],
  [/саратов/u, "Саратов"], [/тюмен[ьи]/u, "Тюмень"], [/тольятти/u, "Тольятти"], [/ижевск/u, "Ижевск"], [/барнаул/u, "Барнаул"],
  [/иркутск/u, "Иркутск"], [/хабаровск/u, "Хабаровск"], [/владивосток/u, "Владивосток"], [/ярославл/u, "Ярославль"], [/(?<!\p{L})томск/u, "Томск"],
  [/оренбург/u, "Оренбург"], [/кемерово/u, "Кемерово"], [/рязан[ьи]/u, "Рязань"], [/набережн\p{L}* челн/u, "Набережные Челны"],
  [/пенз[аеуы]/u, "Пенза"], [/липецк/u, "Липецк"], [/(?<!\p{L})тул[аеуы](?!\p{L})/u, "Тула"], [/калининград/u, "Калининград"], [/(?<!\p{L})сочи(?!\p{L})/u, "Сочи"],
  [/минск/u, "Минск"], [/алмат/u, "Алматы"], [/астан/u, "Астана"], [/ереван/u, "Ереван"],
];

const CHECKS: { key: string; label: string; pattern: RegExp }[] = [
  { key: "state", label: "Состояние и дефекты", pattern: /состояни|царапин|скол|потерт|потёрт|дефект|трещин|как нов|идеальн|износ|следы/u },
  { key: "kit", label: "Что в комплекте", pattern: /комплект|в наборе|коробк|без колб|с колб|без шланг|со шланг|с чаш|без чаш/u },
  { key: "age", label: "Сколько пользовались", pattern: /(?<!\p{L})год|(?<!\p{L})лет(?!\p{L})|месяц|полгода|недел|куплен|покупал|пользовал|использовал/u },
  { key: "original", label: "Оригинал или копия", pattern: /оригинал|подлинн|(?<!\p{L})чек(?!\p{L})|гаранти|серийн|копи[яи]|реплик/u },
];

/** Goods the make sells; lounge chains and services in the atlas sell none. */
export function brandGoods(brand: SmartBrand): ListingCategory[] {
  if (brand.categories?.length) return brand.categories;
  const category = KIND_CATEGORY[brand.kind];
  return category ? [category] : [];
}

function findBrand(text: string, brands: readonly SmartBrand[]) {
  let best: { brand: SmartBrand; at: number; alias: string } | null = null;
  for (const brand of brands) {
    if (brand.match === false || !brandGoods(brand).length) continue;
    for (const alias of brand.aliases) {
      if (alias.length < 3) continue;
      const match = word(escape(alias)).exec(text);
      if (!match) continue;
      const at = match.index + match[0].indexOf(match[1]);
      if (!best || at < best.at) best = { brand, at, alias };
    }
  }
  return best;
}

/** A model the catalogs know, anywhere in the title; the longest one wins («Lotus III» over «Lotus»). */
function knownModel(title: string, brand: SmartBrand) {
  const text = lower(title);
  let best: string | null = null;
  for (const model of brand.models ?? []) {
    if (model.length < 2) continue;
    if (word(escape(lower(model))).test(text) && (!best || model.length > best.length)) best = model;
  }
  return best;
}

/** One or two tokens right after the brand in the original title: «HOOB Atom чёрный» → «Atom», «Alpha Hookah Model X» → «Model X». */
function findModel(title: string, at: number, alias: string) {
  const after = title.slice(at + alias.length).trim().split(/\s+/);
  const token = /^[A-Za-z0-9][A-Za-z0-9.+\-]*$/;
  if (!after[0] || !token.test(after[0]) || /^(б\/у|new)$/i.test(after[0])) return null;
  const model = [after[0]];
  if (after[1] && token.test(after[1]) && (after[1].length <= 3 || /^\d/.test(after[1]) || /^model$/i.test(after[0]))) model.push(after[1]);
  return model.join(" ");
}

function firstThing(text: string) {
  let best: { category: ListingCategory; at: number; word: string } | null = null;
  for (const thing of THINGS) {
    thing.pattern.lastIndex = 0;
    const match = thing.pattern.exec(text);
    if (match && (!best || match.index < best.at)) best = { category: thing.category, at: match.index, word: thing.word };
  }
  return best;
}

export function findPrice(text: string) {
  const source = lower(text);
  const patterns = [
    /(\d+(?:[.,]\d+)?)(?:\s*(?:тыс\.?|т\.\s?р\.?)|[кk](?!\p{L}))/u,
    /(\d[\d\s]{0,8}\d|\d)\s*(?:₽|руб|р\.|р(?!\p{L})|rub)/u,
    /цена[:\s-]*(\d[\d\s]{0,8}\d|\d)/u,
    /(?<!\p{L})за\s+(\d[\d\s]{2,8}\d)(?!\d)/u,
  ];
  for (const [index, pattern] of patterns.entries()) {
    const match = pattern.exec(source);
    if (!match) continue;
    const digits = match[1].replace(/\s/g, "");
    const value = index === 0 ? Math.round(Number(digits.replace(",", ".")) * 1000) : Number(digits);
    if (Number.isFinite(value) && value > 0 && value < 10_000_000) return String(value);
  }
  return null;
}

export function findCity(text: string) {
  const source = lower(text);
  for (const [pattern, city] of CITIES) if (pattern.test(source)) return city;
  const named = /(?:^|\s)г\.\s*([А-ЯЁ][а-яё]+(?:-[А-ЯЁа-яё][а-яё]+)*)/u.exec(text);
  return named ? named[1] : null;
}

export function readListing(fields: { title: string; description: string }, brands: readonly SmartBrand[]): SmartReading {
  const title = lower(fields.title);
  const description = lower(fields.description);
  const all = `${fields.title}\n${fields.description}`;
  const inTitle = findBrand(title, brands);
  const found = inTitle ?? findBrand(description, brands);
  const brand = found?.brand ?? null;
  const model = inTitle ? knownModel(fields.title, inTitle.brand) ?? findModel(fields.title, inTitle.at, inTitle.alias) : null;
  const titleThing = firstThing(title);
  // A make that sells one kind of goods names the category; Oduman (hookahs, bowls, HMD) leaves it to the title.
  const goods = brand ? brandGoods(brand) : [];
  // The atlas states the make's main goods («HOOB — кальяны»); the directory only lists what catalogs sell.
  // Directory goods are listed main first: Werkbund is a bowl maker that also sells hookahs.
  const brandCategory = brand ? KIND_CATEGORY[brand.kind] ?? goods[0] ?? null : null;
  const descriptionThing = titleThing || brandCategory ? null : firstThing(description);
  const category = titleThing?.category ?? brandCategory ?? descriptionThing?.category ?? null;
  const categoryFrom = titleThing ? "title" : brandCategory ? "brand" : descriptionThing ? "description" : null;
  const thingWord = category === "bowls" ? "Чаша" : category === "hookahs" ? "Кальян" : "";
  // Only when the title starts from the brand and never names the thing: «HOOB Atom чёрный» → «Кальян HOOB Atom чёрный».
  const suggestedTitle = brand && inTitle && !titleThing && thingWord ? `${thingWord} ${fields.title.trim()}` : null;
  return {
    brand,
    model,
    category,
    subcategory: detectSubcategory(category, fields.title) ?? (brand?.mainSubcategory && category === "accessories" ? brand.mainSubcategory : null),
    categoryFrom,
    price: findPrice(all),
    city: findCity(all),
    tobacco: TOBACCO.test(lower(all)),
    checklist: CHECKS.map(check => ({ key: check.key, label: check.label, done: check.pattern.test(description) })),
    suggestedTitle: suggestedTitle && suggestedTitle.length <= 100 && lower(suggestedTitle) !== title.trim() ? suggestedTitle : null,
  };
}

/** A whole ready text (from another board or a chat) split into fields: first line is the title, the rest is the description. */
export function splitPasted(raw: string, brands: readonly SmartBrand[]) {
  const lines = raw.replace(/\r/g, "").split("\n").map(line => line.trim());
  const first = lines.findIndex(Boolean);
  if (first < 0) return null;
  let title = lines[first].replace(/\s*[-–—|]\s*\d[\d\s]*\s*(?:₽|руб\.?|р\.?)\s*$/iu, "").slice(0, 100).trim();
  const rest = lines.slice(first + 1).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const description = (rest || lines[first]).slice(0, 5000);
  if (title.length < 5) title = (lines[first] + " " + rest).slice(0, 100).trim();
  const reading = readListing({ title, description: raw }, brands);
  return { title, description, price: reading.price, city: reading.city, category: reading.category };
}
