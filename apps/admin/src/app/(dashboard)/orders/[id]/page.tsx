import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ImageUp } from "lucide-react";
import { formatDateTime, formatINR, needsArtwork, orderCode } from "@stickypie/shared";
import AvatarOrderPrompts from "@/components/avatar-order-prompts";
import { avatarPoseSets } from "@/lib/avatar-prompts";
import FinishedStickers from "@/components/finished-stickers";
import OrderActions from "@/components/order-actions";
import ShiprocketPanel from "@/components/shiprocket-panel";
import { shiprocketConfig } from "@/lib/shiprocket";
import StatusBadge from "@/components/status-badge";
import { getAdminDriver } from "@/lib/data";
import { SpecDetails, SpecDownload, SpecThumb } from "@/components/spec-print-file";
import { imageDownloadHref, imageSrc } from "@/lib/img";

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
  // Avatar lines: each style's pose sets for the AI prompts (only when there are any).
  const avatarStyles = order.items.some((i) => i.customSpec?.kind === "avatar")
    ? (await driver.getSettings()).avatarStyles
    : [];

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
      <ShiprocketPanel order={order} ready={shiprocketConfig() !== null} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <h2 className="font-display text-lg font-semibold">Items</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => {
              // QR / name stickers we draw from their details; avatar packs we draw by hand.
              const drawn = item.customSpec && item.customSpec.kind !== "avatar" ? item.customSpec : null;
              const avatar = item.customSpec?.kind === "avatar" ? item.customSpec : null;
              return (
              <li key={item.id} className="flex flex-wrap items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel p-1 ring-1 ring-line">
                  {drawn ? (
                    <SpecThumb spec={drawn} />
                  ) : (
                    item.isCustom && !item.imageUrl && <ImageUp className="size-6 text-fog" />
                  )}
                  {item.imageUrl && !drawn && (
                    <img
                      src={imageSrc(item.imageUrl)}
                      alt=""
                      className="sticker-cut-sm max-h-full max-w-full object-contain"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {drawn && (
                    <div className="mt-1 space-y-1.5">
                      <SpecDetails spec={drawn} />
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-mint/15 px-1.5 py-0.5 font-semibold text-mint">
                          Made by us — no upload needed
                        </span>
                        <SpecDownload
                          spec={drawn}
                          fileName={`${orderCode(order.id)} ${item.name}${item.sizeInches ? ` ${item.sizeInches}in` : ""} x${item.quantity}`}
                        />
                      </p>
                    </div>
                  )}
                  {avatar && (
                    <div className="mt-1 space-y-0.5 text-xs">
                      <p className="text-fog">{avatar.pages} packs, one style each:</p>
                      <ol className="flex flex-wrap gap-1.5">
                        {avatar.styles.map((style, n) => (
                          <li key={style} className="rounded-full border border-line px-2 py-0.5">
                            <span className="text-fog">#{n + 1}</span> {style}
                          </li>
                        ))}
                      </ol>
                      {avatar.note && (
                        <p>
                          <span className="text-fog">Note:</span> {avatar.note}
                        </p>
                      )}
                      <AvatarOrderPrompts
                        sheets={avatar.styles.map((label) => ({
                          label,
                          poseSets: avatarPoseSets(avatarStyles.find((st) => st.label === label) ?? { label }),
                        }))}
                        note={avatar.note}
                      />
                    </div>
                  )}
                  {needsArtwork(item) && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      {item.customFile ? (
                        <>
                          <span className="rounded-md bg-mint/15 px-1.5 py-0.5 font-semibold text-mint">
                            {avatar ? "Customer photo received" : "Customer artwork received"}
                          </span>
                          <a href={item.imageUrl} target="_blank" rel="noreferrer" className="font-semibold text-snow hover:underline">
                            Open full size
                          </a>
                        </>
                      ) : (
                        <span className="rounded-md bg-gold/15 px-1.5 py-0.5 font-semibold text-gold">
                          {avatar ? "Waiting for customer photo" : "Waiting for customer artwork"}
                        </span>
                      )}
                      <a href={`tel:${order.phone}`} className="font-semibold text-snow hover:underline">
                        Call {order.phone}
                      </a>
                    </p>
                  )}
                  {item.sizeLabel && (
                    <p className="mt-0.5 inline-block rounded-md bg-gold/15 px-1.5 py-0.5 text-xs font-semibold text-gold">
                      Size {item.sizeLabel}
                    </p>
                  )}
                  <p className="text-xs text-fog">
                    {formatINR(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatINR(item.unitPrice * item.quantity)}
                </span>
                {item.imageUrl && !drawn && (
                  <a
                    href={imageDownloadHref(
                      item.imageUrl,
                      item.sizeInches ? `${item.name} ${item.sizeInches}in` : item.name
                    )}
                    download
                    aria-label={`Download ${item.name} image`}
                    title="Download image"
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-fog transition-colors hover:bg-white/10 hover:text-snow"
                  >
                    <Download className="size-4" />
                  </a>
                )}
                {avatar && (
                  <FinishedStickers
                    orderId={order.id}
                    itemId={item.id}
                    pages={avatar.pages}
                    initial={item.finishedFiles}
                  />
                )}
              </li>
              );
            })}
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
            {order.gstAmount != null && order.gstAmount > 0 && (
              <div className="flex justify-between text-fog">
                <span>GST ({order.gstRate}%)</span>
                <span className="text-snow tabular-nums">{formatINR(order.gstAmount)}</span>
              </div>
            )}
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
                <dd>{order.paymentProvider === "cashfree"
                    ? "Cashfree"
                    : order.paymentProvider === "razorpay"
                      ? "Razorpay"
                      : "Simulator (dev)"}</dd>
              </div>
              {order.cfOrderId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fog">Gateway order</dt>
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
