import { publicStats } from "@/server/public-stats";
import { vkConfigured } from "@/server/vk";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = (process.env.APP_URL ?? "http://127.0.0.1:4387").replace(
    /\/$/,
    "",
  );
  const report = await publicStats();
  const gaId =
    process.env.GA_MEASUREMENT_ID?.match(/^G-[A-Z0-9]{4,24}$/)?.[0] ?? null;
  const metrika = report.metrika;
  const google = report.google;
  const body = {
    site: origin,
    name: "Shisha Market",
    updatedAt: report.refreshedAt,
    languages: ["ru", "en"],
    pages: {
      home: "/",
      homeEn: "/en",
      wiki: "/wiki",
      legal: "/legal",
      legalEn: "/en/legal",
      mcp: "/mcp",
      mcpEn: "/en/mcp",
    },
    analytics: {
      yandexMetrika: metrika.ok
        ? {
            ok: true,
            counterId: report.counterId,
            period: { start: metrika.startDate, end: metrika.endDate },
            visits: metrika.visits,
            visitors: metrika.users,
            pageviews: metrika.pageviews,
            sources: metrika.sources.length,
            devices: metrika.devices.length,
          }
        : { ok: false, counterId: report.counterId, message: metrika.message },
      googleAnalytics4: {
        measurementId: gaId,
        connected: Boolean(gaId),
        dataVerified: false,
      },
    },
    search: {
      googleSearchConsole: google.ok
        ? {
            ok: true,
            property: "sc-domain:shisha-market.com",
            period: { start: google.startDate, end: google.endDate },
            clicks: google.clicks,
            impressions: google.impressions,
            queries: google.queries.length,
            sitemap: "/sitemap.xml",
          }
        : { ok: false, message: google.message },
    },
    mcp: {
      docs: "/mcp",
      docsEn: "/en/mcp",
      client: "/mcp/user.mjs",
      repository: "https://github.com/vixkosla/shisha-market-mcp",
      transport: "stdio",
      authentication: "personal account linked through browser approval",
      manageConnections: "/account/mcp",
      tools: ["connect_account", "finish_connection", "get_account", "disconnect_account", "get_publication_rules", "list_my_listings", "create_listing", "get_listing", "get_listing_photo", "update_listing", "archive_listing"],
      operator: {docs: "/mcp/operator", client: "/mcp/listings.mjs", restricted: true},
    },
    publication: {
      vk: { configured: vkConfigured(), deliveryVerified: false },
    },
    agentResources: {
      llms: "/llms.txt",
      llmsFull: "/llms-full.txt",
      sitemap: "/sitemap.xml",
    },
  };
  return Response.json(body, {
    headers: {
      "cache-control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
