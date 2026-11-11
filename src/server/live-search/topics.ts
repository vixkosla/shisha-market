import { normalize, tokens } from "./text";

/**
 * The site's own rubrics, by their own names only: a kind of thing inside a rubric («фаннел», «шланг») goes through plain search.
 * The site's own rubrics. A query that is just a rubric name, in any language or form
 * («tobacco», «чаши», «coal»), gets a reference note led by the rubric's wiki article,
 * and the shelf shows that rubric only. Tobacco and charcoal are not sold here: no shelf, no seller checklist.
 */
export type Topic = {
  slug: string;
  /** Listing category for the shelf, or null when the rubric is not sold on the site. */
  listing: "hookahs" | "bowls" | "accessories" | null;
  words: RegExp;
  /** Knowledge-base entities that belong to the rubric's note. */
  entities: string[];
  /** Material the note must not draw on: tobacco brand pages and company facts would read as advertising. */
  exclude?: (chunk: { slug?: string; facts?: { type: string }[] }) => boolean;
};

export const TOPICS: readonly Topic[] = [
  { slug: "categories/tobacco", listing: null, words: /^(табак\p{L}*|табач\p{L}*|tobacco|tobaccos|molasses|меласс\p{L}*|muassel|maassel|маассел\p{L}*|томбак\p{L}*)$/u, entities: ["Регулирование"], exclude: chunk => Boolean(chunk.slug?.startsWith("brands/")) || chunk.facts?.[0]?.type === "brand" },
  { slug: "categories/charcoal", listing: null, words: /^(уг[оле]\p{L}*|угл\p{L}*|coal|coals|charcoal|charcoals|кокосов\p{L}*)$/u, entities: ["Уголь для кальяна"] },
  { slug: "categories/bowls", listing: "bowls", words: /^(чаш\p{L}*|bowl|bowls)$/u, entities: ["Чаши для кальяна"] },
  { slug: "categories/accessories", listing: "accessories", words: /^(аксессуар\p{L}*|accessor\p{L}*)$/u, entities: ["Кальянные аксессуары", "Электронные кальяны", "Kaloud"] },
  { slug: "categories/hookahs", listing: "hookahs", words: /^(кальян\p{L}*|hookah|hookahs|shisha|шиша|наргиле|nargile|narghile|waterpipe|waterpipes)$/u, entities: ["Устройство кальяна", "История кальяна", "История кальяна в России"] },
];

/** Any word of the query names tobacco: such a query never sits next to goods or a seller checklist. */
export function mentionsTobacco(query: string) {
  return tokens(normalize(query)).some(word => TOPICS[0].words.test(word));
}

/** Words that may stand next to a rubric name without changing what is asked: «табак для кальяна», «hookah bowl». */
const FILLER = /^(для|и|от|the|for|of|a)$/u;

/** The rubric a bare query names. A more specific rubric wins over «кальян»: «табак для кальяна» is about tobacco. */
export function topicOf(query: string): Topic | null {
  const words = tokens(normalize(query));
  if (!words.length || words.length > 3) return null;
  const found = words.filter(word => !FILLER.test(word)).map(word => TOPICS.find(topic => topic.words.test(word)));
  if (found.some(topic => !topic)) return null;
  return TOPICS.find(topic => found.includes(topic)) ?? null;
}
