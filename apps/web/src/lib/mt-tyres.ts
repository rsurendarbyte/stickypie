// Mud-terrain tyres for the car cursor (components/car-cursor.tsx). Each tyre
// is drawn on a 64×64 grid as SVG markup, and comes with its own tread print
// (what it leaves in the mud). One is picked at random on every page load.

const C = 32;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, a: number): [number, number] => [C + r * Math.sin(rad(a)), C - r * Math.cos(rad(a))];
const f = (n: number) => n.toFixed(2);
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")} Z`;

/** Tread print pattern drawn on the canvas, across the track (x along the path). */
export type PrintStyle = "staggered" | "chevron" | "blocks" | "paddle" | "zigzag";

export type Tyre = {
  name: string;
  /** SVG inner markup on a 0 0 64 64 viewBox (hub circle has class car-cursor-hub). */
  svg: string;
  print: PrintStyle;
};

type Spec = {
  name: string;
  print: PrintStyle;
  lugs: number;
  /** Width of a long / short lug, in degrees. */
  width: [number, number];
  /** Outer radius of a long / short lug. */
  reach: [number, number];
  /** How much the lugs lean (degrees). */
  skew: number;
  /** "groove": a cut across each lug; "notch": a bite out of its edge; "step": two-tier lug. */
  lugCut: "groove" | "notch" | "step";
  rim: { face: [string, string]; lip: string; style: "windows" | "spokes" | "holes" | "split"; count: number };
  beadlock: number; // bolts on a beadlock ring (0 = none)
  hub: string;
};

const SPECS: Spec[] = [
  {
    name: "Beadlock gunmetal",
    print: "staggered",
    lugs: 16,
    width: [17, 15],
    reach: [31.2, 30.2],
    skew: 1.4,
    lugCut: "groove",
    rim: { face: ["#6a707b", "#2b2e35"], lip: "#8c929d", style: "windows", count: 5 },
    beadlock: 20,
    hub: "#ff2e63",
  },
  {
    name: "Bronze trail",
    print: "chevron",
    lugs: 14,
    width: [19, 17],
    reach: [31.4, 30.4],
    skew: -2,
    lugCut: "notch",
    rim: { face: ["#c8995a", "#7a5428"], lip: "#e2bd84", style: "spokes", count: 6 },
    beadlock: 0,
    hub: "#1b1d22",
  },
  {
    name: "Black steel",
    print: "blocks",
    lugs: 18,
    width: [14, 13],
    reach: [30.8, 29.8],
    skew: 0,
    lugCut: "step",
    rim: { face: ["#3c3f46", "#16171b"], lip: "#2a2c31", style: "holes", count: 8 },
    beadlock: 0,
    hub: "#ffc93c",
  },
  {
    name: "Chrome mud boss",
    print: "paddle",
    lugs: 12,
    width: [22, 20],
    reach: [31.6, 30.6],
    skew: 3,
    lugCut: "groove",
    rim: { face: ["#f2f4f8", "#9aa1ad"], lip: "#ffffff", style: "spokes", count: 8 },
    beadlock: 16,
    hub: "#ff2e63",
  },
  {
    name: "Desert sand",
    print: "zigzag",
    lugs: 16,
    width: [16, 16],
    reach: [31, 30.4],
    skew: -1.2,
    lugCut: "notch",
    rim: { face: ["#d9c7a3", "#8f7a55"], lip: "#efe3c9", style: "split", count: 5 },
    beadlock: 20,
    hub: "#0f766e",
  },
];

function build(s: Spec): string {
  const id = s.name.replace(/\W+/g, "-").toLowerCase();
  const p: string[] = [];
  p.push(
    `<defs><radialGradient id="${id}-t" cx="50%" cy="45%" r="55%"><stop offset="0.55" stop-color="#2a2a30"/><stop offset="1" stop-color="#0e0e11"/></radialGradient>` +
      `<radialGradient id="${id}-r" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${s.rim.face[0]}"/><stop offset="1" stop-color="${s.rim.face[1]}"/></radialGradient></defs>`
  );
  // tread lugs
  for (let i = 0; i < s.lugs; i++) {
    const a = (360 / s.lugs) * i;
    const long = i % 2 === 0;
    const w = s.width[long ? 0 : 1];
    const r0 = 26.5;
    const r1 = s.reach[long ? 0 : 1];
    const k = long ? s.skew : -s.skew;
    if (s.lugCut === "step") {
      // two-tier block: wide base, narrower top
      p.push(`<path d="${poly([pt(r0, a - w / 2), pt(r1 - 1.6, a - w / 2), pt(r1 - 1.6, a - w / 4 + k), pt(r1, a - w / 4 + k), pt(r1, a + w / 4 + k), pt(r1 - 1.6, a + w / 4 + k), pt(r1 - 1.6, a + w / 2), pt(r0, a + w / 2)])}" fill="#1c1c21" stroke="#4c4c57" stroke-width="0.8" stroke-linejoin="round"/>`);
      continue;
    }
    p.push(`<path d="${poly([pt(r0, a - w / 2), pt(r1, a - w / 2 + k), pt(r1, a + w / 2 + k), pt(r0, a + w / 2)])}" fill="#1c1c21" stroke="#4c4c57" stroke-width="0.8" stroke-linejoin="round"/>`);
    if (s.lugCut === "groove") {
      const [x1, y1] = pt(r0 + 1.4, a + k * 0.4);
      const [x2, y2] = pt(r1 - 1.2, a + k * 0.9);
      p.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#0d0d10" stroke-width="1.1" stroke-linecap="round"/>`);
    } else {
      // notch: a bite out of the lug's outer edge
      p.push(`<path d="${poly([pt(r1 + 0.4, a + k - w / 6), pt(r1 - 1.8, a + k), pt(r1 + 0.4, a + k + w / 6)])}" fill="#0d0d10"/>`);
    }
  }
  // tyre body, sidewall biters, lettering band
  p.push(`<circle cx="${C}" cy="${C}" r="27.6" fill="url(#${id}-t)"/>`);
  for (let i = 0; i < s.lugs; i++) {
    const a = (360 / s.lugs) * i + 360 / s.lugs / 2;
    p.push(`<path d="${poly([pt(24.2, a - 4), pt(27.4, a - 3), pt(27.4, a + 3), pt(24.2, a + 4)])}" fill="#26262c" stroke="#3e3e48" stroke-width="0.55"/>`);
  }
  p.push(`<circle cx="${C}" cy="${C}" r="21.6" fill="none" stroke="#3a3a44" stroke-width="1.5" stroke-dasharray="2.2 1.2 0.8 1.2"/>`);
  // rim lip (+ beadlock bolts)
  p.push(`<circle cx="${C}" cy="${C}" r="19.2" fill="#16171b"/>`);
  p.push(`<circle cx="${C}" cy="${C}" r="18" fill="${s.rim.lip}" stroke="#d6dae1" stroke-width="0.6"/>`);
  for (let i = 0; i < s.beadlock; i++) {
    const [x, y] = pt(16.8, (360 / s.beadlock) * i);
    p.push(`<circle cx="${f(x)}" cy="${f(y)}" r="0.85" fill="#eef0f4" stroke="#5a5f69" stroke-width="0.3"/>`);
  }
  // wheel face
  p.push(`<circle cx="${C}" cy="${C}" r="15.2" fill="url(#${id}-r)"/>`);
  const n = s.rim.count;
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + 180 / n;
    if (s.rim.style === "windows") {
      p.push(`<path d="${poly([pt(7.2, a - 15), pt(13.8, a - 20), pt(14.4, a), pt(13.8, a + 20), pt(7.2, a + 15)])}" fill="#121317"/>`);
    } else if (s.rim.style === "spokes") {
      // dark gaps between slim spokes
      const half = 180 / n - 7;
      p.push(`<path d="${poly([pt(6.4, a - half * 0.7), pt(13.9, a - half), pt(13.9, a + half), pt(6.4, a + half * 0.7)])}" fill="#121317"/>`);
    } else if (s.rim.style === "holes") {
      const [x, y] = pt(10.6, a);
      p.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2.3" fill="#0b0b0e"/>`);
    } else {
      // split spokes: pairs of thin slots
      for (const d of [-7, 7]) p.push(`<path d="${poly([pt(6.6, a + d - 4), pt(13.8, a + d - 5), pt(13.8, a + d + 5), pt(6.6, a + d + 4)])}" fill="#121317"/>`);
    }
  }
  // lug nuts + centre cap
  for (let i = 0; i < 5; i++) {
    const [x, y] = pt(5.2, i * 72);
    p.push(`<circle cx="${f(x)}" cy="${f(y)}" r="0.9" fill="#c9ced6"/>`);
  }
  p.push(`<circle cx="${C}" cy="${C}" r="3.4" fill="#1b1d22" stroke="#9aa1ad" stroke-width="0.6"/>`);
  p.push(`<circle class="car-cursor-hub" cx="${C}" cy="${C}" r="1.9" fill="${s.hub}"/>`);
  return p.join("");
}

export const TYRES: Tyre[] = SPECS.map((s) => ({ name: s.name, svg: build(s), print: s.print }));

export function randomTyre(): Tyre {
  return TYRES[Math.floor(Math.random() * TYRES.length)];
}

/**
 * Draws one tread print centred at (0,0), with x running along the path and y
 * across the track. `alt` flips every other print for staggered patterns.
 */
export function drawPrint(ctx: CanvasRenderingContext2D, style: PrintStyle, alt: boolean) {
  const o = alt ? 1.5 : -1.5;
  switch (style) {
    case "staggered":
      ctx.fillRect(-2, -8 + o * 0.4, 4, 5.5);
      ctx.fillRect(-1.5, -1.5 - o, 3, 3);
      ctx.fillRect(-2, 2.5 + o * 0.4, 4, 5.5);
      break;
    case "chevron": {
      // a V of two angled bars
      ctx.beginPath();
      ctx.moveTo(-2.5, -8);
      ctx.lineTo(1.5, -8);
      ctx.lineTo(3.5, 0);
      ctx.lineTo(1.5, 8);
      ctx.lineTo(-2.5, 8);
      ctx.lineTo(-0.5, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "blocks":
      // three square blocks, the middle one offset
      ctx.fillRect(-2, -8, 4, 4);
      ctx.fillRect(-2 + o, -2, 4, 4);
      ctx.fillRect(-2, 4, 4, 4);
      break;
    case "paddle":
      // one wide bar across the whole track, slightly angled
      ctx.save();
      ctx.rotate(alt ? 0.18 : -0.18);
      ctx.fillRect(-1.6, -8.5, 3.2, 17);
      ctx.restore();
      break;
    case "zigzag": {
      // a zigzag bar
      ctx.beginPath();
      const s = alt ? 1 : -1;
      ctx.moveTo(-1.5, -8);
      ctx.lineTo(1.5, -8);
      ctx.lineTo(1.5 + 2.5 * s, -2.5);
      ctx.lineTo(1.5, 2.5);
      ctx.lineTo(1.5 + 2.5 * s, 8);
      ctx.lineTo(-1.5 + 2.5 * s, 8);
      ctx.lineTo(-1.5, 2.5);
      ctx.lineTo(-1.5 + 2.5 * s, -2.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}
