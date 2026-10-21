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
  payment_session_id?: string;
};

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

/** Verify a Cashfree webhook: base64(HMAC-SHA256(timestamp + rawBody, secret)). */
export function verifyCfWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret || !signature || !timestamp) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
