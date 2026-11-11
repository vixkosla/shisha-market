import type { Metadata } from "next";
import { HomeView } from "@/components/home-view";
import { home } from "@/lib/i18n";

export const metadata: Metadata = {
  description: home.ru.metaDescription,
  openGraph: {type: "website", title: "Shisha Market — кальянная барахолка", description: home.ru.metaDescription, url: "/", locale: "ru_RU", images: ["/og.jpg"]},
  alternates: {
    canonical: "/",
    languages: { ru: "/", en: "/en" },
  },
};

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <HomeView locale="ru" searchParams={searchParams} />;
}
