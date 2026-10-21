import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDateTime, formatINR, orderCode } from "@stickypie/shared";
import OrderActions from "@/components/order-actions";
import StatusBadge from "@/components/status-badge";
import { getAdminDriver } from "@/lib/data";
import { imageSrc } from "@/lib/img";

export const dynamic = "force-dynamic";

export const metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const driver = await getAdminDriver();
  const order = await driver.getOrder(id);
  if (!order) notFound();

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-xs text-fog transition-colors hover:text-snow"
      >
        <ArrowLeft className="size-3.5" /> All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{orderCode(order.id)}</h1>
        <StatusBadge status={order.status} />
        <span className="text-xs text-fog">Placed {formatDateTime(order.createdAt)}</span>
      </div>

      <div className="mt-5">
        <OrderActions order={order} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <h2 className="font-display text-lg font-semibold">Items</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel p-1 ring-1 ring-line">
                  {item.imageUrl && (
                    <img
                      src={imageSrc(item.imageUrl)}
                      alt=""
                      className="sticker-cut-sm max-h-full max-w-full object-contain"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-fog">
                    {formatINR(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatINR(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-fog">
              <span>Subtotal</span>
              <span className="text-snow tabular-nums">{formatINR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-fog">
              <span>Shipping</span>
              <span className="text-snow tabular-nums">
                {order.shippingFee === 0 ? "FREE" : formatINR(order.shippingFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatINR(order.total)}</span>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-ink2 p-5">
            <h2 className="font-display text-lg font-semibold">Customer</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">
              <span className="font-medium text-snow">{order.customerName}</span>
              <br />
              {order.email}
              <br />
              {order.phone}
            </p>
            <p className="mt-4 text-xs font-semibold tracking-wide text-fog uppercase">
              Ship to
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-fog">
              {order.address1}
              {order.address2 ? (
                <>
                  <br />
                  {order.address2}
                </>
              ) : null}
              <br />
              {order.city}, {order.state} — {order.pincode}
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-ink2 p-5">
            <h2 className="font-display text-lg font-semibold">Payment</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-fog">Provider</dt>
                <dd>{order.paymentProvider === "cashfree" ? "Cashfree" : "Simulator (dev)"}</dd>
              </div>
              {order.cfOrderId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fog">CF order</dt>
                  <dd className="truncate">{order.cfOrderId}</dd>
                </div>
              )}
              {order.cfPaymentId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fog">Payment ID</dt>
                  <dd className="truncate">{order.cfPaymentId}</dd>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-fog">Paid at</dt>
                  <dd>{formatDateTime(order.paidAt)}</dd>
                </div>
              )}
              {order.paymentNote && (
                <p className="mt-2 rounded-lg bg-panel px-3 py-2 text-xs text-fog">
                  {order.paymentNote}
                </p>
              )}
            </dl>
          </section>

          {(order.packedAt || order.shippedAt || order.deliveredAt) && (
            <section className="rounded-2xl border border-line bg-ink2 p-5">
              <h2 className="font-display text-lg font-semibold">Fulfilment</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                {(
                  [
                    ["Packed", order.packedAt],
                    ["Shipped", order.shippedAt],
                    ["Delivered", order.deliveredAt],
                  ] as const
                ).map(([label, at]) =>
                  at ? (
                    <div key={label} className="flex justify-between">
                      <dt className="text-fog">{label}</dt>
                      <dd>{formatDateTime(at)}</dd>
                    </div>
                  ) : null
                )}
                {order.courier && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-fog">Courier</dt>
                    <dd className="truncate">
                      {order.courier} · {order.trackingNumber}
                    </dd>
                  </div>
                )}
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-brand hover:underline"
                  >
                    {order.trackingUrl}
                  </a>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
