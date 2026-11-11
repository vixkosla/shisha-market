import type {Locale} from "@/lib/i18n";

// Editorial pointers, not seller accounts or copies in the user-listings table.
// checkedAt means the source and its advertised contact were accessible, NOT that
// the seller, condition, ownership or continued availability has been verified.
export type ExternalListing = {
  id: string;
  title: string;
  category: "hookahs" | "bowls" | "accessories";
  city: Record<Locale, string>;
  summary: Record<Locale, string>;
  priceKopecks: number;
  sourceName: string;
  sourceUrl: string;
  contactUrl: string;
  contactEvidenceUrl: string;
  publishedAt: string;
  checkedAt: string;
  // Review due date changes the label; it never hides or deletes the card.
  reviewBy: string;
  state?: "listed" | "sold" | "unavailable";
};

export const EXTERNAL_LISTINGS: readonly ExternalListing[] = [
  {
    id: "hookah-guru-118",
    title: "Darkside Orion Obsidian Black",
    category: "hookahs",
    city: {ru: "Уфа", en: "Ufa"},
    summary: {
      ru: "По описанию продавца, использовался 10–20 раз. Есть заводская упаковка, колба и дополнительные аксессуары. Возможны самовывоз и отправка.",
      en: "The seller reports 10–20 uses. Includes the original packaging, a base and extra accessories. Collection or shipping offered.",
    },
    priceKopecks: 900000,
    sourceName: "HOOKAH GURU · Telegram",
    sourceUrl: "https://t.me/shisha_baraholka_guru/118",
    contactUrl: "https://t.me/nsk_damir",
    contactEvidenceUrl: "https://t.me/shisha_baraholka_guru/127",
    publishedAt: "2026-10-18T20:38:13Z",
    checkedAt: "2026-10-24T00:00:00Z",
    reviewBy: "2026-11-07T00:00:00Z",
  },
  {
    id: "hookah-guru-110",
    title: "HOOB Atom",
    category: "hookahs",
    city: {ru: "Москва", en: "Moscow"},
    summary: {
      ru: "Продавец указывает рабочее состояние; к кальяну прилагаются чаша и щипцы. Возможны самовывоз и отправка.",
      en: "Advertised as working, with a bowl and tongs included. Collection or shipping offered.",
    },
    priceKopecks: 900000,
    sourceName: "HOOKAH GURU · Telegram",
    sourceUrl: "https://t.me/shisha_baraholka_guru/110",
    contactUrl: "https://t.me/yury_yazov",
    contactEvidenceUrl: "https://t.me/shisha_baraholka_guru/110",
    publishedAt: "2026-09-23T12:47:42Z",
    checkedAt: "2026-10-24T00:00:00Z",
    reviewBy: "2026-11-07T00:00:00Z",
  },
  {
    "id": "hookahsale-192532",
    "title": "HOOB из нержавейки",
    "category": "hookahs",
    "city": {
      "ru": "Москва",
      "en": "Moscow"
    },
    "summary": {
      "ru": "Бывший в использовании HOOB с комплектом аксессуаров. Продавец предлагает только самовывоз; дополнительные фото и подробности — по запросу.",
      "en": "A used stainless-steel HOOB with accessories. The seller offers collection only; more photos and details are available on request."
    },
    "priceKopecks": 1700000,
    "sourceName": "HOOKAHSALE · Telegram",
    "sourceUrl": "https://t.me/hookahsale/192532",
    "contactUrl": "https://t.me/m_toptrip",
    "contactEvidenceUrl": "https://t.me/hookahsale/192532",
    "publishedAt": "2026-11-05T12:31:32Z",
    "checkedAt": "2026-11-07T22:21:55.979089Z",
    "reviewBy": "2026-11-21T22:21:55Z"
  },
  {
    "id": "hookahsale-192545",
    "title": "Geometry Big Bro Natural Black",
    "category": "hookahs",
    "city": {
      "ru": "Город не указан",
      "en": "City not specified"
    },
    "summary": {
      "ru": "Geometry Big Bro в цвете Natural Black. Продавец описывает состояние как хорошее. Город и состав комплекта в посте не указаны — уточните их перед договорённостью.",
      "en": "Geometry Big Bro in Natural Black, described by the seller as being in good condition. The post does not specify the city or included accessories; ask the seller for details."
    },
    "priceKopecks": 800000,
    "sourceName": "HOOKAHSALE · Telegram",
    "sourceUrl": "https://t.me/hookahsale/192545",
    "contactUrl": "https://t.me/desinger_zip",
    "contactEvidenceUrl": "https://t.me/hookahsale/192545",
    "publishedAt": "2026-11-05T12:31:54Z",
    "checkedAt": "2026-11-07T22:21:55.979089Z",
    "reviewBy": "2026-11-21T22:21:55Z"
  },
  {
    "id": "hookahsale-192363",
    "title": "HOOB Atom, чёрно-золотой",
    "category": "hookahs",
    "city": {
      "ru": "Новосибирск",
      "en": "Novosibirsk"
    },
    "summary": {
      "ru": "Чёрно-золотая шахта, колба и мундштук; установлен новый магнит. По описанию продавца, стакан разбит, пульт подсветки утерян. Эти особенности учтите при осмотре.",
      "en": "Black-and-gold stem, base and mouthpiece, with a replacement magnet. The seller reports a broken cup and a missing light remote; inspect these details before agreeing to buy."
    },
    "priceKopecks": 1000000,
    "sourceName": "HOOKAHSALE · Telegram",
    "sourceUrl": "https://t.me/hookahsale/192363",
    "contactUrl": "https://t.me/ur_bass",
    "contactEvidenceUrl": "https://t.me/hookahsale/192363",
    "publishedAt": "2026-11-03T14:42:05Z",
    "checkedAt": "2026-11-07T22:21:55.979089Z",
    "reviewBy": "2026-11-21T22:21:55Z"
  },

];

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

export function getExternalListings(
  filters: {q?: string; city?: string; category?: string; page?: string} = {},
  now = new Date(),
) {
  const page = Number(filters.page || "1");
  if (Number.isFinite(page) && page > 1) return [];
  const queryWords = normalize(filters.q || "").split(/\s+/).filter(Boolean);
  const city = normalize(filters.city || "");
  return EXTERNAL_LISTINGS.filter(item => {
    if (now.getTime() < Date.parse(item.checkedAt)) return false;
    if (filters.category && filters.category !== item.category) return false;
    if (city && !Object.values(item.city).some(value => normalize(value).includes(city))) return false;
    const text = normalize([item.title, ...Object.values(item.city), ...Object.values(item.summary)].join(" "));
    return queryWords.every(word => text.includes(word));
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function externalListingState(item: ExternalListing, now = new Date()) {
  if (item.state === "sold" || item.state === "unavailable") return item.state;
  return now.getTime() >= Date.parse(item.reviewBy) ? "needs_review" : "listed";
}

export const externalListingCopy = {
  ru: {
    title: "С других площадок",
    intro: "Объявления из открытых источников с исходными датами. Карточки остаются в подборке после срока проверки. Продавцы не размещали их на Shisha Market; наличие и условия уточняйте напрямую.",
    badge: "Внешнее объявление",
    states: {
      listed: {label: "Наличие уточняйте у продавца", detail: "Проверена ссылка на объявление, а не наличие вещи."},
      needs_review: {label: "Актуальность нужно уточнить", detail: "Источник давно не перепроверялся. Карточка сохранена с исходной датой."},
      sold: {label: "Продано по данным источника", detail: "Карточка сохранена для истории."},
      unavailable: {label: "Источник недоступен", detail: "Карточка сохранена для истории; актуальное предложение не подтверждено."},
    },
    source: "Источник",
    price: "Цена в источнике",
    published: "Опубликовано",
    checked: "Ссылка проверена",
    contact: "Написать продавцу",
    original: "Фото и оригинал",
    report: "Неактуально или нужно удалить?",
    catalogTitle: "Объявления",
    catalogBadge: "Предложения и примеры отдельно",
  },
  en: {
    title: "From other marketplaces",
    intro: "Listings from public sources with their original dates. Cards remain here after their review date. Sellers did not post them on Shisha Market; ask them directly about availability and terms.",
    badge: "External listing",
    states: {
      listed: {label: "Ask the seller about availability", detail: "The listing link was checked, not the availability of the item."},
      needs_review: {label: "Availability needs checking", detail: "The source has not been rechecked recently. This card keeps its original date."},
      sold: {label: "Sold according to the source", detail: "This card is kept for reference."},
      unavailable: {label: "Source unavailable", detail: "This card is kept for reference; a current offer is not confirmed."},
    },
    source: "Source",
    price: "Price at source",
    published: "Posted",
    checked: "Link checked",
    contact: "Message seller",
    original: "Photos & original post",
    report: "Outdated or should be removed?",
    catalogTitle: "Listings",
    catalogBadge: "Offers and examples shown separately",
  },
} as const;
