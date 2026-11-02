import { notFound } from "next/navigation";
import { SHOP_THEME, formatDateTime, formatInches, orderCode, type OrderItem } from "@stickypie/shared";
import { getAdminDriver } from "@/lib/data";
import { imageDownloadHref } from "@/lib/img";
import { Brand, CardStyles, CardToolbar, Posters, StickingTips, firstNameOf, randomPosters, type PosterSpot } from "../../card-kit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sticker card" };

/** One poster beside the logo (the rest of the page is the sticker list). */
const SPOTS: PosterSpot[] = [{ top: 7, right: 14, height: 38, rotate: 7 }];

/** The sticker grid's box on the page (mm). */
const GRID = { top: 84, width: 178, height: 150, gap: 3 };

/** Room under each picture for the name (2 lines) and size. */
const TEXT_MM = 14;

/** Fewest columns (3–8) whose tiles still fit every line; past 8 columns the rest are counted. */
function layout(count: number) {
  for (let cols = 3; cols <= 8; cols++) {
    const w = (GRID.width - GRID.gap * (cols - 1)) / cols;
    const h = w + TEXT_MM;
    const rows = Math.floor((GRID.height + GRID.gap) / (h + GRID.gap));
    if (rows * cols >= count || cols === 8) return { cols, w, h, fits: rows * cols };
  }
  throw new Error("unreachable");
}

function sizeText(item: OrderItem): string | null {
  if (item.customSpec?.kind === "avatar") return null;
  return item.sizeInches ? `${formatInches(item.sizeInches)}″` : null;
}

/**
 * A4 backing card the stickers sit on in the parcel: who it's for, the order
 * number and every sticker in it (to tick off when packing), with tips.
 */
export default async function StickerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await getAdminDriver();
  const order = await driver.getOrder(id);
  if (!order) notFound();

  const posters = await randomPosters(driver, SPOTS.length);
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
  const { cols, w, h, fits } = layout(order.items.length);
  const shown = order.items.length > fits ? order.items.slice(0, fits - 1) : order.items;
  const hidden = order.items.length - shown.length;
  const nameSize = Math.min(3.6, Math.max(2.4, w * 0.105));
  // Fixed-height picture box (tile padding 1.6 mm each side): tall posters shrink to fit, never cover the name.
  const imageBox = w - 4;

  return (
    <>
      <CardStyles />
      <CardToolbar orderId={order.id} fileName={`stickers-${orderCode(order.id)}`} />

      <div className="py-6 print:py-0">
        <div className="card">
          <Posters posters={posters} spots={SPOTS} />
          <Brand />

          {/* Headline */}
          <div className="absolute top-[40mm] right-[50mm] left-[16mm]">
            <h1 className="headline text-[22mm]" style={{ transform: "rotate(-2deg)", transformOrigin: "left" }}>
              Your stickers
            </h1>
            <p className="mt-[4mm] text-[4.4mm] text-neutral-700">
              Packed for <b className="text-neutral-900">{firstNameOf(order.customerName)}</b> · Order{" "}
              <b className="text-neutral-900">{orderCode(order.id)}</b> · {pieces} sticker{pieces === 1 ? "" : "s"},{" "}
              {order.items.length} design{order.items.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Every line of the order */}
          <div
            className="absolute grid"
            style={{
              top: `${GRID.top}mm`,
              left: `${(210 - GRID.width) / 2}mm`,
              width: `${GRID.width}mm`,
              gridTemplateColumns: `repeat(${cols}, ${w}mm)`,
              gridAutoRows: `${h}mm`,
              gap: `${GRID.gap}mm`,
            }}
          >
            {shown.map((item) => {
              const size = sizeText(item);
              return (
                <div
                  key={item.id}
                  className="relative flex flex-col overflow-hidden rounded-[3mm] bg-white p-[1.6mm]"
                  style={{ boxShadow: "0 .6mm 1.6mm rgba(0,0,0,.12)" }}
                >
                  <div
                    className="grid shrink-0 place-items-center overflow-hidden rounded-[2mm] bg-neutral-50 p-[1mm]"
                    style={{ height: `${imageBox}mm` }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={imageDownloadHref(item.imageUrl)}
                        alt=""
                        className="w-full object-contain"
                        style={{ height: `${imageBox - 2}mm`, filter: "drop-shadow(0 .4mm .6mm rgba(0,0,0,.18))" }}
                      />
                    ) : (
                      <span className="font-display text-[4mm] font-bold" style={{ color: SHOP_THEME.brand }}>
                        Custom
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-[1.2mm] line-clamp-2 leading-[1.15] font-semibold text-neutral-800"
                    style={{ fontSize: `${nameSize}mm` }}
                  >
                    {item.name}
                  </p>
                  {(size || item.quantity > 1) && (
                    <p className="text-neutral-500" style={{ fontSize: `${nameSize * 0.9}mm` }}>
                      {[size, item.quantity > 1 ? `× ${item.quantity}` : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {item.quantity > 1 && (
                    <span
                      className="absolute top-[1mm] right-[1mm] grid min-w-[6mm] place-items-center rounded-full px-[1.2mm] text-[3mm] leading-[5.4mm] font-bold text-white"
                      style={{ background: SHOP_THEME.brand }}
                    >
                      ×{item.quantity}
                    </span>
                  )}
                </div>
              );
            })}
            {hidden > 0 && (
              <div className="grid place-items-center rounded-[3mm] border-[.5mm] border-dashed border-orange-300 bg-white/70 text-center">
                <p className="font-display text-[5mm] font-bold" style={{ color: SHOP_THEME.brand }}>
                  +{hidden} more
                </p>
              </div>
            )}
          </div>

          {/* Tips + help */}
          <div className="absolute right-[16mm] bottom-[32mm] left-[18mm] flex items-end gap-[8mm]">
            <div className="min-w-0 flex-1">
              <StickingTips />
            </div>
            <div className="sticker relative w-[78mm] shrink-0 p-[5mm]">
              <p className="font-display text-[5mm] leading-tight font-bold">Something missing or damaged?</p>
              <p className="mt-[1.5mm] text-[3.6mm] leading-snug text-neutral-700">
                Message us at <b>stickypie.in/contact</b> with your order number and we&apos;ll send a free
                replacement.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute right-[16mm] bottom-[14mm] left-[18mm] flex items-end justify-between gap-[4mm] text-[3.4mm] text-neutral-500">
            <p>
              <span className="font-display text-[5.4mm] font-bold" style={{ color: "#1d1a17" }}>
                stickypie.in
              </span>
              <br />
              Show us where they ended up. We love seeing them!
            </p>
            <p className="text-right">
              Order {orderCode(order.id)}
              <br />
              Placed {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
