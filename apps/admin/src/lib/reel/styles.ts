// The ten reel styles. Each draws one frame at time t (seconds) from the
// product's pictures; every style works for a puzzle poster, a wall poster
// and a wall set, with the words picked for that kind.
import type { ReelInput, ReelStyle } from "./types";
import {
  H, INK, ORANGE, SAFE, W, YELLOW, backOut, brand, card, clamp, confetti, cover, easeInOut, easeOut, fill,
  fitBox, flash, gridPaper, lerp, paintedWall, poster, prog, roundRect, rupees, rng, shuffled, slotsAfter, solveSteps,
  tap, text, tile, vertical,
} from "./kit";

const CY = 790; // centre of the main picture
const box = (input: ReelInput, maxW = 700, maxH = 1000) => fitBox(input.art, W / 2, CY, maxW, maxH);

/** Price lines as one short string: "4×6 ₹60 · 6×9 ₹120". */
const priceRow = (input: ReelInput) => input.prices.map((p) => `${p.label} ${rupees(p.price)}`).join("  ·  ");

/** The last beat every style shares: price card, then the call to action. */
function outro(ctx: CanvasRenderingContext2D, t: number, input: ReelInput, t0: number, dark = false) {
  const p1 = prog(t, t0, t0 + 0.5);
  const p2 = prog(t, t0 + 1.6, t0 + 2.1);
  if (t < t0 + 1.6) card(ctx, input, priceLines(input), 1150, p1);
  else card(ctx, input, [{ text: input.cta[0] }, { text: input.cta[1] }], 1150, p2);
  brand(ctx, input, dark, prog(t, t0, t0 + 0.4));
}

function priceLines(input: ReelInput) {
  const a = input.prices[0];
  const b = input.prices[1];
  if (input.kind === "wall") return [{ text: input.feet ? `${input.posters.length} POSTERS · ${input.feet}` : `${input.posters.length} POSTERS`, size: 64 }, { text: `[${rupees(input.from)}]`, size: 104 }];
  return [
    { text: b ? `${a.label} ${rupees(a.price)}` : a.label, size: 70 },
    { text: b ? `${b.label} [${rupees(b.price)}]` : `[${rupees(a.price)}]`, size: 84 },
  ];
}

/* 1. Solve & win: the poster splits, shuffles and gets solved, then the prize. */
const solve: ReelStyle = {
  id: "solve",
  name: "Solve & win",
  blurb: "Splits into 9 cards, shuffles, gets solved with taps, prize pops.",
  duration: 15,
  draw(ctx, t, input) {
    gridPaper(ctx, t * 10);
    const r = box(input, 760, 1060);
    const slots0 = shuffled(input.seed);
    const steps = solveSteps(slots0);
    const split = easeOut(prog(t, 1.4, 2.0));
    const gap = 16 * split * (1 - easeOut(prog(t, 2.6 + steps.length * 0.75 + 0.2, 2.6 + steps.length * 0.75 + 0.6)));
    const mixP = easeInOut(prog(t, 2.0, 2.6));
    const swapT = (t - 2.6) / 0.75;
    const k = clamp(Math.floor(swapT), 0, steps.length);
    const local = swapT - Math.floor(swapT);
    const before = slotsAfter(slots0, steps, k);
    const solvedAt = 2.6 + steps.length * 0.75;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    roundRect(ctx, r.x - 18, r.y - 18, r.w + 36, r.h + 36, 30);
    ctx.fillStyle = "#2a211c";
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 9; i++) {
      let slot = i;
      let lift = 0;
      if (t >= 2.0 && t < 2.6) {
        const from = { col: i % 3, row: Math.floor(i / 3) };
        const to = { col: slots0[i] % 3, row: Math.floor(slots0[i] / 3) };
        tile(ctx, input.art, i, r, { col: lerp(from.col, to.col, mixP), row: lerp(from.row, to.row, mixP) }, gap, { lift: Math.sin(mixP * Math.PI) });
        continue;
      }
      if (t >= 2.6) {
        slot = before[i];
        if (k < steps.length) {
          const [a, b] = steps[k];
          const moveP = easeInOut(prog(local, 0.45, 0.9));
          if (i === a || i === b) {
            const other = i === a ? b : a;
            const from = before[i];
            const to = before[other];
            lift = local < 0.45 ? (i === a ? prog(local, 0, 0.15) : prog(local, 0.25, 0.4)) : 1 - moveP;
            tile(ctx, input.art, i, r, { col: lerp(from % 3, to % 3, moveP), row: lerp(Math.floor(from / 3), Math.floor(to / 3), moveP) }, gap, { lift });
            continue;
          }
        }
      }
      tile(ctx, input.art, i, r, { col: slot % 3, row: Math.floor(slot / 3) }, gap, { ok: t > 2.6 && slot === i && t < solvedAt });
    }
    if (t >= 2.6 && k < steps.length) {
      const [a, b] = steps[k];
      const cell = (s: number) => ({ x: r.x + ((s % 3) + 0.5) * (r.w / 3), y: r.y + (Math.floor(s / 3) + 0.5) * (r.h / 3) });
      const ca = cell(before[a]);
      const cb = cell(before[b]);
      tap(ctx, ca.x, ca.y, prog(local, 0, 0.3));
      tap(ctx, cb.x, cb.y, prog(local, 0.25, 0.55));
    }
    flash(ctx, t, solvedAt + 0.4);
    confetti(ctx, t, solvedAt + 0.4, input.seed, W / 2, CY);
    if (t < 2.4) card(ctx, input, [{ text: input.hook[0] }, { text: input.hook[1] }], 1150, prog(t, 0.1, 0.6));
    else if (t < solvedAt + 0.4) card(ctx, input, [{ text: "SWAP THEM", size: 72 }, { text: "BACK", size: 84 }], 1170, prog(t, 2.6, 3.0));
    else if (t < solvedAt + 2.6) {
      const won = input.kind === "puzzle" ? [{ text: "YOU WON", size: 72 }, { text: `[${input.pct}%] OFF`, size: 104 }] : [{ text: "SOLVED!", size: 80 }, { text: "NOW HANG IT", size: 84 }];
      card(ctx, input, won, 1150, prog(t, solvedAt + 0.4, solvedAt + 0.9));
    } else outro(ctx, t, input, solvedAt + 2.6);
    brand(ctx, input, false, t < solvedAt + 2.6 ? 1 : 0);
  },
};

/* 2. Peel reveal: an orange sheet peels off the corner to show the poster. */
const peel: ReelStyle = {
  id: "peel",
  name: "Peel reveal",
  blurb: "An orange cover peels off from the corner like a sticker backing.",
  duration: 12,
  draw(ctx, t, input) {
    fill(ctx, vertical(ctx, "#ff8a3d", "#e2541a"));
    const r = box(input, 720, 1040);
    const bob = Math.sin(t * 1.6) * 8;
    const R = { ...r, y: r.y + bob };
    poster(ctx, input.art, R, { shadow: 1.2 });
    // peel: the revealed corner grows from the bottom right
    const p = easeInOut(prog(t, 1.2, 4.2));
    const d = p * (R.w + R.h) * 1.02;
    const c = R.w + R.h - d; // fold line x + y = c in poster coords
    ctx.save();
    ctx.translate(R.x, R.y);
    ctx.beginPath();
    ctx.rect(0, 0, R.w, R.h);
    ctx.clip();
    // the cover: the part with x + y < c (the clip keeps it inside the poster)
    const M = 4000;
    ctx.beginPath();
    ctx.moveTo(-M, -M);
    ctx.lineTo(c + M, -M);
    ctx.lineTo(-M, c + M);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, R.w, R.h);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, "#f1ece6");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = ORANGE;
    ctx.font = `700 ${Math.round(R.w * 0.11)}px ${input.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = clamp(1 - p * 2.5);
    ctx.fillText("PEEL ME", R.w / 2, R.h / 2);
    ctx.globalAlpha = 1;
    ctx.restore();
    // the flap: the revealed corner mirrored across the fold line
    const shown = clipHalf([[0, 0], [R.w, 0], [R.w, R.h], [0, R.h]], c);
    if (p > 0 && p < 1 && shown.length >= 3) {
      const pts = shown.map(([x, y]) => [c - y, c - x]);
      ctx.save();
      ctx.translate(R.x, R.y);
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      const fg = ctx.createLinearGradient(pts[1][0], pts[1][1], pts[0][0], pts[0][1]);
      fg.addColorStop(0, "#d9d2ca");
      fg.addColorStop(1, "#ffffff");
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.restore();
    }
    if (t < 1.2) card(ctx, input, [{ text: input.hook[0] }, { text: input.hook[1] }], 1150, prog(t, 0.1, 0.6));
    else if (t < 6.5) card(ctx, input, [{ text: "FRESH DROP", size: 70 }, { text: input.name.toUpperCase().slice(0, 18), size: 76 }], 1150, prog(t, 4.3, 4.8));
    if (t >= 6.5 && t < 8.5) card(ctx, input, [{ text: "PREMIUM", size: 72 }, { text: "POSTER PAPER", size: 84 }], 1150, prog(t, 6.5, 7));
    if (t >= 8.5) outro(ctx, t, input, 8.5, true);
    brand(ctx, input, true, t < 8.5 ? 1 : 0);
  },
};

/** The part of a polygon where x + y >= c (Sutherland–Hodgman against one line). */
function clipHalf(poly: number[][], c: number): number[][] {
  const out: number[][] = [];
  const inside = (p: number[]) => p[0] + p[1] >= c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const k = (c - a[0] - a[1]) / (b[0] - a[0] + b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}

/* 3. Detail zoom: slow pans over three parts of the art, then the whole poster. */
const details: ReelStyle = {
  id: "details",
  name: "Detail zoom",
  blurb: "Slow cinematic pans over the artwork, then the full poster.",
  duration: 14,
  draw(ctx, t, input) {
    const shots: [number, number, number, number][] = [
      // [focus x, focus y, zoom from, zoom to]
      [0.35, 0.22, 2.6, 2.2],
      [0.62, 0.5, 2.2, 2.6],
      [0.45, 0.8, 2.6, 2.1],
    ];
    if (t < 7.5) {
      const i = Math.min(2, Math.floor(t / 2.5));
      const p = (t - i * 2.5) / 2.5;
      const [fx, fy, z0, z1] = shots[i];
      cover(ctx, input.art, lerp(z0, z1, p), fx + (p - 0.5) * 0.06, fy);
      const v = ctx.createLinearGradient(0, H * 0.45, 0, H);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.55)");
      fill(ctx, v);
      flash(ctx, t, i * 2.5, 0.12);
      const words: [string, string][] = [input.hook, ["EVERY", "DETAIL"], ["PREMIUM", "POSTER PAPER"]];
      card(ctx, input, [{ text: words[i][0], size: 76 }, { text: words[i][1], size: 88 }], 1150, prog(p, 0.05, 0.35));
      brand(ctx, input, true);
      return;
    }
    gridPaper(ctx);
    const p = easeOut(prog(t, 7.5, 8.4));
    const r = box(input, 720, 1040);
    const s = lerp(1.6, 1, p);
    poster(ctx, input.art, { x: W / 2 - (r.w * s) / 2, y: CY - (r.h * s) / 2, w: r.w * s, h: r.h * s }, { tape: true });
    if (t < 10) card(ctx, input, [{ text: "THE FULL", size: 70 }, { text: input.kind === "wall" ? "WALL SET" : "POSTER", size: 90 }], 1150, prog(t, 8.2, 8.7));
    else outro(ctx, t, input, 10);
  },
};

/* 4. Wall build: posters fly onto a painted wall (a wall set spot by spot). */
const wallBuild: ReelStyle = {
  id: "wall-build",
  name: "Wall build",
  blurb: "Posters fly onto a painted wall one by one and get taped up.",
  duration: 14,
  draw(ctx, t, input) {
    paintedWall(ctx, input.paint);
    const items = wallItems(input);
    const per = Math.min(0.45, 5.5 / items.length);
    items.forEach((it, i) => {
      const t0 = 1.0 + i * per;
      const p = easeOut(prog(t, t0, t0 + 0.55));
      if (p <= 0) return;
      const r0 = { x: it.r.x + (i % 2 ? 500 : -500), y: it.r.y + 700, w: it.r.w * 1.4, h: it.r.h * 1.4 };
      const r = { x: lerp(r0.x, it.r.x, p), y: lerp(r0.y, it.r.y, p), w: lerp(r0.w, it.r.w, p), h: lerp(r0.h, it.r.h, p) };
      poster(ctx, it.art, r, { rot: (1 - p) * (i % 2 ? 0.4 : -0.4) + it.rot, tape: p > 0.95, shadow: 0.6 + (1 - p) });
    });
    const done = 1.0 + items.length * per + 0.6;
    if (t < done) card(ctx, input, [{ text: input.hook[0] }, { text: input.hook[1] }], 1260, prog(t, 0.2, 0.7));
    else if (t < done + 2.2)
      card(ctx, input, input.kind === "wall" ? [{ text: "YOUR WALL", size: 70 }, { text: "IN ONE BOX", size: 84 }] : [{ text: "STICKS ON", size: 72 }, { text: "ANY WALL", size: 84 }], 1260, prog(t, done, done + 0.5));
    else outro(ctx, t, input, done + 2.2, true);
    brand(ctx, input, true);
  },
};

/** Where posters hang on the wall: a wall set's own spots, else the poster alone. */
function wallItems(input: ReelInput, area = { x: 90, y: 330, w: 900, h: 900 }) {
  if (input.kind === "wall" && input.posters.length) {
    if (input.spots && input.spots.length === input.posters.length) {
      // spots are percent of the (square) wall picture
      return input.posters.map((p, i) => {
        const [x, y, w, h] = input.spots![i];
        return { art: p.art, r: { x: area.x + (x / 100) * area.w, y: area.y + (y / 100) * area.h, w: (w / 100) * area.w, h: (h / 100) * area.h }, rot: 0 };
      });
    }
    // no spots: a neat grid
    const n = input.posters.length;
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    // 2:3 posters, as big as the cells allow, the block centred in the area
    const h = Math.min(area.h / rows, (area.w / cols) * 1.5) - 20;
    const w = h / 1.5;
    const ox = area.x + (area.w - cols * (w + 20)) / 2;
    const oy = area.y + (area.h - rows * (h + 20)) / 2;
    return input.posters.map((p, i) => ({
      art: p.art,
      r: { x: ox + (i % cols) * (w + 20) + 10, y: oy + Math.floor(i / cols) * (h + 20) + 10, w, h },
      rot: 0,
    }));
  }
  const r = fitBox(input.art, W / 2, 760, 600, 880);
  return [{ art: input.art, r, rot: -0.02 }];
}

/* 5. Size check: the sizes side by side, to scale, with a ruler. */
const sizes: ReelStyle = {
  id: "sizes",
  name: "Size check",
  blurb: "Both sizes side by side to scale, with a ruler and prices.",
  duration: 12,
  draw(ctx, t, input) {
    gridPaper(ctx);
    const base = 1180;
    if (input.kind === "wall") {
      // below the two-line card at the top
      const area = { x: 190, y: 600, w: 700, h: 700 };
      const items = wallItems(input, area);
      const p = easeOut(prog(t, 0.6, 1.6));
      paintedWallBox(ctx, input, p, area);
      items.forEach((it) => poster(ctx, it.art, it.r, { shadow: 0.5 }));
      dimension(ctx, input, area.x, area.y + area.h + 40, area.x + area.w, 0, input.feet ?? `${input.posters.length} posters`, prog(t, 1.8, 2.6));
    } else {
      const labels = input.prices.slice(0, 2);
      const longest = input.kind === "puzzle" ? [18, 27] : [6, 9];
      const scale = 600 / Math.max(...longest.slice(0, labels.length));
      labels.forEach((l, i) => {
        const p = backOut(prog(t, 0.6 + i * 0.5, 1.2 + i * 0.5));
        if (p <= 0) return;
        const h = longest[i] * scale * p;
        const w = (h * 2) / 3;
        const x = labels.length === 1 ? W / 2 - w / 2 : i === 0 ? 120 : 560;
        poster(ctx, input.art, { x, y: base - h, w, h }, { shadow: 0.8 });
        text(ctx, input, l.label, base + 50, { size: 50, x: x + w / 2, alpha: prog(t, 1.2 + i * 0.5, 1.6 + i * 0.5) });
        text(ctx, input, rupees(l.price), base + 110, { size: 60, color: ORANGE, x: x + w / 2, alpha: prog(t, 1.2 + i * 0.5, 1.6 + i * 0.5) });
      });
      ruler(ctx, input, base, prog(t, 0.2, 0.8));
    }
    if (t < 3.5) card(ctx, input, [{ text: "WHICH SIZE", size: 70 }, { text: "FITS YOUR WALL?", size: 74 }], 300, prog(t, 0.1, 0.6));
    else if (t < 7.5)
      card(ctx, input, input.kind === "puzzle" ? [{ text: "9 CARDS BUILD", size: 66 }, { text: "ONE BIG POSTER", size: 76 }] : input.kind === "wall" ? [{ text: "THE WHOLE SET", size: 66 }, { text: rupees(input.from), size: 90 }] : [{ text: "PREMIUM", size: 66 }, { text: "POSTER PAPER", size: 76 }], 300, prog(t, 3.5, 4));
    else card(ctx, input, [{ text: input.cta[0], size: 70 }, { text: input.cta[1], size: 80 }], 300, prog(t, 7.5, 8));
  },
};

function paintedWallBox(ctx: CanvasRenderingContext2D, input: ReelInput, p: number, a: { x: number; y: number; w: number; h: number }) {
  ctx.save();
  ctx.globalAlpha = p;
  roundRect(ctx, a.x - 30, a.y - 30, a.w + 60, a.h + 60, 30);
  ctx.fillStyle = vertical(ctx, input.paint[0], input.paint[1]);
  ctx.fill();
  ctx.restore();
}

function ruler(ctx: CanvasRenderingContext2D, input: ReelInput, base: number, p: number) {
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.fillStyle = YELLOW;
  roundRect(ctx, 60, base + 4, 960 * p, 18, 6);
  ctx.fill();
  ctx.fillStyle = INK;
  for (let i = 0; i <= 40 * p; i++) ctx.fillRect(60 + i * 24, base + 4, 3, i % 4 === 0 ? 18 : 9);
  ctx.restore();
  void input;
}

function dimension(ctx: CanvasRenderingContext2D, input: ReelInput, x1: number, y: number, x2: number, _y2: number, label: string, p: number) {
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(lerp(x1, x2, p), y);
  ctx.moveTo(x1, y - 20);
  ctx.lineTo(x1, y + 20);
  ctx.moveTo(x2, y - 20);
  ctx.lineTo(x2, y + 20);
  ctx.stroke();
  ctx.restore();
  text(ctx, input, label, y + 60, { size: 54, alpha: p });
}

/* 6. Fast cuts: punchy 3-2-1 cuts across the art, then the drop. */
const fastCuts: ReelStyle = {
  id: "fast-cuts",
  name: "Fast cuts",
  blurb: "Quick 3-2-1 cuts across the art with flashes, then the drop.",
  duration: 10,
  draw(ctx, t, input) {
    const r = rng(input.seed + 0.3);
    const cuts = Array.from({ length: 8 }, () => [0.2 + r() * 0.6, 0.15 + r() * 0.7, 2 + r() * 1.4]);
    if (t < 3.6) {
      const i = Math.floor(t / 0.45) % cuts.length;
      const p = (t % 0.45) / 0.45;
      const [fx, fy, z] = cuts[i];
      cover(ctx, input.art, z + p * 0.25, fx, fy);
      fill(ctx, "rgba(0,0,0,0.25)");
      const n = 3 - Math.floor(t / 1.2);
      ctx.save();
      const s = backOut(clamp(((t % 1.2) / 1.2) * 3));
      ctx.translate(SAFE.left + (SAFE.right - SAFE.left) / 2, 820);
      ctx.scale(s, s);
      text(ctx, input, String(Math.max(1, n)), 0, { size: 420, color: "#fff", x: 0, shadow: true });
      ctx.restore();
      flash(ctx, t, Math.round(t / 0.45) * 0.45, 0.08);
      card(ctx, input, [{ text: input.hook[0], size: 70 }, { text: input.hook[1], size: 80 }], 1200, prog(t, 0.05, 0.4));
      brand(ctx, input, true);
      return;
    }
    gridPaper(ctx, t * 30);
    const p = backOut(prog(t, 3.6, 4.2));
    const rr = box(input, 720, 1040);
    const s = lerp(0.3, 1, p);
    poster(ctx, input.art, { x: W / 2 - (rr.w * s) / 2, y: CY - (rr.h * s) / 2, w: rr.w * s, h: rr.h * s }, { rot: (1 - p) * 0.3 });
    flash(ctx, t, 3.6, 0.3);
    if (t < 6) card(ctx, input, [{ text: "JUST", size: 70 }, { text: "DROPPED", size: 96 }], 1150, prog(t, 3.9, 4.3));
    else outro(ctx, t, input, 6);
  },
};

/* 7. Before / after: a bare wall, a wipe, the same wall with the poster(s). */
const beforeAfter: ReelStyle = {
  id: "before-after",
  name: "Before / after",
  blurb: "A bare wall, a swipe, the same wall dressed up.",
  duration: 12,
  draw(ctx, t, input) {
    const scene = (dressed: boolean) => {
      paintedWall(ctx, input.paint);
      // skirting and a little lamp, so it reads as a room
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 1500, W, 420);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 1490, W, 14);
      lamp(ctx);
      if (dressed) wallItems(input).forEach((it) => poster(ctx, it.art, it.r, { tape: true, shadow: 0.7, rot: it.rot }));
    };
    const wipe = easeInOut(prog(t, 2.2, 3.6));
    scene(false);
    if (wipe > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W * wipe, H);
      ctx.clip();
      scene(true);
      ctx.restore();
      if (wipe < 1) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(W * wipe - 5, 0, 10, H);
        ctx.beginPath();
        ctx.arc(W * wipe, 1000, 46, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, input, "⇆", 1000, { size: 50, x: W * wipe });
      }
    }
    if (t < 2.2) card(ctx, input, [{ text: "BEFORE", tone: "ink", size: 80 }, { text: "BORING WALL", size: 74 }], 1250, prog(t, 0.2, 0.6));
    else if (t < 6.5) card(ctx, input, [{ text: "AFTER", tone: "white", size: 80 }, { text: input.kind === "wall" ? `${input.posters.length} POSTERS` : "ONE POSTER", size: 80 }], 1250, prog(t, 3.6, 4.1));
    else outro(ctx, t, input, 6.5, true);
    brand(ctx, input, true);
  },
};

function lamp(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "rgba(40,30,25,0.85)";
  ctx.fillRect(900, 1150, 10, 360);
  ctx.beginPath();
  ctx.moveTo(840, 1160);
  ctx.lineTo(970, 1160);
  ctx.lineTo(940, 1060);
  ctx.lineTo(870, 1060);
  ctx.closePath();
  ctx.fillStyle = "#f5e6c8";
  ctx.fill();
  const g = ctx.createRadialGradient(905, 1200, 10, 905, 1250, 320);
  g.addColorStop(0, "rgba(255,230,170,0.35)");
  g.addColorStop(1, "rgba(255,230,170,0)");
  ctx.fillStyle = g;
  ctx.fillRect(560, 900, 700, 700);
  ctx.restore();
}

/* 8. Price tag: a swinging price ticket; puzzle shows the prize price. */
const priceTag: ReelStyle = {
  id: "price-tag",
  name: "Price tag",
  blurb: "A swinging price tag; puzzles show the price after the prize.",
  duration: 11,
  draw(ctx, t, input) {
    fill(ctx, vertical(ctx, "#1f1a17", "#3a2a20"));
    const r = box(input, 640, 900);
    poster(ctx, input.art, { ...r, y: r.y - 60 }, { shadow: 1.4, tape: true });
    const swing = Math.sin(t * 3) * 0.12 * Math.exp(-prog(t, 1, 6) * 2);
    const drop = backOut(prog(t, 0.8, 1.5));
    ctx.save();
    ctx.translate(r.x + r.w - 40, r.y - 40 + lerp(-600, 0, drop));
    ctx.rotate(0.18 + swing);
    ctx.strokeStyle = "#d9c9b0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 140);
    ctx.stroke();
    roundRect(ctx, -150, 140, 300, 220, 26);
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 170, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#1f1a17";
    ctx.fill();
    const prize = input.kind === "puzzle" && t > 4.2;
    const main = prize ? input.prices[0].price * (1 - input.pct / 100) : input.from;
    const old = prize ? input.prices[0].price : input.prices[0].was;
    text(ctx, input, input.kind === "puzzle" ? (prize ? "AFTER PRIZE" : input.prices[0].label) : "FROM", 215, { size: 34, x: 0 });
    text(ctx, input, rupees(main), 285, { size: 92, x: 0 });
    if (old && old > main) {
      text(ctx, input, rupees(old), 330, { size: 34, x: 0, color: "rgba(0,0,0,0.55)" });
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-46, 328, 92, 4);
    }
    ctx.restore();
    if (input.kind === "puzzle") flash(ctx, t, 4.2, 0.2);
    if (t < 2.5) card(ctx, input, [{ text: input.hook[0] }, { text: input.hook[1] }], 1250, prog(t, 0.1, 0.6));
    else if (t < 6.5)
      card(ctx, input, input.kind === "puzzle" ? [{ text: "SOLVE THE PUZZLE", size: 62 }, { text: `GET [${input.pct}%] OFF`, size: 84 }] : [{ text: priceRow(input), size: 50, tone: "white" }, { text: "PREMIUM POSTER PAPER", size: 62 }], 1250, prog(t, 2.5, 3));
    else card(ctx, input, [{ text: input.cta[0] }, { text: input.cta[1] }], 1250, prog(t, 6.5, 7));
    brand(ctx, input, true);
  },
};

/* 9. Card deal: cards dealt from a deck into place (9 puzzle cards, or a wall set's posters). */
const deal: ReelStyle = {
  id: "deal",
  name: "Card deal",
  blurb: "Cards are dealt from a deck and land in place to build the picture.",
  duration: 13,
  draw(ctx, t, input) {
    // a wooden table
    fill(ctx, vertical(ctx, "#7a4e2d", "#4d2f1a"));
    ctx.save();
    ctx.globalAlpha = 0.08;
    for (let y = 0; y < H; y += 26) {
      ctx.fillStyle = y % 52 ? "#000" : "#fff";
      ctx.fillRect(0, y, W, 6);
    }
    ctx.restore();
    const deck = { x: W / 2, y: 1700 };
    if (input.kind === "wall" && input.posters.length) {
      const items = wallItems(input);
      const per = Math.min(0.5, 6 / items.length);
      items.forEach((it, i) => {
        const p = easeOut(prog(t, 1 + i * per, 1.5 + i * per));
        if (p <= 0) return;
        const r = { x: lerp(deck.x - it.r.w / 2, it.r.x, p), y: lerp(deck.y, it.r.y, p), w: it.r.w, h: it.r.h };
        poster(ctx, it.art, r, { rot: (1 - p) * 1.2, shadow: 0.8 });
      });
    } else {
      const r = box(input, 760, 1060);
      const order = shuffled(input.seed + 0.5).map((_, i) => i);
      order.forEach((i) => {
        const t0 = 1 + i * 0.42;
        const p = easeOut(prog(t, t0, t0 + 0.5));
        if (p <= 0) return;
        const gap = 14 * (1 - prog(t, 5.4, 5.9));
        const col = i % 3;
        const row = Math.floor(i / 3);
        const homeX = r.x + (col + 0.5) * (r.w / 3);
        const homeY = r.y + (row + 0.5) * (r.h / 3);
        ctx.save();
        ctx.translate(lerp(deck.x, homeX, p), lerp(deck.y, homeY, p));
        ctx.rotate((1 - p) * (i % 2 ? 1 : -1) * 1.4);
        ctx.translate(-homeX, -homeY);
        tile(ctx, input.art, i, r, { col, row }, gap, { lift: 1 - p });
        ctx.restore();
      });
      flash(ctx, t, 5.9, 0.2);
    }
    if (t < 4) card(ctx, input, [{ text: input.hook[0] }, { text: input.hook[1] }], 1250, prog(t, 0.1, 0.6));
    else if (t < 8.5)
      card(ctx, input, input.kind === "puzzle" ? [{ text: "9 CARDS", size: 74 }, { text: "ONE BIG POSTER", size: 80 }] : input.kind === "wall" ? [{ text: "EVERY POSTER", size: 70 }, { text: "IN ITS SPOT", size: 80 }] : [{ text: "PICK YOUR", size: 74 }, { text: "SIZE", size: 90 }], 1250, prog(t, 6, 6.5));
    else outro(ctx, t, input, 8.5, true);
    brand(ctx, input, true);
  },
};

/* 10. Clean editorial: off-white, floating poster, quiet type. */
const editorial: ReelStyle = {
  id: "editorial",
  name: "Clean editorial",
  blurb: "Calm and minimal: floating poster, clean type, specs and price.",
  duration: 12,
  draw(ctx, t, input) {
    fill(ctx, "#f6f1ea");
    const r = box(input, 620, 880);
    const enter = easeOut(prog(t, 0.2, 1.4));
    const float = Math.sin(t * 1.3) * 10;
    ctx.save();
    ctx.globalAlpha = enter;
    poster(ctx, input.art, { ...r, y: r.y - 60 + float + (1 - enter) * 80 }, { shadow: 0.9, border: 0 });
    ctx.restore();
    const y0 = r.y + r.h + 40;
    const a = (s: number) => easeOut(prog(t, s, s + 0.6));
    text(ctx, input, input.name, y0 + 30, { size: 58, alpha: a(1.4) });
    text(ctx, input, input.kind === "puzzle" ? "Puzzle poster · 9 cards" : input.kind === "wall" ? `Wall set · ${input.posters.length} mini posters` : "Mini poster · premium poster paper", y0 + 100, { size: 38, weight: 500, color: "rgba(29,27,25,0.6)", alpha: a(1.9) });
    text(ctx, input, priceRow(input), y0 + 170, { size: 44, color: ORANGE, alpha: a(2.4) });
    if (t > 6) outro(ctx, t, input, 6);
    else brand(ctx, input, false, a(0.4));
  },
};

export const REEL_STYLES: ReelStyle[] = [solve, peel, details, wallBuild, sizes, fastCuts, beforeAfter, priceTag, deal, editorial];

export function reelStyle(id: string): ReelStyle {
  return REEL_STYLES.find((s) => s.id === id) ?? REEL_STYLES[0];
}

