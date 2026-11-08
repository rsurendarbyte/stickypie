import type { Metadata } from "next";
import Link from "@/components/page-link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, FileText, PackageX, ShoppingBag, XCircle } from "lucide-react";
import {
  CUSTOM_UPLOAD_STATUSES,
  STATUS_LABELS,
  formatDateTime,
  formatINR,
  isCustomProductId,
  needsArtwork,
  orderCode,
  sameToken,
  type AvatarStickerSpec,
} from "@stickypie/shared";
import CardFeedback from "@/components/card-feedback";
import AvatarStickersShare from "@/components/avatar-stickers-share";
import ClearCartOnPaid from "@/components/clear-cart-on-paid";
import { MetaPurchase } from "@/components/meta-track";
import CustomOrderUpload from "@/components/custom-order-upload";
import OrderReviews from "@/components/order-reviews";
import OrderTracking from "@/components/order-tracking";
import OrderWallThumb from "@/components/order-wall-thumb";
import OrderSignIn from "@/components/order-sign-in";
import GuestAccountBox from "@/components/guest-account-box";
import GuestOrderLink from "@/components/guest-order-link";
import PaymentPending from "@/components/payment-pending";
import { latestPaymentAttempt, reconcileOrderPayment } from "@/lib/payments";
import { getDriver } from "@/lib/data";
import { orderWallPosters } from "@/lib/poster";
import { guestOrderKey } from "@/lib/guest-order";
import { accountsEnabled, orderViewer } from "@/lib/shopper";
import { PRIVATE_PAGE_ROBOTS, absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your order", robots: PRIVATE_PAGE_ROBOTS };

const PAID_LIKE = new Set(["paid", "packed", "shipped", "delivered"]);

/** "90s Retro, Anime, …" — the sheet styles, in order. */
function avatarSummary(spec: AvatarStickerSpec): string {
  return spec.styles.join(", ");
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fb?: string; k?: string }>;
}) {
  const { id } = await params;
  const { fb, k } = await searchParams;
  const driver = getDriver();
  let order = await driver.getOrder(id);
  if (!order) notFound();

  // Only the signed-in shopper who placed it sees the order. The thank-you
  // card's QR (valid key) opens just the feedback box, nothing else.
  // A guest order: the key in this browser's cookie or in its order link.
  const viewer = await orderViewer(order, k);
  // Admin "View as customer": same page, but nothing that acts as the shopper
  // (no purchase pixel, no clearing this browser's cart).
  const adminView = viewer === "admin";
  if (!viewer) {
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
    if (!(PAID_LIKE.has(order.status) && sameToken(fb, order.feedbackToken))) {
      return <OrderSignIn path={`/order/${order.id}`} code={orderCode(order.id)} guest={!order.userId} />;
    }
    const [first] = await driver.listOrderReviews(order.id);
    return (
      <div className="mx-auto min-h-screen w-full max-w-xl px-4 pt-20 pb-24 sm:pt-24">
        <CardFeedback
          orderId={order.id}
          token={fb!}
          firstName={firstName}
          images={[...new Set(order.items.map((i) => i.imageUrl).filter(Boolean))]}
          initial={first ? { rating: first.rating, body: first.body } : null}
        />
        <p className="text-center text-sm text-fog">
          Want to see your order?{" "}
          {order.userId ? (
            <Link
              href={`/account?next=${encodeURIComponent(`/order/${order.id}`)}`}
              className="font-semibold text-brand hover:underline"
            >
              Sign in
            </Link>
          ) : (
            "Open your order link."
          )}
        </p>
      </div>
    );
  }
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

  // Each line opens its product (a wall with the shopper's picks: its set's page).
  // Custom stickers, and products no longer on sale, have no page to open.
  const productIds = order.items.flatMap((i) => (i.productId && !isCustomProductId(i.productId) ? [i.productId] : []));
  const onSale = await driver.getProductsByIds([...new Set(productIds)]).catch(() => []);
  const products = new Map(onSale.map((p) => [p.id, p]));

  // Paid custom order: the design (or avatar photo) upload is the main thing
  // on this page. (QR / name stickers are drawn by us from their saved details.)
  const needsUpload = needsArtwork;
  // Avatar sticker sheets we've finished making, shown with share buttons.
  const finished = order.items.flatMap((i) => (i.customSpec?.kind === "avatar" ? i.finishedFiles : []));
  // Opened from the thank-you card's QR: rate the order without signing in.
  const fromCard = paid && sameToken(fb, order.feedbackToken);
  let cardDone: { rating: number; body: string | null } | null = null;
  if (fromCard) {
    const [first] = await driver.listOrderReviews(order.id);
    if (first) cardDone = { rating: first.rating, body: first.body };
  }
  // Guest orders carry their key in every link out of this page.
  const guestKey = accountsEnabled() && !order.userId ? guestOrderKey(order.id) : null;
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
      {adminView ? (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-xs font-semibold text-gold">
          <Eye className="size-4 shrink-0" /> Admin preview — this is what {order.customerName.split(" ")[0]} sees.
        </p>
      ) : (
        <>
          <ClearCartOnPaid orderId={order.id} paid={paid} />
          <MetaPurchase
            orderId={order.id}
            paid={paid}
            total={order.total}
            items={order.items.map((i) => ({ id: i.productId ?? i.name, qty: i.quantity, price: i.unitPrice }))}
          />
        </>
      )}

      {guestKey && !adminView && <GuestOrderLink url={`${absoluteUrl(`/order/${order.id}`)}?k=${guestKey}`} />}
      {guestKey && !adminView && paid && (
        <GuestAccountBox orderId={order.id} email={order.email} name={order.customerName} />
      )}

      {fromCard && (
        <CardFeedback
          orderId={order.id}
          token={fb!}
          firstName={order.customerName.trim().split(/\s+/)[0] ?? ""}
          images={[...new Set(order.items.map((i) => i.imageUrl).filter(Boolean))]}
          initial={cardDone}
        />
      )}

      {customUploadStep && (
        <CustomOrderUpload
          orderId={order.id}
          orderUserId={order.userId}
          guest={Boolean(guestKey) && !adminView}
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
              photo: i.customSpec?.kind === "avatar",
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

      {paid && finished.length > 0 && (
        <AvatarStickersShare urls={finished} makeUrl={absoluteUrl("/avatar-stickers")} />
      )}

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
            href={`/order/${order.id}/invoice${guestKey ? `?k=${guestKey}` : ""}`}
            className="inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            <FileText className="size-4" /> Download GST invoice
          </Link>
        </div>
      )}

      {order.status === "delivered" && !fromCard && (
        <OrderReviews orderId={order.id} orderUserId={order.userId} items={order.items} />
      )}

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-ink2 p-5">
          {/* the date drops below the order number on narrow phones, never splitting it */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="font-display text-lg font-semibold whitespace-nowrap">
              Order {orderCode(order.id)}
            </h2>
            <span className="text-xs text-fog">{formatDateTime(order.createdAt)}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => {
              const product = products.get(item.productId ?? "");
              const href = product?.isActive ? `/sticker/${product.slug}` : null;
              const own = (item.packPosters ?? []).filter((p) => p.own);
              const pictures = [...new Set(own.map((p) => p.imageUrl).filter(Boolean))];
              const wall = orderWallPosters(item, product);
              const thumb = wall ? (
                <OrderWallThumb posters={wall} className="size-20 rounded-lg bg-panel ring-1 ring-line" />
              ) : (
                <span className="grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] size-14 shrink-0 place-items-center rounded-lg bg-panel p-1 ring-1 ring-line">
                  {(item.imageUrl || item.isCustom) && (
                    <img loading="lazy" decoding="async"
                      src={item.imageUrl || "/icons/custom-sticker.svg"}
                      alt=""
                      className="sticker-cut-sm size-full object-contain"
                    />
                  )}
                </span>
              );
              const name = (
                <>
                  {item.name} <span className="text-fog">× {item.quantity}</span>
                </>
              );
              return (
                <li key={item.id} className="flex items-center gap-3">
                  {href ? <Link href={href} aria-label={`View ${item.name}`} className="shrink-0 rounded-lg transition-transform hover:scale-105">{thumb}</Link> : thumb}
                  <span className="min-w-0 flex-1 text-sm">
                    {href ? (
                      <Link href={href} className="block truncate underline decoration-line underline-offset-2 hover:text-brand hover:decoration-brand">
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate">{name}</span>
                    )}
                    {own.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {pictures.map((url, n) => (
                          // the shopper's own picture, full size in a new tab
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`See your picture ${n + 1}`}
                            className="block w-11 shrink-0 overflow-hidden rounded ring-1 ring-line transition-transform hover:scale-105"
                          >
                            <img loading="lazy" decoding="async" src={url} alt="" className="block aspect-[2/3] w-full object-cover" />
                          </a>
                        ))}
                        <span className="text-xs text-fog">
                          {pictures.length ? (pictures.length > 1 ? "Your pictures" : "Your picture") : "Your picture was removed after delivery"}
                        </span>
                      </span>
                    )}
                    {item.customSpec?.kind === "avatar" ? (
                      <>
                        <span className="block text-xs text-fog">{item.sizeLabel}</span>
                        <span className="block truncate text-xs text-fog">
                          {avatarSummary(item.customSpec)}
                        </span>
                      </>
                    ) : (
                      item.sizeInches && <span className="block text-xs text-fog">Size {item.sizeInches}″</span>
                    )}
                    {item.isCustom && item.customSpec && item.customSpec.kind !== "avatar" && (
                      <span className="block text-xs text-mint">
                        {item.customSpec.kind === "qr"
                          ? `QR: ${item.customSpec.label || "no label"} · we make it from your details`
                          : `“${item.customSpec.line1}” · we make it from your details`}
                      </span>
                    )}
                    {item.isCustom && needsArtwork(item) && (
                      <span className={`block text-xs ${item.customFile ? "text-mint" : "text-fog"}`}>
                        {item.customSpec?.kind === "avatar"
                          ? item.finishedFiles.length
                            ? "Your stickers are ready ✓"
                            : item.customFile
                              ? "Photo received · your AI stickers are being made"
                              : "Photo not uploaded yet"
                          : item.customFile
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
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-fog">
                <span>Thank-you offer</span>
                <span className="font-medium text-mint">−{formatINR(order.discountAmount)}</span>
              </div>
            )}
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
                  <dt className="shrink-0">Payment ID</dt>
                  <dd className="min-w-0 text-right break-all text-snow">{order.cfPaymentId}</dd>
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
