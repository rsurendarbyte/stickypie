// Small drawing kit shared by the reel styles. Canvas is 1080 × 1920; text
// stays in Instagram's safe zone (y 230..1440, right 230 px clear).
import type { ReelInput } from "./types";

export const W = 1080;
export const H = 1920;
export const SAFE = { top: 230, bottom: 1440, left: 60, right: 850 };
export const ORANGE = "#f26b1d";
export const YELLOW = "#ffd23f";
export const INK = "#1d1b19";
export const CREAM = "#fbf3ea";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 0..1 progress of t between a and b. */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const backOut = (p: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Repeatable random numbers from a seed. */
export function rng(seed: number) {
  let s = Math.floor(seed * 2 ** 31) || 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

export function fill(ctx: CanvasRenderingContext2D, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

export function vertical(ctx: CanvasRenderingContext2D, a: string, b: string) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

/** Grid paper background, like the shop's puzzle page. */
export function gridPaper(ctx: CanvasRenderingContext2D, shift = 0) {
  fill(ctx, vertical(ctx, "#fff8f1", "#fdeee0"));
  ctx.strokeStyle = "rgba(242,107,29,0.07)";
  ctx.lineWidth = 2;
  const step = 54;
  const off = (shift % step + step) % step;
  ctx.beginPath();
  for (let x = -step + off; x < W + step; x += step) (ctx.moveTo(x, 0), ctx.lineTo(x, H));
  for (let y = -step + off; y < H + step; y += step) (ctx.moveTo(0, y), ctx.lineTo(W, y));
  ctx.stroke();
}

/** A painted wall with a soft light from the top. */
export function paintedWall(ctx: CanvasRenderingContext2D, paint: [string, string]) {
  fill(ctx, vertical(ctx, paint[0], paint[1]));
  const g = ctx.createRadialGradient(W / 2, 200, 50, W / 2, 400, 1300);
  g.addColorStop(0, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0.12)");
  fill(ctx, g);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Picture scaled to fit a box (contain), returns the drawn rect. */
export function fitBox(img: ImageBitmap, cx: number, cy: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * s;
  const h = img.height * s;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Draws part of a picture (sx..sw in 0..1 of the picture) into a rect, covering it. */
export function drawCrop(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  src: { x: number; y: number; w: number; h: number },
  dst: { x: number; y: number; w: number; h: number }
) {
  ctx.drawImage(img, src.x * img.width, src.y * img.height, src.w * img.width, src.h * img.height, dst.x, dst.y, dst.w, dst.h);
}

/** Picture covering the whole frame, zoomed `zoom` around (fx, fy) in 0..1 of the picture. */
export function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * s;
  const h = img.height * s;
  const x = clamp(W / 2 - fx * w, W - w, 0);
  const y = clamp(H / 2 - fy * h, H - h, 0);
  ctx.drawImage(img, x, y, w, h);
}

/** A printed poster: picture with a thin white border, soft shadow, optional tape. */
export function poster(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  r: { x: number; y: number; w: number; h: number },
  opts: { rot?: number; tape?: boolean; shadow?: number; border?: number } = {}
) {
  const { rot = 0, tape = false, shadow = 1, border = 0 } = opts;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(rot);
  ctx.shadowColor = `rgba(0,0,0,${0.32 * shadow})`;
  ctx.shadowBlur = 40 * shadow;
  ctx.shadowOffsetY = 18 * shadow;
  ctx.fillStyle = "#fff";
  ctx.fillRect(-r.w / 2 - border, -r.h / 2 - border, r.w + border * 2, r.h + border * 2);
  ctx.shadowColor = "transparent";
  ctx.drawImage(img, -r.w / 2, -r.h / 2, r.w, r.h);
  if (tape) {
    const tw = Math.max(40, r.w * 0.28);
    ctx.fillStyle = "rgba(255,244,214,0.82)";
    ctx.save();
    ctx.translate(0, -r.h / 2);
    ctx.rotate(-0.06);
    ctx.fillRect(-tw / 2, -tw * 0.16, tw, tw * 0.32);
    ctx.restore();
  }
  ctx.restore();
}

export type CardLine = { text: string; tone?: "white" | "orange" | "ink" | "yellow"; size?: number };

/**
 * Sticker-style text labels (white then orange), centred in the safe zone at y.
 * `p` 0..1 pops them in; a word in [brackets] gets a yellow highlight.
 */
export function card(ctx: CanvasRenderingContext2D, input: ReelInput, lines: CardLine[], y: number, p = 1) {
  if (p <= 0) return;
  const cx = (SAFE.left + SAFE.right) / 2;
  let top = y;
  lines.forEach((line, i) => {
    const local = clamp(p * lines.length - i * 0.6);
    if (local <= 0) return;
    const size = line.size ?? (i === 0 ? 84 : 96);
    ctx.font = `700 ${size}px ${input.font}`;
    const parts = line.text.split(/(\[[^\]]+\])/).filter(Boolean);
    const widths = parts.map((s) => ctx.measureText(s.replace(/[[\]]/g, "")).width + (s.startsWith("[") ? 28 : 0));
    const tw = widths.reduce((a, b) => a + b, 0);
    const padX = 34;
    const bw = Math.min(tw + padX * 2, SAFE.right - SAFE.left + 40);
    const bh = size * 1.32;
    const tone = line.tone ?? (i === 0 ? "white" : "orange");
    const bg = { white: "#fff", orange: ORANGE, ink: INK, yellow: YELLOW }[tone];
    const fg = tone === "white" || tone === "yellow" ? INK : "#fff";
    ctx.save();
    ctx.translate(cx, top + bh / 2);
    ctx.rotate(i % 2 ? 0.035 : -0.04);
    const s = backOut(local);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(local * 2);
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 26);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.shadowColor = "transparent";
    let x = -tw / 2;
    ctx.textBaseline = "middle";
    parts.forEach((part, k) => {
      const hl = part.startsWith("[");
      const text = part.replace(/[[\]]/g, "");
      if (hl) {
        roundRect(ctx, x, -size * 0.52, widths[k], size * 1.04, 14);
        ctx.fillStyle = YELLOW;
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.fillText(text, x + 14, size * 0.04);
      } else {
        ctx.fillStyle = fg;
        ctx.fillText(text, x, size * 0.04);
      }
      x += widths[k];
    });
    ctx.restore();
    top += bh + 14;
  });
}

/** Plain text, centred in the safe zone. */
export function text(
  ctx: CanvasRenderingContext2D,
  input: ReelInput,
  s: string,
  y: number,
  opts: { size?: number; color?: string; weight?: number; alpha?: number; x?: number; align?: CanvasTextAlign; shadow?: boolean } = {}
) {
  const { size = 56, color = INK, weight = 700, alpha = 1, x = (SAFE.left + SAFE.right) / 2, align = "center", shadow = false } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${input.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 24;
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** "stickypie.in" tag at the top of the safe zone. */
export function brand(ctx: CanvasRenderingContext2D, input: ReelInput, dark = false, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 40px ${input.font}`;
  const label = "stickypie.in";
  const w = ctx.measureText(label).width + 60;
  roundRect(ctx, SAFE.left, SAFE.top + 10, w, 66, 33);
  ctx.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.fillStyle = dark ? "#fff" : ORANGE;
  ctx.textBaseline = "middle";
  ctx.fillText(label, SAFE.left + 30, SAFE.top + 45);
  ctx.restore();
}

/** A finger tap ring. */
export function tap(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - p;
  ctx.beginPath();
  ctx.arc(x, y, 30 + 40 * p, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.stroke();
  ctx.restore();
}

/** Confetti burst starting at t0. */
export function confetti(ctx: CanvasRenderingContext2D, t: number, t0: number, seed: number, cx = W / 2, cy = 800) {
  const p = t - t0;
  if (p < 0 || p > 2.4) return;
  const r = rng(seed + 0.17);
  const colors = [ORANGE, YELLOW, "#2bb673", "#3d8bfd", "#ff4f8b", "#fff"];
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const v = 600 + r() * 900;
    const x = cx + Math.cos(a) * v * p;
    const y = cy + Math.sin(a) * v * p * 0.8 + 900 * p * p;
    ctx.save();
    ctx.globalAlpha = clamp(1.6 - p * 0.7);
    ctx.translate(x, y);
    ctx.rotate(p * 8 * (r() - 0.5));
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-9, -5, 18, 10);
    ctx.restore();
  }
}

/** Flash of white, strongest at t0. */
export function flash(ctx: CanvasRenderingContext2D, t: number, t0: number, len = 0.25) {
  const p = 1 - Math.abs(t - t0) / len;
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = p * 0.8;
  fill(ctx, "#fff");
  ctx.restore();
}

/** One of the 9 puzzle tiles (index = its home cell) drawn at cell position (col,row) of rect r. */
export function tile(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  index: number,
  r: { x: number; y: number; w: number; h: number },
  pos: { col: number; row: number },
  gap: number,
  opts: { lift?: number; ok?: boolean } = {}
) {
  const tw = r.w / 3;
  const th = r.h / 3;
  const x = r.x + pos.col * tw + gap / 2;
  const y = r.y + pos.row * th + gap / 2;
  const w = tw - gap;
  const h = th - gap;
  const lift = opts.lift ?? 0;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(1 + lift * 0.06, 1 + lift * 0.06);
  if (gap > 0.5) {
    ctx.shadowColor = `rgba(0,0,0,${0.18 + lift * 0.2})`;
    ctx.shadowBlur = 14 + lift * 20;
    ctx.shadowOffsetY = 6 + lift * 10;
  }
  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(14, gap * 1.2));
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(14, gap * 1.2));
  ctx.clip();
  const sx = (index % 3) / 3;
  const sy = Math.floor(index / 3) / 3;
  ctx.drawImage(img, sx * img.width, sy * img.height, img.width / 3, img.height / 3, -w / 2, -h / 2, w, h);
  ctx.restore();
  if (opts.ok) {
    ctx.strokeStyle = "#2bb673";
    ctx.lineWidth = 6;
    roundRect(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 12);
    ctx.stroke();
  }
  ctx.restore();
}

/** A shuffled order of the 9 tiles (slot of each tile) with no tile at home, fixed per seed. */
export function shuffled(seed: number): number[] {
  const r = rng(seed);
  for (let tries = 0; tries < 50; tries++) {
    const s = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 8; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    if (s.filter((v, i) => v === i).length <= 1) return s;
  }
  return [4, 0, 1, 2, 3, 8, 5, 6, 7];
}

/** The swaps (tile a, tile b) that solve a shuffle, one tile settled per swap. */
export function solveSteps(slots: number[]): [number, number][] {
  const s = [...slots];
  const steps: [number, number][] = [];
  for (let t = 0; t < 9; t++) {
    if (s[t] === t) continue;
    const other = s.indexOf(t);
    steps.push([t, other]);
    [s[t], s[other]] = [s[other], s[t]];
  }
  return steps;
}

/** Slots after the first k swaps. */
export function slotsAfter(slots: number[], steps: [number, number][], k: number): number[] {
  const s = [...slots];
  for (let i = 0; i < k; i++) {
    const [a, b] = steps[i];
    [s[a], s[b]] = [s[b], s[a]];
  }
  return s;
}
