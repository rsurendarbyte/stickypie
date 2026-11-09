// Browser-only: lays posters out on sheets of any paper size and makes the two
// files of each sheet, the print PDF and the Cricut cut SVG. Both are drawn from
// the same layout, so the cuts land on the posters. Everything in mm.
import { packTight, type PackSheet, type Packed } from "./sheet-pack";
import { slugify } from "./utils";

export const MM_PER_IN = 25.4;

/** A sheet in portrait. `name` goes on the sheet and in the steps, `label` in the paper list. */
export type Paper = { id: string; name: string; label: string; w: number; h: number };

const inches = (w: number, h: number) => ({ w: w * MM_PER_IN, h: h * MM_PER_IN });
export const PAPERS: Paper[] = [
  { id: "a4", name: "A4", label: "A4 · 210 × 297 mm", w: 210, h: 297 },
  { id: "a3", name: "A3", label: "A3 · 297 × 420 mm", w: 297, h: 420 },
  { id: "a3-plus", name: "13 × 19 in", label: "A3+ · 13 × 19 in", ...inches(13, 19) },
  { id: "12x18", name: "12 × 18 in", label: "12 × 18 in", ...inches(12, 18) },
  { id: "sra3", name: "SRA3", label: "SRA3 · 320 × 450 mm", w: 320, h: 450 },
  { id: "letter", name: "Letter", label: "Letter · 8.5 × 11 in", ...inches(8.5, 11) },
  { id: "legal", name: "Legal", label: "Legal · 8.5 × 14 in", ...inches(8.5, 14) },
  { id: "tabloid", name: "11 × 17 in", label: "Tabloid · 11 × 17 in", ...inches(11, 17) },
];
export const SHEET = PAPERS[2];

/** A size typed in by hand, in inches. */
export function customPaper(w: number, h: number): Paper {
  return { id: "custom", name: `${w} × ${h} in`, label: "Custom size", ...inches(w, h) };
}

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
export function cutBox(paper: Paper, area: CutArea) {
  return {
    x: area.left * MM_PER_IN,
    y: area.top * MM_PER_IN,
    w: paper.w - (area.left + area.right) * MM_PER_IN,
    h: paper.h - (area.top + area.bottom) * MM_PER_IN,
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

/** The room posters get on a sheet. */
function sheetSpace(paper: Paper, area: CutArea, bleed = 0): PackSheet {
  const cut = cutBox(paper, area);
  return { w: cut.w, h: cut.h, margin: MARK_CLEAR, gap: Math.max(MIN_GAP, bleed * 2) };
}

/** Sheets needed for posters of these sizes (longest side in inches), or null if one doesn't fit. */
export function sheetsNeeded(inches: number[], paper: Paper, area: CutArea): number | null {
  const pieces = inches.map((long) => ({ w: (long * MM_PER_IN * 2) / 3, h: long * MM_PER_IN }));
  const sheets = packTight(pieces, sheetSpace(paper, area));
  return sheets.flat().length < pieces.length ? null : sheets.length;
}

/**
 * Lays pieces on as few sheets as possible, inside the cut area. `bleed` needs
 * room between posters. With `stock`, leftover space takes extra posters.
 */
export function layOut(pieces: Piece[], paper: Paper, area: CutArea, bleed = 0, stock = false): Placed[][] {
  const cut = cutBox(paper, area);
  const size = sheetSpace(paper, area, bleed);
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
function markShapes(paper: Paper, area: CutArea): [number, number][][] {
  const m = cutBox(paper, area);
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
export function drawSheet(placed: Placed[], paper: Paper, area: CutArea, dpi: number, label: string, bleed = 0, showCut = false): HTMLCanvasElement {
  const k = dpi / MM_PER_IN;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(paper.w * k);
  canvas.height = Math.round(paper.h * k);
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
  for (const shape of markShapes(paper, area)) {
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
 * cuts round a filled shape, and can drop stroke-only ones. Numbers are in
 * points, because Design Space ignores the size and reads one unit as 1/72 in.
 */
export function cutSvg(placed: Placed[], paper: Paper, area: CutArea): string {
  const PT = 72 / MM_PER_IN;
  const posters = placed.map((p, i) => {
    const b = box(p);
    return `    <path id="${i + 1}-${slugify(p.name).slice(0, 40)}" d="${roundedPath({ x: b.x * PT, y: b.y * PT, w: b.w * PT, h: b.h * PT }, radius(p) * PT)}"/>`;
  });
  const marks = markShapes(paper, area).map(
    (shape, i) => `    <path id="mark-${i + 1}" d="M${shape.map(([x, y]) => `${(x * PT).toFixed(3)} ${(y * PT).toFixed(3)}`).join("L")}Z"/>`
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(paper.w * PT).toFixed(3)}pt" height="${(paper.h * PT).toFixed(3)}pt" viewBox="0 0 ${(paper.w * PT).toFixed(3)} ${(paper.h * PT).toFixed(3)}">`,
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
function sheetPdf(jpeg: Uint8Array, pixels: { w: number; h: number }, paper: Paper): Blob {
  const page = { w: (paper.w / MM_PER_IN) * 72, h: (paper.h / MM_PER_IN) * 72 };
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

/** The print PDF of a drawn sheet, or null if the canvas is too big for this device. */
export async function canvasPdf(canvas: HTMLCanvasElement, paper: Paper): Promise<Blob | null> {
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!jpeg) return null;
  return sheetPdf(new Uint8Array(await jpeg.arrayBuffer()), { w: canvas.width, h: canvas.height }, paper);
}

/** The steps for the cutting shop. */
export function cutSteps(paper: Paper, area: CutArea): string[] {
  const cut = cutBox(paper, area);
  const paperSize = `${(paper.w / MM_PER_IN).toFixed(2).replace(/\.?0+$/, "")} × ${(paper.h / MM_PER_IN).toFixed(2).replace(/\.?0+$/, "")} in`;
  return [
    `Print the PDF at 100% (actual size) on the ${paper.name} sheet. No fit to page.`,
    `In Design Space upload the SVG and select all. The size must read ${(cut.w / MM_PER_IN).toFixed(2)} × ${(cut.h / MM_PER_IN).toFixed(2)} in. If not, type it in with the lock on.`,
    "Select all and click Attach, so the whole sheet stays together as one.",
    `Click Make, choose Without Mat and set the material size to ${paperSize}. Use a plain cut, not Print Then Cut.`,
    `On Review artwork the top left mark must sit ${area.left} in from the left and ${area.top} in from the top.`,
    "Test on plain paper first. The cut corner marks must land on the printed marks. A cut that is off leaves a thin white edge on the poster.",
  ];
}

// ---- Puzzle posters: one poster printed as 9 cards (3 × 3) ----

/** Share of the poster trimmed off each edge before it's cut up: its rounded corners would give the corner cards away (as in the shop's game). */
export const PUZZLE_EDGE = 0.035;

/** An order line that's a puzzle poster (its size label says so, see the shop's checkout). */
export function isPuzzleLine(item: { sizeLabel?: string | null }): boolean {
  return /puzzle poster/i.test(item.sizeLabel ?? "");
}

/** A puzzle card stands for its poster's file plus which card (0–8, row by row). */
export function puzzleCardRef(url: string, card: number): string {
  return `${url}#puzzle-${card}`;
}

/** The poster file and card a puzzle card ref stands for, or null for an ordinary file. */
export function parsePuzzleCardRef(ref: string): { url: string; card: number } | null {
  const m = ref.match(/^(.*)#puzzle-([0-8])$/);
  return m ? { url: m[1], card: Number(m[2]) } : null;
}

/** One card of a puzzle poster, cut from the poster (2:3, edge trimmed), as a canvas `w` × `h` px. */
export function puzzleCardCanvas(src: HTMLImageElement, card: number, w: number, h: number): HTMLCanvasElement {
  // the poster as 2:3, centred, less its rounded edge
  const ratio = 2 / 3;
  let pw = src.naturalWidth;
  let ph = src.naturalHeight;
  if (pw / ph > ratio) pw = ph * ratio;
  else ph = pw / ratio;
  const left = (src.naturalWidth - pw) / 2 + pw * PUZZLE_EDGE;
  const top = (src.naturalHeight - ph) / 2 + ph * PUZZLE_EDGE;
  const cw = (pw * (1 - 2 * PUZZLE_EDGE)) / 3;
  const ch = (ph * (1 - 2 * PUZZLE_EDGE)) / 3;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't draw the puzzle card");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, left + (card % 3) * cw, top + Math.floor(card / 3) * ch, cw, ch, 0, 0, w, h);
  return canvas;
}

/** One card of a puzzle poster as a picture (for the sheet layout, which draws pictures). */
export function puzzleCardImage(src: HTMLImageElement, card: number, longPx = 1800): Promise<HTMLImageElement> {
  const canvas = puzzleCardCanvas(src, card, Math.round((longPx * 2) / 3), longPx);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't cut the puzzle card"));
    img.src = canvas.toDataURL("image/jpeg", 0.95);
  });
}

/** A PDF of several pages, each one JPEG filling a page of its own size (mm). */
function pagesPdf(pages: { jpeg: Uint8Array; pixels: { w: number; h: number }; mm: { w: number; h: number } }[]): Blob {
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
  const count = pages.length;
  const pageObj = (i: number) => 3 + i * 3;
  text("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${count} >>`);
  pages.forEach((p, i) => {
    const w = (p.mm.w / MM_PER_IN) * 72;
    const h = (p.mm.h / MM_PER_IN) * 72;
    const n = pageObj(i);
    const draw = encoder.encode(`q ${w} 0 0 ${h} 0 0 cm /Art Do Q`);
    object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Art ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`);
    object(n + 1, `<< /Type /XObject /Subtype /Image /Width ${p.pixels.w} /Height ${p.pixels.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
    object(n + 2, `<< /Length ${draw.length} >>`, draw);
  });
  const total = 3 + count * 3;
  const xref = length;
  text(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) text(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}

async function jpegOf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!blob) throw new Error("This device couldn't make the print file");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * A puzzle poster's print file: page 1 is the layout guide (the poster with its
 * 9 numbered cards), pages 2–10 are cards 1–9 at their exact print size, 300 dpi.
 * `cardInches` is a card's long side (6 = 4 × 6 in, 9 = 6 × 9 in).
 */
export async function puzzlePdf(src: HTMLImageElement, cardInches: number, title: string): Promise<Blob> {
  const mm = { w: ((cardInches * 2) / 3) * MM_PER_IN, h: cardInches * MM_PER_IN };
  const px = { w: Math.round(((cardInches * 2) / 3) * PRINT_DPI), h: Math.round(cardInches * PRINT_DPI) };
  const pages: { jpeg: Uint8Array; pixels: { w: number; h: number }; mm: { w: number; h: number } }[] = [];

  const guide = puzzleGuideCanvas(src, cardInches, title);
  pages.push({ jpeg: await jpegOf(guide), pixels: px, mm });

  for (let card = 0; card < 9; card++) {
    pages.push({ jpeg: await jpegOf(puzzleCardCanvas(src, card, px.w, px.h)), pixels: px, mm });
  }
  return pagesPdf(pages);
}


/** The puzzle's layout guide at a card's size: the poster, its grid and the card numbers. */
function puzzleGuideCanvas(src: HTMLImageElement, cardInches: number, title: string): HTMLCanvasElement {
  const px = { w: Math.round(((cardInches * 2) / 3) * PRINT_DPI), h: Math.round(cardInches * PRINT_DPI) };
  const guide = document.createElement("canvas");
  guide.width = px.w;
  guide.height = px.h;
  const g = guide.getContext("2d");
  if (!g) throw new Error("This browser couldn't draw the guide");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, px.w, px.h);
  const pad = px.w * 0.08;
  const boardW = px.w - pad * 2;
  const boardH = boardW * 1.5;
  const boardTop = px.h * 0.16;
  g.fillStyle = "#111";
  g.font = `bold ${Math.round(px.w * 0.05)}px sans-serif`;
  g.textAlign = "center";
  g.fillText("Puzzle poster · layout", px.w / 2, px.h * 0.07);
  g.font = `${Math.round(px.w * 0.035)}px sans-serif`;
  g.fillText(title.slice(0, 48), px.w / 2, px.h * 0.115);
  const cw = boardW / 3;
  const chh = boardH / 3;
  for (let card = 0; card < 9; card++) {
    const x = pad + (card % 3) * cw;
    const y = boardTop + Math.floor(card / 3) * chh;
    g.drawImage(puzzleCardCanvas(src, card, Math.round(cw), Math.round(chh)), x, y, cw, chh);
    g.strokeStyle = "#fff";
    g.lineWidth = px.w * 0.006;
    g.strokeRect(x, y, cw, chh);
    g.fillStyle = "rgba(0,0,0,0.6)";
    g.beginPath();
    g.arc(x + cw / 2, y + chh / 2, px.w * 0.045, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = `bold ${Math.round(px.w * 0.05)}px sans-serif`;
    g.textBaseline = "middle";
    g.fillText(String(card + 1), x + cw / 2, y + chh / 2);
    g.textBaseline = "alphabetic";
  }
  g.fillStyle = "#555";
  g.font = `${Math.round(px.w * 0.03)}px sans-serif`;
  g.fillText(`9 cards · ${formatLong(cardInches)} each · number = card file`, px.w / 2, boardTop + boardH + px.h * 0.05);
  return guide;
}

/** "4 × 6 in" for a card's long side. */
function formatLong(inches: number): string {
  return `${Math.round(((inches * 2) / 3) * 10) / 10} × ${inches} in`;
}

/** A plain ZIP (stored, not compressed: JPEGs don't shrink) of the given files. */
function zipFiles(files: { name: string; data: Uint8Array }[]): Blob {
  const table = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (d: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < d.length; i++) c = table[(c ^ d[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const enc = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), new Uint8Array(name), new Uint8Array(f.data));
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, f.data.length, true);
    dir.setUint32(24, f.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), new Uint8Array(name));
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

/**
 * A puzzle poster's print files as a ZIP: card-1.jpg … card-9.jpg, each one card
 * at its print size (300 dpi), and layout-guide.jpg showing where each goes.
 * `cardInches` is a card's long side (6 = 4 × 6 in, 9 = 6 × 9 in).
 */
export async function puzzleZip(src: HTMLImageElement, cardInches: number, title: string): Promise<Blob> {
  const px = { w: Math.round(((cardInches * 2) / 3) * PRINT_DPI), h: Math.round(cardInches * PRINT_DPI) };
  const files: { name: string; data: Uint8Array }[] = [];
  for (let card = 0; card < 9; card++) {
    files.push({ name: `card-${card + 1}.jpg`, data: await jpegOf(puzzleCardCanvas(src, card, px.w, px.h)) });
  }
  files.push({ name: "layout-guide.jpg", data: await jpegOf(puzzleGuideCanvas(src, cardInches, title)) });
  return zipFiles(files);
}
