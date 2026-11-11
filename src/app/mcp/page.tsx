import type { Metadata } from "next";
import { McpDoc } from "@/components/mcp-doc";

export const metadata: Metadata = {
  title: "MCP для объявлений",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/mcp",
    languages: { ru: "/mcp", en: "/en/mcp" },
  },
};

export default function McpPage() {
  return <McpDoc locale="ru" />;
}
