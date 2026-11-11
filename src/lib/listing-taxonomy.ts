/**
 * Second level of the catalog: what exactly is sold inside a category. The order is the order in the form.
 * `words` are stems the smart form looks for in the title; the earliest match wins.
 */
export type Subcategory = { slug: string; label: string; words?: RegExp };

export const SUBCATEGORIES: Record<"hookahs" | "bowls" | "accessories", Subcategory[]> = {
  hookahs: [
    { slug: "complete", label: "Кальян в сборе" },
    { slug: "shaft", label: "Шахта отдельно", words: /шахт(?!\p{L}*\s+и\s+колб)/u },
    { slug: "travel", label: "Компактный или дорожный", words: /мини(?!\p{L})|компакт|дорожн|travel|(?<![a-z])go(?![a-z])/u },
  ],
  bowls: [
    { slug: "phunnel", label: "Фаннел", words: /фаннел|phunnel|убивашк/u },
    { slug: "turk", label: "Турка, классическая", words: /турк|классическ/u },
    { slug: "vortex", label: "Vortex и с боковыми отверстиями", words: /vortex|вортекс|боков/u },
    { slug: "hmd-bowl", label: "Под калауд (HMD)", words: /под\s+(?:калауд|kaloud|hmd|хмд)|samsaris|самсарис/u },
    { slug: "other-bowl", label: "Другая чаша" },
  ],
  accessories: [
    { slug: "hmd", label: "Калауд и контроль жара (HMD)", words: /калауд|kaloud|lotus|лотус|(?<![a-z])hmd(?![a-z])|хмд/u },
    { slug: "hose", label: "Шланг и мундштук", words: /шланг|мундштук/u },
    { slug: "base", label: "Колба", words: /колб/u },
    { slug: "tray", label: "Блюдце", words: /блюдц/u },
    { slug: "tongs", label: "Щипцы", words: /щипц/u },
    { slug: "seals", label: "Уплотнители и переходники", words: /уплотнител|переходник|диффузор|клапан/u },
    { slug: "other-accessory", label: "Другое" },
  ],
};

export const SUBCATEGORY_SLUGS = Object.values(SUBCATEGORIES).flat().map(item => item.slug) as [string, ...string[]];

export function subcategoryLabel(category: string, slug: string | null | undefined) {
  if (!slug) return null;
  return SUBCATEGORIES[category as keyof typeof SUBCATEGORIES]?.find(item => item.slug === slug)?.label ?? null;
}

/** The subcategory the title names; a hookah without a part named is a whole hookah. */
export function detectSubcategory(category: string | null, title: string) {
  const list = category ? SUBCATEGORIES[category as keyof typeof SUBCATEGORIES] : null;
  if (!list) return null;
  const text = title.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е");
  let best: { slug: string; at: number } | null = null;
  for (const item of list) {
    const match = item.words?.exec(text);
    if (match && (!best || match.index < best.at)) best = { slug: item.slug, at: match.index };
  }
  if (best) return best.slug;
  return category === "hookahs" && text.trim() ? "complete" : null;
}
