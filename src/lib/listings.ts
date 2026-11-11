import { z } from "zod";
import { SUBCATEGORY_SLUGS } from "./listing-taxonomy";
export const categories = {
  hookahs: "Кальяны",
  bowls: "Чаши",
  accessories: "Аксессуары",
} as const;
export const statusLabels = {
  pending: "На проверке",
  published: "Опубликовано",
  rejected: "Отклонено",
  archived: "В архиве",
} as const;
export const listingInput = z.object({
  title: z.string().trim().min(5, "Название — от 5 символов").max(100),
  description: z.string().trim().min(30, "Описание — от 30 символов").max(5000),
  category: z.enum(["hookahs", "bowls", "accessories"]),
  // An empty field clears the value; a missing one leaves it as it was (edits keep older listings intact).
  subcategory: z.union([z.literal(""), z.enum(SUBCATEGORY_SLUGS)]).nullish().transform(value => (value === undefined ? undefined : value || null)),
  brand: z.string().trim().max(60, "Марка — до 60 символов").nullish().transform(value => (value === undefined ? undefined : value || null)),
  model: z.string().trim().max(60, "Модель — до 60 символов").nullish().transform(value => (value === undefined ? undefined : value || null)),
  country: z.enum(["RU", "BY", "KZ", "AM", "KG", "UZ", "AZ", "MD", "TJ", "TM"]),
  city: z.string().trim().min(2).max(80),
  price: z
    .string()
    .trim()
    .regex(
      /^\d{1,7}([.,]\d{1,2})?$/,
      "Укажите цену в рублях, например 2500 или 2500,50",
    )
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100)),
  condition: z.enum(["new", "used"]),
  contactUrl: z
    .string()
    .url()
    .max(200)
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        ["vk.ru", "vk.com", "t.me"].includes(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        /^\/[a-zA-Z0-9_.-]+\/?$/.test(url.pathname) &&
        !url.search &&
        !url.hash
      );
    }, "Нужна ссылка на профиль: https://vk.ru/имя или https://t.me/имя"),
});
export type ListingInput = z.output<typeof listingInput>;
export const listingRevision = z.number().int().min(1).max(2147483646);
export const keptPhotoIds = z.array(z.string().uuid()).max(6);
export type Actor = { id: string; role: "member" | "moderator" | "admin" };
export function isModerator(actor: Actor) {
  return actor.role === "moderator" || actor.role === "admin";
}
export function canRead(
  status: keyof typeof statusLabels,
  ownerId: string,
  actor?: Actor | null,
) {
  return (
    status === "published" ||
    actor?.id === ownerId ||
    (!!actor && isModerator(actor))
  );
}
export function formatPrice(kopecks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: kopecks % 100 ? 2 : 0,
  }).format(kopecks / 100);
}
export class DomainError extends Error {}
