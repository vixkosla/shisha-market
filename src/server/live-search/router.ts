import { normalize } from "./text";

export type Route = "history" | "people" | "market" | "general";

/** Free, in-code routing: what kind of answer a query needs and how much context to pay for. */
export const ROUTE_PROFILES: Record<Route, { contextSize: number; answerPrompt: "answer" | "report"; check: boolean }> = {
  history: { contextSize: 12, answerPrompt: "report", check: false },
  people: { contextSize: 10, answerPrompt: "report", check: false },
  market: { contextSize: 10, answerPrompt: "report", check: false },
  general: { contextSize: 6, answerPrompt: "answer", check: true },
};

const PEOPLE = /кто так|кто основ|основател|создател|владел|блогер|люди|лица|чемпион|баттл|battle|founder/;
const MARKET = /рынок|рынк|сколько кальянных|объем|статистик|доля|market|закон|запрет|регулир|лиценз|акциз|\bгост\b|фестивал|выставк|преми[яи]|сети|сеть кальянн|производител|\bбренд/;
const HISTORY = /истори|хронолог|когда появ|как появ|как разв|откуда|происхожд|развити|эволюц|тренд|\b(1[5-9]|20)\d\d\b|history|origin/;

export function routeQuery(query: string): Route {
  const text = normalize(query);
  if (PEOPLE.test(text)) return "people";
  if (MARKET.test(text)) return "market";
  if (HISTORY.test(text)) return "history";
  return "general";
}
