// Server-side Razorpay client (REST v1, basic auth with the key id + secret).
// Test vs live is decided by the keys themselves (rzp_test_… / rzp_live_…).
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
  if (!res.ok) {
    throw new Error(`Razorpay ${path} failed (${res.status}): ${data.error?.description ?? "unknown error"}`);
  }
  return data as T;
}

export type RzpOrder = {
  id: string;
  amount: number; // paise
  amount_paid: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid" | string;
  created_at: number; // unix seconds
  notes?: Record<string, string>;
};

export type RzpPayment = {
  id: string;
  order_id: string;
  amount: number; // paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed" | string;
  created_at: number;
};

/** A checkout stays payable this long; after that the shopper checks out again. */
export const RZP_ORDER_TTL_MINUTES = 30;

export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

export async function createRzpOrder(params: { orderId: string; amount: number }): Promise<RzpOrder> {
  return call<RzpOrder>("/orders", {
    amount: Math.round(params.amount * 100),
    currency: "INR",
    receipt: params.orderId, // our order UUID (36 chars; Razorpay allows 40)
    notes: { order_id: params.orderId, store: "StickyPie" },
    payment_capture: true,
  });
}

export function getRzpOrder(rzpOrderId: string): Promise<RzpOrder> {
  return call<RzpOrder>(`/orders/${encodeURIComponent(rzpOrderId)}`);
}

/** Payments made against a Razorpay order, newest first. */
export async function getRzpOrderPayments(rzpOrderId: string): Promise<RzpPayment[]> {
  const data = await call<{ items?: RzpPayment[] }>(`/orders/${encodeURIComponent(rzpOrderId)}/payments`);
  return [...(data.items ?? [])].sort((a, b) => b.created_at - a.created_at);
}

/** Captures an authorized payment (only needed if auto-capture is off in the dashboard). */
export function captureRzpPayment(paymentId: string, amountPaise: number): Promise<RzpPayment> {
  return call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount: amountPaise,
    currency: "INR",
  });
}

function safeEqualHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout success callback: HMAC-SHA256(order_id|payment_id, key secret). */
export function verifyRzpPaymentSignature(rzpOrderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${rzpOrderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhooks: HMAC-SHA256(raw body, webhook secret) in X-Razorpay-Signature. */
export function verifyRzpWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
