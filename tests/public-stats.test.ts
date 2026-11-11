import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  vi.stubEnv("YANDEX_METRIKA_TOKEN", "synthetic-metrika-token");
  vi.stubEnv("GOOGLE_REFRESH_TOKEN", "synthetic-refresh-token");
  vi.stubEnv("GOOGLE_CLIENT_ID", "synthetic-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "synthetic-client-secret");
  vi.stubEnv("METRIKA_COUNTER_ID", "113672611");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function statsFetch() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target === "https://oauth2.googleapis.com/token")
      return Response.json({ access_token: "synthetic-google-token" });
    if (target.startsWith("https://api-metrika.yandex.net/"))
      return Response.json({ data: [{ metrics: [9, 7, 11], dimensions: [{ name: "Synthetic source" }] }] });
    if (target.endsWith("/sites"))
      return Response.json({ siteEntry: [{ siteUrl: "sc-domain:shisha-market.com" }] });
    if (target.endsWith("/searchAnalytics/query")) {
      const { dimensions } = JSON.parse(String(init?.body)) as { dimensions: string[] };
      return Response.json({ rows: [{ clicks: 2, impressions: 8, keys: dimensions.length ? ["synthetic"] : [] }] });
    }
    throw new Error("Unexpected synthetic request");
  });
}

describe("public analytics cache", () => {
  it("shares an in-flight report and reuses it for five minutes", async () => {
    const fetchMock = statsFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { publicStats } = await import("@/server/public-stats");
    const [first, second] = await Promise.all([publicStats(), publicStats()]);
    expect(first).toBe(second);
    expect(first.metrika).toMatchObject({ ok: true, visits: 9, users: 7, pageviews: 11 });
    expect(first.google).toMatchObject({ ok: true, clicks: 2, impressions: 8 });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(await publicStats()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    vi.setSystemTime(new Date("2026-10-21T12:05:01Z"));
    const refreshed = await publicStats();
    expect(refreshed.refreshedAt).not.toBe(first.refreshedAt);
    expect(fetchMock).toHaveBeenCalledTimes(14);
  });

  it("reports an upstream failure without claiming the verified site is missing", async () => {
    const fetchMock = statsFetch();
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/searchAnalytics/query"))
        return Response.json({ error: { message: "temporarily unavailable" } }, { status: 503 });
      return fetchMock(url, init);
    });
    const { publicStats } = await import("@/server/public-stats");
    const report = await publicStats();
    expect(report.google).toEqual({ ok: false, message: "Не удалось получить статистику Search Console. Попробуйте позже." });
    expect(report.metrika.ok).toBe(true);
  });
});
