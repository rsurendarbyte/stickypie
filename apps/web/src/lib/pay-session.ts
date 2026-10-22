// Server-only: what the browser needs to open payment for an order, on the
// order's own gateway. Used by checkout (new order / same cart again) and by
// "Pay now" on an unpaid order — both always reuse the SAME gateway order, so
// a shopper can never end up with two payable orders for one cart.
import type { Order } from "@stickypie/shared";
import { CF_ORDER_TTL_MINUTES, createCfOrder, getCfOrder } from "./cashfree";
import { getDriver } from "./data";
import { cashfreeEnv, siteUrl } from "./mode";
import { reconcileOrderPayment } from "./payments";
import { RZP_ORDER_TTL_MINUTES, createRzpOrder, getRzpOrder, razorpayKeyId } from "./razorpay";

export type PaySession =
  | { mode: "cashfree"; cfMode: "sandbox" | "production"; paymentSessionId: string }
  | {
      mode: "razorpay";
      keyId: string;
      rzpOrderId: string;
      orderId: string;
      amount: number; // paise
      prefill: { name: string; email: string; contact: string };
      /** Seconds the payment window may stay open. */
      timeout: number;
    }
  | { mode: "paid"; url: string };

function razorpaySession(order: Order, rzpOrderId: string): PaySession | null {
  const ageSeconds = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
  const left = Math.floor(RZP_ORDER_TTL_MINUTES * 60 - ageSeconds);
  if (left < 60) return null; // too late — check out again
  return {
    mode: "razorpay",
    keyId: razorpayKeyId(),
    rzpOrderId,
    orderId: order.id,
    amount: order.total * 100,
    prefill: { name: order.customerName, email: order.email, contact: `+91${order.phone}` },
    timeout: left,
  };
}

/** Creates the gateway order for a brand-new order of ours. */
export async function openNewPayment(order: Order): Promise<PaySession> {
  const driver = getDriver();
  if (order.paymentProvider === "razorpay") {
    const rzp = await createRzpOrder({ orderId: order.id, amount: order.total });
    await driver.setCfOrderId(order.id, rzp.id);
    return razorpaySession({ ...order, cfOrderId: rzp.id }, rzp.id)!;
  }
  const cf = await createCfOrder({
    orderId: order.id,
    amount: order.total,
    customer: { name: order.customerName, email: order.email, phone: order.phone },
    returnUrl: `${siteUrl()}/order/${order.id}`,
    notifyUrl: `${siteUrl()}/api/webhooks/cashfree`,
  });
  await driver.setCfOrderId(order.id, String(cf.cf_order_id ?? order.id));
  if (!cf.payment_session_id) throw new Error("Cashfree did not return a payment session");
  return { mode: "cashfree", cfMode: cashfreeEnv(), paymentSessionId: cf.payment_session_id };
}

/**
 * Reopens payment for an unpaid order. Returns "paid" if the money already
 * arrived, or null once the payment window has closed (shopper checks out again).
 */
export async function reopenPayment(order: Order): Promise<PaySession | null> {
  if (order.paymentProvider === "razorpay") {
    if (!order.cfOrderId) return null;
    const rzp = await getRzpOrder(order.cfOrderId);
    if (rzp.status === "paid") {
      await reconcileOrderPayment(order);
      return { mode: "paid", url: `/order/${order.id}` };
    }
    const session = razorpaySession(order, rzp.id);
    if (!session) await reconcileOrderPayment(order);
    return session;
  }
  const cf = await getCfOrder(order.id);
  if (cf.order_status === "PAID") {
    await reconcileOrderPayment(order);
    return { mode: "paid", url: `/order/${order.id}` };
  }
  if (cf.order_status === "ACTIVE" && cf.payment_session_id) {
    return { mode: "cashfree", cfMode: cashfreeEnv(), paymentSessionId: cf.payment_session_id };
  }
  await reconcileOrderPayment(order);
  return null;
}

/** How far back "same cart again" may reuse an earlier unpaid order. */
export function reuseWindowStart(provider: Order["paymentProvider"]): string {
  const ttl = provider === "razorpay" ? RZP_ORDER_TTL_MINUTES : CF_ORDER_TTL_MINUTES;
  return new Date(Date.now() - (ttl - 5) * 60_000).toISOString();
}
