import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { SHOP_THEME, feedbackLink, orderCode } from "@stickypie/shared";
import { webUrl } from "@/lib/auth";
import { getAdminDriver } from "@/lib/data";
import { Brand, CardStyles, CardToolbar, Posters, StickingTips, firstNameOf, randomPosters, type PosterSpot } from "../../card-kit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Thank-you card" };

/** Empty patches (beside the logo, right of the sticking tips), so a poster never covers text. */
const SPOTS: PosterSpot[] = [
  { top: 7, right: 14, height: 38, rotate: 7 },
  { bottom: 38, right: 48, height: 40, rotate: -5 },
  { bottom: 38, right: 12, height: 40, rotate: 6 },
];

/**
 * A4 thank-you poster for the parcel: first name, a QR that opens this
 * order's feedback (no sign-in needed), and the next-order offer.
 */
export default async function ThankYouCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await getAdminDriver();
  const order = await driver.getOrder(id);
  if (!order || !order.feedbackToken) notFound();

  const firstName = firstNameOf(order.customerName);
  const link = feedbackLink(webUrl(), order.id, order.feedbackToken);
  const qrSvg = await QRCode.toString(link, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#111318", light: "#ffffff" },
  });
  const posters = await randomPosters(driver, SPOTS.length);

  return (
    <>
      <CardStyles />
      <CardToolbar orderId={order.id} fileName={`thank-you-${orderCode(order.id)}`} />

      <div className="py-6 print:py-0">
        <div className="card">
          <Posters posters={posters} spots={SPOTS} />
          <Brand />

          {/* Headline */}
          <div className="absolute top-[44mm] right-[16mm] left-[16mm]">
            <h1 className="headline text-[31mm]" style={{ transform: "rotate(-3deg)", transformOrigin: "left" }}>
              Thank you
            </h1>
            <p
              className="font-display mt-[4mm] text-[13mm] leading-none font-bold"
              style={{ color: "#1d1a17", transform: "rotate(-3deg)", transformOrigin: "left" }}
            >
              for ordering, {firstName}!
            </p>
            <p className="mt-[9mm] max-w-[140mm] text-[4.6mm] leading-[1.45] text-neutral-700">
              Every sticker in this parcel was printed, cut and packed just for you. We hope they find awesome
              spots to live: laptops, bottles, helmets, notebooks, anywhere you like.
            </p>
          </div>

          {/* QR + offer */}
          <div
            className="sticker absolute top-[124mm] right-[18mm] left-[18mm] flex items-center gap-[8mm] p-[8mm]"
            style={{ transform: "rotate(1.2deg)" }}
          >
            <div className="shrink-0 text-center">
              <div className="size-[60mm]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-[2.5mm] text-[3.2mm] font-semibold text-neutral-500">Point your phone camera here</p>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="burst absolute -top-[12mm] -right-[7mm] grid size-[30mm] place-items-center text-center"
                style={{ transform: "rotate(-10deg)" }}
              >
                <div>
                  <p className="text-[3.4mm] font-bold tracking-wide uppercase">Thank-you</p>
                  <p className="font-display text-[7.4mm] leading-none font-bold">Offer</p>
                </div>
              </div>
              <p className="font-display pr-[14mm] text-[7.6mm] leading-[1.1] font-bold" style={{ color: "#1d1a17" }}>
                Scan, tell us how we did, and get an offer on your next order
              </p>
              <ol className="mt-[4mm] space-y-[1.6mm] text-[3.9mm] text-neutral-700">
                {["Scan the code", "Rate your stickers (takes 20 seconds)", "Your offer comes off your next order"].map(
                  (step, i) => (
                    <li key={step} className="flex items-center gap-[2.5mm]">
                      <span
                        className="grid size-[6mm] shrink-0 place-items-center rounded-full text-[3.4mm] font-bold text-white"
                        style={{ background: SHOP_THEME.brand }}
                      >
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  )
                )}
              </ol>
            </div>
          </div>

          {/* Sticker tips */}
          <div className="absolute right-[96mm] bottom-[42mm] left-[18mm]">
            <StickingTips items={order.items} />
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
              Offer appears in your StickyPie account after we read your feedback · one order
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
