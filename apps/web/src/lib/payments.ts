// Server-only: the ONE place an order's payment status is decided.
//
// Every path (shopper returning from the gateway, the order page polling,
// webhooks) calls reconcileOrderPayment, which asks the order's gateway API
// (Cashfree or Razorpay) for the truth instead of trusting the browser or the
// webhook body:
//   paid     → amount + currency must match our order, then mark paid
//              (also rescues an order wrongly left "failed")
//   open     → stays pending; a failed attempt can still be retried
//   expired  → failed (only from pending — never a paid order)
// confirm_order_paid locks the row and only moves pending/failed → paid, so
// concurrent calls can't double-confirm or double-decrement stock.
import type { Order } from "@stickypie/shared";
import { getCfLatestPaymentStatus, getCfOrder, getCfSuccessfulPaymentId } from "./cashfree";
import { getDriver } from "./data";
import { cashfreeConfigured, razorpayConfigured } from "./mode";
import {
  RZP_ORDER_TTL_MINUTES,
  captureRzpPayment,
  getRzpOrderPayments,
  type RzpPayment,
} from "./razorpay";

const LABEL = { cashfree: "Cashfree", razorpay: "Razorpay" } as const;

export async function reconcileOrderPayment(order: Order): Promise<Order> {
  if (!["pending", "failed", "cancelled"].includes(order.status)) return order;
  if (order.paymentProvider === "cashfree" && cashfreeConfigured()) return reconcileCashfree(order);
  if (order.paymentProvider === "razorpay" && razorpayConfigured()) return reconcileRazorpay(order);
  return order;
}

/** Money arrived: check it, then mark the order paid (or flag it for a human). */
async function settlePaid(
  order: Order,
  gateway: keyof typeof LABEL,
  paid: { amountPaise: number; currency: string | undefined; paymentId: string | null }
): Promise<Order> {
  const driver = getDriver();
  const label = LABEL[gateway];
  if (paid.currency !== "INR" || paid.amountPaise !== order.total * 100) {
    console.error(
      `[payments] ${order.id}: ${label} says paid ${paid.amountPaise / 100} ${paid.currency}, order total is ₹${order.total}`
    );
    await driver.setPaymentNote(
      order.id,
      `Payment amount mismatch (${label} ${paid.amountPaise / 100} ${paid.currency}, order ₹${order.total}) — check in ${label} before shipping`
    );
    return (await driver.getOrder(order.id)) ?? order;
  }
  if (order.status === "cancelled") {
    // Money arrived for an order an admin already cancelled.
    await driver.setPaymentNote(
      order.id,
      `Paid after the order was cancelled — refund this payment from the ${label} dashboard`,
      paid.paymentId
    );
    return (await driver.getOrder(order.id)) ?? order;
  }
  return driver.markOrderPaid(order.id, {
    paymentId: paid.paymentId,
    note: order.status === "failed" ? `Confirmed by ${label} after being marked failed` : `Confirmed by ${label}`,
  });
}

async function reconcileCashfree(order: Order): Promise<Order> {
  const cf = await getCfOrder(order.id);
  if (cf.order_status === "PAID") {
    return settlePaid(order, "cashfree", {
      amountPaise: Math.round(Number(cf.order_amount) * 100),
      currency: cf.order_currency,
      paymentId: await getCfSuccessfulPaymentId(order.id),
    });
  }
  if ((cf.order_status === "EXPIRED" || cf.order_status === "TERMINATED") && order.status === "pending") {
    return getDriver().markOrderFailed(order.id, `Cashfree session ${cf.order_status.toLowerCase()} — no payment`);
  }
  return order;
}

async function reconcileRazorpay(order: Order): Promise<Order> {
  if (!order.cfOrderId) return order; // gateway order was never created
  const payments = await getRzpOrderPayments(order.cfOrderId);
  let captured: RzpPayment | undefined = payments.find((p) => p.status === "captured");

  // Auto-capture off in the dashboard → capture an authorized payment that matches.
  if (!captured) {
    const authorized = payments.find((p) => p.status === "authorized");
    if (authorized && authorized.amount === order.total * 100 && authorized.currency === "INR") {
      try {
        captured = await captureRzpPayment(authorized.id, authorized.amount);
      } catch (err) {
        console.error("[payments] capture failed", order.id, err);
      }
    }
  }

  if (captured) {
    return settlePaid(order, "razorpay", {
      amountPaise: captured.amount,
      currency: captured.currency,
      paymentId: captured.id,
    });
  }

  // Razorpay orders never expire, so we close abandoned checkouts ourselves
  // (unless a payment is still in progress at the bank).
  const inProgress = payments.some((p) => p.status === "created" || p.status === "authorized");
  const ageMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60_000;
  if (order.status === "pending" && !inProgress && ageMinutes > RZP_ORDER_TTL_MINUTES + 5) {
    return getDriver().markOrderFailed(order.id, "Razorpay checkout not completed in time — no payment");
  }
  return order;
}

/**
 * The shopper's latest payment attempt, normalised across gateways:
 * "SUCCESS" | "PENDING" (bank still processing) | "FAILED" | null (never tried).
 */
export async function latestPaymentAttempt(order: Order): Promise<string | null> {
  if (order.paymentProvider === "cashfree" && cashfreeConfigured()) {
    const status = await getCfLatestPaymentStatus(order.id);
    return status === "SUCCESS" || status === "PENDING" || status === "FAILED" ? status : status ? "FAILED" : null;
  }
  if (order.paymentProvider === "razorpay" && razorpayConfigured() && order.cfOrderId) {
    const [latest] = await getRzpOrderPayments(order.cfOrderId);
    if (!latest) return null;
    if (latest.status === "captured") return "SUCCESS";
    if (latest.status === "authorized" || latest.status === "created") return "PENDING";
    return "FAILED";
  }
  return null;
}
