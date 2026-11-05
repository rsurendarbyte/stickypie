// Browser-only: lays wall posters out on 13 × 19 in (A3+) sheets and makes the
// two files of each sheet, the print PDF and the Cricut cut SVG. Both are drawn
// from the same layout, so the cuts land on the posters. Everything in mm.
import { packTight, slugify, type PackSheet, type Packed } from "@stickypie/shared";

export const MM_PER_IN = 25.4;
export const SHEET = { w: 13 * MM_PER_IN, h: 19 * MM_PER_IN };
export const PRINT_DPI = 300;
/** Optional extra printed past the cut, so a cut a little off shows no white edge. */
export const BLEED = 2;
/** Posters have rounded corners; the masters' are about 3% of the width. */
const CORNER = 0.03;

/** How far in from each sheet edge the Cricut can cut, in inches. */
export type CutArea = { left: number; right: number; top: number; bottom: number };

/** Explore 5 without a mat: 13 in material, 12 in cut width, cutting starts about 1.1 in down. */
export const DEFAULT_CUT_AREA: CutArea = { left: 0.5, right: 0.5, top: 1.125, bottom: 0.5 };

/** Sizes on sale, longest side in inches. */
const SMALL_POSTER = 6;
const BIG_POSTER = 9;

/** Space between posters, enough for the blade to cut each one on its own. */
const MIN_GAP = 2;

/** The corner marks sit on the cut area's corners; posters stay this far inside them. */
const MARK_CLEAR = 2;

/** The cut area in mm. The marks' box is also the size to type into Design Space. */
export function cutBox(area: CutArea) {
  return {
    x: area.left * MM_PER_IN,
    y: area.top * MM_PER_IN,
    w: SHEET.w - (area.left + area.right) * MM_PER_IN,
    h: SHEET.h - (area.top + area.bottom) * MM_PER_IN,
  };
}

/** `src` is what gets drawn; `file` is the full print file behind it. */
export type Piece = { wall: string; name: string; file: string; w: number; h: number; src: HTMLImageElement; /** Not ordered: printed to keep in stock. */ extra?: boolean };
export type Placed = Packed<Piece>;

/**
 * Tops up a sheet with extras to keep in stock: tries every mix of sizes and
 * keeps the one covering the most paper. Uses the job's own posters in turn,
 * and a poster already on the sheet only when no other is left.
 */
function fillWithStock(sheet: Piece[], job: Piece[], size: PackSheet, next: { turn: number }): Piece[] {
  const art = [...new Map(job.map((p) => [p.file, p])).values()];
  const covered = (pieces: Piece[]) => pieces.reduce((sum, p) => sum + p.w * p.h, 0);
  let turn = next.turn;

  /** One more poster of this size on the sheet, or null if it won't fit. */
  const add = (on: Piece[], inches: number): Piece[] | null => {
    const order = art.map((_, i) => art[(turn + i) % art.length]);
    const poster = order.find((p) => !on.some((q) => q.file === p.file)) ?? order[0];
    const long = inches * MM_PER_IN;
    const short = (long * 2) / 3;
    const landscape = poster.w > poster.h;
    const extra: Piece = { ...poster, wall: "Stock extras", extra: true, w: landscape ? long : short, h: landscape ? short : long };
    const tried = packTight([...on, extra], size);
    if (tried.length !== 1 || tried[0].length !== on.length + 1) return null;
    turn = (art.indexOf(poster) + 1) % art.length;
    return tried[0];
  };

  let best = sheet;
  let bestTurn = turn;
  const start = turn;
  let big: Piece[] | null = sheet;
  let bigTurn = start;
  while (big) {
    let mix = big;
    turn = bigTurn;
    for (let more = add(mix, SMALL_POSTER); more; more = add(mix, SMALL_POSTER)) mix = more;
    if (covered(mix) > covered(best)) {
      best = mix;
      bestTurn = turn;
    }
    turn = bigTurn;
    big = add(big, BIG_POSTER);
    bigTurn = turn;
  }
  next.turn = bestTurn;
  return best;
}

/**
 * Lays pieces on as few sheets as possible, inside the cut area. `bleed` needs
 * room between posters. With `stock`, leftover space takes extra posters.
 */
export function layOut(pieces: Piece[], area: CutArea, bleed = 0, stock = false): Placed[][] {
  const cut = cutBox(area);
  const size = { w: cut.w, h: cut.h, margin: MARK_CLEAR, gap: Math.max(MIN_GAP, bleed * 2) };
  const sheets = packTight(pieces, size);
  if (sheets.flat().length < pieces.length) throw new Error("A poster doesn't fit inside the cut area. Make the margins smaller.");
  const next = { turn: 0 };
  return sheets.map((sheet) => {
    const filled = stock ? (fillWithStock(sheet, pieces, size, next) as Placed[]) : sheet;
    return filled.map((p) => ({ ...p, x: p.x + cut.x, y: p.y + cut.y }));
  });
}

/** The piece's box on the sheet (a turned piece swaps width and height). */
function box(p: Placed) {
  return { x: p.x, y: p.y, w: p.rotated ? p.h : p.w, h: p.rotated ? p.w : p.h };
}

function radius(p: Placed) {
  return Math.min(p.w, p.h) * CORNER;
}

/** The four corner marks as thin L shapes. They're printed and cut, so the two can be checked against each other. */
function markShapes(area: CutArea): [number, number][][] {
  const m = cutBox(area);
  const ARM = 6;
  const THICK = 0.5;
  return [
    [m.x, m.y, 1, 1],
    [m.x + m.w, m.y, -1, 1],
    [m.x, m.y + m.h, 1, -1],
    [m.x + m.w, m.y + m.h, -1, -1],
  ].map(([x, y, dx, dy]) => [
    [x, y],
    [x + ARM * dx, y],
    [x + ARM * dx, y + THICK * dy],
    [x + THICK * dx, y + THICK * dy],
    [x + THICK * dx, y + ARM * dy],
    [x, y + ARM * dy],
  ]);
}

/** The part of the art that fills a `w` × `h` poster: centred, trimming whatever isn't 2:3. */
function coverCrop(src: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / src.naturalWidth, h / src.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  return { sx: (src.naturalWidth - sw) / 2, sy: (src.naturalHeight - sh) / 2, sw, sh };
}

/**
 * Fills the bleed and the art's rounded corners by stretching its outermost
 * pixels outward. Nothing of the art itself sits outside the cut, so a poster's
 * border stays on the poster. `w`, `h` and `bleed` are in canvas pixels.
 */
function drawBleed(ctx: CanvasRenderingContext2D, src: HTMLImageElement, w: number, h: number, bleed: number) {
  const { sx, sy, sw, sh } = coverCrop(src, w, h);
  const right = sx + sw;
  const bottom = sy + sh;
  const EDGE = 1;
  const corner = Math.ceil(sw * CORNER);
  const inside = Math.ceil(corner / 2); // Past the master's transparent corner.
  const fill = corner * (w / sw);
  for (const [cx, cy, dx, dy] of [
    [sx + inside, sy + inside, -bleed, -bleed],
    [right - inside, sy + inside, w - fill, -bleed],
    [sx + inside, bottom - inside, -bleed, h - fill],
    [right - inside, bottom - inside, w - fill, h - fill],
  ]) {
    ctx.drawImage(src, cx, cy, 1, 1, dx, dy, fill + bleed, fill + bleed);
  }
  ctx.drawImage(src, sx, sy + EDGE, sw, 1, 0, -bleed, w, bleed + EDGE);
  ctx.drawImage(src, sx, bottom - EDGE - 1, sw, 1, 0, h - EDGE, w, bleed + EDGE);
  ctx.drawImage(src, sx + EDGE, sy, 1, sh, -bleed, 0, bleed + EDGE, h);
  ctx.drawImage(src, right - EDGE - 1, sy, 1, sh, w - EDGE, 0, bleed + EDGE, h);
}

/** Draws one sheet at `dpi`. `showCut` adds the cut lines, for the preview only. */
export function drawSheet(placed: Placed[], area: CutArea, dpi: number, label: string, bleed = 0, showCut = false): HTMLCanvasElement {
  const k = dpi / MM_PER_IN;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(SHEET.w * k);
  canvas.height = Math.round(SHEET.h * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't draw the sheet");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";

  for (const p of placed) {
    ctx.save();
    if (p.rotated) {
      ctx.translate((p.x + p.h) * k, p.y * k);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(p.x * k, p.y * k);
    }
    drawBleed(ctx, p.src, p.w * k, p.h * k, bleed * k);
    const { sx, sy, sw, sh } = coverCrop(p.src, p.w * k, p.h * k);
    ctx.drawImage(p.src, sx, sy, sw, sh, 0, 0, p.w * k, p.h * k);
    ctx.restore();
  }

  ctx.fillStyle = "#000";
  for (const shape of markShapes(area)) {
    ctx.beginPath();
    shape.forEach(([x, y]) => ctx.lineTo(x * k, y * k));
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#6b7280";
  ctx.font = `${Math.round(2.6 * k)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, 8 * k, 4 * k);

  if (showCut) {
    ctx.lineWidth = Math.max(1, 0.5 * k);
    for (const p of placed) {
      const b = box(p);
      ctx.strokeStyle = p.extra ? "#00a651" : "#ff0080";
      ctx.beginPath();
      ctx.roundRect(b.x * k, b.y * k, b.w * k, b.h * k, radius(p) * k);
      ctx.stroke();
    }
  }
  return canvas;
}

/** A closed rounded rectangle as an SVG path. */
function roundedPath({ x, y, w, h }: { x: number; y: number; w: number; h: number }, r: number): string {
  const n = (v: number) => v.toFixed(3);
  return [
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}`,
    `V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}`,
    `H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}`,
    `V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`,
  ].join("");
}

/**
 * The Cricut cut file, drawn in sheet position. Shapes are filled: Design Space
 * cuts round a filled shape, and can drop stroke-only ones.
 */
export function cutSvg(placed: Placed[], area: CutArea): string {
  const posters = placed.map(
    (p, i) => `    <path id="${i + 1}-${slugify(p.name).slice(0, 40)}" d="${roundedPath(box(p), radius(p))}"/>`
  );
  const marks = markShapes(area).map(
    (shape, i) => `    <path id="mark-${i + 1}" d="M${shape.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L")}Z"/>`
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}">`,
    `  <g id="corner-marks" fill="#000000">`,
    ...marks,
    `  </g>`,
    `  <g id="posters" fill="#000000">`,
    ...posters,
    `  </g>`,
    `</svg>`,
    ``,
  ].join("\n");
}

/** A one-page PDF of exactly the sheet's size holding one JPEG, so nobody has to set a scale. */
export function sheetPdf(jpeg: Uint8Array, pixels: { w: number; h: number }): Blob {
  const page = { w: (SHEET.w / MM_PER_IN) * 72, h: (SHEET.h / MM_PER_IN) * 72 };
  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let length = 0;
  const add = (bytes: Uint8Array) => {
    parts.push(new Uint8Array(bytes));
    length += bytes.length;
  };
  const text = (s: string) => add(encoder.encode(s));
  const object = (n: number, head: string, stream?: Uint8Array) => {
    offsets[n] = length;
    text(`${n} 0 obj\n${head}\n`);
    if (stream) {
      text("stream\n");
      add(stream);
      text("\nendstream\n");
    }
    text("endobj\n");
  };

  const draw = encoder.encode(`q ${page.w} 0 0 ${page.h} 0 0 cm /Art Do Q`);
  text("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.w} ${page.h}] /Resources << /XObject << /Art 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, `<< /Type /XObject /Subtype /Image /Width ${pixels.w} /Height ${pixels.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  object(5, `<< /Length ${draw.length} >>`, draw);
  const xref = length;
  text(`xref\n0 6\n0000000000 65535 f \n`);
  for (let n = 1; n <= 5; n++) text(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
