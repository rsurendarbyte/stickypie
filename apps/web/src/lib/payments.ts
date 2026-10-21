// Server-only: the ONE place an order's payment status is decided.
//
// Every path (shopper returning from Cashfree, the order page polling, the
// webhook) calls reconcileOrderPayment, which asks Cashfree's API for the
// truth instead of trusting the browser or the webhook body:
//   PAID   → amount + currency must match our order, then mark paid
//            (also rescues an order wrongly left "failed")
//   ACTIVE → stays pending; a failed attempt can still be retried in the
//            same Cashfree session, so we never mark failed on it
//   EXPIRED / TERMINATED → failed (only from pending — never a paid order)
// confirm_order_paid locks the row and only moves pending/failed → paid, so
// concurrent calls can't double-confirm or double-decrement stock.
import type { Order } from "@stickypie/shared";
import { getCfOrder, getCfSuccessfulPaymentId } from "./cashfree";
import { getDriver } from "./data";
import { cashfreeConfigured } from "./mode";

export async function reconcileOrderPayment(order: Order): Promise<Order> {
  if (order.paymentProvider !== "cashfree" || !cashfreeConfigured()) return order;
  if (!["pending", "failed", "cancelled"].includes(order.status)) return order;

  const driver = getDriver();
  const cf = await getCfOrder(order.id);

  if (cf.order_status === "PAID") {
    const paidPaise = Math.round(Number(cf.order_amount) * 100);
    if (cf.order_currency !== "INR" || paidPaise !== order.total * 100) {
      console.error(
        `[payments] ${order.id}: Cashfree says PAID ${cf.order_amount} ${cf.order_currency}, order total is ₹${order.total}`
      );
      await driver.setPaymentNote(
        order.id,
        `Payment amount mismatch (Cashfree ${cf.order_amount} ${cf.order_currency}, order ₹${order.total}) — check in Cashfree before shipping`
      );
      return (await driver.getOrder(order.id)) ?? order;
    }
    const paymentId = await getCfSuccessfulPaymentId(order.id);
    if (order.status === "cancelled") {
      // Money arrived for an order an admin already cancelled.
      await driver.setPaymentNote(
        order.id,
        "Paid after the order was cancelled — refund this payment from the Cashfree dashboard",
        paymentId
      );
      return (await driver.getOrder(order.id)) ?? order;
    }
    return driver.markOrderPaid(order.id, {
      paymentId,
      note: order.status === "failed" ? "Confirmed by Cashfree after being marked failed" : "Confirmed by Cashfree",
    });
  }

  if ((cf.order_status === "EXPIRED" || cf.order_status === "TERMINATED") && order.status === "pending") {
    return driver.markOrderFailed(order.id, `Cashfree session ${cf.order_status.toLowerCase()} — no payment`);
  }

  return order;
}
