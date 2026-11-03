"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatINR } from "@stickypie/shared";
import type { Customer, LoginStatus } from "@/lib/customers";

export type CustomerRow = Customer & {
  status: LoginStatus;
  statusText: string;
  seenText: string;
  joinedText: string;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "online", label: "Online now" },
  { id: "signed-in", label: "Signed in" },
  { id: "signed-out", label: "Signed out" },
  { id: "bought", label: "Bought" },
  { id: "never", label: "Never bought" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

function matches(c: CustomerRow, f: Filter) {
  if (f === "all") return true;
  if (f === "online") return c.status === "online";
  if (f === "signed-in") return c.status === "online" || c.status === "signed-in";
  if (f === "signed-out") return c.status === "signed-out" || c.status === "blocked";
  if (f === "bought") return c.paid_orders > 0;
  return c.paid_orders === 0;
}

export function StatusPill({ status, text }: { status: LoginStatus; text: string }) {
  const tone =
    status === "online"
      ? "bg-mint/15 text-mint"
      : status === "signed-in"
        ? "bg-sky-400/15 text-sky-300"
        : status === "blocked"
          ? "bg-brand/15 text-brand"
          : "bg-white/5 text-fog";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      <span
        className={`size-1.5 rounded-full bg-current ${status === "online" ? "animate-pulse" : status === "signed-out" ? "opacity-50" : ""}`}
      />
      {text}
    </span>
  );
}

export default function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.id] = customers.filter((c) => matches(c, f.id)).length;
    return out;
  }, [customers]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter(
      (c) =>
        matches(c, filter) &&
        (!q || [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [customers, filter, query]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
      active
        ? "pie-gradient border-transparent text-white shadow-md shadow-brand/20"
        : "border-line bg-ink2 text-fog hover:border-fog/40 hover:text-snow"
    }`;

  return (
    <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={chip(filter === f.id)}>
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-ink2 px-3.5 py-2.5 text-sm focus-within:border-fog/50">
        <Search className="size-4 text-fog" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or phone"
          className="w-full bg-transparent outline-none placeholder:text-fog/70"
        />
      </label>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-ink2 py-12 text-center text-sm text-fog">
          Nobody here.
        </p>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="mt-4 space-y-2 md:hidden">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="block rounded-2xl border border-line bg-ink2 p-4 active:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {c.name ?? c.email.split("@")[0]}
                        {c.is_admin && <span className="ml-1.5 text-[10px] font-bold text-gold uppercase">Admin</span>}
                      </p>
                      <p className="truncate text-xs text-fog">{c.email}</p>
                    </div>
                    <StatusPill status={c.status} text={c.statusText} />
                  </div>
                  <p className="mt-2.5 text-xs text-fog">
                    Seen {c.seenText} · {c.paid_orders} paid {c.paid_orders === 1 ? "order" : "orders"}
                    {c.spent > 0 && <> · {formatINR(c.spent)}</>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-line bg-ink2 md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-fog uppercase">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Login</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th className="px-4 py-3 text-right font-semibold">Spent</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="border-b border-line/50 transition-colors last:border-0 hover:bg-white/[0.03]">
                    <td className="max-w-[280px] px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="block truncate font-semibold hover:text-brand">
                        {c.name ?? c.email.split("@")[0]}
                        {c.is_admin && <span className="ml-1.5 text-[10px] font-bold text-gold uppercase">Admin</span>}
                      </Link>
                      <p className="truncate text-xs text-fog">
                        {c.email}
                        {c.phone && <> · {c.phone}</>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} text={c.statusText} />
                      {c.sessions > 1 && <p className="mt-1 text-[11px] text-fog">{c.sessions} devices</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-fog">{c.seenText}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-fog">{c.joinedText}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.paid_orders}
                      {c.orders > c.paid_orders && (
                        <span className="text-xs text-fog"> +{c.orders - c.paid_orders} unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {c.spent > 0 ? formatINR(c.spent) : <span className="font-normal text-fog">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
