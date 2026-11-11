import { z } from "zod";

export const LEGAL_VERSION = "2026-10-19.1";
export const LEGAL_DATE = "19 октября 2026 года";
export const countries = {
  RU: "Россия",
  BY: "Беларусь",
  KZ: "Казахстан",
  AM: "Армения",
  KG: "Кыргызстан",
  UZ: "Узбекистан",
  AZ: "Азербайджан",
  MD: "Молдова",
  TJ: "Таджикистан",
  TM: "Туркменистан",
} as const;

export const legalLinks = {
  terms: "Пользовательское соглашение",
  rules: "Правила публикации",
  privacy: "Политика обработки данных",
  consent: "Согласие на обработку данных",
  publication: "Согласие на публикацию данных",
  cookies: "Файлы cookie",
  contact: "Оператор и обращения",
} as const;

export const LEGAL_DATE_EN = "19 October 2026";

export const legalLinksEn = {
  terms: "Terms of Use",
  rules: "Listing Rules",
  privacy: "Data Processing Policy",
  cookies: "Cookies",
  contact: "Operator and Contacts",
} as const;

export type EnglishLegalSlug = keyof typeof legalLinksEn;
export const englishLegalSlugs = Object.keys(legalLinksEn) as EnglishLegalSlug[];
export function hasEnglishLegal(slug: string): slug is EnglishLegalSlug {
  return Object.hasOwn(legalLinksEn, slug);
}

// These are separate affirmative choices, not a consent inferred from visiting.
export const legalHeaders = {
  "x-shisha-terms": LEGAL_VERSION,
  "x-shisha-processing": LEGAL_VERSION,
  "x-shisha-adult": "yes",
};
export function hasLoginAcceptance(headers?: Headers | null) {
  return (
    !!headers &&
    Object.entries(legalHeaders).every(
      ([key, value]) => headers.get(key) === value,
    )
  );
}

export const publicationAcceptance = z.object({
  version: z.literal(
    LEGAL_VERSION,
    "Правила обновились. Перезагрузите страницу.",
  ),
  fullName: z
    .string()
    .trim()
    .min(3, "Укажите ФИО для согласия; оно не публикуется.")
    .max(160),
  personalItem: z.literal(
    true,
    "Подтвердите, что это ваша личная вещь, не коммерческая торговля.",
  ),
  adult: z.literal(true, "Публикация доступна только совершеннолетним."),
  contact: z.literal(true, "Отдельно подтвердите публикацию ссылки для связи."),
  city: z.literal(true, "Отдельно подтвердите публикацию страны и города."),
  conditions: z.string().trim().max(1000).default(""),
});
export type PublicationAcceptance = z.infer<typeof publicationAcceptance>;

export const requestKinds = {
  report: "Жалоба на объявление",
  access: "Доступ или исправление данных",
  delete: "Удаление аккаунта и данных",
  withdraw: "Отзыв согласия на публикацию",
  appeal: "Обжалование модерации",
} as const;
export const supportInput = z
  .object({
    kind: z.enum(["report", "access", "delete", "withdraw", "appeal"]),
    listingId: z.string().uuid().or(z.literal("")).default(""),
    message: z
      .string()
      .trim()
      .min(10, "Опишите обращение: от 10 до 2000 символов.")
      .max(2000),
  })
  .refine((value) => value.kind !== "report" || !!value.listingId, {
    message: "Для жалобы нужен идентификатор объявления.",
    path: ["listingId"],
  });
export type SupportInput = z.infer<typeof supportInput>;
export const suggestionInput = z.object({
  contact: z.string().trim().max(200).default(""),
  message: z
    .string()
    .trim()
    .min(10, "Опишите предложение: от 10 до 2000 символов.")
    .max(2000),
});
export type SuggestionInput = z.infer<typeof suggestionInput>;
