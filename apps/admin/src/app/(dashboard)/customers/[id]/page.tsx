import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Package,
  Smartphone,
  Star,
  Truck,
  UserPlus,
} from "lucide-react";
import { formatDateTime, formatINR } from "@stickypie/shared";
import { StatusPill } from "@/components/customers-table";
import { supabaseConfigured } from "@/lib/auth";
import { deviceName, getCustomer, loginStatus, STATUS_TEXT, timeAgo, type CustomerEvent } from "@/lib/customers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer" };

const EVENT_ICON: Record<CustomerEvent["kind"], typeof LogIn> = {
  signup: UserPlus,
  login: LogIn,
  logout: LogOut,
  order: Package,
  paid: CheckCircle2,
  delivered: Truck,
  review: Star,
  message: MessageSquare,
  address: MapPin,
};

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await getCustomer(id);
  if (!found) notFound();
  const { customer: c, sessions, events } = found;
  const status = loginStatus(c);

  const facts: Array<[string, string]> = [
    ["Joined", formatDateTime(c.created_at)],
    ["Last sign-in", c.last_sign_in_at ? `${formatDateTime(c.last_sign_in_at)} (${timeAgo(c.last_sign_in_at)})` : "Never"],
    ["Last seen", timeAgo(c.last_active_at)],
    ["Email confirmed", c.email_confirmed_at ? "Yes" : "No"],
    ["Paid orders", `${c.paid_orders}${c.orders > c.paid_orders ? ` (+${c.orders - c.paid_orders} unpaid)` : ""}`],
    ["Spent", formatINR(c.spent)],
    ["Saved addresses", String(c.addresses)],
    ["Reviews", String(c.reviews)],
  ];

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-fog hover:text-snow">
        <ArrowLeft className="size-4" /> Customers
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">
            {c.name ?? c.email.split("@")[0]}
            {c.is_admin && <span className="ml-2 align-middle text-xs font-bold text-gold uppercase">Admin</span>}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fog">
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-snow">
              <Mail className="size-3.5" /> {c.email}
            </a>
            {c.phone && (
              <a href={`tel:${c.phone}`} className="hover:text-snow">
                {c.phone}
              </a>
            )}
          </p>
        </div>
        <StatusPill status={status} text={STATUS_TEXT[status]} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-ink2 p-4">
            <dt className="text-[11px] font-semibold tracking-wide text-fog uppercase">{k}</dt>
            <dd className="mt-1 text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section>
          <h2 className="font-display text-lg font-bold">Activity</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-fog">Nothing yet.</p>
          ) : (
            <ol className="mt-3 rounded-2xl border border-line bg-ink2 p-2">
              {events.map((e, i) => {
                const Icon = EVENT_ICON[e.kind] ?? Package;
                const body = (
                  <>
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/5 text-fog">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{e.title}</span>
                      {e.detail && <span className="block text-xs break-words text-fog">{e.detail}</span>}
                    </span>
                    <span className="shrink-0 text-right text-[11px] text-fog" title={formatDateTime(e.at)}>
                      {timeAgo(e.at)}
                    </span>
                  </>
                );
                const linksToOrder = e.ref && ["order", "paid", "delivered", "review"].includes(e.kind);
                return (
                  <li key={`${e.kind}-${e.at}-${i}`}>
                    {linksToOrder ? (
                      <Link href={`/orders/${e.ref}`} className="flex gap-3 rounded-xl p-2.5 hover:bg-white/[0.03]">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-3 p-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-bold">Signed in on</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-line bg-ink2 p-4 text-sm text-fog">
              No device — signed out everywhere.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.map((s, i) => {
                const name = deviceName(s.user_agent);
                const Icon = /iPhone|iPad|Android/.test(name) ? Smartphone : Monitor;
                return (
                  <li key={i} className="flex gap-3 rounded-2xl border border-line bg-ink2 p-4">
                    <Icon className="mt-0.5 size-4 shrink-0 text-fog" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-fog">
                        Active {timeAgo(s.seen_at)} · since {timeAgo(s.created_at)}
                      </p>
                      {s.ip && <p className="text-xs text-fog/70">IP {s.ip}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-fog/80">
            Sign-in / sign-out entries appear in the activity only if Supabase keeps its auth log. Page browsing isn&apos;t
            tracked per person.
          </p>
        </section>
      </div>
    </div>
  );
}
