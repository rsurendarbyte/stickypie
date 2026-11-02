import Link from "next/link";
import { REWARD_VALID_DAYS, formatDateTime, orderCode, type Coupon } from "@stickypie/shared";
import { DefaultPercentForm, WaitingList, type WaitingFeedback } from "@/components/offers-manager";
import OfferEditor from "@/components/offer-editor";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offers" };

function stateOf(c: Coupon, now: number) {
  if (c.disabled && c.percent === 0) return { label: "No offer", cls: "bg-panel text-fog" };
  if (c.usedOrderId) return { label: "Used", cls: "bg-mint/10 text-mint" };
  if (c.disabled) return { label: "Off", cls: "bg-panel text-fog" };
  if (Date.parse(c.expiresAt) < now) return { label: "Expired", cls: "bg-panel text-fog" };
  return { label: "Waiting for next order", cls: "bg-brand/10 text-brand" };
}

export default async function OffersPage() {
  const driver = await getAdminDriver();
  const [settings, coupons, reviews] = await Promise.all([
    driver.getSettings(),
    driver.listCoupons(),
    driver.listReviews(),
  ]);
  // One entry per order that has feedback but no decision yet (newest first).
  const decided = new Set(coupons.map((c) => c.sourceOrderId));
  const firstPerOrder = reviews.filter(
    (r, i) => !decided.has(r.orderId) && reviews.findIndex((x) => x.orderId === r.orderId) === i
  );
  const waiting: WaitingFeedback[] = (
    await Promise.all(
      firstPerOrder.slice(0, 40).map(async (r) => {
        const order = await driver.getOrder(r.orderId);
        return order
          ? {
              orderId: order.id,
              orderCode: orderCode(order.id),
              customerName: order.customerName,
              email: order.email,
              rating: r.rating,
              body: r.body,
              createdAt: r.createdAt,
            }
          : null;
      })
    )
  ).filter((x): x is WaitingFeedback => x !== null);
  const now = Date.now();

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Offers</h1>
      <p className="mt-1 text-sm text-fog">
        Customers scan the thank-you card in their parcel and rate their order. Read the feedback, then give an
        offer. It shows on their account and comes off their next order by itself, once, within {REWARD_VALID_DAYS}{" "}
        days. They see nothing until you give it. You can change or switch off an offer any time until it&apos;s used.
      </p>

      <div className="mt-5">
        <DefaultPercentForm initial={settings.thanksPercent} />
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">Feedback waiting ({waiting.length})</h2>
      <div className="mt-3">
        <WaitingList items={waiting} defaultPercent={settings.thanksPercent} />
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">Given</h2>
      {coupons.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-ink2 p-5 text-center text-sm text-fog">Nothing yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {coupons.map((c) => {
            const state = stateOf(c, now);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-ink2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold">
                    {c.percent > 0 ? `${c.percent}% off` : "No offer"}{" "}
                    <span className="text-xs font-semibold tracking-wide text-fog">{c.code}</span>
                  </p>
                  <p className="truncate text-xs text-fog">
                    {c.email} · feedback on{" "}
                    <Link href={`/orders/${c.sourceOrderId}`} className="text-snow hover:text-brand">
                      {orderCode(c.sourceOrderId)}
                    </Link>
                    {c.usedOrderId && (
                      <>
                        {" "}· used on{" "}
                        <Link href={`/orders/${c.usedOrderId}`} className="text-snow hover:text-brand">
                          {orderCode(c.usedOrderId)}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-fog">
                    {formatDateTime(c.createdAt)}
                    {c.percent > 0 && <> · until {formatDateTime(c.expiresAt)}</>}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${state.cls}`}>{state.label}</span>
                {!c.usedOrderId && (
                  <OfferEditor
                    id={c.id}
                    percent={c.percent}
                    disabled={c.disabled}
                    defaultPercent={settings.thanksPercent}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
