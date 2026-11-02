import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { SHOP_THEME, feedbackLink, orderCode } from "@stickypie/shared";
import { webUrl } from "@/lib/auth";
import { getAdminDriver } from "@/lib/data";
import { imageDownloadHref } from "@/lib/img";
import PrintButton, { DownloadImageButton } from "./print-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Thank-you card" };

/**
 * Where the decoration mini posters sit (mm from the page edges), their height
 * and tilt. Each spot is an empty patch (beside the logo, right of the sticking
 * tips), so a poster never covers text; posters are at most 0.8 wide per 1 tall.
 */
const SPOTS = [
  { top: 7, right: 14, height: 38, rotate: 7 },
  { bottom: 38, right: 48, height: 40, rotate: -5 },
  { bottom: 38, right: 12, height: 40, rotate: 6 },
] as const;

/** Background patterns (brand-tinted); one is picked at random for each card. */
const PATTERNS = [
  // dots
  { image: "radial-gradient(circle at 1.2mm 1.2mm, rgba(234,88,12,.14) .7mm, transparent .8mm)", size: "9mm 9mm" },
  // grid
  {
    image:
      "linear-gradient(rgba(234,88,12,.08) .35mm, transparent .35mm), linear-gradient(90deg, rgba(234,88,12,.08) .35mm, transparent .35mm)",
    size: "10mm 10mm",
  },
  // diagonal stripes
  { image: "repeating-linear-gradient(45deg, rgba(234,88,12,.06) 0 3mm, transparent 3mm 9mm)", size: "auto" },
  // soft checks
  { image: "conic-gradient(rgba(234,88,12,.06) 25%, transparent 0 50%, rgba(234,88,12,.06) 0 75%, transparent 0)", size: "12mm 12mm" },
  // confetti
  {
    image:
      "radial-gradient(circle at 2mm 3mm, rgba(234,88,12,.18) .8mm, transparent .9mm), radial-gradient(circle at 9mm 8mm, rgba(240,138,85,.2) .6mm, transparent .7mm), radial-gradient(circle at 5mm 12mm, rgba(255,193,7,.25) .7mm, transparent .8mm)",
    size: "14mm 15mm",
  },
] as const;


/**
 * A4 thank-you poster for the parcel: first name, a QR that opens this
 * order's feedback (no sign-in needed), and the next-order offer.
 */
export default async function ThankYouCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await getAdminDriver();
  const order = await driver.getOrder(id);
  if (!order || !order.feedbackToken) notFound();

  const raw = order.customerName.trim().split(/\s+/)[0] ?? "";
  // Long names are cut so the headline stays on one line.
  const firstName = raw ? (raw[0].toUpperCase() + raw.slice(1).toLowerCase()).slice(0, 16) : "friend";
  const link = feedbackLink(webUrl(), order.id, order.feedbackToken);
  const qrSvg = await QRCode.toString(link, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#111318", light: "#ffffff" },
  });
  // A different random set of the shop's mini posters on every card (each picture once).
  // Served through the admin's own image route so "Download image" can capture them.
  const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  const seen = new Set<string>();
  const posters = (await driver.listProducts({ activeOnly: true }))
    .filter((p) => /mini poster/i.test(p.name))
    .map((p) => ({ url: p.thumbUrl ?? p.imageUrl, aspect: p.aspectRatio ?? 0.7, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .filter((p) => p.url && !seen.has(p.url) && Boolean(seen.add(p.url)))
    .slice(0, SPOTS.length)
    .map((p) => ({ src: imageDownloadHref(p.url), aspect: p.aspect }));

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        html, body { background: #e9e4df !important; color: #1d1a17 !important; }
        .card, .card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .card {
          --brand: ${SHOP_THEME.brand}; --brand2: ${SHOP_THEME.brand2}; --soft: ${SHOP_THEME.brandSoft};
          width: 210mm; height: 297mm; position: relative; overflow: hidden; margin: 0 auto;
          background: var(--soft);
          background-image: ${pattern.image};
          background-size: ${pattern.size};
          font-family: var(--font-sans);
        }
        .poster { position: absolute; object-fit: cover; background: #fff; padding: 1.2mm; border-radius: 1.2mm;
          box-shadow: .6mm 1.4mm 2.4mm rgba(0,0,0,.22); }
        .sticker { background: #fff; border-radius: 9mm; box-shadow: 0 0 0 1.6mm #fff, 0 2mm 5mm rgba(0,0,0,.16); }
        .sticker::after { content: ""; position: absolute; inset: 2.5mm; border: .5mm dashed rgba(234,88,12,.35); border-radius: 7mm; pointer-events: none; }
        .headline { font-family: var(--font-display); font-weight: 700; line-height: .9; letter-spacing: -.5mm;
          color: var(--brand); -webkit-text-stroke: 0; text-shadow:
            .9mm .9mm 0 #fff, -.9mm .9mm 0 #fff, .9mm -.9mm 0 #fff, -.9mm -.9mm 0 #fff,
            0 1.3mm 0 #fff, 1.3mm 0 0 #fff, 0 -1.3mm 0 #fff, -1.3mm 0 0 #fff, 1.4mm 2.6mm 0 rgba(0,0,0,.14); }
        .burst { background: linear-gradient(135deg, var(--brand), var(--brand2)); color: #fff; border-radius: 50%;
          box-shadow: 0 0 0 1.4mm #fff, 0 1.5mm 3mm rgba(0,0,0,.2); }
        @media print { .no-print { display: none !important; } html, body { background: #fff !important; } }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-white/90 px-4 py-3 text-sm text-neutral-700 shadow backdrop-blur">
        <Link href={`/orders/${order.id}`} className="font-semibold text-neutral-500 hover:text-neutral-900">
          ← {orderCode(order.id)}
        </Link>
        <span className="hidden sm:inline">A4 · tick &ldquo;Background graphics&rdquo; in the print dialog for the colours.</span>
        <span className="ml-auto flex gap-2">
          <DownloadImageButton fileName={`thank-you-${orderCode(order.id)}`} />
          <PrintButton />
        </span>
      </div>

      <div className="py-6 print:py-0">
        <div className="card">
          {posters.map(({ src, aspect }, i) => {
            const { height, rotate, ...pos } = SPOTS[i];
            const style: React.CSSProperties = {
              width: `${(height * Math.min(Math.max(aspect, 0.45), 0.8)).toFixed(1)}mm`,
              height: `${height}mm`,
              transform: `rotate(${rotate}deg)`,
            };
            for (const [k, v] of Object.entries(pos)) (style as Record<string, string>)[k] = `${v}mm`;
            return <img key={src} src={src} alt="" className="poster" style={style} />;
          })}

          {/* Brand */}
          <div className="absolute top-[14mm] left-[16mm] flex items-center gap-[3mm]">
            <img src="/icons/icon-192.png" alt="" className="size-[15mm] rounded-[3.5mm]" style={{ boxShadow: "0 0 0 1.2mm #fff" }} />
            <div>
              <p className="font-display text-[9mm] leading-none font-bold" style={{ color: "#1d1a17" }}>
                StickyPie
              </p>
              <p className="mt-[1mm] text-[3.3mm] font-semibold tracking-wide text-neutral-500 uppercase">
                Die-cut vinyl stickers
              </p>
            </div>
          </div>

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
            <p className="font-display text-[5.6mm] font-bold" style={{ color: SHOP_THEME.brand }}>
              Sticking tips
            </p>
            <ul className="mt-[2mm] space-y-[1.2mm] text-[3.8mm] text-neutral-700">
              <li>✦ Wipe the spot clean and let it dry first</li>
              <li>✦ Peel the backing slowly from one corner</li>
              <li>✦ Smooth it down from the centre outwards</li>
            </ul>
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
