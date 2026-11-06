// Lays a wall out from its poster sizes, for when posters are added or removed:
// small posters in rows, big ones in the first row. Same layout as
// scripts/make-wall-setups.mjs gives the older packs.
const GAP = 0.3; // inches between posters
const SMALL = { w: 4, h: 6 };
const BIG = { w: 6, h: 9 };

type Spot = { x: number; y: number; w: number; h: number };

function packSpots(sizes: number[]) {
  const bigs = sizes.filter((s) => s === 9).length;
  const smalls = sizes.length - bigs;
  const perRow = Math.max(3, Math.ceil(Math.sqrt(sizes.length)));
  const colW = SMALL.w + GAP;
  const rowH = SMALL.h + GAP;
  const pick = (all: Spot[]) => {
    const big = all.filter((s) => s.h === 9);
    const small = all.filter((s) => s.h === 6);
    return sizes.map((size) => (size === 9 ? big.shift()! : small.shift()!));
  };
  // Too many big posters for one row: rows of big ones, then the small ones.
  const perBig = Math.max(2, Math.floor((perRow * colW) / (BIG.w + GAP)));
  if (bigs > perBig) {
    const wide = Math.max(perBig * (BIG.w + GAP), perRow * colW) - GAP;
    const rows = (count: number, each: number, poster: typeof SMALL, top: number) =>
      Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / each);
        const inRow = Math.min(each, count - row * each);
        const step = poster.w + GAP;
        return { x: (wide - (inRow * step - GAP)) / 2 + (i % each) * step, y: top + row * (poster.h + GAP), ...poster };
      });
    return pick([...rows(bigs, perBig, BIG, 0), ...rows(smalls, perRow, SMALL, Math.ceil(bigs / perBig) * (BIG.h + GAP))]);
  }
  const beside = Math.min(smalls, Math.max(0, bigs ? perRow - bigs : 0));
  const first: Spot[] = [];
  let x = 0;
  const left = Math.floor(beside / 2);
  const topH = bigs ? BIG.h : SMALL.h;
  for (let i = 0; i < left; i++, x += colW) first.push({ x, y: (topH - SMALL.h) / 2, ...SMALL });
  for (let i = 0; i < bigs; i++, x += BIG.w + GAP) first.push({ x, y: 0, ...BIG });
  for (let i = left; i < beside; i++, x += colW) first.push({ x, y: (topH - SMALL.h) / 2, ...SMALL });
  const width = Math.max(x - GAP, perRow * colW - GAP);
  const inset = (width - (x - GAP)) / 2;
  for (const s of first) s.x += inset;
  const rest: Spot[] = [];
  const left2 = smalls - beside;
  const rows = Math.ceil(left2 / perRow);
  for (let r = 0; r < rows; r++) {
    const count = Math.min(perRow, left2 - r * perRow);
    const pad = (width - (count * colW - GAP)) / 2;
    for (let i = 0; i < count; i++) rest.push({ x: pad + i * colW, y: (first.length ? topH + GAP : 0) + r * rowH, ...SMALL });
  }
  return pick([...first, ...rest]);
}

/** Each poster's spot as [x, y, w, h] in % of the square picture, in poster order, and the wall's size in feet. */
export function arrangeWall(sizes: number[]) {
  const spots = packSpots(sizes);
  const width = Math.max(...spots.map((s) => s.x + s.w));
  const height = Math.max(...spots.map((s) => s.y + s.h));
  const scale = 92 / Math.max(width, height);
  const ox = (100 - width * scale) / 2;
  const oy = (100 - height * scale) / 2;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    spots: spots.map((s) => [ox + s.x * scale, oy + s.y * scale, s.w * scale, s.h * scale].map(round)),
    feet: `${(width / 12).toFixed(1)} × ${(height / 12).toFixed(1)} ft`,
  };
}
