import type { Metadata } from "next";
import { WikiDirectory } from "@/components/wiki/wiki-directory";
import { WikiLicense, WikiMasthead } from "@/components/wiki/wiki-chrome";
import { getWikiDirectory } from "@/lib/wiki";
import { wikiDescription } from "@/lib/wiki-seo";
import { wikiNotebookEnabled } from "@/lib/wiki-features";

export const metadata: Metadata = {
  title: "Атлас кальянного мира — Wiki",
  description: wikiDescription,
  alternates: {canonical: "/wiki"},
  openGraph: {type: "website", title: "Атлас кальянного мира — Shisha Market Wiki", description: wikiDescription, url: "/wiki", locale: "ru_RU", images: ["/og.jpg"]},
};

export default function WikiIndexPage() {
  return <div className="wiki-index"><WikiMasthead /><WikiDirectory entries={getWikiDirectory()} notebookEnabled={wikiNotebookEnabled(process.env.WIKI_NOTEBOOK_ENABLED)} /><WikiLicense /></div>;
}
