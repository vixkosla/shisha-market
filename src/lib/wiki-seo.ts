import type { Metadata } from "next";
import type { WikiArticle } from "./wiki";

export const wikiDescription = "Справочник Shisha Market: производители, модели, устройство кальянов, чаши и комплектующие. Источники и документация.";

export function siteOrigin() {
  return (process.env.APP_URL ?? "http://127.0.0.1:4387").replace(/\/$/, "");
}

export function articleDescription(article: Pick<WikiArticle, "description" | "title">) {
  const text = (article.description || `${article.title}: справочный материал Shisha Market Wiki.`).replace(/\s+/g, " ").trim();
  return text.length <= 180 ? text : `${text.slice(0, 177).trimEnd()}…`;
}

export function wikiArticleMetadata(article: WikiArticle): Metadata {
  const path = `/wiki/${article.slug}`;
  const description = articleDescription(article);
  return {
    title: `${article.title} — вики`, description,
    robots: {index: !article.reviewPending, follow: true},
    alternates: {canonical: path},
    openGraph: {
      type: "article", title: article.title, description, url: path,
      siteName: "Shisha Market Wiki", locale: "ru_RU", images: ["/og.jpg"],
    },
    twitter: {card: "summary_large_image", title: article.title, description, images: ["/og.jpg"]},
  };
}

export function wikiArticleStructuredData(article: WikiArticle) {
  const base = siteOrigin();
  const url = `${base}/wiki/${article.slug}`;
  const crumbs = [{name: "Атлас", item: `${base}/wiki`}];
  if (article.category && article.categoryLabel) crumbs.push({name: article.categoryLabel, item: `${base}/wiki#${article.category}`});
  crumbs.push({name: article.title, item: url});
  return [
    {
      "@context": "https://schema.org", "@type": "Article",
      "@id": `${url}#article`, headline: article.title,
      description: articleDescription(article), mainEntityOfPage: url,
      inLanguage: "ru", dateModified: article.modifiedAt,
      isPartOf: {"@type": "WebSite", name: "Shisha Market Wiki", url: `${base}/wiki`},
      publisher: {"@type": "Organization", name: "Shisha Market", url: base},
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: crumbs.map((item, index) => ({"@type": "ListItem", position: index + 1, ...item})),
    },
  ];
}

export function serializeStructuredData(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
