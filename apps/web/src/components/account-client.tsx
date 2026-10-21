"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, LogOut, Package } from "lucide-react";
import type { Order, OrderStatus } from "@stickypie/shared";
import { STATUS_LABELS, formatDateTime, formatINR, orderCode, rowToOrder } from "@stickypie/shared";
import { authClient, createAccount, signIn, signOut, useShopper } from "@/lib/shopper-auth";
import { TextField } from "./field";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-gold/10 text-gold",
  paid: "bg-mint/10 text-mint",
  packed: "bg-sky-500/10 text-sky-600",
  shipped: "bg-violet-500/10 text-violet-600",
  delivered: "bg-mint/15 text-mint",
  failed: "bg-brand/10 text-brand",
  cancelled: "bg-panel text-fog",
};

export default function AccountClient() {
  const shopper = useShopper();

  if (!shopper.ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-8 animate-spin text-fog" />
      </div>
    );
  }
  if (!shopper.enabled) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center text-sm text-fog">
        Accounts aren&apos;t available in demo mode.
      </div>
    );
  }
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 pt-24 pb-24 sm:px-8">
      {shopper.email ? <OrderHistory email={shopper.email} /> : <SignInCard />}
    </div>
  );
}

function SignInCard() {
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "create") await createAccount(email, password, "");
      else await signIn(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in.";
      setError(message);
      if (/already exists/i.test(message)) setMode("signin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm rounded-2xl border border-line bg-ink2/40 p-5 sm:p-6"
    >
      <h1 className="font-display text-2xl font-bold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-1 text-sm text-fog">Track your orders and see your order history.</p>
      <div className="mt-5 space-y-3">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={mode === "create" ? "8+ characters" : undefined}
        />
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email || !password}
        className="pie-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "create" : "signin");
          setError(null);
        }}
        className="mt-3 w-full text-center text-xs font-semibold text-brand hover:underline"
      >
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

function OrderHistory({ email }: { email: string }) {
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
        else setOrders((data ?? []).map(rowToOrder));
      });
    return () => {
      alive = false;
    };
  }, [email]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">My orders</h1>
          <p className="mt-0.5 text-sm text-fog">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-brand"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-brand">{error}</p>}
      {!orders && !error && (
        <div className="mt-10 grid place-items-center">
          <Loader2 className="size-7 animate-spin text-fog" />
        </div>
      )}
      {orders && orders.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-10 text-center">
          <Package className="mx-auto size-10 text-fog/60" />
          <p className="mt-3 font-semibold">No orders yet</p>
          <Link href="/browse" className="mt-2 inline-block text-sm text-brand hover:underline">
            Browse stickers →
          </Link>
        </div>
      )}
      {orders && orders.length > 0 && (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/order/${order.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-ink2/40 p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex -space-x-3">
                  {order.items.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className="grid size-11 place-items-center rounded-lg bg-ink p-1 ring-2 ring-ink2"
                    >
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                      )}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{orderCode(order.id)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[order.status]}`}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fog">
                    {formatDateTime(order.createdAt)} ·{" "}
                    {order.items.reduce((n, item) => n + item.quantity, 0)} sticker
                    {order.items.reduce((n, item) => n + item.quantity, 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="font-display font-bold tabular-nums">{formatINR(order.total)}</span>
                <ChevronRight className="size-4 shrink-0 text-fog" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
