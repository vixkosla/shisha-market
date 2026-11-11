import type { MetadataRoute } from "next";
import { hasEnglishLegal, legalLinks } from "@/lib/legal";
import { hasOperatorLegalDetails } from "@/lib/legal-indexing";
import { getDatabase } from "@/server/db";
import { listPublicSitemapEntries } from "@/server/listings";
import { getWikiArticle, getWikiSlugs } from "@/lib/wiki";
import { isExampleListing } from "@/lib/listing-examples";

export const dynamic = "force-dynamic";

function origin() {
  return (process.env.APP_URL ?? "http://127.0.0.1:4387").replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origin();
  const homeLanguages = { ru: `${base}/`, en: `${base}/en` };
  const legalLanguages = { ru: `${base}/legal`, en: `${base}/en/legal` };
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
      alternates: { languages: homeLanguages },
    },
    {
      url: `${base}/en`,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: homeLanguages },
    },
    {
      url: `${base}/brand`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/legal`,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: legalLanguages },
    },
    {
      url: `${base}/en/legal`,
      changeFrequency: "monthly",
      priority: 0.5,
      alternates: { languages: legalLanguages },
    },
  ];
  for (const slug of Object.keys(legalLinks)) {
    if (hasOperatorLegalDetails(slug)) continue;
    const translated = hasEnglishLegal(slug);
    const languages = translated
      ? {
          ru: `${base}/legal/${slug}`,
          en: `${base}/en/legal/${slug}`,
        }
      : undefined;
    entries.push({
      url: `${base}/legal/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      ...(languages ? { alternates: { languages } } : {}),
    });
    if (translated) {
      entries.push({
        url: `${base}/en/legal/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.4,
        alternates: { languages },
      });
    }
  }
  const rows = await listPublicSitemapEntries(await getDatabase());
  for (const row of rows) {
    if (isExampleListing(row.id)) continue;
    entries.push({
      url: `${base}/listings/${row.id}`,
      ...(row.updatedAt || row.publishedAt ? {lastModified: row.updatedAt ?? row.publishedAt!} : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  const articles = getWikiSlugs().flatMap(slug => {
    const article = getWikiArticle(slug);
    return article && !article.reviewPending ? [article] : [];
  });
  entries.push({
    url: `${base}/wiki`,
    ...(articles.length ? {lastModified: new Date(Math.max(...articles.map(article => Date.parse(article.modifiedAt))))} : {}),
    changeFrequency: "weekly", priority: 0.8,
  });
  for (const article of articles) entries.push({url: `${base}/wiki/${article.slug}`, lastModified: article.modifiedAt, changeFrequency: "monthly", priority: 0.6});
  return entries;
}
