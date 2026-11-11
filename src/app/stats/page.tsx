import type { Metadata } from "next";
import { StatsOverview } from "@/components/stats-overview";
import { publicStats } from "@/server/public-stats";
import "./stats.css";

export const metadata: Metadata = {
  title: "Статистика",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  return <StatsOverview report={await publicStats()} />;
}
