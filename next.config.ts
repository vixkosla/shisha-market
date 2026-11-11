import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR ?? ".next",
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
  outputFileTracingIncludes: {
    "/wiki": ["./content/**/*"],
    "/api/live": ["./content/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
