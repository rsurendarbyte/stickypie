// Shared look for the A4 parcel cards (thank-you card, sticker backing card):
// page styles, a random background pattern, random mini posters, toolbar,
// brand header and sticking tips.
import Link from "next/link";
import { SHOP_THEME, isPosterItem, orderCode, type DataDriver, type OrderItem } from "@stickypie/shared";
import { imageDownloadHref } from "@/lib/img";
import PrintButton, { DownloadImageButton } from "./print-buttons";

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

/** Page + card styles, with a random background pattern. */
export function CardStyles() {
  const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  return (
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
        color: var(--brand); text-shadow:
          .9mm .9mm 0 #fff, -.9mm .9mm 0 #fff, .9mm -.9mm 0 #fff, -.9mm -.9mm 0 #fff,
          0 1.3mm 0 #fff, 1.3mm 0 0 #fff, 0 -1.3mm 0 #fff, -1.3mm 0 0 #fff, 1.4mm 2.6mm 0 rgba(0,0,0,.14); }
      .burst { background: linear-gradient(135deg, var(--brand), var(--brand2)); color: #fff; border-radius: 50%;
        box-shadow: 0 0 0 1.4mm #fff, 0 1.5mm 3mm rgba(0,0,0,.2); }
      @media print { .no-print { display: none !important; } html, body { background: #fff !important; } }
    `}</style>
  );
}

/** Sticky bar above the card: back to the order, Download image, Print. */
export function CardToolbar({ orderId, fileName }: { orderId: string; fileName: string }) {
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-white/90 px-4 py-3 text-sm text-neutral-700 shadow backdrop-blur">
      <Link href={`/orders/${orderId}`} className="font-semibold text-neutral-500 hover:text-neutral-900">
        ← {orderCode(orderId)}
      </Link>
      <span className="hidden sm:inline">A4 · tick &ldquo;Background graphics&rdquo; in the print dialog for the colours.</span>
      <span className="ml-auto flex gap-2">
        <DownloadImageButton fileName={fileName} />
        <PrintButton />
      </span>
    </div>
  );
}

/** A spot for a mini poster: mm from the page edges, height and tilt. Posters are at most 0.8 wide per 1 tall. */
export type PosterSpot = { height: number; rotate: number; top?: number; bottom?: number; left?: number; right?: number };

/**
 * A different random set of the shop's mini posters on every card (each
 * picture once), served through the admin's own image route so "Download
 * image" can capture them.
 */
export async function randomPosters(driver: DataDriver, count: number) {
  const seen = new Set<string>();
  return (await driver.listProducts({ activeOnly: true }))
    .filter((p) => /mini poster/i.test(p.name))
    .map((p) => ({ url: p.thumbUrl ?? p.imageUrl, aspect: p.aspectRatio ?? 0.7, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .filter((p) => p.url && !seen.has(p.url) && Boolean(seen.add(p.url)))
    .slice(0, count)
    .map((p) => ({ src: imageDownloadHref(p.url), aspect: p.aspect }));
}

export function Posters({ posters, spots }: { posters: { src: string; aspect: number }[]; spots: readonly PosterSpot[] }) {
  return posters.map(({ src, aspect }, i) => {
    const { height, rotate, ...pos } = spots[i];
    const style: React.CSSProperties = {
      width: `${(height * Math.min(Math.max(aspect, 0.45), 0.8)).toFixed(1)}mm`,
      height: `${height}mm`,
      transform: `rotate(${rotate}deg)`,
    };
    for (const [k, v] of Object.entries(pos)) (style as Record<string, string>)[k] = `${v}mm`;
    return <img key={src} src={src} alt="" className="poster" style={style} />;
  });
}

/** Logo + name, top left. */
export function Brand() {
  return (
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
  );
}

export function StickingTips({ items }: { items: OrderItem[] }) {
  const posters = items.some(isPosterItem);
  const stickers = items.some((i) => !isPosterItem(i));
  return (
    <>
      <p className="font-display text-[5.6mm] font-bold" style={{ color: SHOP_THEME.brand }}>
        Sticking tips
      </p>
      <ul className="mt-[2mm] space-y-[1.2mm] text-[3.8mm] text-neutral-700">
        <li>✦ Wipe the spot clean and let it dry first</li>
        {stickers && <li>✦ Peel the backing slowly from one corner</li>}
        {stickers && <li>✦ Smooth it down from the centre outwards</li>}
        {posters && <li>✦ Posters: glue dots or tape on the back, then press onto the wall</li>}
      </ul>
    </>
  );
}

/** "Asha rao" → "Asha" (cut so headlines stay on one line). */
export function firstNameOf(fullName: string): string {
  const raw = fullName.trim().split(/\s+/)[0] ?? "";
  return raw ? (raw[0].toUpperCase() + raw.slice(1).toLowerCase()).slice(0, 16) : "friend";
}
