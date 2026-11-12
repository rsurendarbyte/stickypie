import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Phone,
  Repeat,
  ShoppingCart,
  Smartphone,
  UserRound,
  XCircle,
} from "lucide-react";
import { formatINR, orderCode } from "@stickypie/shared";
import MeButton from "@/components/me-button";
import { timeAgo } from "@/lib/customers";
import { listOwnDevices, type OwnDevices } from "@/lib/own-devices";
import {
  JOURNEY_RANGES,
  dayTime,
  formatMs,
  groupVisitors,
  listJourneys,
  pageName,
  sessionMs,
  sourceLabel,
  visitSteps,
  type JourneySession,
  type Step,
  type Visitor,
} from "@/lib/journeys";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journeys" };

const SHOWS = [
  { id: "abandoned", label: "Added to cart, didn't buy" },
  { id: "contact", label: "Left phone or email" },
  { id: "paid", label: "Bought" },
  { id: "all", label: "Everyone" },
] as const;
type Show = (typeof SHOWS)[number]["id"];

const SHOWN_MAX = 150;

function count<T>(list: T[], key: (x: T) => string | null | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const x of list) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/* ── summary ─────────────────────────────────────────────────────────────── */

function Funnel({ stages }: { stages: { label: string; n: number }[] }) {
  return (
    <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].n : s.n;
        return (
          <li key={s.label} className="relative min-w-0 rounded-xl border border-line bg-ink p-3">
            <p className="font-display text-2xl font-bold tabular-nums">{s.n.toLocaleString("en-IN")}</p>
            <p className="text-xs font-semibold text-snow">{s.label}</p>
            <p className="mt-0.5 text-[11px] text-fog">
              {i === 0 ? "people on the shop" : `${pct(s.n, prev)}% of the step before`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Bars({ title, rows, total, empty }: { title: string; rows: [string, number][]; total: number; empty: string }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-ink2 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-fog">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 6).map(([k, n]) => (
            <li key={k} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{k}</span>
                <span className="shrink-0 text-xs text-fog tabular-nums">
                  {n} {n === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="pie-gradient h-full rounded-full" style={{ width: `${Math.max(pct(n, total), 3)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── one guest ───────────────────────────────────────────────────────────── */

const STAGE: Record<Visitor["stage"], { text: string; cls: string; Icon: typeof CheckCircle2 }> = {
  paid: { text: "Bought", cls: "border-mint/30 bg-mint/10 text-mint", Icon: CheckCircle2 },
  payment: { text: "Reached payment", cls: "border-brand/30 bg-brand/10 text-brand", Icon: CreditCard },
  checkout: { text: "Reached checkout", cls: "border-brand/30 bg-brand/10 text-brand", Icon: CreditCard },
  cart: { text: "Added to cart", cls: "border-gold/30 bg-gold/10 text-gold", Icon: ShoppingCart },
  browsing: { text: "Just looking", cls: "border-line bg-ink text-fog", Icon: Eye },
};

function StepPill({ step }: { step: Step }) {
  if (step.kind === "page") {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-ink px-2.5 py-1 text-xs" title={step.path}>
        <span className="truncate font-semibold text-snow">{step.name}</span>
        <span className="shrink-0 text-fog tabular-nums">{formatMs(step.ms)}</span>
      </span>
    );
  }
  const cls =
    step.tone === "good"
      ? "border-mint/30 bg-mint/10 text-mint"
      : step.tone === "bad"
        ? "border-brand/30 bg-brand/10 text-brand"
        : step.tone === "cart"
          ? "border-gold/30 bg-gold/10 text-gold"
          : "border-line/60 bg-transparent text-fog";
  const Icon =
    step.tone === "good" ? CheckCircle2 : step.tone === "bad" ? XCircle : step.e === "add_to_cart" ? ShoppingCart : step.tone === "cart" ? CreditCard : null;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{step.label}</span>
    </span>
  );
}

function VisitFlow({ s, isLast, paid }: { s: JourneySession; isLast: boolean; paid: boolean }) {
  const steps = visitSteps(s);
  // a quick-look visit (no cart, no contact) loses its steps after 7 days to save space
  const trimmed = s.pages.length === 0 && s.events.length === 0;
  return (
    <div className="rounded-xl bg-ink p-3">
      <p className="text-xs font-semibold text-snow">
        Visit {s.visit_no}
        <span className="font-normal text-fog">
          {" "}
          · {dayTime(s.started_at)}
          {!trimmed && ` · ${formatMs(sessionMs(s))}`} · from {sourceLabel(s)}
        </span>
      </p>
      {trimmed ? (
        <p className="mt-2 text-xs text-fog">
          Landed on {pageName(s.entry_path ?? "/")}
          {s.last_path && s.last_path !== s.entry_path ? `, left on ${pageName(s.last_path)}` : ""}. Step-by-step details are
          cleared after 7 days for visits that didn&apos;t add to cart.
        </p>
      ) : (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {steps.map((step, i) => (
          <span key={i} className="inline-flex max-w-full items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-3 shrink-0 text-fog/60" />}
            <StepPill step={step} />
          </span>
        ))}
        {!(isLast && paid) && (
          <span className="inline-flex items-center gap-1.5">
            <ArrowRight className="size-3 shrink-0 text-fog/60" />
            <span className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-fog">
              <LogOut className="size-3.5" /> left
            </span>
          </span>
        )}
      </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-fog">{label}</dt>
      <dd className="truncate text-xs text-snow">{value}</dd>
    </div>
  );
}

const isMine = (v: Visitor, own: OwnDevices) => own.visitors.includes(v.id) || v.ips.some((ip) => own.ips.includes(ip));

function GuestRow({ v, me }: { v: Visitor; me: boolean }) {
  const stage = STAGE[v.stage];
  const city = v.place?.split(",")[0];
  const who = me ? "You" : (v.name ?? (v.phone || v.email ? "Guest" : city ? `Guest from ${city}` : "Guest"));
  const DeviceIcon = /Computer/.test(v.device) ? Monitor : Smartphone;
  const sentence = [
    `Came from ${v.source}`,
    v.device,
    v.place,
    v.visits > 1 ? `${v.visits} visits` : "1 visit",
    v.totalMs > 0 ? `${formatMs(v.totalMs)} on the shop` : null,
    v.cart?.length
      ? `${v.cart.reduce((n, l) => n + l.qty, 0)} in cart${v.cartValue ? ` (${formatINR(v.cartValue)})` : ""}`
      : v.addedCount
        ? `added ${v.addedCount} to cart`
        : null,
  ].filter(Boolean);
  const first = v.first;
  return (
    <details
      className={`group rounded-2xl border ${me ? "border-sky-400/50 bg-sky-400/[0.07] open:border-sky-400" : "border-line bg-ink2 open:border-fog/40"}`}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${stage.cls}`}>
          <stage.Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{who}</span>
            {me && (
              <span className="inline-flex items-center rounded-full border border-sky-400/50 bg-sky-400/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                My device
              </span>
            )}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stage.cls}`}>
              {stage.text}
            </span>
            {v.visits > 1 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-snow">
                <Repeat className="size-3" /> came back
              </span>
            )}
          </p>
          <p className="mt-1 text-sm leading-snug text-fog">{sentence.join(" · ")}</p>
          {v.ips.length > 0 && (
            <p className="mt-0.5 font-mono text-xs text-fog/80">
              IP {v.ips[0]}
              {v.ips.length > 1 && ` +${v.ips.length - 1} more`}
            </p>
          )}
          <p className="mt-1 text-sm">
            {v.paid ? (
              <span className="font-semibold text-mint">
                Bought{v.orderId ? ` · ${orderCode(v.orderId)}` : ""}
              </span>
            ) : (
              <>
                <span className="text-fog">Left on </span>
                <span className="font-semibold text-snow">{v.leftAt}</span>
              </>
            )}
            <span className="text-fog"> · {timeAgo(v.lastAt)}</span>
          </p>
          {(v.phone || v.email) && (
            <p className="mt-2 flex flex-wrap gap-2">
              {v.phone && (
                <>
                  <a href={`tel:+91${v.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand">
                    <Phone className="size-3.5" /> {v.phone}
                  </a>
                  <a
                    href={`https://wa.me/91${v.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-mint/30 bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint hover:border-mint"
                  >
                    <MessageCircle className="size-3.5" /> WhatsApp
                  </a>
                </>
              )}
              {v.email && (
                <a href={`mailto:${v.email}`} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-ink px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand">
                  <Mail className="size-3.5 shrink-0" /> <span className="truncate">{v.email}</span>
                </a>
              )}
            </p>
          )}
        </div>
        <ChevronDown className="mt-2 size-4 shrink-0 text-fog transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-line/50 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-fog uppercase">What they did</p>
          <div className="space-y-2">
            {[...v.sessions].reverse().map((s, i, all) => (
              <VisitFlow key={s.id} s={s} isLast={i === all.length - 1} paid={v.paid} />
            ))}
          </div>
          {v.visits > v.sessions.length && (
            <p className="mt-1.5 text-[11px] text-fog">
              {v.visits - v.sessions.length} older visit{v.visits - v.sessions.length === 1 ? "" : "s"} outside this date range.
            </p>
          )}
        </div>

        {!v.paid && !v.cart?.length && v.addedItems.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-fog uppercase">Added to cart</p>
            <ul className="space-y-1">
              {v.addedItems.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{l.name}</span>
                  {l.price !== null && <span className="shrink-0 text-xs text-fog tabular-nums">{formatINR(l.price)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {v.cart && v.cart.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-fog uppercase">In their cart now</p>
            <ul className="space-y-1">
              {v.cart.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {l.name}
                    {l.size && <span className="text-xs text-fog"> · {l.size}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-fog tabular-nums">
                    {l.qty} × {formatINR(l.price)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-fog uppercase">About this guest</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Fact label="First seen" value={dayTime(v.firstAt)} />
            <Fact label="Last seen" value={dayTime(v.lastAt)} />
            <Fact label="Visits" value={String(v.visits)} />
            <Fact label="First landed on" value={first.entry_path ? pageName(first.entry_path) : null} />
            <Fact label="Came from" value={sourceLabel(first)} />
            <Fact label="Site before us" value={first.referrer} />
            <Fact label="Ad campaign" value={first.campaign} />
            <Fact label="Ad name" value={first.utm_content} />
            <Fact label="Place" value={v.place} />
            <Fact label={v.ips.length > 1 ? "IP addresses" : "IP address"} value={v.ips.length ? <span className="font-mono">{v.ips.join(", ")}</span> : null} />
            <Fact label="Device" value={v.device} />
            <Fact label="Screen" value={v.sessions.find((s) => s.screen)?.screen} />
            <Fact label="Language" value={v.sessions.find((s) => s.lang)?.lang} />
            <Fact label="Name" value={v.name} />
            {v.orderId && (
              <Fact
                label="Order"
                value={
                  <Link href={`/orders/${v.orderId}`} className="font-semibold hover:text-brand">
                    {orderCode(v.orderId)}
                  </Link>
                }
              />
            )}
          </dl>
          <div className="mt-3">
            <MeButton ip={v.ips[0]} visitorId={v.id} isMe={me} />
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-fog/70">
            <DeviceIcon className="size-3" /> one browser = one guest; the same person on another phone shows as a new guest.
          </p>
        </div>
      </div>
    </details>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default async function JourneysPage({ searchParams }: { searchParams: Promise<{ show?: string; days?: string }> }) {
  const q = await searchParams;
  const show: Show = SHOWS.some((s) => s.id === q.show) ? (q.show as Show) : "abandoned";
  const range = JOURNEY_RANGES.find((r) => r.id === q.days) ?? JOURNEY_RANGES[1];

  let sessions: JourneySession[];
  let own: OwnDevices;
  try {
    [sessions, own] = await Promise.all([listJourneys(range.days), listOwnDevices()]);
  } catch (e) {
    return (
      <div className="w-full">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Journeys</h1>
        <p className="mt-6 rounded-2xl border border-brand/40 bg-brand/10 p-5 text-sm">
          Could not load journeys: {(e as Error).message}
          <br />
          <span className="text-fog">If it says a function or column is missing, apply the 20261110 journeys migrations.</span>
        </p>
      </div>
    );
  }

  const everyone = groupVisitors(sessions);
  const mine = new Set(everyone.filter((v) => isMine(v, own)).map((v) => v.id));
  // the numbers leave out your own devices; the "Everyone" list still shows them
  const visitors = everyone.filter((v) => !mine.has(v.id));
  const added = visitors.filter((v) => v.added);
  const abandoners = added.filter((v) => !v.paid);
  const reachable = visitors.filter((v) => !v.paid && (v.phone || v.email));
  const paid = visitors.filter((v) => v.paid);
  const leftAt = count(abandoners, (v) => v.leftAt);
  const sources = count(abandoners, (v) => v.source);
  const top = leftAt[0];

  // the lists still show your own devices (in blue), so you can find yourself
  const shownIn = (want: Show, v: Visitor) =>
    want === "abandoned" ? v.added && !v.paid : want === "contact" ? !v.paid && Boolean(v.phone || v.email) : want === "paid" ? v.paid : true;
  const list = everyone.filter((v) => shownIn(show, v));
  list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const chip = (isActive: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
      isActive
        ? "pie-gradient border-transparent text-white shadow-md shadow-brand/20"
        : "border-line bg-ink2 text-fog hover:border-fog/40 hover:text-snow"
    }`;
  const href = (o: { show?: Show; days?: string }) => `/journeys?${new URLSearchParams({ show: o.show ?? show, days: o.days ?? range.id })}`;
  const listCount = Object.fromEntries(SHOWS.map((s) => [s.id, everyone.filter((v) => shownIn(s.id, v)).length])) as Record<Show, number>;

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Journeys</h1>
      <p className="mt-1 text-sm text-fog">
        Every guest on the shop, what they looked at and where they stopped. Tap a guest to see their steps.
      </p>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {JOURNEY_RANGES.map((r) => (
          <Link key={r.id} href={href({ days: r.id })} prefetch={false} className={chip(r.id === range.id)}>
            {r.label}
          </Link>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-ink2 p-4">
        <h2 className="text-sm font-semibold">From visit to payment</h2>
        <Funnel
          stages={[
            { label: "Visited", n: visitors.length },
            { label: "Added to cart", n: added.length },
            { label: "Opened checkout", n: visitors.filter((v) => v.checkout).length },
            { label: "Tapped Pay", n: visitors.filter((v) => v.payClicked).length },
            { label: "Paid", n: paid.length },
          ]}
        />
        {top && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-sm">
            <LogOut className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>
              Most people who add to cart and don&apos;t buy leave at <b>{top[0]}</b> — {top[1]} of {abandoners.length}.
            </span>
          </p>
        )}
        {reachable.length > 0 && (
          <Link
            href={href({ show: "contact" })}
            prefetch={false}
            className="mt-2 flex items-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-3.5 py-2.5 text-sm hover:border-mint"
          >
            <UserRound className="size-4 shrink-0 text-mint" />
            <span>
              <b>{reachable.length}</b> {reachable.length === 1 ? "guest" : "guests"} typed a phone or email but didn&apos;t pay — you can follow up.
            </span>
          </Link>
        )}
        {mine.size > 0 && (
          <p className="mt-2 text-xs text-sky-300">
            Your own devices ({mine.size}) are left out of these numbers. They still show in the lists below, in blue.
          </p>
        )}
        {sessions.length >= 1000 && (
          <p className="mt-2 text-xs text-gold">Only the latest 1,000 visits are counted — pick a shorter range for exact numbers.</p>
        )}
      </section>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Bars title="Where cart-adders leave" rows={leftAt} total={abandoners.length} empty="Nobody left with a cart in this range." />
        <Bars title="Where cart-adders came from" rows={sources} total={abandoners.length} empty="—" />
      </div>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {SHOWS.map((s) => (
          <Link key={s.id} href={href({ show: s.id })} prefetch={false} className={chip(s.id === show)}>
            {s.label} ({listCount[s.id]})
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-ink2 py-12 text-center text-sm text-fog">No guests here yet.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
            {list.slice(0, SHOWN_MAX).map((v) => (
              <GuestRow key={v.id} v={v} me={mine.has(v.id)} />
            ))}
          </div>
          {list.length > SHOWN_MAX && (
            <p className="mt-3 text-center text-xs text-fog">Showing the latest {SHOWN_MAX} of {list.length}.</p>
          )}
        </>
      )}

      <p className="mt-6 flex items-start gap-1.5 text-[11px] leading-relaxed text-fog/70">
        <Clock className="mt-px size-3 shrink-0" />
        A visit ends after 30 minutes away. Times are India time and count only while the page was on screen. Place is a
        rough guess from the connection. Name, phone and email appear once a guest types them at checkout. Kept 60 days.
        IP is the guest&apos;s internet address; a phone&apos;s changes often. Tap a guest and “This is me” to mark your own
        browser and IP: they show in blue as “You” and leave the numbers. “Ad” means the link carried an ad tag.
      </p>
    </div>
  );
}
