// The home page apart from its product rails: the hero and the order of the
// page's sections, edited in admin → Home page. Kept inside store_settings.features
// as `homePage`, so it reaches the shop like the feature switches do: anything
// missing falls back to the defaults here. Browser-safe.
import { z } from "zod";
import { WALL_THEMES } from "./walls";

export const HOME_SLIDES = {
  avatar: { label: "AI stickers & wall posters", hint: "Shows only while Avatar sticker packs is on in Features" },
  stickers: { label: "Stickers", hint: "Stick your style" },
  posters: { label: "Wall posters", hint: "Style your wall" },
  products: { label: "Product slides", hint: "Stickers, posters and wall sets taking turns" },
} as const;
export type HomeSlideId = keyof typeof HOME_SLIDES;

export const HOME_SECTIONS = {
  walls: { label: "Wall poster sets", hint: "The mix of every wall set" },
  themes: { label: "Wall theme rows", hint: "Car walls, Travel walls and the rest" },
  custom: { label: "Make your own", hint: "The custom sticker cards" },
  festivals: { label: "Festival rows", hint: "Shown around each festival's date" },
  rails: { label: "Product rails", hint: "The rails you set up below" },
} as const;
export type HomeSectionId = keyof typeof HOME_SECTIONS;

export type HomeHeroCopy = { badge: string; title: string; text: string; button: string; chips: string[] };

/** How wall cards look, in every row and on the wall pages' listings. */
export type WallCardDesign = {
  /** 0–100: how strongly the wall's own colour tints the picture. */
  tint: number;
  /** 0–15: empty space around the posters, in % of the picture. */
  space: number;
  /** Corner roundness in px. */
  radius: number;
  shadow: boolean;
  outline: boolean;
  discount: boolean;
  posterCount: boolean;
  posterSizes: boolean;
  /** The "4×6 in" labels on the posters. */
  sizeLabels: boolean;
  button: string;
};

/** A row's hand edits: walls that lead it (in this order, from any theme) and walls taken out. By slug, so they hold on any store. */
export type WallRowCards = { pinned: string[]; hidden: string[] };

/** The row that mixes every wall set; theme rows use their theme id. */
export const WALL_MIX_ROW = "mix";

export type HomePage = {
  slides: { id: HomeSlideId; visible: boolean }[];
  /** Seconds each slide stays before the next. */
  seconds: number;
  /** How many sticker / poster slides, and how many wall set slides between them. */
  productSlides: number;
  wallSlides: number;
  /** Festival stickers lead the product slides around their dates. */
  festivals: boolean;
  /** Leave out anything tied to one state or city. */
  hideRegional: boolean;
  avatar: {
    badge: string;
    titleTop: string;
    titleBottom: string;
    stickerTitle: string;
    /** {styles} becomes the number of styles in a pack order. */
    stickerText: string;
    stickerButton: string;
    wallTitle: string;
    wallText: string;
    wallButton: string;
    chips: string[];
  };
  stickers: HomeHeroCopy;
  posters: HomeHeroCopy;
  /** Under sticker and poster product slides. */
  stickerChips: string[];
  posterChips: string[];
  sections: { id: HomeSectionId; visible: boolean }[];
  wallsTitle: string;
  themes: { id: string; title: string; visible: boolean }[];
  wallCard: WallCardDesign;
  wallRows: Record<string, WallRowCards>;
};

export const DEFAULT_HOME_PAGE: HomePage = {
  slides: (Object.keys(HOME_SLIDES) as HomeSlideId[]).map((id) => ({ id, visible: true })),
  seconds: 6.5,
  productSlides: 5,
  wallSlides: 3,
  festivals: true,
  hideRegional: true,
  avatar: {
    badge: "New · AI avatar stickers",
    titleTop: "AI stickers",
    titleBottom: "& wall posters",
    stickerTitle: "Stickers of you",
    stickerText: "Send a selfie, pick trending styles. {styles}+ styles on vinyl.",
    stickerButton: "Make my stickers",
    wallTitle: "Wall posters",
    wallText: "Ready wall sets on premium poster paper. Glue dots included.",
    wallButton: "Shop wall posters",
    chips: ["Vinyl stickers", "Premium posters", "Glue dots included", "Ships across India"],
  },
  stickers: {
    badge: "Stickers",
    title: "Stick your style.",
    text: "Die-cut vinyl stickers for your car, bike, laptop and bottle.",
    button: "Shop stickers",
    chips: ["Peel & stick", "Die-cut edges", "Car, bike & laptop", "Ships across India"],
  },
  posters: {
    badge: "Wall posters",
    title: "Style your wall.",
    text: "Premium posters for your room, with glue dots or tape included.",
    button: "Shop posters",
    chips: ["Premium poster paper", "Glue dots included", "Walls & doors", "Ships across India"],
  },
  stickerChips: ["Peel & stick", "Die-cut edges", "Car, bike & laptop", "Ships across India"],
  posterChips: ["Premium poster paper", "Glue dots included", "Walls & doors", "Ships across India"],
  sections: (Object.keys(HOME_SECTIONS) as HomeSectionId[]).map((id) => ({ id, visible: true })),
  wallsTitle: "Wall poster sets",
  themes: WALL_THEMES.map((t) => ({ id: t.id, title: t.title, visible: true })),
  wallCard: {
    tint: 30,
    space: 6,
    radius: 24,
    shadow: true,
    outline: true,
    discount: true,
    posterCount: true,
    posterSizes: true,
    sizeLabels: true,
    button: "Add to cart",
  },
  wallRows: { [WALL_MIX_ROW]: { pinned: ["4x4-garage-poster-pack"], hidden: [] } },
};

const line = z.string().trim().max(120);
const chips = z.array(z.string().trim().max(30)).length(4);
const copy = z.object({ badge: line, title: line, text: z.string().trim().max(200), button: line, chips });

export const homePageSchema = z.object({
  slides: z
    .array(z.object({ id: z.enum(Object.keys(HOME_SLIDES) as [HomeSlideId]), visible: z.boolean() }))
    .refine((slides) => slides.some((s) => s.visible), "Keep at least one hero slide on"),
  seconds: z.number().min(2).max(30),
  productSlides: z.number().int().min(0).max(12),
  wallSlides: z.number().int().min(0).max(8),
  festivals: z.boolean(),
  hideRegional: z.boolean(),
  avatar: z.object({
    badge: line,
    titleTop: line,
    titleBottom: line,
    stickerTitle: line,
    stickerText: z.string().trim().max(200),
    stickerButton: line,
    wallTitle: line,
    wallText: z.string().trim().max(200),
    wallButton: line,
    chips,
  }),
  stickers: copy,
  posters: copy,
  stickerChips: chips,
  posterChips: chips,
  sections: z.array(z.object({ id: z.enum(Object.keys(HOME_SECTIONS) as [HomeSectionId]), visible: z.boolean() })),
  wallsTitle: line,
  themes: z.array(z.object({ id: z.string().min(1).max(64), title: line, visible: z.boolean() })),
  wallCard: z.object({
    tint: z.number().min(0).max(100),
    space: z.number().min(0).max(15),
    radius: z.number().min(0).max(40),
    shadow: z.boolean(),
    outline: z.boolean(),
    discount: z.boolean(),
    posterCount: z.boolean(),
    posterSizes: z.boolean(),
    sizeLabels: z.boolean(),
    button: z.string().trim().min(1, "Give wall cards a button label").max(20),
  }),
  wallRows: z.record(
    z.object({ pinned: z.array(z.string().max(120)).max(200), hidden: z.array(z.string().max(120)).max(400) })
  ),
});

/** A row's cards: its pinned walls first, then its own walls without the ones taken out. */
export function arrangeWallRow<P extends { slug: string }>(row: WallRowCards | undefined, own: P[], all: P[]): P[] {
  if (!row) return own;
  const pinned = row.pinned.flatMap((slug) => all.filter((p) => p.slug === slug));
  return [...pinned, ...own.filter((p) => !row.pinned.includes(p.slug) && !row.hidden.includes(p.slug))];
}

/** Every known slide, section and theme exactly once: saved order first, new ones after. */
function complete<T extends { id: string }>(saved: T[], all: T[]): T[] {
  const known = new Map(all.map((item) => [item.id, item]));
  const kept = saved.filter((item, i) => known.has(item.id) && saved.findIndex((s) => s.id === item.id) === i);
  return [...kept, ...all.filter((item) => !kept.some((s) => s.id === item.id))];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToHomePage(value: any): HomePage {
  const merged = {
    ...DEFAULT_HOME_PAGE,
    ...(value && typeof value === "object" ? value : {}),
    wallCard: { ...DEFAULT_HOME_PAGE.wallCard, ...value?.wallCard },
  };
  const parsed = homePageSchema.safeParse(merged);
  if (!parsed.success) return DEFAULT_HOME_PAGE;
  return {
    ...parsed.data,
    slides: complete(parsed.data.slides, DEFAULT_HOME_PAGE.slides),
    sections: complete(parsed.data.sections, DEFAULT_HOME_PAGE.sections),
    themes: complete(parsed.data.themes, DEFAULT_HOME_PAGE.themes),
  };
}
