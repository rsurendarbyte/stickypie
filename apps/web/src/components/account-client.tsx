"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, LogOut, MapPin, Package, Plus, Trash2 } from "lucide-react";
import type { Order, OrderStatus } from "@stickypie/shared";
import {
  INDIAN_STATES,
  STATUS_LABELS,
  customerSchema,
  formatDateTime,
  formatINR,
  orderCode,
  rowToOrder,
} from "@stickypie/shared";
import {
  authClient,
  finishSignup,
  startSignup,
  requestPasswordReset,
  signIn,
  signOut,
  useShopper,
} from "@/lib/shopper-auth";
import {
  addAddress,
  addressLine,
  deleteAddress,
  setDefaultAddress,
  useSavedAddresses,
  type AddressType,
} from "@/lib/addresses";
import { lookupPincode } from "@/lib/pincode";
import AddressTypePicker, { AddressTypeBadge } from "./address-type-picker";
import AuthShell from "./auth-shell";
import { CheckField, PasswordField, SelectField, TextField } from "./field";
import StickerLoader, { PageLoader } from "./sticker-loader";

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
      <PageLoader />
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
      <SavedAddresses email={shopper.email} />
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
  // Create account: a 6-digit code is emailed to confirm the address.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const awaitingCode = mode === "create" && codeSentTo !== null && codeSentTo === email.trim().toLowerCase();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
      } else if (mode === "create" && !awaitingCode) {
        const result = await startSignup(email.trim().toLowerCase(), password);
        if ("codeSent" in result) {
          setCodeSentTo(email.trim().toLowerCase());
          setCode("");
          setResendIn(60);
        }
      } else if (mode === "create") {
        if (!/^\d{6}$/.test(code.trim())) {
          setError("Enter the 6-digit code from your email.");
          return;
        }
        await finishSignup(email.trim().toLowerCase(), password, name.trim(), code.trim());
        setCodeSentTo(null);
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
    create: {
      title: "Create your account",
      sub: "We'll email you a 6-digit code to confirm it's you.",
      button: awaitingCode ? "Verify & create account" : "Create account",
    },
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

          {awaitingCode && (
            <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/[0.04] p-4">
              <p className="text-sm">
                We emailed a 6-digit code to <b>{codeSentTo}</b>.
              </p>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                aria-label="6-digit code"
                autoFocus
                className="mt-2.5 h-12 w-full rounded-xl border border-line bg-ink px-4 text-center font-display text-xl font-bold tracking-[0.5em] outline-none focus:border-brand/60"
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={resendIn > 0 || busy}
                  onClick={async () => {
                    setError(null);
                    setBusy(true);
                    try {
                      const result = await startSignup(email.trim().toLowerCase(), password);
                      if ("codeSent" in result) setResendIn(60);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Couldn't send the code.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="font-semibold text-brand hover:underline disabled:text-fog disabled:no-underline"
                >
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
                </button>
                <span className="text-fog">Check spam too</span>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2.5 text-sm text-brand">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="peel-btn peel-btn--brand mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold active:scale-[0.99] disabled:cursor-wait"
          >
            {busy && <StickerLoader size={18} variant="onBrand" />}
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
          <StickerLoader size={44} />
        </div>
      )}
      {orders && orders.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-10 text-center">
          <Package className="mx-auto size-10 text-fog/60" />
          <p className="mt-3 font-semibold">No orders yet</p>
          <Link href="/stickers" className="mt-2 inline-block text-sm text-brand hover:underline">
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

function SavedAddresses({ email }: { email: string }) {
  const { addresses, loaded, refresh } = useSavedAddresses(email);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Saved addresses</h2>
          <p className="mt-0.5 text-sm text-fog">Pick one at checkout in a tap.</p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 px-3.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            <Plus className="size-3.5" /> Add address
          </button>
        )}
      </div>
      {adding && (
        <AddAddressForm
          email={email}
          first={addresses.length === 0}
          onDone={async (saved) => {
            setAdding(false);
            if (saved) await refresh();
          }}
        />
      )}
      {error && <p className="mt-3 text-sm text-brand">{error}</p>}
      {!loaded ? (
        <div className="mt-6 grid place-items-center">
          <StickerLoader size={36} />
        </div>
      ) : addresses.length === 0 ? (
        !adding && <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">
          <MapPin className="mx-auto size-8 text-fog/60" />
          <p className="mt-2">No saved addresses yet — add one now or at your next checkout.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={`flex flex-col rounded-2xl border p-4 ${
                a.isDefault ? "border-brand/50 bg-brand/[0.03]" : "border-line bg-ink2/40"
              }`}
            >
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {a.name}
                <AddressTypeBadge type={a.label} />
                {a.isDefault && (
                  <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand uppercase">
                    Default
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-fog">
                {addressLine(a)}
                <br />
                {a.state} · {a.phone}
              </p>
              <div className="mt-auto flex items-center gap-4 pt-3 text-xs font-semibold">
                {!a.isDefault && (
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => run(a.id, () => setDefaultAddress(a.id))}
                    className="text-brand hover:underline disabled:opacity-50"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => {
                    if (confirm("Delete this address?")) run(a.id, () => deleteAddress(a.id));
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-fog hover:text-brand disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const EMPTY_ADDRESS = {
  name: "",
  phone: "",
  pincode: "",
  city: "",
  state: "",
  address1: "",
  address2: "",
};

function AddAddressForm({
  email,
  first,
  onDone,
}: {
  email: string;
  first: boolean;
  onDone: (saved: boolean) => void;
}) {
  const [type, setType] = useState<AddressType>("Home");
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [makeDefault, setMakeDefault] = useState(first);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_ADDRESS, string>>>({});
  const [pinNote, setPinNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof EMPTY_ADDRESS, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // Fill city + state from India Post once the PIN code is complete.
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(form.pincode)) {
      setPinNote(null);
      return;
    }
    let cancelled = false;
    lookupPincode(form.pincode).then((r) => {
      if (cancelled) return;
      if (r.status === "ok") {
        setForm((f) => ({ ...f, city: r.city, state: r.state ?? f.state }));
        setPinNote([r.city, r.state].filter(Boolean).join(", "));
      } else if (r.status === "notfound") {
        setErrors((e) => ({ ...e, pincode: "We couldn't find this PIN code" }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [form.pincode]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = customerSchema.safeParse({ ...form, email });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof EMPTY_ADDRESS;
        if (key in EMPTY_ADDRESS && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const { name, phone, address1, address2, city, state, pincode } = parsed.data;
      await addAddress({ label: type, name, phone, address1, address2, city, state, pincode }, makeDefault);
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the address.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-5 rounded-2xl border border-line bg-ink2/40 p-4 sm:p-5">
      <AddressTypePicker value={type} onChange={setType} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <TextField
          label="Full name"
          autoComplete="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
          className="col-span-2 sm:col-span-3"
        />
        <TextField
          label="Mobile (10 digits)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={form.phone}
          onChange={(e) =>
            set("phone", e.target.value.replace(/\D/g, "").replace(/^91(?=\d{10})/, "").slice(0, 10))
          }
          error={errors.phone}
          className="col-span-2 sm:col-span-3"
        />
        <TextField
          label="PIN code"
          inputMode="numeric"
          autoComplete="postal-code"
          value={form.pincode}
          onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          error={errors.pincode}
          hint={pinNote ?? undefined}
          className="sm:col-span-2"
        />
        <TextField
          label="City / district"
          autoComplete="address-level2"
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
          error={errors.city}
          className="sm:col-span-2"
        />
        <SelectField
          label="State"
          value={form.state}
          onChange={(e) => set("state", e.target.value)}
          error={errors.state}
          className="col-span-2 sm:col-span-2"
        >
          <option value="" disabled>
            Select state
          </option>
          {INDIAN_STATES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </SelectField>
        <TextField
          label="House / flat no., street"
          autoComplete="address-line1"
          value={form.address1}
          onChange={(e) => set("address1", e.target.value)}
          error={errors.address1}
          className="col-span-2 sm:col-span-6"
        />
        <TextField
          label="Area, landmark (optional)"
          autoComplete="address-line2"
          value={form.address2}
          onChange={(e) => set("address2", e.target.value)}
          className="col-span-2 sm:col-span-6"
        />
      </div>
      {!first && (
        <CheckField
          label="Make this my default address"
          checked={makeDefault}
          onChange={setMakeDefault}
          className="mt-3"
        />
      )}
      {error && <p className="mt-3 text-xs text-brand">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="peel-btn peel-btn--brand inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {saving && <StickerLoader size={18} variant="onBrand" />} Save address
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-fog hover:text-snow"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
