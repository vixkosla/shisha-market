import { categories } from "@/lib/listings";

export type Locale = "ru" | "en";
export const locales: Locale[] = ["ru", "en"];

export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en";
}

/** Russian lives at the root, English under /en. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "ru") return path;
  if (path === "/") return "/en";
  return `/en${path}`;
}

export function catalogHref(
  locale: Locale,
  filters: { q?: string; category?: string; city?: string; page?: string },
  page?: number,
): string {
  const query = new URLSearchParams();
  for (const key of ["q", "category", "city"] as const) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  const target = page ?? Number(filters.page ?? 1);
  if (target > 1) query.set("page", String(target));
  const base = locale === "en" ? "/en" : "/";
  const search = query.toString();
  return `${base}${search ? `?${search}` : ""}#catalog`;
}

export type ChromeCopy = {
  skip: string;
  stripLeft: string;
  stripRight: string;
  brandAria: string;
  navLabel: string;
  nav: {
    catalog: string;
    wiki: string;
    stats: string;
    favorites: string;
    moderation: string;
    account: string;
    login: string;
  };
  cta: string;
  language: { label: string; aria: string; hrefLang: Locale };
  footer: {
    tagline: string;
    community: string;
    source: string;
    suggest: string;
    disclaimer: string;
    legalNav: string;
    brandbook: string;
    legal: string;
    privacy: string;
    contact: string;
    support: string;
    mcp: string;
    credit: string;
  };
};

export const chrome: Record<Locale, ChromeCopy> = {
  ru: {
    skip: "К содержимому",
    stripLeft: "SHISHA MARKET / ПЕРЕЗАПУСК",
    stripRight: "Открытая площадка · 18+",
    brandAria: "Shisha Market — главная",
    navLabel: "Основная навигация",
    nav: {
      catalog: "Объявления",
      wiki: "Вики",
      stats: "Статистика",
      favorites: "Избранное",
      moderation: "Модерация",
      account: "Мой кабинет",
      login: "Войти",
    },
    cta: "Подать объявление",
    language: { label: "EN", aria: "English version", hrefLang: "en" },
    footer: {
      tagline: "Знакомое место. Новая глава.",
      community: "Сообщество ВКонтакте",
      source: "Исходный код",
      suggest: "Предложить улучшение",
      disclaimer: "18+ · без приёма платежей и сопровождения сделок",
      legalNav: "Документы и поддержка",
      brandbook: "Брендбук",
      legal: "Правила и документы",
      privacy: "Обработка данных",
      contact: "Оператор и контакты",
      support: "Обращения и жалобы",
      mcp: "MCP для объявлений",
      credit: "Разработка —",
    },
  },
  en: {
    skip: "Skip to content",
    stripLeft: "SHISHA MARKET / RELAUNCH",
    stripRight: "Open marketplace · 18+",
    brandAria: "Shisha Market — home",
    navLabel: "Main navigation",
    nav: {
      catalog: "Listings",
      wiki: "Wiki",
      stats: "Stats",
      favorites: "Favorites",
      moderation: "Moderation",
      account: "My account",
      login: "Sign in",
    },
    cta: "List an item",
    language: { label: "RU", aria: "Русская версия", hrefLang: "ru" },
    footer: {
      tagline: "A familiar place. A new chapter.",
      community: "VK community",
      source: "Source code",
      suggest: "Suggest an improvement",
      disclaimer: "18+ · no payments or deal support",
      legalNav: "Documents and support",
      brandbook: "Brandbook",
      legal: "Rules and documents",
      privacy: "Data processing",
      contact: "Operator and contacts",
      support: "Reports and complaints",
      mcp: "MCP for listings",
      credit: "Developed by",
    },
  },
};

export type HomeCopy = {
  metaDescription: string;
  heroEyebrow: string;
  heroTitle: [string, string, string];
  heroDescription: [string, string];
  heroLink: string;
  heroAlt: string;
  heroNote: string;
  heroBrand: string;
  notice: string;
  noticeLink: string;
  formNote: string;
  catalogEyebrow: string;
  catalogTitle: string;
  catalogBadge: string;
  searchLabel: string;
  searchPlaceholder: string;
  cityLabel: string;
  cityPlaceholder: string;
  searchButton: string;
  categoriesLabel: string;
  allListings: string;
  emptyFilteredTitle: string;
  emptyFilteredText: string;
  emptyTitle: string;
  emptyText: string;
  resetFilters: string;
  firstListing: string;
  paginationLabel: string;
  back: string;
  next: string;
  pageLabel: (page: number) => string;
  principles: { title: string; text: string }[];
};

export const home: Record<Locale, HomeCopy> = {
  ru: {
    metaDescription:
      "Кальянная барахолка Shisha Market: частные объявления о б/у кальянах, чашах и аксессуарах. Проверка перед публикацией, связь напрямую. Без оплаты через сайт.",
    heroEyebrow: "СНОВА НА СВЯЗИ",
    heroTitle: ["Хорошим вещам", "есть ", "продолжение."],
    heroDescription: [
      "Кальянная барахолка возвращается.",
      "Частные объявления с проверкой перед публикацией. Без оплаты через сайт.",
    ],
    heroLink: "Дать вещи новую историю",
    heroAlt: "Терракотовая чаша, тонкая струйка дыма",
    heroNote: "Предмет остаётся. Площадка — только объявление.",
    heroBrand: "Брендбук →",
    notice:
      "Сайт не принимает заказы и оплату, не организует доставку и не гарантирует сделки.",
    noticeLink: "Правила и условия запуска →",
    formNote: "",
    catalogEyebrow: "НАЙТИ СВОЁ",
    catalogTitle: "Объявления",
    catalogBadge: "Публикуются после проверки",
    searchLabel: "Что ищем?",
    searchPlaceholder: "Марка, модель или название",
    cityLabel: "Город",
    cityPlaceholder: "Любой город",
    searchButton: "Найти",
    categoriesLabel: "Категории",
    allListings: "Все объявления",
    emptyFilteredTitle: "Пока ничего не нашлось",
    emptyFilteredText: "Попробуйте изменить запрос или выбрать другой город.",
    emptyTitle: "Здесь начнётся новая история",
    emptyText:
      "В новой базе ещё нет опубликованных объявлений. Старый архив хранится отдельно и не выдаётся за актуальные предложения.",
    resetFilters: "Сбросить фильтры",
    firstListing: "Подать первое объявление",
    paginationLabel: "Страницы каталога",
    back: "← Назад",
    next: "Далее →",
    pageLabel: (page) => `Страница ${page}`,
    principles: [
      {
        title: "Объявление за пару минут",
        text: "Фотографии, состояние и цена. Все детали в одном месте.",
      },
      {
        title: "Связь напрямую",
        text: "Обсуждайте подробности с продавцом в привычном мессенджере.",
      },
      {
        title: "Проверка перед публикацией",
        text: "Проверяем содержание. Модерация не подтверждает товар и не гарантирует сделку.",
      },
    ],
  },
  en: {
    metaDescription:
      "Information marketplace for private pre-owned hookah listings. Publication rules, moderation and direct contact between members.",
    heroEyebrow: "BACK ONLINE",
    heroTitle: ["Good things", "deserve a ", "second chapter."],
    heroDescription: [
      "The hookah marketplace returns.",
      "Private listings checked before publication. No payments through the site.",
    ],
    heroLink: "Give an item a new story",
    heroAlt: "Terracotta bowl with a thin wisp of smoke",
    heroNote: "The object stays. The site is only the listing.",
    heroBrand: "Brandbook →",
    notice:
      "The site does not take orders or payments, arrange delivery or guarantee deals.",
    noticeLink: "Rules and launch terms →",
    formNote:
      "The English listing form arrives with the international launch; the current form is in Russian.",
    catalogEyebrow: "FIND YOURS",
    catalogTitle: "Listings",
    catalogBadge: "Published after review",
    searchLabel: "What are you looking for?",
    searchPlaceholder: "Brand, model or name",
    cityLabel: "City",
    cityPlaceholder: "Any city",
    searchButton: "Search",
    categoriesLabel: "Categories",
    allListings: "All listings",
    emptyFilteredTitle: "Nothing found yet",
    emptyFilteredText: "Try another query or choose a different city.",
    emptyTitle: "A new story starts here",
    emptyText:
      "The new database has no published listings yet. The old archive is kept separately and is not presented as current offers.",
    resetFilters: "Reset filters",
    firstListing: "Post the first listing",
    paginationLabel: "Catalog pages",
    back: "← Back",
    next: "Next →",
    pageLabel: (page) => `Page ${page}`,
    principles: [
      {
        title: "A listing in a couple of minutes",
        text: "Photos, condition and price. All the details in one place.",
      },
      {
        title: "Direct contact",
        text: "Discuss the details with the seller in your usual messenger.",
      },
      {
        title: "Review before publication",
        text: "We check the content. Moderation does not certify the item or guarantee a deal.",
      },
    ],
  },
};

export const categoryNames: Record<Locale, Record<keyof typeof categories, string>> = {
  ru: categories,
  en: { hookahs: "Hookahs", bowls: "Bowls", accessories: "Accessories" },
};

export type StatusKey = "pending" | "published" | "rejected" | "archived";

export const statusNames: Record<Locale, Record<StatusKey, string>> = {
  ru: {
    pending: "На проверке",
    published: "Опубликовано",
    rejected: "Отклонено",
    archived: "В архиве",
  },
  en: {
    pending: "Under review",
    published: "Published",
    rejected: "Rejected",
    archived: "Archived",
  },
};

export const cardCopy: Record<
  Locale,
  { noPhoto: string; conditionNew: string; conditionUsed: string }
> = {
  ru: { noPhoto: "Фото недоступно", conditionNew: "Новое", conditionUsed: "С историей" },
  en: { noPhoto: "No photo", conditionNew: "New", conditionUsed: "Used" },
};
