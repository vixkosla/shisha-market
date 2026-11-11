/** Events of the home page live search stream, shared by the route and the client. */
export type LiveLane = "wiki" | "shelf" | "answer" | "journal" | "check";
export type LiveLaneState = "work" | "done" | "off";
export type LiveTextLane = "answer" | "journal" | "check";
export type LiveAnswerKind = "fixed" | "excerpt" | "notfound";

export type LiveSource = { n: number; title: string; href: string; external: boolean };
export type LiveWikiItem = { slug: string; title: string; description: string; href: string; pending: boolean };
export type LiveWikiGroup = { rubric: string; items: LiveWikiItem[] };
export type LiveShelfItem = {
  id: string;
  title: string;
  city: string;
  priceLabel: string;
  categoryLabel: string;
  href: string;
  external: boolean;
  note: string | null;
  coverId: string | null;
};
export type LiveTerm = { term: string; text: string; href: string };
export type LiveTimelineItem = { year: number; text: string; href: string; label: string };
export type LivePersonItem = { name: string; text: string; href: string; label: string };
/** A row of the brand card: every value points at the checked fact it came from. */
export type LiveBrandRow = { label: string; value: string; href: string; source: string };
export type LiveBrandLogo = { src: string; width: number; height: number; plate: "light" | "dark"; source: string };
/** Atlas entry for a hookah, bowl or device brand. Tobacco brands never get a card. */
export type LiveBrand = {
  slug: string;
  name: string;
  kind: string;
  wiki: string | null;
  site: string | null;
  logo: LiveBrandLogo | null;
  rows: LiveBrandRow[];
  legend: { text: string; href: string; label: string; own: boolean }[];
};

export type LiveEvent =
  | { t: "start"; generating: boolean }
  | { t: "status"; lane: LiveLane; state: LiveLaneState; text: string }
  | { t: "wiki"; groups: LiveWikiGroup[] }
  | { t: "shelf"; items: LiveShelfItem[]; exact: boolean }
  | { t: "terms"; items: LiveTerm[] }
  | { t: "timeline"; items: LiveTimelineItem[] }
  | { t: "people"; items: LivePersonItem[] }
  | { t: "brand"; items: LiveBrand[] }
  | { t: "sources"; items: LiveSource[] }
  | { t: "delta"; lane: LiveTextLane; text: string }
  | { t: "replace"; text: string; kind: LiveAnswerKind; href?: string }
  | { t: "follow"; items: string[] }
  | { t: "done" };

export const LIVE_QUERY_MIN = 3;
export const LIVE_QUERY_MAX = 160;
export const LIVE_NOT_GENERATED = "НЕТ";

const NOT_FOUND_TAIL = /\s*«?В базе сайта этого нет\.?»?\s*$/u;
const NOT_FOUND_HEAD = /^\s*«?В базе сайта этого нет\.?»?\s*/u;

/** Small models sometimes put the not-found line before or after a real answer; the answer stays, the line goes. */
export function trimNotFoundTail(text: string): string {
  const trimmed = text.replace(NOT_FOUND_TAIL, "").replace(NOT_FOUND_HEAD, "");
  return trimmed.trim().length >= 40 ? trimmed : text;
}
const LIVE_JOURNAL_TITLE_MAX = 90;

/** Splits model text into plain runs and [n] citations. Output is rendered as text only. */
export function splitCitations(text: string): (string | number)[] {
  return text.replace(/\s+\[(\d{1,2})\]/g, "[$1]").split(/\[(\d{1,2})\]/).map((part, index) => (index % 2 ? Number(part) : part)).filter(part => part !== "");
}

/** The first line of a journal note is its title; the model may still be writing the rest. */
export function parseJournal(text: string): { title: string; body: string } | null {
  const clean = text.replace(/^\s+/, "");
  if (!clean || isNotGenerated(clean)) return null;
  const end = clean.indexOf("\n");
  const head = (end < 0 ? clean : clean.slice(0, end)).replace(/[#*]/g, "").trim();
  // A model that skipped the title writes a long first line: that is the note itself.
  if (head.length > LIVE_JOURNAL_TITLE_MAX) return { title: "", body: clean.trim() };
  return { title: head, body: end < 0 ? "" : clean.slice(end + 1).trim() };
}

/** Follow-ups become clickable queries, so statements and citations are dropped. */
export function cleanFollowUp(line: string) {
  const raw = line.replace(/^[-•*\d.)\s]+/, "").replace(/\[\d+\]/g, "").replace(/\s+\?/g, "?").trim();
  const text = !raw.endsWith("?") && /^(что|как|как[а-я]+|чем|где|когда|можно|есть|зачем|почему|кто)\s/i.test(raw) ? `${raw.replace(/[.!]$/, "")}?` : raw;
  // A line cut off by the token limit ends on a preposition or conjunction.
  if (/\s(с|в|на|о|об|по|для|и|а|но|к|у|из|от|за|при)\?$/i.test(text)) return null;
  return text.length > 3 && text.length <= 70 && text.endsWith("?") ? text : null;
}

export function parseChecklist(text: string): string[] {
  if (isNotGenerated(text)) return [];
  return text.split("\n").map(line => line.trim()).filter(line => /^[-•*]\s*\S/.test(line)).map(line => line.replace(/^[-•*]\s*/, ""));
}

export function isNotGenerated(text: string) {
  const value = text.trim().replace(/[.!«»"]/g, "");
  return value === LIVE_NOT_GENERATED || (LIVE_NOT_GENERATED.startsWith(value) && value.length > 0 && value.length < LIVE_NOT_GENERATED.length);
}
