import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = (process.env.APP_URL ?? "http://127.0.0.1:4387").replace(
    /\/$/,
    "",
  );
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/admin",
        "/api/",
        "/favorites",
        "/login",
        "/stats",
        "/support",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
