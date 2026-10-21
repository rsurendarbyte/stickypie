import { NextResponse } from "next/server";
import { z } from "zod";
import { getCfOrder } from "@/lib/cashfree";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured, cashfreeEnv } from "@/lib/mode";
import { reconcileOrderPayment } from "@/lib/payments";
import { accountsEnabled, shopperFromRequest } from "@/lib/shopper";

const bodySchema = z.object({ orderId: z.string().uuid() });

/**
 * "Pay now" on an unpaid order: reopens the SAME Cashfree payment session
 * (never a new order, so the shopper can't end up paying twice). Once the
 * session has expired the order is marked failed and they check out again.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const driver = getDriver();
  const order = await driver.getOrder(parsed.data.orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (accountsEnabled() && order.userId) {
    const shopper = await shopperFromRequest(req);
    if (!shopper || shopper.id !== order.userId) {
      return NextResponse.json(
        { error: "Please sign in to pay for this order.", code: "auth_required" },
        { status: 401 }
      );
    }
  }

  if (order.paymentProvider !== "cashfree" || !cashfreeConfigured()) {
    return NextResponse.json({ mode: "simulator", url: `/pay/simulator?order=${order.id}` });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ mode: "paid", url: `/order/${order.id}` });
  }

  try {
    const cf = await getCfOrder(order.id);
    if (cf.order_status === "PAID") {
      await reconcileOrderPayment(order);
      return NextResponse.json({ mode: "paid", url: `/order/${order.id}` });
    }
    if (cf.order_status === "ACTIVE" && cf.payment_session_id) {
      return NextResponse.json({ mode: "cashfree", cfMode: cashfreeEnv(), paymentSessionId: cf.payment_session_id });
    }
    await reconcileOrderPayment(order);
    return NextResponse.json(
      { error: "This payment link has expired — please check out again.", code: "expired" },
      { status: 410 }
    );
  } catch (err) {
    console.error("[pay/retry]", order.id, err);
    return NextResponse.json({ error: "Couldn't reach the payment service. Please try again." }, { status: 502 });
  }
}
