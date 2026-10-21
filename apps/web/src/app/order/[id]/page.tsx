import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, PackageX, XCircle } from "lucide-react";
import { STATUS_LABELS, formatDateTime, formatINR, orderCode } from "@stickypie/shared";
import ClearCartOnPaid from "@/components/clear-cart-on-paid";
import OrderTracking from "@/components/order-tracking";
import PaymentPending from "@/components/payment-pending";
import { reconcileOrderPayment } from "@/lib/payments";
import { getDriver } from "@/lib/data";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your order", robots: PRIVATE_PAGE_ROBOTS };

const PAID_LIKE = new Set(["paid", "packed", "shipped", "delivered"]);

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = getDriver();
  let order = await driver.getOrder(id);
  if (!order) notFound();

  // Buyer just returned from Cashfree (or the page is polling): ask Cashfree.
  if (order.status === "pending" || order.status === "failed") {
    try {
      order = await reconcileOrderPayment(order);
    } catch {
      // Keep the current status — the webhook or the next check settles it.
    }
  }

  const paid = PAID_LIKE.has(order.status);
  const failed = order.status === "failed";
  const cancelled = order.status === "cancelled";
  const pending = order.status === "pending";

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1100px] px-4 pt-28 pb-24 sm:px-8">
      <ClearCartOnPaid orderId={order.id} paid={paid} />

      <div className="text-center">
        {paid && (
          <>
            <CheckCircle2 className="mx-auto size-16 animate-pop text-mint" />
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
              {order.status === "delivered"
                ? "Delivered 🎉"
                : order.status === "shipped"
                  ? "On its way 🚚"
                  : order.status === "packed"
                    ? "Packed & ready to ship"
                    : "Order confirmed! 🎉"}
            </h1>
            <p className="mt-2 text-sm text-fog">
              {order.status === "paid"
                ? `Thanks ${order.customerName.split(" ")[0]} — your stickers are getting packed.`
                : `Thanks ${order.customerName.split(" ")[0]} — follow your order below.`}
            </p>
          </>
        )}
        {pending && <PaymentPending />}
        {failed && (
          <>
            <XCircle className="mx-auto size-16 text-brand" />
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Payment failed</h1>
            <p className="mt-2 text-sm text-fog">
              No money moved — your cart is safe. Give it another shot whenever you&apos;re ready.
            </p>
            <Link
              href="/checkout"
              className="pie-gradient mt-4 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
            >
              Try again
            </Link>
          </>
        )}
        {cancelled && (
          <>
            <PackageX className="mx-auto size-16 text-fog" />
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Order cancelled</h1>
            <p className="mt-2 text-sm text-fog">
              This order was cancelled. If you were charged, the refund is on its way.
            </p>
          </>
        )}
      </div>

      {paid && (
        <section className="mt-10 rounded-2xl border border-line bg-ink2 p-5">
          <h2 className="font-display text-lg font-semibold">Order tracking</h2>
          <div className="mt-4">
            <OrderTracking order={order} />
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">
              Order {orderCode(order.id)}
            </h2>
            <span className="text-xs text-fog">{formatDateTime(order.createdAt)}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => {
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-panel p-1 ring-1 ring-line">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="sticker-cut-sm max-h-full max-w-full object-contain"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate">
                      {item.name} <span className="text-fog">× {item.quantity}</span>
                    </span>
                    {item.sizeInches && (
                      <span className="block text-xs text-fog">Size {item.sizeInches}″</span>
                    )}
                  </span>
                  <span className="text-sm font-medium">
                    {formatINR(item.unitPrice * item.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-fog">
              <span>Subtotal</span>
              <span className="text-snow">{formatINR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-fog">
              <span>Shipping</span>
              <span className={order.shippingFee === 0 ? "font-medium text-mint" : "text-snow"}>
                {order.shippingFee === 0 ? "FREE" : formatINR(order.shippingFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatINR(order.total)}</span>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-ink2 p-5">
            <h2 className="font-display text-lg font-semibold">Delivery</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">
              <span className="font-medium text-snow">{order.customerName}</span>
              <br />
              {order.address1}
              {order.address2 ? (
                <>
                  <br />
                  {order.address2}
                </>
              ) : null}
              <br />
              {order.city}, {order.state} — {order.pincode}
              <br />
              {order.phone}
            </p>
          </section>
          <section className="rounded-2xl border border-line bg-ink2 p-5">
            <h2 className="font-display text-lg font-semibold">Payment</h2>
            <dl className="mt-3 space-y-1.5 text-sm text-fog">
              <div className="flex justify-between">
                <dt>Status</dt>
                <dd className="font-medium text-snow">{STATUS_LABELS[order.status]}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Method</dt>
                <dd className="text-snow">
                  {order.paymentProvider === "cashfree" ? "Cashfree" : "Test simulator"}
                </dd>
              </div>
              {order.cfPaymentId && (
                <div className="flex justify-between gap-3">
                  <dt>Payment ID</dt>
                  <dd className="truncate text-snow">{order.cfPaymentId}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-center gap-6 text-sm">
        {order.userId && (
          <Link href="/account" className="text-brand hover:underline">
            ← My orders
          </Link>
        )}
        <Link href="/browse" className="text-brand hover:underline">
          Continue shopping →
        </Link>
      </div>
    </div>
  );
}
