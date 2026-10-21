// Server-side Cashfree Payment Gateway client (REST, API version 2023-08-01).
// Sandbox vs production is selected with CASHFREE_ENV.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cashfreeEnv } from "./mode";

const API_VERSION = "2023-08-01";

function baseUrl(): string {
  return cashfreeEnv() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": process.env.CASHFREE_APP_ID ?? "",
    "x-client-secret": process.env.CASHFREE_SECRET_KEY ?? "",
  };
}

export type CfOrder = {
  cf_order_id?: string | number;
  order_id: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | string;
  order_amount?: number | string;
  order_currency?: string;
  payment_session_id?: string;
};

/** A Cashfree payment session stays payable for this long, then expires. */
export const CF_ORDER_TTL_MINUTES = 30;

export async function createCfOrder(params: {
  orderId: string;
  amount: number;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
  notifyUrl?: string;
}): Promise<CfOrder> {
  const body: Record<string, unknown> = {
    order_id: params.orderId,
    order_amount: params.amount,
    order_currency: "INR",
    customer_details: {
      customer_id: `cust_${params.orderId.replace(/-/g, "").slice(0, 20)}`,
      customer_name: params.customer.name,
      customer_email: params.customer.email,
      customer_phone: params.customer.phone,
    },
    order_meta: {
      return_url: params.returnUrl,
      // Cashfree requires https for webhooks; skip on plain-http dev hosts.
      ...(params.notifyUrl?.startsWith("https://") ? { notify_url: params.notifyUrl } : {}),
    },
    order_note: "StickyPie sticker order",
    // Stale checkout tabs can't be paid later (which could double-charge a
    // shopper who already re-ordered); the order then shows as failed.
    order_expiry_time: new Date(Date.now() + CF_ORDER_TTL_MINUTES * 60_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "+00:00"),
  };
  const res = await fetch(`${baseUrl()}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Cashfree order creation failed (${res.status}): ${data?.message ?? "unknown error"}`
    );
  }
  return data as CfOrder;
}

export async function getCfOrder(orderId: string): Promise<CfOrder> {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}`, {
    headers: headers(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Cashfree order lookup failed (${res.status}): ${data?.message ?? "unknown error"}`
    );
  }
  return data as CfOrder;
}

/** The successful payment's id for an order, if Cashfree has one. */
export async function getCfSuccessfulPaymentId(orderId: string): Promise<string | null> {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payments = (await res.json().catch(() => [])) as Array<{
    payment_status?: string;
    cf_payment_id?: string | number;
  }>;
  const success = Array.isArray(payments)
    ? payments.find((p) => p.payment_status === "SUCCESS")
    : undefined;
  return success?.cf_payment_id !== undefined ? String(success.cf_payment_id) : null;
}

/**
 * Status of the shopper's latest payment attempt on an order — SUCCESS,
 * PENDING (bank still processing), FAILED, USER_DROPPED… — or null if they
 * never tried (closed the payment page straight away).
 */
export async function getCfLatestPaymentStatus(orderId: string): Promise<string | null> {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cashfree payments lookup failed (${res.status})`);
  const payments = (await res.json().catch(() => [])) as Array<{
    payment_status?: string;
    payment_time?: string;
  }>;
  if (!Array.isArray(payments) || payments.length === 0) return null;
  const latest = [...payments].sort(
    (a, b) => new Date(b.payment_time ?? 0).getTime() - new Date(a.payment_time ?? 0).getTime()
  )[0];
  return latest.payment_status ?? null;
}

/** Verify a Cashfree webhook: base64(HMAC-SHA256(timestamp + rawBody, secret)). */
export function verifyCfWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret || !signature || !timestamp) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
