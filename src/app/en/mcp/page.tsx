import type { Metadata } from "next";
import { McpDoc } from "@/components/mcp-doc";

export const metadata: Metadata = {
  title: "MCP for listings",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/en/mcp",
    languages: { ru: "/mcp", en: "/en/mcp" },
  },
};

export default function EnglishMcpPage() {
  return <McpDoc locale="en" />;
}
