import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/markdown";
import { WikiArticleReader } from "@/components/wiki/wiki-article-reader";
import { WikiLicense, WikiMasthead } from "@/components/wiki/wiki-chrome";
import { getWikiArticle, getWikiDirectory, getWikiSlugs } from "@/lib/wiki";
import { getWikiHeadings } from "@/lib/wiki-markdown";
import { serializeStructuredData, wikiArticleMetadata, wikiArticleStructuredData } from "@/lib/wiki-seo";
import { wikiNotebookEnabled } from "@/lib/wiki-features";

interface WikiArticlePageProps { params: Promise<{ slug: string[] }> }

export async function generateMetadata({ params }: WikiArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getWikiArticle(slug.join("/"));
  if (!article) notFound();
  return wikiArticleMetadata(article);
}

export async function generateStaticParams() {
  return getWikiSlugs().map((slug) => ({ slug: slug.split("/") }));
}

export default async function WikiArticlePage({ params }: WikiArticlePageProps) {
  const { slug } = await params;
  const article = getWikiArticle(slug.join("/"));
  if (!article) notFound();
  const directory = getWikiDirectory();
  const entry = directory.find((item) => item.slug === article.slug)!;
  return <div className="wiki-article"><script type="application/ld+json" dangerouslySetInnerHTML={{__html: serializeStructuredData(wikiArticleStructuredData(article))}} /><WikiMasthead article /><WikiArticleReader key={article.slug} entry={entry} headings={getWikiHeadings(article.content)} directory={directory} notebookEnabled={wikiNotebookEnabled(process.env.WIKI_NOTEBOOK_ENABLED)}><MarkdownRenderer content={article.content} articleSlug={article.slug} skipTitle /></WikiArticleReader><WikiLicense /></div>;
}
