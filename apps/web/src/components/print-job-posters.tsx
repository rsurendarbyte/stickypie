"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, Scissors } from "lucide-react";
import { posterSizeLabel } from "@stickypie/shared";
import {
  BLEED,
  DEFAULT_CUT_AREA,
  MM_PER_IN,
  PAPERS,
  PRINT_DPI,
  canvasPdf,
  customPaper,
  cutBox,
  cutSteps,
  cutSvg,
  drawSheet,
  layOut,
  type CutArea,
  type Paper,
  type Piece,
  type Placed,
} from "@stickypie/shared/wall-sheets";
import type { JobItem } from "@/components/print-job";

const PREVIEW_DPI = 60;
/** Phones cap canvas size (~16.7 MP); a 300 DPI 13 × 19 in is 22 MP, so they fall back to this. */
const FALLBACK_DPI = 250;

type Layout = { sheets: Placed[][]; previews: string[]; trimmed: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load a poster file. Check the connection and reload."));
    img.src = src;
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

/** This device's last paper for `kind`, kept in the browser so each job starts on it. */
export function usePaper(kind: string, fallback: Paper) {
  const key = `print.paper.${kind}`;
  const [paper, setPaper] = useState(fallback);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as { id: string; w: number; h: number } | null;
      if (saved?.id === "custom") setPaper(customPaper(saved.w, saved.h));
      else if (saved) setPaper(PAPERS.find((p) => p.id === saved.id) ?? fallback);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  function choose(next: Paper) {
    setPaper(next);
    try {
      localStorage.setItem(key, JSON.stringify({ id: next.id, w: next.w / MM_PER_IN, h: next.h / MM_PER_IN }));
    } catch {}
  }
  return [paper, choose] as const;
}

const field = "mt-1 h-9 w-full rounded-lg border border-line bg-ink px-2 text-sm text-snow outline-none";

export function PaperPicker({ paper, onChange }: { paper: Paper; onChange: (paper: Paper) => void }) {
  const custom = paper.id === "custom";
  const width = paper.w / MM_PER_IN;
  const height = paper.h / MM_PER_IN;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-[200px] flex-1 text-xs text-fog sm:max-w-[260px]">
        Paper size
        <select
          value={paper.id}
          onChange={(e) => onChange(e.target.value === "custom" ? customPaper(13, 19) : PAPERS.find((p) => p.id === e.target.value)!)}
          className={field}
        >
          {PAPERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom size</option>
        </select>
      </label>
      {custom && (
        <>
          <label className="w-24 text-xs text-fog">
            Width (in)
            <input type="number" min={2} step={0.25} value={+width.toFixed(2)} onChange={(e) => onChange(customPaper(Math.max(2, Number(e.target.value) || 2), height))} className={field} />
          </label>
          <label className="w-24 text-xs text-fog">
            Height (in)
            <input type="number" min={2} step={0.25} value={+height.toFixed(2)} onChange={(e) => onChange(customPaper(width, Math.max(2, Number(e.target.value) || 2)))} className={field} />
          </label>
        </>
      )}
    </div>
  );
}

/**
 * Posters on sheets of the chosen paper: a print PDF and a Cricut cut SVG per
 * sheet, the same as the admin's print sheets. `items` carry their print files.
 */
export default function PosterSheets({ token, code, items }: { token: string; code: string; items: JobItem[] }) {
  const [paper, setPaper] = usePaper("posters", PAPERS[2]);
  const [area, setArea] = useState<CutArea>(DEFAULT_CUT_AREA);
  const [showCut, setShowCut] = useState(true);
  const [bleed, setBleed] = useState(false);
  const [stock, setStock] = useState(true);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [working, setWorking] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const images = useRef(new Map<string, Promise<HTMLImageElement>>());
  const cut = cutBox(paper, area);
  const bleedMm = bleed ? BLEED : 0;
  const ordered = items.reduce((n, i) => n + i.quantity * (i.posters?.length ?? 1), 0);
  const extras = layout?.sheets.flat().filter((p) => p.extra).length ?? 0;

  function image(url: string) {
    if (!images.current.has(url)) images.current.set(url, loadImage(url));
    return images.current.get(url)!;
  }

  useEffect(() => {
    let live = true;
    (async () => {
      setWorking(true);
      setError(null);
      try {
        const posters = (item: JobItem) => [...(item.posters ?? [{ name: item.name, inches: item.sizeInches! }]).entries()];
        const file = (item: JobItem, n: number) => image(`/api/print-job/${token}/file?item=${encodeURIComponent(item.id)}&n=${n}`);
        await Promise.all(items.flatMap((item) => posters(item).map(([f]) => file(item, f))));
        const pieces: Piece[] = [];
        let trimmed = 0;
        for (const item of items) {
          for (const [f, poster] of posters(item)) {
            const src = await file(item, f);
            // Always the size on sale (2:3), whatever shape the file is.
            const long = poster.inches * MM_PER_IN;
            const short = (long * 2) / 3;
            const landscape = src.naturalWidth > src.naturalHeight;
            const ratio = Math.min(src.naturalWidth, src.naturalHeight) / Math.max(src.naturalWidth, src.naturalHeight);
            if (Math.abs(ratio - 2 / 3) > 0.02) trimmed += item.quantity;
            for (let n = 0; n < item.quantity; n++) {
              pieces.push({ wall: item.name, name: poster.name, file: poster.name, w: landscape ? long : short, h: landscape ? short : long, src });
            }
          }
        }
        if (!live) return;
        const sheets = layOut(pieces, paper, area, bleedMm, stock);
        const previews = sheets.map((sheet, n) => drawSheet(sheet, paper, area, PREVIEW_DPI, sheetLabel(n, sheets.length), bleedMm, showCut).toDataURL("image/jpeg", 0.8));
        if (live) setLayout({ sheets, previews, trimmed });
      } catch (err) {
        if (live) {
          setLayout(null);
          setError(err instanceof Error ? err.message : "Couldn't arrange the sheets");
        }
      } finally {
        if (live) setWorking(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, paper, area, showCut, bleedMm, stock]);

  function sheetLabel(n: number, of: number) {
    return `${code} · Sheet ${n + 1} of ${of} · ${paper.name} · Print at 100%`;
  }

  const fileName = (n: number) => `${code}-sheet-${n + 1}`;

  async function savePdf(l: Layout, n: number) {
    const label = sheetLabel(n, l.sheets.length);
    const pdf =
      (await canvasPdf(drawSheet(l.sheets[n], paper, area, PRINT_DPI, label, bleedMm), paper)) ??
      (await canvasPdf(drawSheet(l.sheets[n], paper, area, FALLBACK_DPI, label, bleedMm), paper));
    if (!pdf) throw new Error("This device couldn't make the sheet. Open the link on a computer.");
    save(pdf, `${fileName(n)}-print.pdf`);
  }

  function saveCut(l: Layout, n: number) {
    save(new Blob([cutSvg(l.sheets[n], paper, area)], { type: "image/svg+xml" }), `${fileName(n)}-cut.svg`);
  }

  async function run(id: string, job: () => Promise<void> | void) {
    setSaving(id);
    setError(null);
    try {
      await job();
    } catch (err) {
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

  const button = "peel-btn peel-btn--light inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold disabled:opacity-60";

  return (
    <section className="mt-5 rounded-2xl border border-line bg-ink2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Poster sheets · 300 GSM poster paper</h2>
          <p className="text-xs text-fog">
            {layout
              ? `${ordered} poster${ordered === 1 ? "" : "s"}${extras > 0 ? ` + ${extras} stock extra${extras === 1 ? "" : "s"}` : ""} on ${layout.sheets.length} sheet${layout.sheets.length === 1 ? "" : "s"}. `
              : ""}
            Print files are {paper.name} at {PRINT_DPI} DPI.
            {extras > 0 && " Extras have a green cut line in the preview."}
          </p>
        </div>
        {layout && (
          <button
            type="button"
            disabled={!!saving}
            onClick={() => run("all", () => saveAll(layout))}
            className="peel-btn peel-btn--brand inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
          >
            {saving === "all" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download all files
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <PaperPicker paper={paper} onChange={setPaper} />
        <div>
          <p className="text-xs font-semibold text-fog">Cricut margins (inches from the sheet edge)</p>
          <div className="mt-1 grid max-w-md grid-cols-4 gap-2">
            {(["left", "right", "top", "bottom"] as const).map((side) => (
              <label key={side} className="text-xs text-fog capitalize">
                {side}
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={area[side]}
                  onChange={(e) => setArea((now) => ({ ...now, [side]: Math.max(0, Number(e.target.value) || 0) }))}
                  className={field}
                />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-fog">
            Cut area {(cut.w / MM_PER_IN).toFixed(2)} × {(cut.h / MM_PER_IN).toFixed(2)} in
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-fog">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showCut} onChange={(e) => setShowCut(e.target.checked)} /> Show cut lines in the preview
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} className="mt-0.5" /> Fill empty space with extra posters for stock
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} className="mt-0.5" /> Print {BLEED} mm of edge colour past the cut, in case the cut drifts
          </label>
        </div>
      </div>

      {layout && layout.trimmed > 0 && (
        <p className="mt-3 flex items-start gap-2 text-xs text-gold">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {layout.trimmed} poster{layout.trimmed === 1 ? " isn't" : "s aren't"} 2:3, so the top and bottom or sides get trimmed to fit 4 × 6 or 6 × 9.
        </p>
      )}
      {error && <p className="mt-4 rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">{error}</p>}
      {working && !layout && !error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-fog">
          <Loader2 className="size-4 animate-spin" /> Laying out the sheets…
        </p>
      )}

      {layout && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layout.sheets.map((sheet, n) => {
              const counts = new Map<string, number>();
              for (const p of sheet) {
                const size = posterSizeLabel(Math.max(p.w, p.h) / MM_PER_IN);
                const key = `${p.wall}|${size}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
              }
              return (
                <figure key={n} className="rounded-xl border border-line bg-white p-2">
                  <img src={layout.previews[n]} alt={`Sheet ${n + 1}`} style={{ aspectRatio: `${paper.w} / ${paper.h}` }} className="w-full object-contain" />
                  <figcaption className="mt-2">
                    <p className="text-sm font-semibold text-[#15161e]">
                      Sheet {n + 1} of {layout.sheets.length} · {sheet.length} poster{sheet.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-1 text-xs text-[#5b5e6b]">
                      {[...counts].map(([key, count]) => {
                        const [wall, size] = key.split("|");
                        return (
                          <li key={key} className="truncate">
                            {wall}: {size} × {count}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
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
          <div className="mt-5 text-sm">
            <h3 className="font-semibold">For the cutting shop</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-fog">
              {cutSteps(paper, area).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}
