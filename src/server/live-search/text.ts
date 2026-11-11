const STOP = new Set(
  "а без более бы был была были было быть в вам вас вот все всё где да даже для до его ее если есть еще ещё же за и из или им их к как какая какие каким какой какую кем когда кого кто ли либо мне можно мой мы на надо нам нас не него нет ни них но ну о об обо он она они оно от по под при про с сайт сайте скока сколько со так такое такой там те тебе то только ты у уже хочу чего чем что чтобы эта эти это этот я the a an is are of in on to for and or".split(" "),
);

const ENDINGS = [
  "иями", "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ать", "ять", "ить", "еть", "ует", "ают", "яют", "ешь", "ишь", "ает", "яет",
  "ие", "ые", "ое", "ая", "яя", "ую", "юю", "ой", "ей", "ий", "ый", "ах", "ях", "ом", "ем", "ов", "ев",
  "а", "я", "о", "е", "ы", "и", "у", "ю", "ь", "й",
];

const WORD_FORMS: Record<string, string> = { угля: "уголь", углю: "уголь", углем: "уголь", угли: "уголь", углей: "уголь", углях: "уголь", углями: "уголь" };

/** Spoken and Cyrillic spellings that plain transliteration does not reach. */
const ALIASES: Record<string, string> = {
  хуб: "hoob", хоб: "hoob", дарксайд: "darkside", дарк: "darkside", калауд: "kaloud", лотус: "lotus", адалья: "adalya", нахла: "nakhla",
  фумари: "fumari", танжирс: "tangiers", старбаз: "starbuzz", одуман: "oduman", блэкберн: "blackburn", мастхэв: "musthave", щербетли: "serbetli",
  хейз: "haze", титаниум: "titanium", геометри: "geometry", геометрия: "geometry", дсх: "dsh", дсш: "dsh", фаннел: "phunnel", факер: "fakher", фахер: "fakher",
  стимулейшн: "steamulation", хукаджон: "hookahjohn", хмд: "hmd",
  // The site is Shisha Market: the English and Arabic names of the thing itself must find the hookah, not every brand with the word.
  tobacco: "табак", bowl: "чаша", bowls: "чаша", coal: "уголь", coals: "уголь", charcoal: "уголь", hose: "шланг", hoses: "шланг", mouthpiece: "мундштук", tongs: "щипцы",
  hookah: "кальян", hookahs: "кальян", shisha: "кальян", шиша: "кальян", nargile: "кальян", narghile: "кальян", наргиле: "кальян", waterpipe: "кальян",
};

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function normalize(text: string) {
  return text.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е");
}

export function stem(word: string) {
  const form = WORD_FORMS[word] ?? word;
  if (!/^[а-я]+$/.test(form)) return form;
  if (form.length >= 5) {
    for (const ending of ENDINGS) if (form.endsWith(ending) && form.length - ending.length >= 3) return form.slice(0, -ending.length);
    return form;
  }
  if (form.length >= 3 && /[аяоеыиую]$/.test(form)) return form.slice(0, -1);
  return form;
}

export function tokens(text: string) {
  return (normalize(text).match(/[a-z0-9]+|[а-я]+/g) ?? []).filter(word => word.length >= 2 && !STOP.has(word));
}

export function terms(text: string) {
  return tokens(text).map(stem);
}

function translit(word: string) {
  return [...word].map(char => CYR_TO_LAT[char] ?? char).join("");
}

function withinOneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Query terms plus Latin spellings of Cyrillic words found in the indexed vocabulary. */
export function expandQuery(text: string, vocabulary: ReadonlySet<string>) {
  const result = new Set<string>();
  for (const word of tokens(text)) {
    result.add(stem(word));
    const alias = ALIASES[word] ?? ALIASES[stem(word)];
    if (alias) result.add(stem(alias));
    // Transliteration is for brands typed in Cyrillic; a Russian word the base already knows must not turn into a rare Latin name.
    if (/^[а-я]+$/.test(word) && word.length >= 4 && !vocabulary.has(stem(word))) {
      const latin = translit(word);
      for (const known of vocabulary) if (/^[a-z]/.test(known) && known.length >= 4 && withinOneEdit(latin, known)) result.add(known);
    }
  }
  return [...result];
}
