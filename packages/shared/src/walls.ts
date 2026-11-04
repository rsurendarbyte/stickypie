// Wall builder: ready layouts of 4 × 6 and 6 × 9 in posters. The shopper picks
// a poster for every spot; the wall is priced poster by poster. Positions are
// inches on the wall, measured from the top left. Browser-safe, no deps.

/** Rows of wall sets on the home page; a set says its row with the tag "wall theme:<id>". */
export const WALL_THEMES = [
  { id: "cars", title: "Car walls" },
  { id: "ride", title: "Ride & adventure walls" },
  { id: "travel", title: "Travel walls" },
  { id: "india", title: "Incredible India walls" },
  { id: "devotional", title: "Devotional walls" },
  { id: "motivational", title: "Motivational walls" },
  { id: "retro", title: "Retro walls" },
] as const;

export type WallTile = { x: number; y: number; /** Longest side: 6 = 4 × 6 in, 9 = 6 × 9 in. */ inches: 6 | 9 };
export type WallLayout = { id: string; name: string; tiles: WallTile[] };

const GAP = 0.5;
const SMALL = { w: 4, h: 6 };

/** A row of 4 × 6 in posters from (x, y). */
function smalls(count: number, x: number, y: number): WallTile[] {
  return Array.from({ length: count }, (_, i) => ({ x: x + i * (SMALL.w + GAP), y, inches: 6 as const }));
}

export const WALL_LAYOUTS: WallLayout[] = [
  {
    id: "double-hero",
    name: "Double hero",
    tiles: [
      ...smalls(4, 0, 0),
      { x: 2.5, y: 6.5, inches: 9 },
      { x: 9, y: 6.5, inches: 9 },
      ...smalls(4, 0, 16),
    ],
  },
  {
    id: "trio",
    name: "Trio",
    tiles: [
      ...smalls(4, 0.75, 0),
      { x: 0, y: 6.5, inches: 9 },
      { x: 6.5, y: 6.5, inches: 9 },
      { x: 13, y: 6.5, inches: 9 },
      ...smalls(4, 0.75, 16),
    ],
  },
  {
    id: "gallery",
    name: "Gallery",
    tiles: [0, 1, 2, 3].flatMap((row) => smalls(3, 0, row * (SMALL.h + GAP))),
  },
  {
    id: "big-wall",
    name: "Big wall",
    tiles: [0, 1, 2, 3, 4].flatMap((row) => smalls(4, 0, row * (SMALL.h + GAP))),
  },
];

export function wallLayout(id: string): WallLayout | null {
  return WALL_LAYOUTS.find((l) => l.id === id) ?? null;
}

/** A tile's printed width and height in inches (posters are 2:3). */
export function wallTileSize(tile: WallTile): { width: number; height: number } {
  return { width: (tile.inches * 2) / 3, height: tile.inches };
}

/** The layout's full width and height on the wall, in inches. */
export function wallBounds(layout: WallLayout): { width: number; height: number } {
  return layout.tiles.reduce(
    (box, t) => {
      const { width, height } = wallTileSize(t);
      return { width: Math.max(box.width, t.x + width), height: Math.max(box.height, t.y + height) };
    },
    { width: 0, height: 0 }
  );
}
