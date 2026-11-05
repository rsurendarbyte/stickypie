"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Printer } from "lucide-react";
import { TEXT_STICKER_FONTS, pack, posterSizeLabel, type QrStickerSpec, type TextStickerSpec } from "@stickypie/shared";
import { drawSticker } from "@stickypie/shared/qr-art";
import { drawTextSticker, loadStickerFont } from "@stickypie/shared/text-art";
import { MM_PER_IN, PAPERS } from "@stickypie/shared/wall-sheets";
import { STICKER_FONTS } from "@/lib/sticker-fonts";
import PosterSheets, { PaperPicker, usePaper } from "@/components/print-job-posters";

export type JobItem = {
  id: string;
  name: string;
  quantity: number;
  sizeInches: number | null;
  sizeLabel: string | null;
  /** Print files served by /api/print-job/<key>/file (avatar packs: one per sheet). */
  files: number;
  /** QR / name stickers: drawn here from their details. */
  drawn: QrStickerSpec | TextStickerSpec | null;
  /** Avatar orders: packs ordered (their sheets are printed as they are, not on the A3 sheets). */
  avatarPacks: number | null;
  /** Poster packs: each poster's name and size (file n = poster n); every poster goes on the sheets. */
  posters: { name: string; inches: number }[] | null;
  /** Printed on 300 GSM poster paper, on its own sheets; everything else is vinyl. */
  paper: boolean;
};

// Portrait, everything in mm. Pieces sit at their real size with room to cut between them.
// Vinyl sheets are PNGs, on A3 unless the page says otherwise. Posters have their own sheets (print-job-posters).
const VINYL_STOCK = "sticker vinyl";
const VINYL_EDGE = { margin: 10, gap: 5 };
type SheetSize = { name: string; w: number; h: number; margin: number; gap: number };
const DPI = 300;
/** Phones cap canvas size (~16.7 MP); a 300 DPI A3 is 17.4 MP, so they fall back to this. */
const FALLBACK_DPI = 250;

type Piece = { name: string; w: number; h: number; src: CanvasImageSource };
type Placed = Piece & { x: number; y: number; rotated: boolean };
type Sheet = { url: string; dpi: number; n: number; of: number };

function fileUrl(token: string, item: string, n: number, download = false) {
  return `/api/print-job/${token}/file?item=${encodeURIComponent(item)}&n=${n}${download ? "&dl=1" : ""}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

async function drawSpec(spec: QrStickerSpec | TextStickerSpec, px: number): Promise<HTMLCanvasElement> {
  if (spec.kind === "qr") return drawSticker(spec.value, spec.label, px);
  const font = STICKER_FONTS.find((f) => f.id === spec.font) ?? STICKER_FONTS[0];
  const weight = TEXT_STICKER_FONTS.find((f) => f.id === font.id)?.weight ?? font.weight;
  await loadStickerFont(font.family, weight);
  return drawTextSticker(
    { line1: spec.line1, line2: spec.line2, family: font.family, weight, color: spec.color, color2: spec.color2, style: spec.style },
    px
  );
}

function render(placed: Placed[], dpi: number, label: string, size: SheetSize): Promise<Blob | null> {
  const k = dpi / MM_PER_IN;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size.w * k);
  canvas.height = Math.round(size.h * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = "high";
  for (const p of placed) {
    if (!p.rotated) {
      ctx.drawImage(p.src, p.x * k, p.y * k, p.w * k, p.h * k);
      continue;
    }
    // Turned 90°: takes p.h × p.w on the sheet.
    ctx.save();
    ctx.translate((p.x + p.h) * k, p.y * k);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(p.src, 0, 0, p.w * k, p.h * k);
    ctx.restore();
  }
  // Small job label in the bottom margin, so loose sheets stay with their order.
  ctx.fillStyle = "#9ca3af";
  ctx.font = `${Math.round(3 * k)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, Math.max(size.margin, 4) * k, (size.h - Math.max(size.margin / 2, 3)) * k);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export default function PrintJob({
  token,
  code,
  placed,
  items,
}: {
  token: string;
  code: string;
  placed: string;
  items: JobItem[];
}) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [shrunk, setShrunk] = useState(0);
  const images = useRef(new Map<string, Promise<HTMLImageElement>>());
  const [error, setError] = useState<string | null>(null);
  const [vinylPaper, setVinylPaper] = usePaper("vinyl", PAPERS[1]);
  const vinyl: SheetSize = { name: vinylPaper.name, w: vinylPaper.w, h: vinylPaper.h, ...VINYL_EDGE };
  const onSheets = items.filter((i) => i.avatarPacks == null && (i.posters || (i.sizeInches && (i.files > 0 || i.drawn))));
  const count = (list: JobItem[]) => list.reduce((n, i) => n + i.quantity * (i.posters?.length ?? 1), 0);
  const stickers = onSheets.filter((i) => !i.paper || i.drawn);
  const posters = onSheets.filter((i) => i.paper && !i.drawn);
  const groups = [
    { key: "vinyl", stock: VINYL_STOCK, title: "Stickers", items: items.filter((i) => !i.paper) },
    { key: "paper", stock: "300 GSM poster paper", title: "Wall posters", items: items.filter((i) => i.paper) },
  ].filter((g) => g.items.length > 0);

  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    (async () => {
      try {
        setSheets(null);
        const pieces: Piece[] = [];
        let tooBig = 0;
        const fit = { w: vinyl.w - vinyl.margin * 2, h: vinyl.h - vinyl.margin * 2 };
        for (const item of stickers) {
          const longest = (item.sizeInches ?? 0) * MM_PER_IN;
          let src: CanvasImageSource;
          let w: number;
          let h: number;
          if (item.drawn) {
            const canvas = await drawSpec(item.drawn, Math.min(3000, Math.round(item.sizeInches! * DPI)));
            if (live) setThumbs((t) => ({ ...t, [item.id]: canvas.toDataURL("image/png") }));
            [src, w, h] = [canvas, canvas.width, canvas.height];
          } else {
            // A poster pack puts every poster on the sheets at its own size; anything else has one file.
            for (const [f, poster] of (item.posters ?? [{ name: item.name, inches: item.sizeInches! }]).entries()) {
              const name = poster.name;
              const url = fileUrl(token, item.id, f);
              if (!images.current.has(url)) images.current.set(url, loadImage(url));
              const img = await images.current.get(url)!;
              const real = (poster.inches * MM_PER_IN) / Math.max(img.naturalWidth, img.naturalHeight);
              const scale = Math.min(real, fit.w / img.naturalWidth, fit.h / img.naturalHeight);
              if (scale < real) tooBig += item.quantity;
              for (let n = 0; n < item.quantity; n++) {
                pieces.push({ name, w: img.naturalWidth * scale, h: img.naturalHeight * scale, src: img });
              }
            }
            continue;
          }
          const real = longest / Math.max(w, h);
          const scale = Math.min(real, fit.w / w, fit.h / h);
          if (scale < real) tooBig += item.quantity;
          for (let n = 0; n < item.quantity; n++) pieces.push({ name: item.name, w: w * scale, h: h * scale, src });
        }
        const out: Sheet[] = [];
        const layout = pack(pieces, vinyl);
        for (const [n, sheet] of layout.entries()) {
          if (!live) return;
          const label = `${code} · ${vinyl.name} ${VINYL_STOCK} ${n + 1} of ${layout.length}`;
          let dpi = DPI;
          let blob = await render(sheet, dpi, label, vinyl);
          if (!blob) blob = await render(sheet, (dpi = FALLBACK_DPI), label, vinyl);
          if (!blob) throw new Error("This device couldn't make the sheets — open the link on a computer.");
          const url = URL.createObjectURL(blob);
          urls.push(url);
          out.push({ url, dpi, n, of: layout.length });
        }
        if (live) {
          setSheets(out);
          setShrunk(tooBig);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Couldn't make the sheets");
      }
    })();
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, vinyl.w, vinyl.h, vinyl.name]);

  const list = sheets ?? [];
  const sheetFile = (s: Sheet) => `${code}-${vinyl.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}-vinyl-${s.n + 1}.png`;

  function downloadAll(list: Sheet[]) {
    list.forEach((s, n) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = s.url;
        a.download = sheetFile(s);
        a.click();
      }, n * 400);
    });
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1100px] px-4 pt-8 pb-16 sm:px-8 sm:pt-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
          <Printer className="size-6 text-brand" /> Print job {code}
        </h1>
        <span className="text-xs text-fog">Paid {placed}</span>
      </div>
      <p className="mt-1 text-sm text-fog">
        {[
          count(stickers) > 0 && `${count(stickers)} sticker${count(stickers) === 1 ? "" : "s"} on vinyl`,
          count(posters) > 0 && `${count(posters)} poster${count(posters) === 1 ? "" : "s"} on 300 GSM paper`,
        ]
          .filter(Boolean)
          .join(" · ")}
        , at their real size.
      </p>

      {groups.map((group) => (
      <section key={group.key} className="mt-6 rounded-2xl border border-line bg-ink2 p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold">
          {group.title} <span className="ml-1 rounded-lg bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{group.stock}</span>
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {group.items.map((item) =>
            item.posters ? (
            // A poster pack: one tile per poster, with its own size and file.
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-sm font-bold text-brand">× {item.quantity} set{item.quantity === 1 ? "" : "s"}</span>
                {item.sizeLabel && <p className="text-xs text-fog">{item.sizeLabel}</p>}
              </div>
              <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {item.posters.map((poster, n) => (
                  <li key={n} className="flex flex-col rounded-xl border border-line bg-white p-2">
                    <img src={fileUrl(token, item.id, n)} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />
                    <p className="mt-1.5 line-clamp-2 text-xs font-medium text-[#15161e]">
                      {n + 1}. {poster.name.replace(/ — Mini Poster$| Mini Poster$/, "")}
                    </p>
                    <p className={`text-xs font-bold ${poster.inches > 6 ? "text-brand" : "text-fog"}`}>
                      {posterSizeLabel(poster.inches)} × {item.quantity}
                    </p>
                    <a
                      href={fileUrl(token, item.id, n, true)}
                      className="peel-btn peel-btn--light mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold"
                    >
                      <Download className="size-3.5" /> File
                    </a>
                  </li>
                ))}
              </ol>
            </li>
            ) : (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-line">
                {item.drawn ? (
                  thumbs[item.id] && <img src={thumbs[item.id]} alt="" className="max-h-full max-w-full object-contain" />
                ) : item.files > 0 ? (
                  <img src={fileUrl(token, item.id, 0)} alt="" className="max-h-full max-w-full object-contain" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-fog">
                  {item.sizeLabel ?? (item.sizeInches ? `${item.sizeInches}″ longest side` : "Size as on the file")}
                </p>
                {item.avatarPacks != null && (
                  <p className="text-xs text-fog">
                    {item.files > 0
                      ? `${item.files} pack sheet${item.files === 1 ? "" : "s"} — print each as it is (not on the A3 sheets)`
                      : "Pack sheets aren't ready yet"}
                  </p>
                )}
              </div>
              <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-sm font-bold text-brand">× {item.quantity}</span>
              {item.drawn ? (
                thumbs[item.id] && (
                  <a
                    href={thumbs[item.id]}
                    download={`${code}-${item.name}-${item.sizeInches}in-x${item.quantity}.png`}
                    className="peel-btn peel-btn--light inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                  >
                    <Download className="size-4" /> File
                  </a>
                )
              ) : (
                Array.from({ length: item.files }, (_, n) => (
                  <a
                    key={n}
                    href={fileUrl(token, item.id, n, true)}
                    className="peel-btn peel-btn--light inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                  >
                    <Download className="size-4" /> {item.files > 1 ? `Pack ${n + 1}` : "File"}
                  </a>
                ))
              )}
            </li>
            )
          )}
        </ul>
      </section>
      ))}

      {stickers.length > 0 && (
        <section className="mt-5 rounded-2xl border border-line bg-ink2 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">{vinyl.name} sheets · {VINYL_STOCK}</h2>
              <p className="text-xs text-fog">
                {Math.round(vinyl.w)} × {Math.round(vinyl.h)} mm PNG, {list[0]?.dpi ?? DPI} DPI, transparent background. Print at 100% (actual size).
              </p>
            </div>
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => downloadAll(list)}
                className="peel-btn peel-btn--brand inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold"
              >
                <Download className="size-4" /> Download all ({list.length})
              </button>
            )}
          </div>
          <div className="mt-3">
            <PaperPicker paper={vinylPaper} onChange={setVinylPaper} />
          </div>
          {shrunk > 0 && sheets && (
            <p className="mt-3 flex items-start gap-2 text-xs text-gold">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {shrunk} sticker{shrunk === 1 ? " is" : "s are"} bigger than this paper and got shrunk. Pick a larger paper to print at the real size.
            </p>
          )}
          {error ? (
            <p className="mt-4 rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>
          ) : !sheets ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-fog">
              <Loader2 className="size-4 animate-spin" /> Laying out the sheets…
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <figure key={s.url} className="rounded-xl border border-line bg-white p-2">
                  <img
                    src={s.url}
                    alt={`${vinyl.name} sheet ${s.n + 1}`}
                    style={{ aspectRatio: `${vinyl.w} / ${vinyl.h}` }}
                    className="w-full object-contain bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px]"
                  />
                  <figcaption className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#15161e]">
                      Sheet {s.n + 1} of {s.of}
                    </span>
                    <a
                      href={s.url}
                      download={sheetFile(s)}
                      className="peel-btn peel-btn--light inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                    >
                      <Download className="size-4" /> Download
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {posters.length > 0 && <PosterSheets token={token} code={code} items={posters} />}
    </div>
  );
}
