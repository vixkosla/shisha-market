const WINDOW_DAYS = 28;
const COUNTER_ID = Number(process.env.METRIKA_COUNTER_ID || 113672611);
const SITE_HOST = "shisha-market.com";
const CACHE_MS = 5 * 60 * 1000;
let cachedReport: Promise<PublicStats> | undefined;
let cachedUntil = 0;

type Row = { label: string; visits: number };
export type PublicStats = {
  refreshedAt: string;
  counterId: number;
  metrika:
    | {
        ok: true;
        startDate: string;
        endDate: string;
        visits: number;
        users: number;
        pageviews: number;
        sources: Row[];
        devices: Row[];
      }
    | { ok: false; message: string };
  google:
    | {
        ok: true;
        startDate: string;
        endDate: string;
        clicks: number;
        impressions: number;
        queries: Row[];
      }
    | { ok: false; message: string };
};

function day(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    message?: string;
  };
  if (!response.ok) {
    const message = body.error?.message ?? body.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as Record<string, unknown>;
}

async function metrika(token: string): Promise<PublicStats["metrika"]> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
  const filters = `ym:s:startURLDomain=='${SITE_HOST}'`;
  const query = async (metrics: string, dimensions = "") => {
    const params = new URLSearchParams({
      id: String(COUNTER_ID),
      date1: day(start),
      date2: day(end),
      metrics,
      filters,
      accuracy: "full",
      lang: "ru",
      limit: "8",
    });
    if (dimensions) params.set("dimensions", dimensions);
    return readJson(`https://api-metrika.yandex.net/stat/v1/data?${params}`, {
      headers: { Authorization: `OAuth ${token}` },
    });
  };
  const [summary, sources, devices] = await Promise.all([
    query("ym:s:visits,ym:s:users,ym:s:pageviews"),
    query("ym:s:visits", "ym:s:trafficSource"),
    query("ym:s:visits", "ym:s:deviceCategory"),
  ]);
  const totals =
    ((summary.data as { metrics?: number[] }[] | undefined)?.[0]?.metrics ??
      []) as number[];
  const rows = (payload: Record<string, unknown>): Row[] =>
    ((payload.data as { dimensions?: { name?: string }[]; metrics?: number[] }[]) ??
      []).map((row) => ({
      label: row.dimensions?.[0]?.name ?? "Не указано",
      visits: Math.round(row.metrics?.[0] ?? 0),
    }));
  return {
    ok: true,
    startDate: day(start),
    endDate: day(end),
    visits: Math.round(totals[0] ?? 0),
    users: Math.round(totals[1] ?? 0),
    pageviews: Math.round(totals[2] ?? 0),
    sources: rows(sources),
    devices: rows(devices),
  };
}

async function googleAccessToken() {
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refresh || !clientId || !clientSecret) return;
  const body = await readJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  return typeof body.access_token === "string" ? body.access_token : undefined;
}

async function google(): Promise<PublicStats["google"]> {
  const token = await googleAccessToken();
  if (!token)
    return {
      ok: false,
      message:
        "Search Console не подключён: проверьте настройки доступа на сервере.",
    };
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
  const listed = await readJson(
    "https://www.googleapis.com/webmasters/v3/sites",
    { headers: { authorization: `Bearer ${token}` } },
  );
  const sites = (
    (listed.siteEntry as { siteUrl?: string }[] | undefined) ?? []
  )
    .map((entry) => entry.siteUrl ?? "")
    .filter(Boolean);
  const siteUrl =
    sites.find((url) => url === "sc-domain:shisha-market.com") ??
    sites.find((url) =>
      /^https:\/\/(www\.)?shisha-market\.com\/?$/i.test(url),
    );
  if (!siteUrl)
    return {
      ok: false,
      message:
        "В доступном аккаунте Search Console не найден shisha-market.com.",
    };
  const query = (dimensions: string[]) =>
    readJson(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: day(start),
          endDate: day(end),
          dimensions,
          rowLimit: dimensions.length ? 8 : 1,
          type: "web",
          dataState: "all",
        }),
      },
    );
  try {
    const [summary, queries] = await Promise.all([query([]), query(["query"])]);
    const row = ((summary.rows as { clicks?: number; impressions?: number }[]) ??
      [])[0];
    return {
      ok: true,
      startDate: day(start),
      endDate: day(end),
      clicks: Math.round(row?.clicks ?? 0),
      impressions: Math.round(row?.impressions ?? 0),
      queries: (
        (queries.rows as { keys?: string[]; clicks?: number }[]) ?? []
      ).map((item) => ({
        label: item.keys?.[0] ?? "Без запроса",
        visits: Math.round(item.clicks ?? 0),
      })),
    };
  } catch {
    return {
      ok: false,
      message: "Не удалось получить статистику Search Console. Попробуйте позже.",
    };
  }
}

async function collectPublicStats(): Promise<PublicStats> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  const [metrikaResult, googleResult] = await Promise.all([
    token
      ? metrika(token).catch((error: Error) => ({
          ok: false as const,
          message: error.message || "Метрика не ответила.",
        }))
      : Promise.resolve({
          ok: false as const,
          message: "Токен Метрики на сервере не задан.",
        }),
    google().catch(() => ({
      ok: false as const,
      message: "Search Console сейчас не ответил.",
    })),
  ]);
  return {
    refreshedAt: new Date().toISOString(),
    counterId: COUNTER_ID,
    metrika: metrikaResult,
    google: googleResult,
  };
}

export function publicStats(): Promise<PublicStats> {
  if (!cachedReport || Date.now() >= cachedUntil) {
    cachedUntil = Date.now() + CACHE_MS;
    cachedReport = collectPublicStats().catch((error: unknown) => {
      cachedReport = undefined;
      throw error;
    });
  }
  return cachedReport;
}
