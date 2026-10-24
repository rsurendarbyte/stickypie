// Browser-only: draws a name / text sticker onto a canvas — the print file and
// the live preview on the name sticker maker.

export type TextStickerStyle = "cut" | "label";

export type TextSticker = {
  line1: string;
  /** Optional smaller line under the name. */
  line2: string;
  /** CSS font-family list (from next/font) and weight. */
  family: string;
  weight: number;
  color: string;
  /** Small line colour; null = automatic (dark on cut-out, white on a label). */
  color2: string | null;
  /** "cut" = die-cut around the letters; "label" = coloured rounded label. */
  style: TextStickerStyle;
};

const INK = "#111318";
const BASE = 200; // layout is worked out at this font size, then scaled

/** Waits until the sticker's font is ready so the canvas doesn't draw a fallback. */
export async function loadStickerFont(
  family: string,
  weight: number,
): Promise<void> {
  try {
    await document.fonts.load(`${weight} ${BASE}px ${family}`, "Aa");
  } catch {}
}

type Line = {
  text: string;
  size: number;
  width: number;
  ascent: number;
  descent: number;
};

function measure(ctx: CanvasRenderingContext2D, s: TextSticker): Line[] {
  const lines: Line[] = [];
  for (const [text, size] of [
    [s.line1.trim(), BASE],
    [s.line2.trim(), BASE * 0.42],
  ] as const) {
    if (!text) continue;
    ctx.font = `${s.weight} ${size}px ${s.family}`;
    const m = ctx.measureText(text);
    lines.push({
      text,
      size,
      width: Math.max(
        m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        m.width,
      ),
      ascent: m.actualBoundingBoxAscent || size * 0.75,
      descent: m.actualBoundingBoxDescent || size * 0.2,
    });
  }
  return lines;
}

/**
 * Draws the sticker with its longest side `maxSide` px (transparent outside
 * the sticker). Cut-out: coloured letters with a thin dark outline and a thick
 * white die-cut border. Label: white letters on a coloured rounded label with
 * a white border.
 */
export function drawTextSticker(
  s: TextSticker,
  maxSide = 1600,
): HTMLCanvasElement {
  const probe = document.createElement("canvas").getContext("2d")!;
  const lines = measure(probe, s);
  const gap = BASE * 0.14;
  const border = BASE * 0.13; // white die-cut margin
  const pad = s.style === "label" ? BASE * 0.3 : 0; // label padding around the text
  const textW = Math.max(...lines.map((l) => l.width), 1);
  const textH =
    lines.reduce((h, l) => h + l.ascent + l.descent, 0) +
    gap * Math.max(lines.length - 1, 0);
  const w = textW + (pad + border) * 2 + BASE * 0.06;
  const h = textH + (pad + border) * 2 + BASE * 0.06;
  const k = maxSide / Math.max(w, h);

  const c = document.createElement("canvas");
  c.width = Math.ceil(w * k);
  c.height = Math.ceil(h * k);
  const ctx = c.getContext("2d")!;
  ctx.scale(k, k);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (s.style === "label") {
    const r = Math.min(BASE * 0.35, (h - border * 2) / 2);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r + border);
    ctx.fill();
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.roundRect(border, border, w - border * 2, h - border * 2, r);
    ctx.fill();
  }

  // Baselines, top to bottom.
  let y = (h - textH) / 2;
  const placed = lines.map((l, i) => {
    y += l.ascent;
    const at = { ...l, y };
    y += l.descent + (i < lines.length - 1 ? gap : 0);
    return at;
  });
  const font = (l: Line) => `${s.weight} ${l.size}px ${s.family}`;

  if (s.style === "cut") {
    // 1) white die-cut border, 2) thin dark outline, 3) colour fill.
    ctx.strokeStyle = "#ffffff";
    for (const l of placed) {
      ctx.font = font(l);
      ctx.lineWidth = border * 2 * (l.size / BASE) + BASE * 0.05;
      ctx.strokeText(l.text, w / 2, l.y);
    }
    ctx.strokeStyle = INK;
    for (const l of placed) {
      ctx.font = font(l);
      ctx.lineWidth = l.size * 0.07;
      ctx.strokeText(l.text, w / 2, l.y);
    }
    for (const l of placed) {
      ctx.font = font(l);
      ctx.fillStyle = l === placed[0] ? s.color : (s.color2 ?? INK);
      ctx.fillText(l.text, w / 2, l.y);
    }
  } else {
    for (const l of placed) {
      ctx.font = font(l);
      ctx.fillStyle = l === placed[0] ? "#ffffff" : (s.color2 ?? "#ffffff");
      ctx.fillText(l.text, w / 2, l.y);
    }
  }
  return c;
}
