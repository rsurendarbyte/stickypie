"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  House,
  ImageUp,
  Package,
  PackageCheck,
  Search,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import type { Order, OrderStatus } from "@stickypie/shared";
import {
  STATUS_LABELS,
  formatINR,
  orderCode,
  rowToOrder,
} from "@stickypie/shared";
import { authClient } from "@/lib/shopper-auth";
import StickerLoader from "./sticker-loader";

type Filter = "all" | "topay" | "active" | "delivered" | "closed";

const FILTERS: {
  id: Filter;
  label: string;
  match: (s: OrderStatus) => boolean;
}[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "active",
    label: "In progress",
    match: (s) => s === "paid" || s === "packed" || s === "shipped",
  },
  { id: "topay", label: "To pay", match: (s) => s === "pending" },
  { id: "delivered", label: "Delivered", match: (s) => s === "delivered" },
  {
    id: "closed",
    label: "Cancelled",
    match: (s) => s === "cancelled" || s === "failed",
  },
];

/** Badge colour + the card's tint, per status. */
const STATUS: Record<
  OrderStatus,
  {
    icon: typeof Clock3;
    cls: string;
    tint: string;
    step?: string;
    label: string;
  }
> = {
  pending: {
    icon: Clock3,
    cls: "bg-amber-500 text-white",
    tint: "#fff5dc",
    label: "To pay",
  },
  paid: {
    icon: CheckCircle2,
    cls: "bg-emerald-600 text-white",
    tint: "#e6f7ee",
    step: "#059669",
    label: STATUS_LABELS.paid,
  },
  packed: {
    icon: PackageCheck,
    cls: "bg-[#a0703c] text-white",
    tint: "#f3e4cb",
    step: "#a0703c",
    label: STATUS_LABELS.packed,
  },
  shipped: {
    icon: Truck,
    cls: "bg-violet-600 text-white",
    tint: "#f0ebfe",
    step: "#7c3aed",
    label: STATUS_LABELS.shipped,
  },
  delivered: {
    icon: CheckCircle2,
    cls: "bg-green-600 text-white",
    step: "#16a34a",
    tint: "#ddf5e5",
    label: STATUS_LABELS.delivered,
  },
  failed: {
    icon: XCircle,
    cls: "bg-brand text-white",
    tint: "#fde8ee",
    label: STATUS_LABELS.failed,
  },
  cancelled: {
    icon: XCircle,
    cls: "bg-slate-400 text-white",
    tint: "#eef0f4",
    label: STATUS_LABELS.cancelled,
  },
};

const STEPS: { status: OrderStatus; label: string; icon: typeof Clock3 }[] = [
  { status: "paid", label: "Paid", icon: CreditCard },
  { status: "packed", label: "Packed", icon: Package },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "delivered", label: "Delivered", icon: House },
];
/** A little tilt per step sticker, like they were stuck on by hand. */
const TILT = [-6, 4, -3, 5];

const PAGE = 10;
const stickerCount = (o: Order) => o.items.reduce((n, i) => n + i.quantity, 0);

function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };
  const day = (x: Date) => x.toLocaleDateString("en-IN", opts);
  if (day(d) === day(now))
    return `Today, ${d.toLocaleTimeString("en-IN", { ...opts, timeStyle: "short" })}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (day(d) === day(y))
    return `Yesterday, ${d.toLocaleTimeString("en-IN", { ...opts, timeStyle: "short" })}`;
  return d.toLocaleDateString("en-IN", {
    ...opts,
    day: "numeric",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Shopper's order list: status filters with counts, search, progress per order. */
export default function MyOrders({ email }: { email: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    authClient()!
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError("Could not load your orders. Please refresh.");
        // An order without lines never completed checkout — nothing to show.
        else
          setOrders(
            (data ?? []).map(rowToOrder).filter((o) => o.items.length > 0),
          );
      });
    return () => {
      alive = false;
    };
  }, [email]);

  if (error) return <p className="mt-6 text-sm text-brand">{error}</p>;
  if (!orders) {
    return (
      <div className="mt-10 grid place-items-center">
        <StickerLoader size={44} />
      </div>
    );
  }
  return <OrderList orders={orders} />;
}

/** The list itself: status filters with counts, search, one card per order. */
export function OrderList({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map((f) => [f.id, 0])) as Record<
      Filter,
      number
    >;
    for (const o of orders)
      for (const f of FILTERS) if (f.match(o.status)) c[f.id]++;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const q = query.trim().toLowerCase().replace(/^sp-?/, "");
    return orders.filter(
      (o) =>
        f.match(o.status) &&
        (!q ||
          orderCode(o.id).toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))),
    );
  }, [orders, filter, query]);

  useEffect(() => setShown(PAGE), [filter, query]);

  if (orders.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center">
        <Package className="mx-auto size-10 text-fog/60" />
        <p className="mt-3 font-semibold">No orders yet</p>
        <Link
          href="/stickers"
          className="peel-btn mt-4 inline-flex h-10 items-center rounded-xl px-5 text-sm font-bold"
        >
          Browse stickers
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {/* Filters + search */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id
                ? "border-snow bg-snow text-ink"
                : "border-line bg-ink2 text-fog hover:text-snow"
            }`}
          >
            {f.label}
            <span
              className={`tabular-nums ${filter === f.id ? "text-ink/60" : "text-fog/70"}`}
            >
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>
      <label className="mt-2.5 flex h-10 items-center gap-2 rounded-xl border border-line bg-ink2 px-3 focus-within:border-brand/60">
        <Search className="size-4 shrink-0 text-fog" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number or sticker"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fog/60"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="text-fog hover:text-snow"
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">
          No orders match{query ? ` “${query}”` : " this filter"}.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {visible.slice(0, shown).map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
      {visible.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-3 w-full rounded-xl border border-line bg-ink2 py-2.5 text-sm font-semibold text-fog hover:text-snow"
        >
          Show more ({visible.length - shown})
        </button>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const s = STATUS[order.status];
  const cancelled = order.status === "cancelled";
  const Icon = s.icon;
  const count = stickerCount(order);
  const step = STEPS.findIndex((x) => x.status === order.status);
  const needsDesign =
    order.status === "paid" &&
    order.items.some((i) => i.isCustom && !i.customFile);
  const names = order.items.map((i) => i.name);
  const thumbs = order.items.slice(0, 3);

  return (
    <Link
      href={`/order/${order.id}`}
      style={{ "--tint": s.tint, "--step": s.step } as React.CSSProperties}
      className={`block rounded-2xl p-3 sm:p-4 ${cancelled ? "torn-card" : "peel-card"} card-${order.status}`}
    >
      <div className="flex items-center gap-2 pr-4">
        <span className="font-display text-[15px] font-bold">
          {orderCode(order.id)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}
        >
          <Icon className="size-3" /> {s.label}
        </span>
        <span className="ml-auto font-display text-base font-bold tabular-nums">
          {formatINR(order.total)}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex shrink-0 -space-x-2.5">
          {thumbs.map((item) => (
            <span
              key={item.id}
              className="grid size-10 place-items-center rounded-xl bg-ink p-1 ring-2 ring-white sm:size-11"
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImageUp className="size-4.5 text-fog" />
              )}
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="grid size-10 place-items-center rounded-xl bg-panel text-xs font-bold text-fog ring-2 ring-white sm:size-11">
              +{order.items.length - 3}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-snow">
            {names.slice(0, 2).join(", ")}
            {names.length > 2 ? ` +${names.length - 2} more` : ""}
          </p>
          <p className="mt-0.5 text-xs text-fog">
            {shortDate(order.createdAt)} · {count} sticker
            {count === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-fog" />
      </div>

      {/* Next step / progress */}
      {order.status === "pending" ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
          <span className="text-xs font-semibold text-snow">
            Payment not completed
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
            <CreditCard className="size-3.5" /> Pay now
          </span>
        </div>
      ) : needsDesign ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
          <span className="text-xs font-semibold text-snow">
            We need your design to print
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
            <ImageUp className="size-3.5" /> Upload
          </span>
        </div>
      ) : step >= 0 ? (
        <StickerProgress step={step} />
      ) : null}
      {/* One look per status — see .card-* in globals.css */}
      {order.status === "pending" && (
        <span aria-hidden className="card-shine" />
      )}
      {order.status === "packed" && (
        <span aria-hidden className="parcel-tape" />
      )}
      {order.status === "shipped" && (
        <span aria-hidden className="airmail-edge" />
      )}
      {order.status === "delivered" && (
        <span aria-hidden className="postmark">
          <CheckCircle2 className="size-5" />
          Delivered
        </span>
      )}
      {order.status === "failed" && (
        <span aria-hidden className="hazard-edge" />
      )}
      {cancelled && (
        <span aria-hidden className="cancel-stamp">
          Cancelled
        </span>
      )}
    </Link>
  );
}

/** Order progress as a row of little stickers joined by a strip of tape. */
function StickerProgress({ step }: { step: number }) {
  const pct = (step / (STEPS.length - 1)) * 100;
  return (
    <div
      className="relative mt-3"
      aria-label={`Progress: ${STEPS[step].label}`}
    >
      {/* track runs between the first and last sticker centres */}
      <div className="absolute top-4 right-[12.5%] left-[12.5%] h-1.5 -translate-y-1/2">
        <span className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-snow/15" />
        <span
          className="progress-tape absolute inset-y-0 left-0"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="relative grid grid-cols-4">
        {STEPS.map((x, i) => {
          const Icon = x.icon;
          const done = i <= step;
          return (
            <li key={x.status} className="flex flex-col items-center gap-1">
              <span
                className={`step-sticker ${done ? "is-done" : ""} ${i === step ? "is-current" : ""}`}
                style={{ rotate: done ? `${TILT[i]}deg` : undefined }}
              >
                <Icon className="size-3.5" strokeWidth={2.4} />
              </span>
              <span
                className={`text-[10px] font-semibold ${done ? "text-snow" : "text-fog"}`}
              >
                {x.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
