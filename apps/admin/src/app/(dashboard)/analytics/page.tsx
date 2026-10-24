import Link from "next/link";
import { Activity, Eye, Gauge, Users } from "lucide-react";
import StatCard from "@/components/stat-card";
import {
  analyticsConfigured,
  FREE_DAILY_REQUESTS,
  getAnalytics,
  RANGES,
  type Analytics,
  type Bar,
  type Range,
  type Ranked,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-IN");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: asked } = await searchParams;
  const range: Range = RANGES.some((r) => r.id === asked) ? (asked as Range) : "7d";

  let data: Analytics | null = null;
  let error = "";
  if (analyticsConfigured()) {
    try {
      data = await getAnalytics(range);
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't reach Cloudflare.";
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-fog">Who visited stickypie.in, and how much of the free plan the shop uses.</p>
        </div>
        <nav className="flex rounded-full border border-line bg-ink2 p-1 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/analytics?range=${r.id}`}
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                r.id === range ? "bg-snow text-ink" : "text-fog hover:text-snow"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {!analyticsConfigured() ? (
        <Setup />
      ) : error ? (
        <p className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm">
          Couldn&apos;t load analytics from Cloudflare: {error}
        </p>
      ) : data ? (
        <Report data={data} range={range} />
      ) : null}
    </div>
  );
}

function Report({ data, range }: { data: Analytics; range: Range }) {
  const usedPct = Math.min(100, (data.usage.today / FREE_DAILY_REQUESTS) * 100);
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visits" value={n(data.visits)} sub="times someone opened the shop" icon={<Activity className="size-4" />} />
        <StatCard
          label="Page views"
          value={n(data.views)}
          sub={data.visits ? `${(data.views / data.visits).toFixed(1)} pages per visit` : "pages people looked at"}
          icon={<Eye className="size-4" />}
        />
        <StatCard
          label="Unique visitors"
          value={n(data.uniquesPerDay)}
          sub={range === "today" ? "today (by IP, includes bots)" : "per day, average (by IP, includes bots)"}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Free plan used today"
          value={`${usedPct < 1 && usedPct > 0 ? "<1" : Math.round(usedPct)}%`}
          sub={
            <span>
              {n(data.usage.today)} of {n(FREE_DAILY_REQUESTS)} requests · resets 5:30 am
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-snow/10">
                <span
                  className={`block h-full rounded-full ${usedPct > 80 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-mint"}`}
                  style={{ width: `${Math.max(usedPct, 1)}%` }}
                />
              </span>
            </span>
          }
          icon={<Gauge className="size-4" />}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-ink2 p-5">
        <h2 className="font-display text-base font-semibold">Visits {range === "today" ? "by hour" : "by day"}</h2>
        <Bars bars={data.bars} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <List title="Top pages" unit="views" rows={data.pages} />
        <List
          title="Where they came from"
          unit="visits"
          rows={data.sources}
          note="Instagram and WhatsApp in-app browsers often hide where people came from — those show as Direct / apps."
        />
        <List title="Countries" unit="visits" rows={data.countries} />
        <List title="Devices" unit="visits" rows={data.devices} />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-ink2 p-5">
        <h2 className="font-display text-base font-semibold">Requests per day (all workers)</h2>
        <p className="mt-1 text-xs text-fog">Free plan limit is {n(FREE_DAILY_REQUESTS)} a day, counted in UTC (5:30 am to 5:30 am India time).</p>
        <List rows={data.usage.days.slice().reverse()} unit="requests" bare max={FREE_DAILY_REQUESTS} />
      </section>
    </>
  );
}

/** One series (visits): thin bars from a shared baseline, value on hover. */
function Bars({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.visits));
  const every = bars.length > 14 ? Math.ceil(bars.length / 10) : bars.length > 12 ? 3 : 1;
  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-[2px] border-b border-line">
        {bars.map((b) => (
          <div key={b.key} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-7 rounded-t-[4px] bg-brand/80 transition-colors group-hover:bg-brand"
              style={{ height: `${(b.visits / max) * 100}%`, minHeight: b.visits ? 3 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg border border-line bg-ink px-2 py-1 text-[11px] whitespace-nowrap shadow-lg group-hover:block">
              <span className="font-semibold">{b.label}</span> · {n(b.visits)} visits · {n(b.views)} views
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-fog">
        {bars.map((b, i) => (
          <span key={b.key} className="flex-1 truncate text-center">
            {i % every === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function List({
  title,
  rows,
  unit,
  note,
  bare,
  max,
}: {
  title?: string;
  rows: Ranked[];
  unit: string;
  note?: string;
  bare?: boolean;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  const body = rows.length ? (
    <ul className="mt-3 space-y-2">
      {rows.map((r) => (
        <li key={r.name} className="relative overflow-hidden rounded-lg px-3 py-1.5 text-sm">
          <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg bg-brand/10" style={{ width: `${(r.value / top) * 100}%` }} />
          <span className="relative flex items-center justify-between gap-3">
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 text-xs text-fog tabular-nums">
              {n(r.value)} {r.value === 1 ? unit.replace(/s$/, "") : unit}
            </span>
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-3 text-sm text-fog">No data yet.</p>
  );
  if (bare) return body;
  return (
    <section className="rounded-2xl border border-line bg-ink2 p-5">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {body}
      {note && <p className="mt-3 text-[11px] text-fog">{note}</p>}
    </section>
  );
}

function Setup() {
  return (
    <section className="mt-6 max-w-2xl rounded-2xl border border-line bg-ink2 p-5 text-sm leading-relaxed">
      <h2 className="font-display text-base font-semibold">Connect Cloudflare</h2>
      <p className="mt-2 text-fog">The admin needs a read-only Cloudflare token to show visitors here:</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">
        <li>Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom token.</li>
        <li>
          Permissions: <b>Account · Account Analytics · Read</b> and <b>Zone · Analytics · Read</b> (zone stickypie.in).
        </li>
        <li>
          Save it as the admin secret <code className="rounded bg-snow/10 px-1">CF_ANALYTICS_TOKEN</code>, then reload this page.
        </li>
      </ol>
    </section>
  );
}
