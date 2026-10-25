import type { Metadata } from "next";
import Link from "@/components/page-link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, PackageX, ShoppingBag, XCircle } from "lucide-react";
import { CUSTOM_UPLOAD_STATUSES, STATUS_LABELS, formatDateTime, formatINR, orderCode } from "@stickypie/shared";
import ClearCartOnPaid from "@/components/clear-cart-on-paid";
import CustomOrderUpload from "@/components/custom-order-upload";
import OrderReviews from "@/components/order-reviews";
import OrderTracking from "@/components/order-tracking";
import PaymentPending from "@/components/payment-pending";
import { latestPaymentAttempt, reconcileOrderPayment } from "@/lib/payments";
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
  const settings = await driver.getSettings();

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

  // Still unpaid: is a payment actually in progress, or did the shopper close
  // the payment window / fail an attempt? Then they get "Pay now", not a spinner.
  let lastAttempt: string | null = null;
  let awaitingShopper = false;
  if (pending && order.paymentProvider !== "simulator") {
    try {
      lastAttempt = await latestPaymentAttempt(order);
      awaitingShopper = lastAttempt !== "PENDING" && lastAttempt !== "SUCCESS";
    } catch {
      // Unknown → keep checking.
    }
  }

  // Paid custom order: the design upload is the main thing on this page.
  // (QR / name stickers are drawn by us from their saved details — no upload.)
  const needsUpload = (i: (typeof order.items)[number]) => i.isCustom && !i.customSpec;
  const customUploadStep =
    order.items.some(needsUpload) &&
    (CUSTOM_UPLOAD_STATUSES as readonly string[]).includes(order.status);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1100px] px-4 pt-20 pb-24 sm:px-8 sm:pt-24">
      {/* Way out, always at the top */}
      <div className="mb-6 flex items-center gap-2">
        {order.userId && (
          <Link
            href="/account"
            className="peel-btn peel-btn--light inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold"
          >
            <ArrowLeft className="size-4" /> My orders
          </Link>
        )}
        <span className="hidden text-xs font-semibold text-fog sm:inline">{orderCode(order.id)}</span>
        <Link
          href="/stickers"
          className="peel-btn ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold"
        >
          <ShoppingBag className="peel-icon size-4" /> Shop more
        </Link>
      </div>
      <ClearCartOnPaid orderId={order.id} paid={paid} />

      {customUploadStep && (
        <CustomOrderUpload
          orderId={order.id}
          orderUserId={order.userId}
          firstName={order.customerName.split(" ")[0]}
          items={order.items
            .filter(needsUpload)
            .map((i) => ({
              id: i.id,
              name: i.name,
              customRef: i.customRef,
              hasFile: Boolean(i.customFile),
              imageUrl: i.imageUrl,
              sizeInches: i.sizeInches,
              quantity: i.quantity,
            }))}
        />
      )}

      <div className="text-center">
        {paid && !customUploadStep && (
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
        {pending && (
          <PaymentPending
            orderId={order.id}
            total={order.total}
            awaitingShopper={awaitingShopper}
            lastAttempt={lastAttempt}
          />
        )}
        {failed && (
          <>
            <XCircle className="mx-auto size-16 text-brand" />
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Payment failed</h1>
            <p className="mt-2 text-sm text-fog">
              No money moved — your cart is safe. Give it another shot whenever you&apos;re ready.
            </p>
            <Link
              href="/checkout"
              className="peel-btn peel-btn--brand mt-4 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold"
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

      {order.status === "delivered" && order.invoiceNumber && settings.business.gstin && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink2 p-4">
          <p className="text-sm">
            <span className="font-semibold">GST invoice</span>{" "}
            <span className="text-fog">· {order.invoiceNumber}</span>
          </p>
          <Link
            href={`/order/${order.id}/invoice`}
            className="inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            <FileText className="size-4" /> Download GST invoice
          </Link>
        </div>
      )}

      {order.status === "delivered" && (
        <OrderReviews orderId={order.id} orderUserId={order.userId} items={order.items} />
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
                  <span className="grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] size-12 shrink-0 place-items-center rounded-lg bg-panel p-1 ring-1 ring-line">
                    {(item.imageUrl || item.isCustom) && (
                      <img
                        src={item.imageUrl || "/icons/custom-sticker.svg"}
                        alt=""
                        className="sticker-cut-sm size-full object-contain"
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
                    {item.isCustom && item.customSpec && (
                      <span className="block text-xs text-mint">
                        {item.customSpec.kind === "qr"
                          ? `QR: ${item.customSpec.label || "no label"} · we make it from your details`
                          : `“${item.customSpec.line1}” · we make it from your details`}
                      </span>
                    )}
                    {item.isCustom && !item.customSpec && (
                      <span className={`block text-xs ${item.customFile ? "text-mint" : "text-fog"}`}>
                        {item.customFile
                          ? order.status === "paid"
                            ? "Design received"
                            : "Design received · locked for printing"
                          : "Design not uploaded yet"}
                      </span>
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
            {order.gstAmount != null && order.gstAmount > 0 && (
              <div className="flex justify-between text-fog">
                <span>GST ({order.gstRate}%)</span>
                <span className="text-snow">{formatINR(order.gstAmount)}</span>
              </div>
            )}
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
                  {order.paymentProvider === "cashfree"
                    ? "Cashfree"
                    : order.paymentProvider === "razorpay"
                      ? "Razorpay"
                      : "Test simulator"}
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

      <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-2.5">
        {order.userId ? (
          <Link
            href="/account"
            className="peel-btn peel-btn--light inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold"
          >
            <ArrowLeft className="size-4" /> My orders
          </Link>
        ) : null}
        <Link
          href="/stickers"
          className={`peel-btn inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${
            order.userId ? "" : "col-span-2"
          }`}
        >
          <ShoppingBag className="peel-icon size-4" /> Continue shopping
        </Link>
      </div>
    </div>
  );
}
