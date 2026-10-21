"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  customerSchema,
  formatINR,
} from "@stickypie/shared";
import { authClient, createAccount, signIn, signOut, useShopper } from "@/lib/shopper-auth";
import { useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import { TextField } from "./field";

type FormState = {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  pincode: "",
};

const CUSTOMER_KEY = "stickypie.customer.v1";

export default function CheckoutClient() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const shopper = useShopper();
  const [authMode, setAuthMode] = useState<"create" | "signin">("create");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const needsAccount = shopper.enabled && !shopper.email;

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  // Signed-in shoppers order with their account email.
  useEffect(() => {
    if (shopper.email) setForm((f) => ({ ...f, email: shopper.email ?? f.email }));
  }, [shopper.email]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_KEY);
      if (raw) setForm({ ...EMPTY, ...(JSON.parse(raw) as Partial<FormState>) });
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setAuthError(null);

    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (needsAccount && (authMode === "create" ? password.length < 8 : !password)) {
      setAuthError(authMode === "create" ? "Choose a password of at least 8 characters." : "Enter your password.");
      return;
    }

    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(form));
    } catch {
      // ignore
    }

    setSubmitting(true);

    // Quick onboarding: create the account or sign in, then pay — one click.
    let token: string | null = null;
    if (shopper.enabled) {
      try {
        const session = !needsAccount
          ? (await authClient()!.auth.getSession()).data.session
          : authMode === "create"
            ? await createAccount(parsed.data.email, password, parsed.data.name)
            : await signIn(parsed.data.email, password);
        token = session?.access_token ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not sign you in.";
        setAuthError(message);
        if (/already exists/i.test(message)) setAuthMode("signin");
        setSubmitting(false);
        return;
      }
      setPassword("");
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customer: parsed.data,
          items: items.map((item) => ({ productId: item.productId, quantity: item.qty })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "auth_required") {
          await signOut();
          setAuthMode("signin");
          setAuthError("Your session expired — please sign in again.");
        } else {
          setServerError(
            typeof data.error === "string" ? data.error : "Something went wrong. Please try again."
          );
        }
        setSubmitting(false);
        return;
      }
      if (data.mode === "cashfree") {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const cashfree = await load({ mode: data.cfMode });
        await cashfree.checkout({
          paymentSessionId: data.paymentSessionId,
          redirectTarget: "_self",
        });
      } else {
        router.push(data.url as string);
      }
    } catch {
      setServerError("Could not reach the payment service. Please try again.");
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="size-10 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }

  if (items.length === 0 && !submitting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-display text-2xl font-semibold">Your cart is empty</p>
        <p className="text-sm text-fog">Add a few stickers before checking out.</p>
        <Link
          href="/browse"
          className="pie-gradient rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
        >
          Browse stickers
        </Link>
      </div>
    );
  }

  const field = (
    name: keyof FormState,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    span = false
  ) => (
    <TextField
      label={label}
      value={form[name]}
      onChange={(e) => set(name, e.target.value)}
      error={errors[name]}
      className={span ? "sm:col-span-2" : ""}
      {...props}
    />
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-20 pb-24 sm:px-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Checkout</h1>
      <p className="mt-0.5 text-sm text-fog">
        Quick order — fill once, items stay editable on the right.
      </p>

      <form onSubmit={submit} className="mt-5 grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* One compact form — no separate steps */}
        <section className="rounded-2xl border border-line/70 bg-ink2/40 p-4 sm:p-5">
          {shopper.enabled && shopper.ready && (
            <div className="mb-4 border-b border-line/70 pb-4">
              {shopper.email ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="text-fog">Signed in as</span>
                  <span className="font-semibold">{shopper.email}</span>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Not you? Sign out
                  </button>
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-semibold">Your account</h2>
                    <div className="inline-flex rounded-full border border-line bg-ink p-0.5 text-xs font-semibold">
                      {(["create", "signin"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setAuthMode(mode);
                            setAuthError(null);
                          }}
                          className={`rounded-full px-3 py-1 transition-colors ${
                            authMode === mode ? "pie-gradient text-white" : "text-fog hover:text-snow"
                          }`}
                        >
                          {mode === "create" ? "New here" : "Sign in"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {field("email", "Email", { type: "email", autoComplete: "email" })}
                    <TextField
                      label={authMode === "create" ? "Create a password" : "Password"}
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthError(null);
                      }}
                      autoComplete={authMode === "create" ? "new-password" : "current-password"}
                      hint={authMode === "create" ? "8+ characters — to track your orders" : undefined}
                    />
                  </div>
                  {authMode === "signin" && (
                    <a
                      href="/account?forgot"
                      target="_blank"
                      rel="noopener"
                      className="mt-2 inline-block text-xs font-semibold text-fog hover:text-brand"
                    >
                      Forgot password?
                    </a>
                  )}
                  {authError && (
                    <p className="mt-2 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">
                      {authError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <h2 className="font-display text-base font-semibold">Contact &amp; delivery</h2>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
            {field("name", "Full name", { autoComplete: "name" }, shopper.enabled)}
            {!shopper.enabled && field("email", "Email", { type: "email", autoComplete: "email" })}
            {field(
              "phone",
              "Mobile number (10-digit)",
              { inputMode: "numeric", autoComplete: "tel" },
              true
            )}
            {field("address1", "Flat / house, street", { autoComplete: "address-line1" }, true)}
            {field("address2", "Area, landmark (optional)", { autoComplete: "address-line2" }, true)}
            {field("city", "City", { autoComplete: "address-level2" })}
            {field("state", "State", { autoComplete: "address-level1" })}
            {field("pincode", "PIN code", { inputMode: "numeric", autoComplete: "postal-code" })}
          </div>
        </section>

        {/* Summary stays editable: qty steppers, trash at 1 removes */}
        <aside className="rounded-2xl border border-line bg-ink2 p-4 sm:p-5 lg:sticky lg:top-24">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base font-semibold">Your order</h2>
            <span className="text-xs text-fog">
              {items.length} sticker{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="mt-3 space-y-2.5">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-2.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-panel p-1 ring-1 ring-line">
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="sticker-cut-sm max-h-full max-w-full object-contain"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.name}</p>
                  <CartStepper item={item} size="sm" className="mt-1" />
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {formatINR(item.price * item.qty)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between text-fog">
              <span>Subtotal</span>
              <span className="text-snow">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-fog">
              <span>Shipping</span>
              <span className={shipping === 0 ? "font-medium text-mint" : "text-snow"}>
                {shipping === 0 ? "FREE" : formatINR(shipping)}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          {serverError && (
            <p className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="pie-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Taking you to payment…
              </>
            ) : (
              <>
                <Lock className="size-4" />
                {needsAccount
                  ? `${authMode === "create" ? "Create account" : "Sign in"} & pay ${formatINR(total)}`
                  : `Pay ${formatINR(total)} securely`}
              </>
            )}
          </button>

          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] text-fog/80">
            <ShieldCheck className="size-3.5" /> UPI · Cards · NetBanking — secured by Cashfree
          </p>
        </aside>
      </form>
    </div>
  );
}
