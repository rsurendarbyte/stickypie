"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Lock,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  INDIAN_STATES,
  PAYMENT_GATEWAY_LABELS,
  ZONE_LABELS,
  belowMinimum,
  customerSchema,
  formatINR,
  matchIndianState,
  shippingFor,
} from "@stickypie/shared";
import { useStoreSettings } from "@/lib/live-catalog";
import { authClient, createAccount, signIn, signOut, useShopper } from "@/lib/shopper-auth";
import { openPayment } from "@/lib/open-payment";
import { lookupPincode } from "@/lib/pincode";
import {
  ADDRESS_TYPES,
  addressLine,
  rememberAddress,
  useSavedAddresses,
  type AddressType,
  type SavedAddress,
} from "@/lib/addresses";
import AddressTypePicker, { AddressTypeBadge } from "./address-type-picker";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import { CheckField, PasswordField, SelectField, TextField } from "./field";
import StickerLoader, { PageLoader } from "./sticker-loader";

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
  const { items, count, subtotal } = useCart();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const payBar = useRef<HTMLDivElement>(null);
  const formColumn = useStickyColumn(payBar);
  const summaryColumn = useStickyColumn(payBar);
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
  const [pin, setPin] = useState<{
    status: "idle" | "checking" | "ok" | "notfound" | "unavailable";
    label?: string;
  }>({ status: "idle" });

  // Address book (signed-in shoppers): pick a saved address or add a new one.
  const { addresses, loaded: addressesLoaded } = useSavedAddresses(shopper.email);
  const [addressChoice, setAddressChoice] = useState<string | null>(null); // address id or "new"
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressType, setAddressType] = useState<AddressType>("Home");
  const savedChoice = addresses.find((a) => a.id === addressChoice) ?? null;
  // Signed-in shopper whose address book is still loading: don't flash the form.
  const addressesPending =
    shopper.enabled && (!shopper.ready || (Boolean(shopper.email) && !addressesLoaded));

  function pickAddress(a: SavedAddress) {
    setAddressChoice(a.id);
    setForm((f) => ({
      ...f,
      name: a.name,
      phone: a.phone,
      address1: a.address1,
      address2: a.address2 ?? "",
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    }));
    setAddressType(a.label);
    setErrors({});
  }

  function pickNewAddress() {
    setAddressChoice("new");
    // Keep who it's for; clear where it goes.
    setForm((f) => ({ ...f, address1: "", address2: "", city: "", state: "", pincode: "" }));
    // Suggest a type they haven't saved yet (Home → Work → Other).
    const used = new Set(addresses.map((a) => a.label));
    setAddressType(ADDRESS_TYPES.find((t) => !used.has(t)) ?? "Other");
    setErrors({});
  }

  // Signed in with saved addresses → start on the default one.
  useEffect(() => {
    if (addressesLoaded && addresses.length > 0 && addressChoice === null) pickAddress(addresses[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesLoaded, addresses]);

  // Shipping depends on distance: known once the PIN code + state are filled in.
  const settings = useStoreSettings();
  const addressKnown =
    /^[1-9]\d{5}$/.test(form.pincode) && (INDIAN_STATES as readonly string[]).includes(form.state);
  const quote = addressKnown && settings.loaded ? shippingFor(settings, form.pincode, form.state) : null;
  const total = subtotal + (quote?.fee ?? 0);
  const shortBy = belowMinimum(settings, subtotal);
  const gatewayName = PAYMENT_GATEWAY_LABELS[settings.paymentGateway];

  // Signed-in shoppers order with their account email.
  useEffect(() => {
    if (shopper.email) setForm((f) => ({ ...f, email: shopper.email ?? f.email }));
  }, [shopper.email]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_KEY);
      if (raw) {
        const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<FormState>) };
        // Older saved addresses had a free-text state; snap it to the dropdown.
        saved.state = matchIndianState(saved.state) ?? "";
        setForm(saved);
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  // Verify the PIN with India Post and fill in its city + state.
  useEffect(() => {
    const code = form.pincode;
    if (!/^[1-9]\d{5}$/.test(code)) {
      setPin({ status: "idle" });
      return;
    }
    let cancelled = false;
    setPin({ status: "checking" });
    lookupPincode(code).then((result) => {
      if (cancelled) return;
      if (result.status === "ok") {
        setForm((f) => ({ ...f, city: result.city, state: result.state ?? f.state }));
        setErrors((e) => ({ ...e, city: undefined, state: undefined, pincode: undefined }));
        setPin({ status: "ok", label: [result.city, result.state].filter(Boolean).join(", ") });
      } else {
        setPin({ status: result.status });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [form.pincode]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setAuthError(null);
    if (shortBy > 0) {
      setServerError(
        `Minimum order is ${formatINR(settings.minOrder)} — add ${formatINR(shortBy)} more to check out.`
      );
      return;
    }

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
    // Only a PIN India Post doesn't know blocks the order; if the lookup
    // service is down the shopper can still continue.
    const verified = pin.status === "checking" ? await lookupPincode(form.pincode) : pin;
    if (verified.status === "notfound") {
      setErrors((e) => ({ ...e, pincode: "We couldn't find this PIN code — please check it" }));
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
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.qty,
            size: item.size,
          })),
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
      // Order placed: remember the address in the shopper's book (never blocks payment).
      if (shopper.enabled && token && (savedChoice || saveAddress)) {
        const { name, phone, address1, address2, city, state, pincode } = parsed.data;
        const label = savedChoice ? savedChoice.label : addressType;
        await rememberAddress({ label, name, phone, address1, address2, city, state, pincode }).catch(
          () => {}
        );
      }
      // Closing the Razorpay window → the order page offers "Pay now".
      await openPayment(data, (url) => router.push(url), (orderId) => router.push(`/order/${orderId}`));
    } catch (err) {
      setServerError(
        err instanceof Error && /payment window/.test(err.message)
          ? err.message
          : "Could not reach the payment service. Please try again."
      );
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <PageLoader />
    );
  }

  if (items.length === 0 && !submitting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-display text-2xl font-semibold">Your cart is empty</p>
        <p className="text-sm text-fog">Add a few stickers before checking out.</p>
        <Link
          href="/stickers"
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

  const signedIn = Boolean(shopper.email);
  // Long carts: show the first few lines and a clear "show all" — never a hidden scroll.
  const PREVIEW_LINES = 4;
  const hiddenLines = Math.max(items.length - PREVIEW_LINES, 0);
  const visibleItems = showAllItems ? items : items.slice(0, PREVIEW_LINES);
  const steps = shopper.enabled ? (["account", "address", "payment"] as const) : (["address", "payment"] as const);
  const stepNo = (key: (typeof steps)[number]) => steps.indexOf(key as never) + 1;
  const addressDone = Boolean(savedChoice) && !Object.values(errors).some(Boolean);

  const payLabel = (compact: boolean) =>
    needsAccount
      ? `${authMode === "create" ? "Create account" : "Sign in"} & pay${compact ? "" : ` ${formatINR(total)}`}`
      : compact
        ? "Pay securely"
        : `Pay ${formatINR(total)} securely`;

  const payButton = (className: string, compact = false) => (
    <button
      type="submit"
      disabled={submitting || shortBy > 0}
      className={`pie-gradient flex items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 ${className}`}
    >
      {submitting ? (
        <>
          <StickerLoader size={18} variant="onBrand" /> Taking you to payment…
        </>
      ) : (
        <>
          <Lock className="size-4" /> {payLabel(compact)}
        </>
      )}
    </button>
  );

  const notices = (
    <>
      {shortBy > 0 && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-xs text-snow">
          <p>
            Minimum order is <b>{formatINR(settings.minOrder)}</b> — add <b>{formatINR(shortBy)}</b> more to
            check out.
          </p>
          <Link href="/stickers" className="mt-1 inline-block font-semibold text-brand hover:underline">
            Add more stickers →
          </Link>
        </div>
      )}
      {serverError && (
        <p className="rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2.5 text-xs text-brand">{serverError}</p>
      )}
    </>
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-32 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/stickers"
            className="inline-flex items-center gap-1 text-xs font-semibold text-fog transition-colors hover:text-brand"
          >
            <ArrowLeft className="size-3.5" /> Continue shopping
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Checkout</h1>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-[11px] font-semibold text-mint">
          <ShieldCheck className="size-3.5" /> Secure checkout
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-7">
        <div ref={formColumn} className="space-y-4 lg:sticky">
          {/* ── Account ───────────────────────────────────────────────── */}
          {shopper.enabled && (
            <Step n={stepNo("account")} title="Account" done={signedIn}>
              {!shopper.ready ? (
                <p className="flex items-center gap-2 text-xs text-fog">
                  <StickerLoader size={16} /> Checking your account…
                </p>
              ) : signedIn ? (
                <div className="flex items-center gap-3">
                  <span className="pie-gradient grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white uppercase">
                    {shopper.email!.charAt(0)}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{shopper.email}</p>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="shrink-0 text-xs font-semibold text-fog transition-colors hover:text-brand"
                  >
                    Not you?
                  </button>
                </div>
              ) : (
                <>
                  <div role="tablist" className="grid grid-cols-2 rounded-xl border border-line bg-ink p-1 text-sm font-semibold">
                    {(["create", "signin"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={authMode === mode}
                        onClick={() => {
                          setAuthMode(mode);
                          setAuthError(null);
                        }}
                        className={`rounded-lg py-2 transition-colors ${
                          authMode === mode ? "pie-gradient text-white shadow" : "text-fog hover:text-snow"
                        }`}
                      >
                        {mode === "create" ? "I'm new here" : "I have an account"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {field("email", "Email", { type: "email", autoComplete: "email" })}
                    <PasswordField
                      label={authMode === "create" ? "Create a password" : "Password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthError(null);
                      }}
                      autoComplete={authMode === "create" ? "new-password" : "current-password"}
                      hint={authMode === "create" ? "8+ characters — to track your order" : undefined}
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
            </Step>
          )}

          {/* ── Delivery address ──────────────────────────────────────── */}
          <Step
            n={stepNo("address")}
            title={shopper.enabled ? "Delivery address" : "Contact & delivery"}
            done={addressDone}
          >
            {addressesPending && (
              <p className="flex items-center gap-2 text-xs text-fog">
                <StickerLoader size={16} /> Loading your saved addresses…
              </p>
            )}
            {addresses.length > 0 && (
              <div role="radiogroup" aria-label="Saved addresses" className="space-y-2">
                {addresses.map((a) => {
                  const active = addressChoice === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickAddress(a)}
                      className={`flex w-full gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        active
                          ? "border-brand bg-brand/[0.04] ring-1 ring-brand"
                          : "border-line bg-ink hover:border-snow/30"
                      }`}
                    >
                      <Radio active={active} />
                      <span className="min-w-0 flex-1 text-xs leading-relaxed">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-snow">
                          {a.name}
                          <AddressTypeBadge type={a.label} />
                          {a.isDefault && (
                            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand uppercase">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-fog">{addressLine(a)}</span>
                        <span className="block text-fog">
                          {a.state} · {a.phone}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={addressChoice === "new"}
                  onClick={pickNewAddress}
                  className={`flex w-full items-center gap-3 rounded-xl border border-dashed p-3.5 text-left text-sm font-semibold transition-all ${
                    addressChoice === "new"
                      ? "border-brand bg-brand/[0.04] text-brand"
                      : "border-line text-fog hover:border-snow/30 hover:text-snow"
                  }`}
                >
                  <Plus className="size-4" /> Deliver to a new address
                </button>
              </div>
            )}

            <div
              className={`grid grid-cols-2 gap-3 sm:grid-cols-6 ${addresses.length > 0 ? "mt-4" : ""} ${
                savedChoice || addressesPending ? "hidden" : ""
              }`}
            >
              <TextField
                label="Full name"
                autoComplete="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                error={errors.name}
                className="col-span-2 sm:col-span-3"
              />
              {!shopper.enabled && (
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  error={errors.email}
                  className="col-span-2 sm:col-span-3"
                />
              )}
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
                hint="For delivery updates from the courier"
                className={shopper.enabled ? "col-span-2 sm:col-span-3" : "col-span-2 sm:col-span-6"}
              />

              <TextField
                label="PIN code"
                inputMode="numeric"
                autoComplete="postal-code"
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                error={errors.pincode ?? (pin.status === "notfound" ? "PIN code not found" : undefined)}
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
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectField>
              {pin.status === "checking" && (
                <p className="col-span-2 -mt-1 flex items-center gap-1.5 text-xs text-fog sm:col-span-6">
                  <StickerLoader size={16} /> Checking PIN code…
                </p>
              )}
              {pin.status === "ok" && (
                <p className="col-span-2 -mt-1 flex items-center gap-1.5 text-xs font-medium text-mint sm:col-span-6">
                  <CheckCircle2 className="size-3.5" /> PIN verified · {pin.label}
                </p>
              )}
              {pin.status === "unavailable" && (
                <p className="col-span-2 -mt-1 text-xs text-fog sm:col-span-6">
                  Couldn&apos;t verify the PIN right now — please double-check city and state.
                </p>
              )}

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
              {shopper.enabled && (
                <div className="col-span-2 flex flex-wrap items-end justify-between gap-3 sm:col-span-6">
                  {saveAddress && <AddressTypePicker value={addressType} onChange={setAddressType} />}
                  <CheckField
                    label={<span className="text-xs text-fog">Save for next time</span>}
                    checked={saveAddress}
                    onChange={setSaveAddress}
                  />
                </div>
              )}
            </div>
            {savedChoice && Object.values(errors).some(Boolean) && (
              <p className="mt-2 text-xs text-brand">
                This saved address needs an update — choose “Deliver to a new address” and enter it again.
              </p>
            )}

            {quote && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-panel px-3.5 py-2.5 text-xs text-fog">
                <Truck className="size-4 shrink-0 text-brand" />
                <span>
                  Shipping to <b className="text-snow">{form.city || form.state}</b> · {ZONE_LABELS[quote.zone]} ·{" "}
                  <b className="text-snow">{formatINR(quote.fee)}</b>
                </span>
              </p>
            )}
          </Step>

          {/* ── Payment ───────────────────────────────────────────────── */}
          <Step n={stepNo("payment")} title="Payment">
            <div className="flex flex-wrap gap-1.5">
              {["UPI", "Cards", "NetBanking", "Wallets"].map((m) => (
                <span
                  key={m}
                  className="rounded-lg border border-line bg-ink px-2.5 py-1 text-[11px] font-semibold text-snow"
                >
                  {m}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-fog">
              You&apos;ll pay securely with {gatewayName}. Your order is confirmed the moment the payment goes
              through — you&apos;re never charged twice.
            </p>
          </Step>

          <div className="space-y-2 lg:hidden">{notices}</div>
        </div>

        {/* ── Order summary (collapsible on phones) ─────────────────── */}
        <aside ref={summaryColumn} className="order-first rounded-2xl border border-line bg-ink2 lg:sticky lg:order-none">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            aria-expanded={summaryOpen}
            className="flex w-full items-center gap-3 p-4 text-left lg:pointer-events-none lg:px-5 lg:pt-5 lg:pb-0"
          >
            <span className="flex -space-x-2.5 lg:hidden">
              {items.slice(0, 3).map((item) => (
                <span
                  key={lineKey(item)}
                  className="grid size-9 place-items-center rounded-lg bg-panel p-0.5 ring-2 ring-ink2"
                >
                  <img src={item.thumbUrl ?? item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-semibold">Order summary</span>
              <span className="block text-xs text-fog">
                {count} sticker{count === 1 ? "" : "s"}
                {items.length > 1 && <span className="hidden sm:inline"> · {items.length} designs</span>}
              </span>
            </span>
            <span className="text-base font-bold tabular-nums lg:hidden">{formatINR(total)}</span>
            <ChevronDown
              className={`size-4 text-fog transition-transform lg:hidden ${summaryOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div className={`${summaryOpen ? "" : "hidden"} px-4 pb-4 lg:block lg:px-5 lg:pb-5`}>
            <ul className="mt-1 divide-y divide-line/70">
              {visibleItems.map((item) => (
                <li key={lineKey(item)} className="flex gap-3 py-3">
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-panel p-1.5 ring-1 ring-line">
                    <img
                      src={item.thumbUrl ?? item.imageUrl}
                      loading="lazy"
                      decoding="async"
                      alt=""
                      className="sticker-cut-sm max-h-full max-w-full object-contain"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[13px] leading-snug font-semibold">{item.name}</p>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {formatINR(item.price * item.qty)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fog">
                      {item.size && <span className="font-semibold text-snow/80">{item.size}″ · </span>}
                      {formatINR(item.price)} each
                    </p>
                    <CartStepper item={item} size="sm" className="mt-1.5" />
                  </div>
                </li>
              ))}
            </ul>
            {hiddenLines > 0 && (
              <button
                type="button"
                onClick={() => setShowAllItems((v) => !v)}
                aria-expanded={showAllItems}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-ink py-2.5 text-xs font-semibold text-snow transition-colors hover:border-brand/50 hover:text-brand"
              >
                {showAllItems ? "Show less" : `Show all ${items.length} items (+${hiddenLines} more)`}
                <ChevronDown className={`size-3.5 transition-transform ${showAllItems ? "rotate-180" : ""}`} />
              </button>
            )}

            <dl className="mt-2 space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-fog">
                <dt>Subtotal</dt>
                <dd className="text-snow tabular-nums">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3 text-fog">
                <dt>
                  Shipping
                  {quote && <span className="text-xs"> · {ZONE_LABELS[quote.zone]}</span>}
                </dt>
                <dd className={quote ? "text-snow tabular-nums" : "text-xs"}>
                  {quote ? formatINR(quote.fee) : addressKnown ? "Calculating…" : "Add your address"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="text-xl font-bold tabular-nums">{formatINR(total)}</dd>
              </div>
            </dl>

            <div className="mt-4 hidden space-y-2 lg:block">{notices}</div>

            <ul className="mt-4 space-y-1.5 text-[11px] text-fog">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 shrink-0 text-mint" /> Payments secured by {gatewayName}
              </li>
              <li className="flex items-center gap-2">
                <PackageCheck className="size-3.5 shrink-0 text-mint" /> Damaged or wrong sticker? Free replacement
              </li>
              <li className="flex items-center gap-2">
                <Truck className="size-3.5 shrink-0 text-mint" /> Tracking link by email once shipped
              </li>
            </ul>
          </div>
        </aside>

        {/* ── Pay bar, pinned to the bottom on every screen ────────────── */}
        <div ref={payBar} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.25)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-8 lg:gap-6">
            <div className="shrink-0">
              <p className="text-[11px] text-fog">
                {quote ? "Total" : "Total + shipping"}
                <span className="hidden sm:inline">
                  {" "}
                  · {count} sticker{count === 1 ? "" : "s"}
                  {quote ? ` · incl. ${formatINR(quote.fee)} shipping` : ""}
                </span>
              </p>
              <p className="text-lg leading-tight font-bold tabular-nums lg:text-xl">{formatINR(total)}</p>
            </div>
            <p className="hidden min-w-0 flex-1 items-center justify-end gap-1.5 text-[11px] text-fog lg:flex">
              <ShieldCheck className="size-3.5 shrink-0 text-mint" /> UPI · Cards · NetBanking — secured by {gatewayName}
            </p>
            <span className="contents sm:hidden">{payButton("min-w-0 flex-1 py-3 text-sm", true)}</span>
            <span className="hidden sm:contents">{payButton("ml-auto min-w-0 flex-1 py-3 text-sm lg:ml-0 lg:w-[340px] lg:flex-none")}</span>
          </div>
        </div>
      </form>
    </div>
  );
}

const HEADER_OFFSET = 96;

/**
 * Desktop two-column scroll: a column shorter than the screen stays pinned under
 * the header; a taller one scrolls until its end reaches the pay bar, then stops
 * there while the other column keeps scrolling — no blank half-screen.
 */
function useStickyColumn(payBar: React.RefObject<HTMLDivElement | null>) {
  // Callback ref: the columns mount after the first-load spinner.
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const update = () => {
      const bottomGap = (payBar.current?.offsetHeight ?? 0) + 16;
      el.style.top = `${Math.min(HEADER_OFFSET, window.innerHeight - bottomGap - el.offsetHeight)}px`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (payBar.current) observer.observe(payBar.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [el, payBar]);
  return setEl as (node: HTMLElement | null) => void;
}

/** A numbered checkout section; the number turns into a tick when done. */
function Step({
  n,
  title,
  done = false,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line/70 bg-ink2/40 p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-semibold">
        <span
          className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
            done ? "bg-mint text-white" : "bg-snow text-white"
          }`}
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <span
      className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors ${
        active ? "border-brand" : "border-line"
      }`}
    >
      {active && <span className="size-2 rounded-full bg-brand" />}
    </span>
  );
}
