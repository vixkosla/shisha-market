import type { Locale } from "./i18n";

/** Explicitly verified launch examples, not a title/owner heuristic. No user data is rewritten. */
export const EXAMPLE_LISTING_IDS = [
  "85d2d955-e247-4102-82d5-efcccb6af779",
  "c254599b-788b-4d73-bcd3-5506db343864",
  "62180618-0ad8-4188-b512-18fc55bbcff3",
  "65abdc40-4ee2-4431-9a16-e02b2c3faeb4",
  "30f49a95-af03-431f-8bd6-a620698f5cfe",
  "0b567e13-7cfd-4275-83ae-0aabd77e3e38",
] as const;

const examples: ReadonlySet<string> = new Set(EXAMPLE_LISTING_IDS);
export function isExampleListing(id: string): boolean {
  return examples.has(id);
}

export const exampleListingCopy: Record<Locale, {
  photoLabel: string; caption: string; priceLabel: string; catalogTitle: string;
  catalogBadge: string; noticeTitle: string; noticeText: string; createLabel: string;
}> = {
  ru: {
    photoLabel: "Пример объявления · не продаётся",
    caption: "Пример оформления. Товар не продаётся.",
    priceLabel: "Условная цена",
    catalogTitle: "Примеры объявлений",
    catalogBadge: "Демонстрационные карточки",
    noticeTitle: "Это примеры, а не предложения о продаже",
    noticeText: "Отмеченные карточки показывают оформление объявления. Товары не продаются, цены условные.",
    createLabel: "Подать настоящее объявление",
  },
  en: {
    photoLabel: "Example listing · not for sale",
    caption: "Layout example. Item is not for sale.",
    priceLabel: "Illustrative price",
    catalogTitle: "Example listings",
    catalogBadge: "Demonstration cards",
    noticeTitle: "Examples, not offers for sale",
    noticeText: "Marked cards demonstrate the listing layout. These items are not for sale and prices are illustrative.",
    createLabel: "Post a real listing",
  },
};
