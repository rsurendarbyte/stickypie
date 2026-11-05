"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, Minus, Plus, Scissors, Search, X } from "lucide-react";
import { posterSizeLabel, type PackPoster } from "@stickypie/shared";
import { imageDownloadHref, imageSrc } from "@/lib/img";
import { BLEED, DEFAULT_CUT_AREA, MM_PER_IN, PRINT_DPI, SHEET, canvasPdf, cutBox, cutSteps, cutSvg, drawSheet, layOut, type CutArea, type Piece, type Placed } from "@stickypie/shared/wall-sheets";

/** `preview` is the small picture: the sheets are arranged and shown with it, the full file is only fetched for the PDF. */
export type SheetPoster = PackPoster & { preview: string };

export type SheetWall = {
  key: string;
  name: string;
  /** Order code when it comes from a paid order; null = a wall from the catalog. */
  order: string | null;
  quantity: number;
  image: string;
  posters: SheetPoster[];
};

type Picked = { wall: SheetWall; quantity: number };
type Layout = { sheets: Placed[][]; previews: string[]; batch: string; trimmed: number };

const PREVIEW_DPI = 60;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load a poster file. Check the connection and pick again."));
    img.src = imageDownloadHref(url);
  });
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function batchCode() {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}${two(d.getMonth() + 1)}-${two(d.getHours())}${two(d.getMinutes())}`;
}

function sheetLabel(batch: string, n: number, of: number) {
  return `Batch ${batch} · Sheet ${n + 1} of ${of} · 13 × 19 in · Print at 100%`;
}

export default function WallSheetMaker({ walls, ordered }: { walls: SheetWall[]; ordered: SheetWall[] }) {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [tab, setTab] = useState<"orders" | "walls">(ordered.length ? "orders" : "walls");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<CutArea>(DEFAULT_CUT_AREA);
  const [showCut, setShowCut] = useState(true);
  const [bleed, setBleed] = useState(false);
  const [stock, setStock] = useState(true);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const images = useRef(new Map<string, Promise<HTMLImageElement>>());
  const cut = cutBox(SHEET, area);

  const list = (tab === "orders" ? ordered : walls).filter((w) =>
    `${w.name} ${w.order ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const posters = picked.reduce((n, p) => n + p.quantity * p.wall.posters.length, 0);
  const extras = layout?.sheets.flat().filter((p) => p.extra).length ?? 0;

  function pick(wall: SheetWall) {
    setPicked((now) => (now.some((p) => p.wall.key === wall.key) ? now : [...now, { wall, quantity: wall.quantity }]));
  }

  function setQuantity(key: string, quantity: number) {
    setPicked((now) => now.map((p) => (p.wall.key === key ? { ...p, quantity: Math.max(1, quantity) } : p)));
  }

  function image(url: string) {
    if (!images.current.has(url)) images.current.set(url, loadImage(url));
    return images.current.get(url)!;
  }

  useEffect(() => {
    let live = true;
    (async () => {
      if (!picked.length) {
        setLayout(null);
        return;
      }
      setWorking(true);
      setError(null);
      try {
        await Promise.all(picked.flatMap((p) => p.wall.posters.map((poster) => image(poster.preview))));
        const pieces: Piece[] = [];
        let trimmed = 0;
        for (const { wall, quantity } of picked) {
          for (const poster of wall.posters) {
            const src = await image(poster.preview);
            // Always the size on sale (2:3), whatever shape the file is.
            const long = poster.inches * MM_PER_IN;
            const short = (long * 2) / 3;
            const landscape = src.naturalWidth > src.naturalHeight;
            const ratio = Math.min(src.naturalWidth, src.naturalHeight) / Math.max(src.naturalWidth, src.naturalHeight);
            if (Math.abs(ratio - 2 / 3) > 0.02) trimmed += quantity;
            for (let n = 0; n < quantity; n++) {
              pieces.push({ wall: wall.name, name: poster.name, file: poster.imageUrl, w: landscape ? long : short, h: landscape ? short : long, src });
            }
          }
        }
        if (!live) return;
        const sheets = layOut(pieces, SHEET, area, bleed ? BLEED : 0, stock);
        const batch = batchCode();
        const previews = sheets.map((sheet, n) =>
          drawSheet(sheet, SHEET, area, PREVIEW_DPI, sheetLabel(batch, n, sheets.length), bleed ? BLEED : 0, showCut).toDataURL("image/jpeg", 0.8)
        );
        if (live) setLayout({ sheets, previews, batch, trimmed });
      } catch (err) {
        images.current.clear();
        if (live) setError(err instanceof Error ? err.message : "Couldn't arrange the sheets");
      } finally {
        if (live) setWorking(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [picked, area, showCut, bleed, stock]);

  const fileName = (batch: string, n: number) => `sheet-${batch}-${n + 1}`;

  async function savePdf(l: Layout, n: number) {
    const sheet = await Promise.all(l.sheets[n].map(async (p) => ({ ...p, src: await image(p.file) })));
    const canvas = drawSheet(sheet, SHEET, area, PRINT_DPI, sheetLabel(l.batch, n, l.sheets.length), bleed ? BLEED : 0);
    const pdf = await canvasPdf(canvas, SHEET);
    if (!pdf) throw new Error("This browser couldn't make the sheet");
    save(pdf, `${fileName(l.batch, n)}-print.pdf`);
  }

  function saveCut(l: Layout, n: number) {
    save(new Blob([cutSvg(l.sheets[n], SHEET, area)], { type: "image/svg+xml" }), `${fileName(l.batch, n)}-cut.svg`);
  }

  async function run(id: string, job: () => Promise<void> | void) {
    setSaving(id);
    setError(null);
    try {
      await job();
    } catch (err) {
      images.current.clear();
      setError(err instanceof Error ? err.message : "Couldn't make the file");
    } finally {
      setSaving(null);
    }
  }

  async function saveAll(l: Layout) {
    for (const n of l.sheets.keys()) {
      await savePdf(l, n);
      await new Promise((r) => setTimeout(r, 400));
      saveCut(l, n);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const button = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand/50 hover:text-brand disabled:opacity-60";

  return (
    <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-line bg-ink2 p-4">
          <div className="flex gap-1 rounded-xl bg-ink p-1">
            {(
              [
                ["orders", `Paid orders (${ordered.length})`],
                ["walls", `All walls (${walls.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`h-8 flex-1 rounded-lg text-xs font-semibold ${tab === id ? "bg-ink2 text-snow" : "text-fog hover:text-snow"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-line bg-ink px-2.5">
            <Search className="size-4 shrink-0 text-fog" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search walls"
              className="min-w-0 flex-1 bg-transparent text-sm text-snow outline-none"
            />
          </label>
          <ul className="mt-3 max-h-[42vh] space-y-1 overflow-y-auto">
            {list.map((wall) => {
              const added = picked.some((p) => p.wall.key === wall.key);
              return (
                <li key={wall.key}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => pick(wall)}
                    className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-white/5 disabled:opacity-50"
                  >
                    <img src={imageSrc(wall.image)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md bg-ink object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{wall.name}</span>
                      <span className="block text-xs text-fog">
                        {wall.order ? `${wall.order} · ` : ""}
                        {wall.posters.length} poster{wall.posters.length === 1 ? "" : "s"}
                        {wall.quantity > 1 ? ` × ${wall.quantity}` : ""}
                      </span>
                    </span>
                    {added ? <span className="text-xs text-fog">Added</span> : <Plus className="size-4 shrink-0 text-brand" />}
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="p-2 text-sm text-fog">Nothing here.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-ink2 p-4">
          <h2 className="text-sm font-semibold">On the sheets</h2>
          {picked.length === 0 ? (
            <p className="mt-1 text-xs text-fog">Pick walls above.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {picked.map(({ wall, quantity }) => (
                <li key={wall.key} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{wall.name}</span>
                    {wall.order && <span className="block text-xs text-fog">{wall.order}</span>}
                  </span>
                  <span className="flex items-center rounded-lg border border-line">
                    <button type="button" aria-label="One less" onClick={() => setQuantity(wall.key, quantity - 1)} className="grid size-8 place-items-center text-fog hover:text-snow">
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                    <button type="button" aria-label="One more" onClick={() => setQuantity(wall.key, quantity + 1)} className="grid size-8 place-items-center text-fog hover:text-snow">
                      <Plus className="size-3.5" />
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${wall.name}`}
                    onClick={() => setPicked((now) => now.filter((p) => p.wall.key !== wall.key))}
                    className="grid size-8 place-items-center text-fog hover:text-brand"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <p className="text-xs font-semibold text-fog">Cricut margins (inches from the sheet edge)</p>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {(["left", "right", "top", "bottom"] as const).map((side) => (
                <label key={side} className="text-xs text-fog capitalize">
                  {side}
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={area[side]}
                    onChange={(e) => setArea((now) => ({ ...now, [side]: Math.max(0, Number(e.target.value) || 0) }))}
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-ink px-2 text-sm text-snow outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-fog">
              Cut area {(cut.w / MM_PER_IN).toFixed(2)} × {(cut.h / MM_PER_IN).toFixed(2)} in
            </p>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-fog">
            <input type="checkbox" checked={showCut} onChange={(e) => setShowCut(e.target.checked)} /> Show cut lines in the preview
          </label>
          <label className="mt-2 flex items-start gap-2 text-xs text-fog">
            <input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} className="mt-0.5" /> Fill empty space with extra posters for stock
          </label>
          <label className="mt-2 flex items-start gap-2 text-xs text-fog">
            <input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} className="mt-0.5" /> Print {BLEED} mm of edge colour past the cut, in case the cut drifts
          </label>
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        {error && <p className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>}
        {!layout && !working && (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">Your sheets show up here.</p>
        )}
        {working && !layout && (
          <p className="flex items-center gap-2 text-sm text-fog">
            <Loader2 className="size-4 animate-spin" /> Arranging the sheets…
          </p>
        )}
        {layout && (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink2 p-4">
              <div>
                <p className="font-semibold">
                  {posters} poster{posters === 1 ? "" : "s"}
                  {extras > 0 && ` + ${extras} stock extra${extras === 1 ? "" : "s"}`} on {layout.sheets.length} sheet{layout.sheets.length === 1 ? "" : "s"}
                  {working && <Loader2 className="ml-2 inline size-4 animate-spin text-fog" />}
                </p>
                <p className="text-xs text-fog">Batch {layout.batch}. Print files are 13 × 19 in at {PRINT_DPI} DPI.{extras > 0 && " Extras have a green cut line in the preview."}</p>
              </div>
              <button
                type="button"
                disabled={!!saving}
                onClick={() => run("all", () => saveAll(layout))}
                className="pie-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand/25 hover:brightness-110 disabled:opacity-60"
              >
                {saving === "all" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download all files
              </button>
              {layout.trimmed > 0 && (
                <p className="flex w-full items-start gap-2 text-xs text-gold">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  {layout.trimmed} poster{layout.trimmed === 1 ? " isn't" : "s aren't"} 2:3, so the top and bottom or sides get trimmed to fit 4 × 6 or 6 × 9.
                </p>
              )}
            </section>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {layout.sheets.map((sheet, n) => {
                const counts = new Map<string, number>();
                for (const p of sheet) {
                  const size = posterSizeLabel(Math.max(p.w, p.h) / MM_PER_IN);
                  const key = `${p.wall}|${size}`;
                  counts.set(key, (counts.get(key) ?? 0) + 1);
                }
                return (
                  <figure key={n} className="rounded-2xl border border-line bg-ink2 p-3">
                    <img src={layout.previews[n]} alt={`Sheet ${n + 1}`} style={{ aspectRatio: "13 / 19" }} className="w-full rounded-md bg-white" />
                    <figcaption className="mt-3">
                      <p className="text-sm font-semibold">
                        Sheet {n + 1} of {layout.sheets.length} · {sheet.length} poster{sheet.length === 1 ? "" : "s"}
                      </p>
                      <ul className="mt-1 text-xs text-fog">
                        {[...counts].map(([key, count]) => {
                          const [wall, size] = key.split("|");
                          return (
                            <li key={key} className="truncate">
                              {wall}: {size} × {count}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={!!saving} onClick={() => run(`pdf${n}`, () => savePdf(layout, n))} className={button}>
                          {saving === `pdf${n}` ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Print PDF
                        </button>
                        <button type="button" disabled={!!saving} onClick={() => run(`cut${n}`, () => saveCut(layout, n))} className={button}>
                          <Scissors className="size-4" /> Cut SVG
                        </button>
                      </div>
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            <section className="rounded-2xl border border-line bg-ink2 p-4 text-sm">
              <h2 className="font-semibold">For the cutting shop</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-fog">
                {cutSteps(SHEET, area).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
