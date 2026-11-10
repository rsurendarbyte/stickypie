// The real-shopper journeys the recorder can film (see record.ts). Browser-safe.

export type JourneyId = "play-win-cart" | "share-win" | "browse-play" | "product-cart" | "poster-cart" | "wall-cart" | "browse-walls";

export const JOURNEYS: { id: JourneyId; name: string; blurb: string; for: ("puzzle" | "poster" | "wall")[] }[] = [
  { id: "play-win-cart", name: "Play, win, add to cart", blurb: "Opens the puzzle, solves it, wins the prize and adds the poster to the cart.", for: ["puzzle"] },
  { id: "share-win", name: "Win and share", blurb: "Solves the puzzle, then taps Challenge friends to share the win.", for: ["puzzle"] },
  { id: "browse-play", name: "Browse puzzles, then play", blurb: "Scrolls the puzzle posters, opens this one, taps Play & win and solves it.", for: ["puzzle"] },
  { id: "product-cart", name: "Product page to cart", blurb: "Opens the poster page, picks Puzzle and a size, adds to cart.", for: ["puzzle"] },
  { id: "poster-cart", name: "Wall poster to cart", blurb: "Opens the poster page, picks Wall poster and a size, adds to cart.", for: ["poster"] },
  { id: "wall-cart", name: "Wall set to cart", blurb: "Opens the wall set, looks through it and adds it to the cart.", for: ["wall"] },
  { id: "browse-walls", name: "Browse walls, then buy", blurb: "Scrolls the wall sets, opens this one and adds it to the cart.", for: ["wall"] },
];
