import fs from "node:fs";
import path from "node:path";
import { brandCards } from "@/server/live-search/corpus";
import type { ListingCategory, SmartBrand } from "@/lib/listing-smart";

type Make = { name: string; aliases: string[]; categories: ListingCategory[]; kind: string; models: string[]; country: string | null; sources: string[]; match: boolean; main_sub: string | null };

let cache: { at: number; brands: SmartBrand[] } | null = null;

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * Atlas cards (checked facts, logos) merged with the shop-catalog directory (content/atlas/makes.json).
 * The atlas wins for rows, logo and wiki; the directory adds models, goods and catalog links.
 */
export function smartAtlas(now = Date.now()): SmartBrand[] {
  if (cache && now - cache.at < 300_000) return cache.brands;
  const file = path.join(process.cwd(), "content", "atlas", "makes.json");
  const makes = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Make[]) : [];
  const brands: SmartBrand[] = brandCards().map(card => ({
    slug: card.slug, name: card.name, kind: card.kind, aliases: card.aliases,
    logo: card.logo ? { src: card.logo.src, width: card.logo.width, height: card.logo.height, plate: card.logo.plate } : null,
    rows: card.rows, wiki: card.wiki, atlas: true,
  }));
  for (const make of makes) {
    const twin = brands.find(brand => brand.aliases.some(alias => make.aliases.includes(alias)));
    if (twin) {
      twin.models = make.models;
      twin.sources = make.sources;
      twin.categories = make.categories;
      twin.mainSubcategory = make.main_sub;
      twin.aliases = [...new Set([...twin.aliases, ...make.aliases])];
      continue;
    }
    brands.push({
      slug: `make-${make.name.toLowerCase().replace(/[^a-z0-9а-я]+/g, "-")}`,
      name: make.name, kind: make.kind, aliases: make.aliases, logo: null,
      rows: make.country && make.sources[0] ? [{ label: "Страна", value: make.country, href: make.sources[0], source: `каталог ${host(make.sources[0])}` }] : [],
      wiki: null, categories: make.categories, models: make.models, sources: make.sources, match: make.match, mainSubcategory: make.main_sub,
    });
  }
  cache = { at: now, brands };
  return brands;
}
