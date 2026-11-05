// Lays print pieces out on sheets. Everything in mm. Browser-safe, no deps.

export type PackSheet = { w: number; h: number; margin: number; gap: number };
export type Packed<P> = P & { x: number; y: number; rotated: boolean };

type Rect = { x: number; y: number; w: number; h: number };

/**
 * MaxRects packing (best short side fit), biggest pieces first, turned 90°
 * where that fits better. Each piece takes its size + gap, and the sheet
 * area gets + gap too, so pieces end up gap apart and inside the margins.
 * With `upright`, a piece turns only when it can't fit standing up.
 */
export function pack<P extends { w: number; h: number }>(pieces: P[], size: PackSheet, opts: { upright?: boolean } = {}): Packed<P>[][] {
  const { margin: MARGIN, gap: GAP } = size;
  const W = size.w - MARGIN * 2 + GAP;
  const H = size.h - MARGIN * 2 + GAP;
  const sheets: { free: Rect[]; placed: Packed<P>[] }[] = [];

  function place(sheet: { free: Rect[]; placed: Packed<P>[] }, p: P): boolean {
    let best = null as { r: Rect; rotated: boolean; short: number; long: number } | null;
    for (const turn of opts.upright ? [[false], [true]] : [[false, true]]) {
      for (const r of sheet.free) {
        for (const rotated of turn) {
          const w = (rotated ? p.h : p.w) + GAP;
          const h = (rotated ? p.w : p.h) + GAP;
          if (w > r.w + 1e-6 || h > r.h + 1e-6) continue;
          const short = Math.min(r.w - w, r.h - h);
          const long = Math.max(r.w - w, r.h - h);
          if (!best || short < best.short || (short === best.short && long < best.long)) {
            best = { r, rotated, short, long };
          }
        }
      }
      if (best) break;
    }
    if (!best) return false;
    const w = (best.rotated ? p.h : p.w) + GAP;
    const h = (best.rotated ? p.w : p.h) + GAP;
    const used: Rect = { x: best.r.x, y: best.r.y, w, h };
    sheet.placed.push({ ...p, x: MARGIN + used.x, y: MARGIN + used.y, rotated: best.rotated });
    // Split every free rectangle the new one overlaps, then drop ones inside others.
    const next: Rect[] = [];
    for (const r of sheet.free) {
      if (used.x >= r.x + r.w || used.x + used.w <= r.x || used.y >= r.y + r.h || used.y + used.h <= r.y) {
        next.push(r);
        continue;
      }
      if (used.x > r.x) next.push({ x: r.x, y: r.y, w: used.x - r.x, h: r.h });
      if (used.x + used.w < r.x + r.w) next.push({ x: used.x + used.w, y: r.y, w: r.x + r.w - used.x - used.w, h: r.h });
      if (used.y > r.y) next.push({ x: r.x, y: r.y, w: r.w, h: used.y - r.y });
      if (used.y + used.h < r.y + r.h) next.push({ x: r.x, y: used.y + used.h, w: r.w, h: r.y + r.h - used.y - used.h });
    }
    sheet.free = next.filter(
      (a, i) =>
        !next.some(
          (b, j) => i !== j && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)
        )
    );
    return true;
  }

  for (const p of [...pieces].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h)) {
    if (sheets.some((s) => place(s, p))) continue;
    const sheet = { free: [{ x: 0, y: 0, w: W, h: H }], placed: [] as Packed<P>[] };
    sheets.push(sheet);
    place(sheet, p);
  }
  return sheets.map((s) => s.placed);
}

/**
 * Fewest sheets for pieces of a few sizes: fills one sheet at a time with the
 * mix of sizes, upright and turned, that covers the most paper, then moves on.
 */
export function packTight<P extends { w: number; h: number }>(pieces: P[], size: PackSheet): Packed<P>[][] {
  const groups = new Map<string, P[]>();
  for (const p of pieces) {
    const key = `${Math.max(p.w, p.h).toFixed(3)}x${Math.min(p.w, p.h).toFixed(3)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const left = [...groups.values()].sort((a, b) => b[0].w * b[0].h - a[0].w * a[0].h);
  const sheetArea = (size.w - size.margin * 2) * (size.h - size.margin * 2);
  const fits = new Map<string, boolean>();
  const sheets: Packed<P>[][] = [];

  /** Puts `count[g]` of each group on a sheet, `turn[g]` of them on their side. */
  const build = (count: number[], turn: number[]) =>
    left.flatMap((group, g) =>
      group.slice(0, count[g]).map((p, i) => (i < turn[g] ? { ...p, w: p.h, h: p.w, turned: true } : { ...p, turned: false }))
    );
  const tryMix = (count: number[], turn: number[]) => {
    const key = `${count}|${turn}`;
    const cached = fits.get(key);
    if (cached === false) return null;
    const list = build(count, turn);
    const placed = pack(list, size, { upright: true });
    const ok = placed.length === 1 && placed[0].length === list.length;
    fits.set(key, ok);
    return ok ? placed[0] : null;
  };

  while (left.some((g) => g.length > 0)) {
    let best: ReturnType<typeof tryMix> = null;
    let bestArea = 0;
    const walk = (g: number, count: number[], turn: number[], area: number) => {
      if (g === left.length) {
        if (area <= bestArea) return;
        const placed = tryMix(count, turn);
        if (placed) {
          best = placed;
          bestArea = area;
        }
        return;
      }
      const piece = left[g][0];
      const one = piece ? piece.w * piece.h : 0;
      for (let c = 0; c <= left[g].length && area + c * one <= sheetArea; c++) {
        for (let t = 0; t <= c; t++) walk(g + 1, [...count, c], [...turn, t], area + c * one);
      }
    };
    walk(0, [], [], 0);
    const chosen = best as ReturnType<typeof tryMix>;
    if (!chosen) break; // What's left doesn't fit on a sheet at all.
    sheets.push(chosen.map(({ turned, ...p }) => (turned ? { ...p, w: p.h, h: p.w, rotated: !p.rotated } : p)) as unknown as Packed<P>[]);
    const used = new Map<number, number>();
    left.forEach((group, g) => {
      const n = chosen.filter((p) => group.some((q) => q.w * q.h === p.w * p.h)).length;
      used.set(g, n);
    });
    left.forEach((group, g) => group.splice(0, used.get(g) ?? 0));
  }
  return sheets;
}
