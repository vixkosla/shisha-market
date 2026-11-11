import { expandQuery, stem, terms, tokens } from "./text";
import type { Chunk, SourceKind } from "./corpus";

type Indexed = { chunk: Chunk; tf: Map<string, number>; length: number };
export type Hit = { chunk: Chunk; score: number };

const K1 = 1.2;
const B = 0.6;
const TITLE_WEIGHT = 3;
const SOURCE_WEIGHT: Record<SourceKind, number> = { encyclopedia: 1.1, official: 1.1, research: 1.1, press: 1.05, community: 1, blog: 0.9, retailer: 0.9 };

export function search(chunks: readonly Chunk[], query: string) {
  const docs: Indexed[] = chunks.map(chunk => {
    const tf = new Map<string, number>();
    for (const term of terms(`${chunk.indexTitle ?? chunk.title} ${chunk.keywords ?? ""}`)) tf.set(term, (tf.get(term) ?? 0) + TITLE_WEIGHT);
    let length = 0;
    for (const term of terms(chunk.text)) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
      length += 1;
    }
    return { chunk, tf, length };
  });
  const average = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(docs.length, 1);
  const frequency = new Map<string, number>();
  for (const doc of docs) for (const term of doc.tf.keys()) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  const wanted = expandQuery(query, new Set(frequency.keys()));
  const hits: Hit[] = [];
  for (const doc of docs) {
    let score = 0;
    let matched = 0;
    for (const term of wanted) {
      const tf = doc.tf.get(term);
      if (!tf) continue;
      matched += 1;
      const df = frequency.get(term) ?? 1;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      score += (idf * (tf * (K1 + 1))) / (tf + K1 * (1 - B + (B * doc.length) / Math.max(average, 1)));
    }
    const trust = doc.chunk.sourceKind ? SOURCE_WEIGHT[doc.chunk.sourceKind] : 1;
    if (score > 0) hits.push({ chunk: doc.chunk, score: score * trust * (0.6 + (0.4 * matched) / wanted.length) });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** When the query names a city that listings have, only that city is an exact match. */
export function matchCity(listings: readonly Chunk[], query: string) {
  const asked = new Set(terms(query));
  const cities = new Set<string>();
  for (const item of listings) {
    const city = item.shelf?.city;
    if (city && tokens(city).some(word => asked.has(stem(word)))) cities.add(city);
  }
  return cities;
}
