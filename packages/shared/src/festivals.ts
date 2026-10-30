// Festivals & special days (admin → Festivals): each one gets its own page
// (/kannada-rajyotsava-stickers …, kept all year for search) and, from a few
// days before its date to a few days after, a row at the top of the home page.
// Browser-safe, no deps — the storefront works out what's on in the browser,
// so a festival's row appears and disappears without a deploy.
import { z } from "zod";
import type { Product } from "./types";

export type FestivalFaq = { q: string; a: string };

export type Festival = {
  id: string;
  /** "Kannada Rajyotsava" — the home row title and the page's H1. */
  name: string;
  /** Page address: stickypie.in/<slug> (e.g. "kannada-rajyotsava-stickers"). */
  slug: string;
  /** The day, YYYY-MM-DD (India time). */
  date: string;
  /** Same day every year (Rajyotsava): rolls over by itself. Off for festivals
   *  whose date moves (Diwali, Holi) — edit the date each year. */
  yearly: boolean;
  /** Home row shows this many days before … */
  daysBefore: number;
  /** … and this many days after the date. */
  daysAfter: number;
  /** Stickers with any of these tags (lower-case) belong here … */
  tags: string[];
  /** … and every sticker in this category. */
  categoryId: string | null;
  /** Search title, description and the page's intro. */
  title: string;
  description: string;
  intro: string;
  /** Questions answered on the page (Google / AI answers). */
  faq: FestivalFaq[];
  /** Off = no home row and no page. */
  visible: boolean;
};

export const FESTIVAL_DEFAULT_DAYS = 7;
export const FESTIVAL_MAX = 60;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const festivalSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Give every festival a name").max(60),
  slug: z
    .string()
    .trim()
    .min(3, "Every festival needs a page address")
    .max(80)
    .regex(SLUG, "Page address: lower-case letters, numbers and dashes only"),
  date: z.string().regex(DATE, "Pick the festival's date"),
  yearly: z.boolean(),
  daysBefore: z.number().int().min(0).max(60),
  daysAfter: z.number().int().min(0).max(60),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30),
  categoryId: z.string().nullable(),
  title: z.string().trim().max(120),
  description: z.string().trim().max(300),
  intro: z.string().trim().max(1200),
  faq: z
    .array(z.object({ q: z.string().trim().min(1).max(200), a: z.string().trim().min(1).max(800) }))
    .max(12),
  visible: z.boolean(),
});

export const festivalsSchema = z
  .array(festivalSchema)
  .max(FESTIVAL_MAX)
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.forEach((f, i) => {
      if (seen.has(f.slug)) {
        ctx.addIssue({ code: "custom", path: [i, "slug"], message: `Two festivals use the page address "${f.slug}"` });
      }
      seen.add(f.slug);
      if (!f.tags.length && !f.categoryId) {
        ctx.addIssue({ code: "custom", path: [i, "tags"], message: `${f.name}: add a tag or pick a category for its stickers` });
      }
    });
  });

/** Starting festivals until the admin saves their own list. */
export const DEFAULT_FESTIVALS: Festival[] = [
  {
    id: "kannada-rajyotsava",
    name: "Kannada Rajyotsava",
    slug: "kannada-rajyotsava-stickers",
    date: "2026-11-01",
    yearly: true,
    daysBefore: FESTIVAL_DEFAULT_DAYS,
    daysAfter: FESTIVAL_DEFAULT_DAYS,
    tags: ["kannada", "karnataka", "rajyotsava", "kannada rajyotsava", "kannada flag", "namma karnataka"],
    categoryId: null,
    title: "Kannada Rajyotsava Stickers & Mini Posters – Karnataka Flag Stickers",
    description:
      "Kannada Rajyotsava (ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ) stickers & mini posters: Kannada flag, Karnataka map, Hampi. Die-cut vinyl for car, bike, laptop.",
    intro:
      "Celebrate ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ on 1 November with Karnataka pride you can stick anywhere: the red-and-yellow Kannada flag, the map of Karnataka, Mysore Palace, Vidhana Soudha, Hampi's stone chariot and ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವದ ಶುಭಾಶಯಗಳು lettering — as die-cut vinyl stickers and mini posters for your car, bike, laptop, bottle or wall.",
    faq: [
      {
        q: "When is Kannada Rajyotsava?",
        a: "Kannada Rajyotsava, also called Karnataka Rajyotsava or Karnataka Formation Day, is celebrated every year on 1 November. It marks the day in 1956 when the Kannada-speaking regions were joined into one state, later named Karnataka.",
      },
      {
        q: "Where can I buy Kannada Rajyotsava stickers online?",
        a: "On StickyPie (stickypie.in): Kannada Rajyotsava stickers and mini posters with the Kannada flag, the map of Karnataka and Mysore Palace, in 3″, 6″ and 7″ sizes, shipped across India.",
      },
      {
        q: "What do the colours of the Kannada flag mean?",
        a: "The Kannada flag is yellow over red. Yellow (arishina) and red (kunkuma) are the turmeric and vermilion of auspicious occasions in Karnataka; the flag is flown everywhere on Kannada Rajyotsava.",
      },
      {
        q: "Can I stick it on my car or bike?",
        a: "Yes. The stickers are die-cut vinyl and stick cleanly to car glass, painted panels, bike tanks and helmets, and peel off later without damaging the paint.",
      },
      {
        q: "How much do Kannada Rajyotsava stickers cost?",
        a: "Prices start at ₹14 for a 3″ sticker or mini poster; 6″ and 7″ sizes cost more. Every size and price is shown on each sticker's page.",
      },
    ],
    visible: true,
  },
  {
    id: "puducherry-liberation-day",
    name: "Puducherry Liberation Day",
    slug: "puducherry-liberation-day-stickers",
    date: "2026-11-01",
    yearly: true,
    daysBefore: FESTIVAL_DEFAULT_DAYS,
    daysAfter: FESTIVAL_DEFAULT_DAYS,
    tags: ["puducherry", "pondicherry", "pondy", "puducherry liberation day", "de facto transfer day"],
    categoryId: null,
    title: "Puducherry Liberation Day Stickers & Mini Posters – Pondicherry",
    description:
      "Puducherry Liberation Day (1 November) stickers & mini posters: French Quarter, the promenade and lighthouse. Die-cut vinyl, shipped across India.",
    intro:
      "Puducherry Liberation Day — De Facto Transfer Day — is celebrated on 1 November, the day in 1954 that ended almost 300 years of French rule. Mark it with Pondicherry's French Quarter, bougainvillea streets, the lighthouse and the promenade as mini posters and die-cut vinyl stickers for your car, bike, laptop, bottle or wall.",
    faq: [
      {
        q: "When is Puducherry Liberation Day?",
        a: "Puducherry Liberation Day, also called De Facto Transfer Day, is celebrated every year on 1 November. On 1 November 1954 the French settlements of Puducherry, Karaikal, Mahe and Yanam were transferred to India, ending almost 300 years of French rule.",
      },
      {
        q: "Where can I buy Puducherry or Pondicherry stickers online?",
        a: "On StickyPie (stickypie.in): Puducherry Liberation Day mini posters and stickers with the French Quarter, the promenade and the lighthouse, shipped across India.",
      },
      {
        q: "What sizes are there?",
        a: "3″, 6″ and 7″. A 3″ piece suits a laptop, phone or bottle; 6″ and 7″ suit a car's rear glass, a bike or a wall. Prices start at ₹14.",
      },
    ],
    visible: true,
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToFestivals(value: any): Festival[] {
  if (!Array.isArray(value)) return DEFAULT_FESTIVALS;
  const parsed = festivalsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_FESTIVALS;
}

const DAY_MS = 86_400_000;
const IST_MS = 5.5 * 3_600_000;

/** Days since 1970 for a YYYY-MM-DD date. */
function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Today's day number in India. */
function todayInIndia(now: Date): number {
  return Math.floor((now.getTime() + IST_MS) / DAY_MS);
}

/**
 * The festival's next (or current) date as YYYY-MM-DD: a yearly festival whose
 * window has passed this year moves on to next year's date.
 */
export function festivalDate(f: Festival, now = new Date()): string {
  if (!f.yearly) return f.date;
  const today = todayInIndia(now);
  const [, m, d] = f.date.split("-");
  let year = new Date(now.getTime() + IST_MS).getUTCFullYear() - 1;
  // last year's date may still be inside its "after" days (early January)
  for (let i = 0; i < 3; i++, year++) {
    const ymd = `${year}-${m}-${d}`;
    if (dayNumber(ymd) + f.daysAfter >= today) return ymd;
  }
  return `${year}-${m}-${d}`;
}

/** Festivals whose home row is showing now (from daysBefore to daysAfter), soonest first. */
export function activeFestivals(list: Festival[], now = new Date()): Festival[] {
  const today = todayInIndia(now);
  return list
    .filter((f) => f.visible)
    .map((f) => ({ f, day: dayNumber(festivalDate(f, now)) }))
    .filter(({ f, day }) => today >= day - f.daysBefore && today <= day + f.daysAfter)
    .sort((a, b) => a.day - b.day)
    .map(({ f }) => f);
}

/** "1 Nov" — for the home row. */
export function festivalShortDate(f: Festival, now = new Date()): string {
  const [y, m, d] = festivalDate(f, now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "1 November" — for the page. */
export function festivalLongDate(f: Festival, now = new Date()): string {
  const [y, m, d] = festivalDate(f, now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" });
}

/** On-sale stickers for a festival, in catalog order (newest first). */
export function festivalProducts(f: Festival, products: Product[]): Product[] {
  const tags = new Set(f.tags.map((t) => t.toLowerCase()));
  return products.filter(
    (p) =>
      p.tags.some((t) => tags.has(t.toLowerCase())) ||
      (f.categoryId !== null && (p.categoryId === f.categoryId || (p.categoryIds ?? []).includes(f.categoryId)))
  );
}
