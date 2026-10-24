// Shop traffic for the admin's Analytics page, from Cloudflare's GraphQL API:
//  - Web Analytics (the cookie-free beacon on stickypie.in): visits, page views,
//    top pages, where people came from, countries, devices. Real browsers only.
//  - Zone traffic: unique visitors per day (by IP — includes bots).
//  - Workers: requests per day against the free plan's 100,000/day limit.
// Needs CF_ANALYTICS_TOKEN (a token with Account Analytics: Read and
// Zone Analytics: Read). Account and zone ids are not secret.

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "be62304a5f41702ad535c19c683d42c5";
const ZONE_ID = process.env.CF_ZONE_ID ?? "66caacd08a3f124706b19bac6a641a96";
const HOST = "stickypie.in";
export const FREE_DAILY_REQUESTS = 100_000;

export type Range = "today" | "7d" | "30d";
export const RANGES: Array<{ id: Range; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

const IST_MS = 5.5 * 3600_000;
const DAY_MS = 86_400_000;

/** Midnight in India, `daysBack` days ago, as a UTC instant. */
function istMidnight(daysBack: number) {
  const nowIst = Date.now() + IST_MS;
  return new Date(Math.floor(nowIst / DAY_MS) * DAY_MS - daysBack * DAY_MS - IST_MS);
}
/** "2026-10-24" for an instant, in India's calendar. */
const istDate = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const utcDate = (d: Date) => d.toISOString().slice(0, 10);

export type Bar = { key: string; label: string; visits: number; views: number };
export type Ranked = { name: string; value: number };
export type Analytics = {
  visits: number;
  views: number;
  uniquesPerDay: number;
  bars: Bar[];
  pages: Ranked[];
  sources: Ranked[];
  countries: Ranked[];
  devices: Ranked[];
  usage: { today: number; days: Ranked[] };
};

export function analyticsConfigured() {
  return Boolean(process.env.CF_ANALYTICS_TOKEN);
}

async function gql<T>(query: string): Promise<T> {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CF_ANALYTICS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> | null };
  if (!res.ok || json.errors?.length || !json.data) {
    throw new Error(json.errors?.[0]?.message ?? `Cloudflare answered ${res.status}`);
  }
  return json.data;
}

type RumRow = { count: number; sum: { visits: number }; dimensions: Record<string, string> };

export async function getAnalytics(range: Range): Promise<Analytics> {
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const start = istMidnight(days - 1);
  const rum = `{datetime_geq:"${start.toISOString()}", requestHost:"${HOST}"}`;
  const top = (dim: string, order = "sum_visits_DESC") =>
    `rumPageloadEventsAdaptiveGroups(limit:8, filter:${rum}, orderBy:[${order}]) { count sum { visits } dimensions { ${dim} } }`;
  const usageFrom = new Date(Date.now() - 6 * DAY_MS);
  // Cloudflare samples long time spans (1 in 10 over a month), so visits and
  // views are asked for one day at a time, where the counts are exact.
  const dayQueries = Array.from({ length: days }, (_, i) => {
    const from = istMidnight(days - 1 - i);
    const to = new Date(from.getTime() + DAY_MS);
    return `d${i}: rumPageloadEventsAdaptiveGroups(limit:24, filter:{datetime_geq:"${from.toISOString()}", datetime_lt:"${to.toISOString()}", requestHost:"${HOST}"}) { count sum { visits } dimensions { datetimeHour } }`;
  }).join("\n      ");

  const data = await gql<{
    viewer: {
      accounts: Array<{
        [day: `d${number}`]: RumRow[];
        pages: RumRow[];
        sources: RumRow[];
        countries: RumRow[];
        devices: RumRow[];
        usage: Array<{ sum: { requests: number }; dimensions: { date: string } }>;
      }>;
      zones: Array<{ days: Array<{ uniq: { uniques: number }; dimensions: { date: string } }> }>;
    };
  }>(`{ viewer {
    accounts(filter:{accountTag:"${ACCOUNT_ID}"}) {
      ${dayQueries}
      pages: ${top("requestPath", "count_DESC")}
      sources: ${top("refererHost")}
      countries: ${top("countryName")}
      devices: ${top("deviceType")}
      usage: workersInvocationsAdaptive(limit:50, filter:{date_geq:"${utcDate(usageFrom)}"}, orderBy:[date_ASC]) { sum { requests } dimensions { date } }
    }
    zones(filter:{zoneTag:"${ZONE_ID}"}) {
      days: httpRequests1dGroups(limit:31, filter:{date_geq:"${utcDate(start)}"}) { uniq { uniques } dimensions { date } }
    }
  } }`);

  const acc = data.viewer.accounts[0];
  const zone = data.viewer.zones[0];

  // Bars: by hour for today, by day (India time) for longer ranges.
  const bars = new Map<string, Bar>();
  if (range === "today") {
    for (let h = 0; h < 24; h++) {
      const key = String(h);
      bars.set(key, { key, label: `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`, visits: 0, views: 0 });
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = istMidnight(i);
      const key = istDate(d);
      const label = new Date(d.getTime() + IST_MS).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
      bars.set(key, { key, label, visits: 0, views: 0 });
    }
  }
  let visits = 0;
  let views = 0;
  const hours = Array.from({ length: days }, (_, i) => acc?.[`d${i}`] ?? []).flat();
  for (const row of hours) {
    const at = new Date(row.dimensions.datetimeHour);
    const ist = new Date(at.getTime() + IST_MS);
    const key = range === "today" ? String(ist.getUTCHours()) : ist.toISOString().slice(0, 10);
    const bar = bars.get(key);
    if (bar) {
      bar.visits += row.sum.visits;
      bar.views += row.count;
    }
    visits += row.sum.visits;
    views += row.count;
  }

  const uniqueDays = zone?.days ?? [];
  const uniquesPerDay = uniqueDays.length
    ? Math.round(uniqueDays.reduce((n, d) => n + d.uniq.uniques, 0) / uniqueDays.length)
    : 0;

  const rank = (rows: RumRow[] | undefined, dim: string, by: "visits" | "views", name: (v: string) => string) =>
    (rows ?? [])
      .map((r) => ({ name: name(r.dimensions[dim] ?? ""), value: by === "visits" ? r.sum.visits : r.count }))
      .filter((r) => r.value > 0);

  const region = new Intl.DisplayNames(["en"], { type: "region" });
  const usageByDay = new Map<string, number>();
  for (const u of acc?.usage ?? []) usageByDay.set(u.dimensions.date, (usageByDay.get(u.dimensions.date) ?? 0) + u.sum.requests);

  return {
    visits,
    views,
    uniquesPerDay,
    bars: [...bars.values()],
    pages: rank(acc?.pages, "requestPath", "views", (p) => p || "/"),
    sources: rank(acc?.sources, "refererHost", "visits", (h) => (h ? h.replace(/^www\./, "") : "Direct / apps")).filter((s) => s.name !== HOST),
    countries: rank(acc?.countries, "countryName", "visits", (c) => {
      try {
        return c ? (region.of(c) ?? c) : "Unknown";
      } catch {
        return c || "Unknown";
      }
    }),
    devices: rank(acc?.devices, "deviceType", "visits", (d) => (d ? d[0].toUpperCase() + d.slice(1) : "Unknown")),
    usage: {
      today: usageByDay.get(utcDate(new Date())) ?? 0,
      days: [...usageByDay.entries()].map(([name, value]) => ({ name, value })),
    },
  };
}
