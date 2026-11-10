// What a reel is drawn from. Built on the server from a product (see the
// reel-studio page), pictures loaded in the browser before drawing.

export type ReelKind = "puzzle" | "poster" | "wall";

export type ReelPriceLine = { label: string; price: number; was: number | null };

/** A product as the studio sees it (plain data, sent to the browser). */
export type ReelProduct = {
  id: string;
  slug: string;
  name: string;
  /** "poster" = a single mini poster (made as a wall poster or a puzzle poster); "wall" = a wall set. */
  type: "poster" | "wall";
  image: string;
  thumb: string;
  active: boolean;
  categories: string[];
  tags: string[];
  /** Mini posters: the sizes sold as a wall poster (inches = longest side). */
  sizes: { inches: number; price: number; was: number | null }[];
  /** Wall sets: price and the posters in wall order. */
  price: number;
  was: number | null;
  wall: null | {
    feet: string | null;
    paint: [string, string];
    /** Collage walls: each poster's spot on the wall picture, percent x, y, w, h. */
    spots: [number, number, number, number][] | null;
    posters: { image: string; inches: number }[];
  };
};

/** Everything a style needs, pictures loaded. */
export type ReelInput = {
  kind: ReelKind;
  name: string;
  /** The poster (or the wall picture). */
  art: ImageBitmap;
  /** Wall sets: the single posters, wall order. */
  posters: { art: ImageBitmap; inches: number }[];
  spots: [number, number, number, number][] | null;
  paint: [string, string];
  feet: string | null;
  pct: number;
  prices: ReelPriceLine[];
  /** "from ₹60" style lowest price. */
  from: number;
  /** Big headline for the hook. */
  hook: [string, string];
  cta: [string, string];
  font: string;
  /** 0..1 pseudo-random numbers fixed per product, so a style always plays the same. */
  seed: number;
};

export type ReelStyle = {
  id: string;
  name: string;
  blurb: string;
  duration: number;
  draw: (ctx: CanvasRenderingContext2D, t: number, input: ReelInput) => void;
};
