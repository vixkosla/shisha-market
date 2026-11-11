import { normalize } from "./text";

export const TOBACCO_REPLY = "Я не рекомендую табачную продукцию и не помогаю её купить.";
export const INJECTION_REPLY = "Я отвечаю только по базе сайта.";
export const NOT_FOUND_REPLY = "В базе сайта этого нет.";

const TOBACCO_WORD = /табак|табач|никотин|забивк|смес[ьи] для кур/;
const TOBACCO_BRAND = /adalya|адаль|al ?fakher|аль ?фа[хк]ер|black ?burn|блэкберн|must ?have|мастхэв|nakhla|нахл|serbetli|щербетл|187 ?(tobacco|strassenbande)|haze tobacco|хейз|bonche|бонш|sebero|duft|satyr|trofimoff|overdose/;
const TOBACCO_INTENT = /посовет|порекоменд|совет|рекоменд|лучш|\bтоп\b|сам(ый|ая|ое|ые) |что (взять|покурить)|покурить|где (купить|взять|достать|заказать)|купить|заказать|доставк|дешев|подешев|\bцен[аыу]\b|стоит|скольк|крепк|крепост|вкус|никотин|процент|\bмикс/;
const INJECTION = /(забудь|игнорируй|не учитывай|отмени)[^.]{0,40}(инструкц|правил|промпт|указан)|ignore[^.]{0,40}(instruction|prompt|rules)|систем\w* промпт|system prompt|jailbreak/;

export type Gate = "ok" | "tobacco" | "injection";

/** Decided in code before any paid call: the model is not the only safeguard. */
export function gateQuery(query: string): Gate {
  const text = normalize(query);
  if (INJECTION.test(text)) return "injection";
  if ((TOBACCO_WORD.test(text) || TOBACCO_BRAND.test(text)) && TOBACCO_INTENT.test(text)) return "tobacco";
  return "ok";
}
