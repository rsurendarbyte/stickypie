// Deterministic dark tile gradients so every sticker sits on its own
// subtly-different card (client-safe, no env access).

const TILES: Array<{ from: string; to: string; glow: string }> = [
  { from: "#201d38", to: "#2d2347", glow: "#8b5cf6" }, // violet dusk
  { from: "#122433", to: "#1b3a4b", glow: "#38bdf8" }, // deep teal
  { from: "#2d1830", to: "#44203f", glow: "#f472b6" }, // plum
  { from: "#1b2a18", to: "#2b4022", glow: "#a3e635" }, // moss
  { from: "#301d14", to: "#4a2c1c", glow: "#fb923c" }, // espresso
  { from: "#15203b", to: "#20305c", glow: "#60a5fa" }, // midnight
];

export function tileFor(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TILES[hash % TILES.length];
}

/** Small deterministic rotation (-7°..7°) for a hand-placed sticker look. */
export function rotationFor(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 131 + slug.charCodeAt(i)) >>> 0;
  }
  return (hash % 15) - 7;
}

// Product card / hero backdrops: each sticker sits on either a dotted sticker
// sheet or a cutting-mat grid.
type CardSkin = { card: string; art: { backgroundColor: string; backgroundImage: string; backgroundSize: string } };

const sheet = (card: string, paper: string, dot: string): CardSkin => ({
  card,
  art: {
    backgroundColor: paper,
    backgroundImage: `radial-gradient(${dot} 1.2px, transparent 1.2px)`,
    backgroundSize: "12px 12px",
  },
});

const mat = (card: string, paper: string, line: string): CardSkin => ({
  card,
  art: {
    backgroundColor: paper,
    backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
    backgroundSize: "16px 16px",
  },
});

// Washi-tape style diagonal stripes.
const tape = (card: string, paper: string, line: string): CardSkin => ({
  card,
  art: {
    backgroundColor: paper,
    backgroundImage: `repeating-linear-gradient(45deg, ${line} 0 2px, transparent 2px 14px)`,
    backgroundSize: "auto",
  },
});

const svgTile = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// Printer's cutting-sheet registration marks (+).
const marks = (card: string, paper: string, line: string): CardSkin => ({
  card,
  art: {
    backgroundColor: paper,
    backgroundImage: svgTile(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M11 7v8M7 11h8" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/></svg>`
    ),
    backgroundSize: "22px 22px",
  },
});

// Scattered little sparkles.
const sparkle = (card: string, paper: string, ink: string): CardSkin => ({
  card,
  art: {
    backgroundColor: paper,
    backgroundImage: svgTile(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="${ink}"><path d="M10 4l1.2 3.3L14.5 8.5l-3.3 1.2L10 13l-1.2-3.3L5.5 8.5l3.3-1.2z"/><path d="M29 22l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><circle cx="31" cy="8" r="1.1"/><circle cx="9" cy="31" r="1.1"/></svg>`
    ),
    backgroundSize: "40px 40px",
  },
});

const CARD_SKINS: CardSkin[] = [
  sheet("#fff8ec", "#fff1d6", "#e9d3a6"), // cream sheet
  mat("#f1fbf7", "#e1f5ee", "#bfe9da"), // mint mat
  sheet("#fff5f7", "#ffe6ec", "#f4bfcb"), // blush sheet
  mat("#f6f5ff", "#eeedfe", "#dad7fa"), // lilac mat
  sheet("#f4f9ff", "#e3f0ff", "#b7d3f2"), // sky sheet
  mat("#fdf7ec", "#faeeda", "#f2dcb4"), // sand mat
  tape("#fff6ef", "#ffeadb", "#ffd9bd"), // peach washi tape
  marks("#f3f8ff", "#e8f1fe", "#b9cfee"), // blue cutting marks
  sparkle("#fffbea", "#fff4cc", "#efcf6b"), // gold sparkles
];

// Very light versions for the page background behind everything.
const MILD_SKINS: CardSkin["art"][] = [
  sheet("", "#ffffff", "#f1f2f6").art,
  mat("", "#ffffff", "#f7f8fa").art,
  {
    backgroundColor: "#ffffff",
    backgroundImage: "repeating-linear-gradient(45deg, #f6f7f9 0 1px, transparent 1px 16px)",
    backgroundSize: "auto",
  },
  marks("", "#ffffff", "#eef0f4").art,
  sparkle("", "#ffffff", "#f2f3f6").art,
];

/** Mild site-wide backdrop for this page load. */
export function mildSkinFor(seed: number): CardSkin["art"] {
  return MILD_SKINS[(seed >>> 0) % MILD_SKINS.length];
}

/**
 * Backdrop for a sticker. `seed` changes on every page load (useSkinSeed), so
 * the mix of sheets and mats is new each visit but stable while browsing.
 */
export function cardSkinFor(slug: string, seed = 0): CardSkin {
  // FNV-1a + a final avalanche, so similar slugs (petrol-…/diesel-…) still
  // land on different backdrops.
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < slug.length; i++) {
    hash = Math.imul(hash ^ slug.charCodeAt(i), 16777619) >>> 0;
  }
  hash = (hash ^ (hash >>> 16)) >>> 0;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0; // keep it unsigned
  return CARD_SKINS[hash % CARD_SKINS.length];
}
