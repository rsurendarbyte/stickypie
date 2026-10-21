"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, LogOut, Package } from "lucide-react";
import type { Order, OrderStatus } from "@stickypie/shared";
import { STATUS_LABELS, formatDateTime, formatINR, orderCode, rowToOrder } from "@stickypie/shared";
import {
  authClient,
  createAccount,
  requestPasswordReset,
  signIn,
  signOut,
  useShopper,
} from "@/lib/shopper-auth";
import AuthShell from "./auth-shell";
import { PasswordField, TextField } from "./field";

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
  if (!shopper.email) {
    return (
      <AuthShell>
        <SignInCard />
      </AuthShell>
    );
  }
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 pt-24 pb-24 sm:px-8">
      <OrderHistory email={shopper.email} />
    </div>
  );
}

function SignInCard() {
  const [mode, setMode] = useState<"signin" | "create" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // /account?forgot opens straight on the reset form (linked from checkout).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("forgot")) setMode("forgot");
  }, []);

  function switchTo(next: typeof mode) {
    setMode(next);
    setError(null);
    setFieldErrors({});
    setSentTo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errors: typeof fieldErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter a valid email";
    if (mode === "create" && password.length < 8) errors.password = "Use at least 8 characters";
    if (mode === "signin" && !password) errors.password = "Enter your password";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email);
        setSentTo(email.trim());
      } else if (mode === "create") {
        await createAccount(email, password, name.trim());
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in.";
      setError(message);
      if (/already exists/i.test(message)) setMode("signin");
    } finally {
      setBusy(false);
    }
  }

  const copy = {
    signin: { title: "Welcome back", sub: "Sign in to see your orders and check out faster.", button: "Sign in" },
    create: { title: "Create your account", sub: "Takes ten seconds — no email confirmation needed.", button: "Create account" },
    forgot: { title: "Reset your password", sub: "Enter your account email and we'll send you a link to choose a new password.", button: "Send reset link" },
  }[mode];

  return (
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-sm">
      {mode !== "forgot" && (
        <div className="grid grid-cols-2 rounded-full border border-line bg-ink2 p-1 text-sm font-semibold">
          {(["signin", "create"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchTo(m)}
              className={`rounded-full py-2 transition-all ${
                mode === m ? "pie-gradient text-white shadow-md shadow-brand/25" : "text-fog hover:text-snow"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <h1 className="mt-7 font-display text-3xl font-bold">{copy.title}</h1>
      <p className="mt-1.5 text-sm text-fog">{copy.sub}</p>

      {sentTo ? (
        <div className="mt-6 rounded-2xl border border-mint/40 bg-mint/10 p-4 text-sm">
          <p className="font-semibold text-snow">Check your inbox</p>
          <p className="mt-1 text-fog">
            If an account exists for <span className="font-semibold text-snow">{sentTo}</span>, a
            reset link is on its way. Look in spam too — the link works once.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3.5">
            {mode === "create" && (
              <TextField
                label="Your name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              error={fieldErrors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
            />
            {mode !== "forgot" && (
              <div>
                <PasswordField
                  label="Password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  error={fieldErrors.password}
                  hint={mode === "create" ? "At least 8 characters" : undefined}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((f) => ({ ...f, password: undefined }));
                  }}
                />
                {mode === "signin" && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => switchTo("forgot")}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2.5 text-sm text-brand">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="pie-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-wait"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {copy.button}
          </button>
        </>
      )}

      {mode === "create" && (
        <p className="mt-4 text-center text-xs text-fog">
          By creating an account you agree to our{" "}
          <Link href="/legal/terms" className="font-semibold text-snow hover:text-brand">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="font-semibold text-snow hover:text-brand">
            Privacy Policy
          </Link>
          .
        </p>
      )}
      {mode === "forgot" && (
        <button
          type="button"
          onClick={() => switchTo("signin")}
          className="mt-5 w-full text-center text-sm font-semibold text-brand hover:underline"
        >
          ← Back to sign in
        </button>
      )}
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
