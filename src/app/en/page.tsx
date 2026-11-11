import type { Metadata } from "next";
import { HomeView } from "@/components/home-view";
import { home } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: "Shisha Market — hookah marketplace" },
  description: home.en.metaDescription,
  alternates: {
    canonical: "/en",
    languages: { ru: "/", en: "/en" },
  },
  openGraph: {
    title: "Shisha Market — hookah marketplace",
    description: home.en.metaDescription,
    locale: "en_US",
    images: ["/og.jpg"],
  },
};

export default function EnglishHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <HomeView locale="en" searchParams={searchParams} />;
}
