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
