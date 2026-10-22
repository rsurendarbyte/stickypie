// Server-only environment helpers. The app runs in "demo mode" (local JSON
// store + payment simulator) until Supabase / Cashfree env vars are set.

/** Supabase project URL (accepts the dashboard's NEXT_PUBLIC_ naming too). */
export function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function cashfreeConfigured(): boolean {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export type Gateway = "cashfree" | "razorpay";

/**
 * Gateway for a new checkout: the one picked in admin → Settings if its keys
 * are set here, otherwise whichever one is configured. null = none (dev/demo).
 */
export function checkoutGateway(preferred: Gateway): Gateway | null {
  const ready: Record<Gateway, boolean> = { cashfree: cashfreeConfigured(), razorpay: razorpayConfigured() };
  if (ready[preferred]) return preferred;
  if (ready.razorpay) return "razorpay";
  if (ready.cashfree) return "cashfree";
  return null;
}

/**
 * The fake-payment simulator stands in for a gateway in local/dev only. It
 * must never run on the production site: it would let anyone mark an order paid.
 */
export function paymentSimulatorAllowed(): boolean {
  return !cashfreeConfigured() && !razorpayConfigured() && process.env.SITE_ENV !== "production";
}

export function cashfreeEnv(): "sandbox" | "production" {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
