import { z } from "zod";
import { countries, LEGAL_VERSION } from "@/lib/legal";
import { categories, DomainError } from "@/lib/listings";

const marketSchema = z.array(
  z.object({
    country: z.enum(
      Object.keys(countries) as [
        keyof typeof countries,
        ...(keyof typeof countries)[],
      ],
    ),
    categories: z.array(z.enum(["hookahs", "bowls", "accessories"])).min(1),
  }),
);
export function legalConfiguration() {
  let markets: z.infer<typeof marketSchema> = [];
  try {
    markets = marketSchema.parse(
      JSON.parse(process.env.LEGAL_APPROVED_MARKETS ?? "[]"),
    );
  } catch {
    /* fail closed */
  }
  return {
    version: LEGAL_VERSION,
    siteUrl: process.env.APP_URL ?? "http://127.0.0.1:4387",
    operator: process.env.LEGAL_OPERATOR_NAME?.trim() ?? "",
    address: process.env.LEGAL_OPERATOR_ADDRESS?.trim() ?? "",
    email: process.env.LEGAL_CONTACT_EMAIL?.trim() || "hello@shisha-market.com",
    operatorStatus: "Самозанятый, плательщик налога на профессиональный доход",
    dataLocation: process.env.LEGAL_DATA_LOCATION?.trim() ?? "",
    processors: process.env.LEGAL_PROCESSORS?.trim() ?? "",
    retention: process.env.LEGAL_RETENTION?.trim() ?? "",
    markets,
  };
}
export function launchBlockers() {
  const config = legalConfiguration();
  const missing: string[] = [];
  if (
    !config.operator ||
    !config.address ||
    !z.email().safeParse(config.email).success
  )
    missing.push("Реквизиты оператора и рабочий адрес для обращений");
  if (!config.dataLocation || !config.processors || !config.retention)
    missing.push("Место обработки, получатели данных и сроки хранения");
  if (!config.markets.length)
    missing.push("Проверенные страны и категории публикаций");
  if (process.env.LEGAL_PUBLIC_READY !== "true")
    missing.push("Подтверждение организационной готовности владельцем");
  return missing;
}
export function legalLaunchReady() {
  return launchBlockers().length === 0;
}
export function developmentOnly() {
  return process.env.NODE_ENV !== "production";
}
export function allowedMarkets(): { country: string; categories: string[] }[] {
  if (developmentOnly())
    return Object.keys(countries).map((country) => ({
      country,
      categories: Object.keys(categories),
    }));
  return legalLaunchReady() ? legalConfiguration().markets : [];
}
export function listingMarketAllowed(item: {
  category: string;
  country: string;
}) {
  return allowedMarkets().some(
    (market) =>
      market.country === item.country &&
      market.categories.includes(item.category),
  );
}
export function assertListingPolicy(item: {
  category: string;
  country: string;
  condition: string;
  title: string;
  description: string;
}) {
  if (!listingMarketAllowed(item))
    throw new DomainError(
      "Публикация в этой стране или категории пока не открыта.",
    );
  if (item.condition !== "used")
    throw new DomainError(
      "На пилоте принимаются только личные вещи, бывшие в использовании.",
    );
  if (
    /(табак|никотин|снюс|вейп|vape|nicotine|tobacco|жидкост[ьи]\s+для|смес[ьи]\s+для\s+курения)/iu.test(
      `${item.title} ${item.description}`,
    )
  )
    throw new DomainError(
      "Табак, никотин, смеси для курения и вейпы не принимаются. Проверьте правила публикации.",
    );
}
