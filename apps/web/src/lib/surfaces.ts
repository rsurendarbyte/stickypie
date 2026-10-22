// "Where it goes" landing pages: /car-stickers, /bike-stickers, … These match
// how people search ("car stickers online India") rather than our theme
// categories. Which stickers show is decided by tags and categories, both
// edited in the admin — add the tag "laptop" to a sticker and it appears on
// /laptop-stickers.
import type { Category, Product } from "@stickypie/shared";

export type Surface = {
  slug: string;
  /** "Car Stickers" — H1 and title. */
  name: string;
  /** Short noun for copy: "car". */
  noun: string;
  title: string;
  description: string;
  intro: string;
  /** Tags (lower-case) that put a sticker here. */
  tags: string[];
  /** Category slugs whose stickers belong here. */
  categories: string[];
  sections: { heading: string; body: string }[];
  faq: { q: string; a: string }[];
};

export const SURFACES: Surface[] = [
  {
    slug: "car-stickers",
    name: "Car Stickers",
    noun: "car",
    title: "Car Stickers Online in India – Waterproof Vinyl Car Decals",
    description:
      "Buy car stickers online in India: waterproof die-cut vinyl decals for bumpers, windows and fuel flaps — JDM, racing, warning labels and more. Several sizes, shipped across India.",
    intro:
      "Bumper, rear window, fuel flap or dashboard — our car stickers are die-cut vinyl decals made to handle sun, rain and car washes. Pick from JDM and racing designs, petrolhead slogans, warning labels and origin badges, each printed to order in the size you pick.",
    tags: ["car", "cars", "bumper", "jdm", "racing", "petrolhead", "fuel", "diesel", "petrol", "drift", "turbo", "tuning", "baby on board", "jeep", "4x4"],
    categories: ["cars", "jdm", "racing", "petrolhead", "signage", "warning", "origin", "off-road"],
    sections: [
      {
        heading: "Made for the outside of your car",
        body: "Every car sticker is printed on premium vinyl that's waterproof, UV-safe and scratch-resistant, so colours stay bright through Indian summers and monsoon washes. The die-cut edge follows the design — no square white borders on your paint or glass.",
      },
      {
        heading: "Where car stickers look best",
        body: "Rear windscreen and quarter glass for big 6″–7″ designs, fuel flaps for petrol/diesel signs, bumpers for warning labels and badges, and the dashboard or glovebox for small 3″ ones.",
      },
    ],
    faq: [
      {
        q: "Will the car sticker survive a car wash?",
        a: "Yes. The vinyl is waterproof and the print is UV-safe. Wait 24 hours after applying before the first wash, and avoid pointing a pressure washer straight at the edges.",
      },
      {
        q: "Can I put a sticker on the car glass?",
        a: "Yes — vinyl stickers stick cleanly to glass and can be peeled off later. Don't place them where they block your view or on the windscreen area the wipers cover.",
      },
      {
        q: "Will it damage the paint when I remove it?",
        a: "No. Warm it with a hair dryer and peel slowly; it comes off cleanly from factory paint. Any light residue wipes off with a little rubbing alcohol.",
      },
    ],
  },
  {
    slug: "bike-stickers",
    name: "Bike Stickers",
    noun: "bike",
    title: "Bike Stickers Online in India – Waterproof Vinyl Bike Decals",
    description:
      "Shop bike stickers online in India: waterproof die-cut vinyl decals for tanks, side panels, visors and helmets — rider, off-road and adventure designs. Ships across India.",
    intro:
      "Tank, side panel, mudguard or visor — our bike stickers are die-cut vinyl decals built for riders. They're waterproof, UV-safe and tough enough for rain, dust and highway miles, with rider, off-road and adventure designs in several sizes.",
    tags: ["bike", "bikes", "biker", "bikers", "motorcycle", "motocross", "ride", "rider", "helmet", "offroad", "trail", "adventure", "mountains"],
    categories: ["bikers", "off-road", "adventure", "racing"],
    sections: [
      {
        heading: "Tough enough for every ride",
        body: "Vinyl that shrugs off rain, mud and sun, with a print that won't fade after a season outdoors. The die-cut shape hugs the design so it looks painted on, not stuck on.",
      },
      {
        heading: "Where bike stickers fit",
        body: "3″ stickers suit side panels, headlamp covers and helmets; 6″ and 7″ work on fuel tanks, tail sections and luggage boxes. Smooth, flat or gently curved surfaces give the cleanest finish.",
      },
    ],
    faq: [
      {
        q: "Do bike stickers come off in the rain?",
        a: "No. They're waterproof vinyl with a strong adhesive. Apply on a clean, dry surface and let them set for 24 hours before riding in the rain.",
      },
      {
        q: "Can I stick one on a curved fuel tank?",
        a: "Yes. Vinyl flexes over gentle curves — press from the centre out and warm it slightly with a hair dryer to help it settle on tighter curves.",
      },
      {
        q: "What size sticker should I get for my bike?",
        a: "3″ for helmets, side panels and small spaces; 6″ or 7″ for tanks and luggage boxes. Use \"See actual size\" on any sticker to check it on your screen.",
      },
    ],
  },
  {
    slug: "laptop-stickers",
    name: "Laptop Stickers",
    noun: "laptop",
    title: "Laptop Stickers Online in India – Waterproof Vinyl Laptop Decals",
    description:
      "Buy laptop stickers online in India: waterproof die-cut vinyl stickers for MacBooks, laptops and tablets — memes, funny quotes, car culture and more. Peel off cleanly, ships across India.",
    intro:
      "Make your laptop yours. Our laptop stickers are die-cut vinyl — waterproof, scratch-resistant and easy to peel off without leaving residue — so you can build a lid full of memes, car culture and good vibes, and change it whenever you like.",
    tags: ["laptop", "macbook", "funny", "meme", "memes", "gaming", "cute", "good vibes", "positive", "aesthetic", "anime", "shaka"],
    categories: ["laptop", "memes", "fun", "anime", "gaming", "computer-geek", "aesthetic", "hacker", "startup"],
    sections: [
      {
        heading: "Stickers that look good on any lid",
        body: "Die-cut edges mean no awkward white boxes — just the design, sitting flat on your MacBook, Windows laptop, tablet or phone case. 3″ stickers are the classic laptop size; mix a few to fill the lid.",
      },
      {
        heading: "Peel off clean when you upgrade",
        body: "Vinyl comes away cleanly from laptop lids, so selling or swapping your laptop later isn't a problem. They're also water-resistant, so a spilled drink won't ruin them.",
      },
    ],
    faq: [
      {
        q: "Will laptop stickers leave residue?",
        a: "No. They peel off cleanly from aluminium and plastic lids. If a little adhesive stays behind, a drop of rubbing alcohol on a cloth removes it.",
      },
      {
        q: "What size works best on a laptop?",
        a: "3″ is the classic size for building a sticker collage; 6″ makes a single statement design. Check \"See actual size\" to preview it at real size on your screen.",
      },
      {
        q: "Can I use them on my MacBook?",
        a: "Yes — they stick well on MacBook lids. Keep them away from vents and the hinge so they don't block airflow.",
      },
    ],
  },
  {
    slug: "helmet-stickers",
    name: "Helmet Stickers",
    noun: "helmet",
    title: "Helmet Stickers Online in India – Waterproof Vinyl Helmet Decals",
    description:
      "Shop helmet stickers online in India: small waterproof die-cut vinyl decals for bike and cycling helmets — rider, adventure and fun designs. Ships across India.",
    intro:
      "Give your lid some personality. Our helmet stickers are compact die-cut vinyl decals that flex over curves and stay put through rain and sun — rider slogans, adventure badges and fun designs, best in 3″.",
    tags: ["helmet", "bike", "biker", "bikers", "motocross", "ride", "rider", "offroad", "adventure"],
    categories: ["bikers", "off-road", "adventure"],
    sections: [
      {
        heading: "Small, flexible and weatherproof",
        body: "Helmets are curved, so the 3″ size works best: it settles smoothly on the shell without lifting at the edges. The vinyl is waterproof and UV-safe for daily rides.",
      },
      {
        heading: "Stick it safely",
        body: "Place stickers on the shell only — never on the visor where they'd block your view, and keep any safety or certification labels visible.",
      },
    ],
    faq: [
      {
        q: "What size sticker fits a helmet?",
        a: "3″ is ideal for most helmets. Larger sizes can work on the back of full-face helmets with a broad, flat area.",
      },
      {
        q: "Will the sticker lift on a curved helmet?",
        a: "Press it on from the centre outwards and warm it gently with a hair dryer — the vinyl softens and settles into the curve.",
      },
      {
        q: "Can I stick it on the visor?",
        a: "We don't recommend it — anything on the visor can block your view. Keep stickers on the helmet shell.",
      },
    ],
  },
  {
    slug: "bottle-stickers",
    name: "Bottle Stickers",
    noun: "water bottle",
    title: "Water Bottle Stickers Online in India – Waterproof Vinyl Stickers",
    description:
      "Buy waterproof water bottle stickers online in India: die-cut vinyl stickers for steel bottles, flasks and tumblers — funny, cute and good-vibes designs. Ships across India.",
    intro:
      "Your bottle goes everywhere — make it unmistakably yours. These waterproof vinyl stickers handle daily washing and cold condensation, with funny, cute and good-vibes designs in a bottle-friendly 3″ size.",
    tags: ["bottle", "water bottle", "flask", "funny", "cute", "good vibes", "positive", "shaka", "meme", "memes"],
    categories: ["water-bottle", "fun", "memes", "aesthetic", "motivational", "inspirational"],
    sections: [
      {
        heading: "Waterproof, wash after wash",
        body: "The vinyl and print are waterproof, so hand-washing your steel bottle or tumbler won't fade or peel the sticker. Skip the dishwasher to keep it looking new for longer.",
      },
      {
        heading: "The right size for bottles",
        body: "3″ stickers fit most 500 ml–1 L bottles and flasks. Stick them on a clean, dry, room-temperature bottle and let them set for a day before washing.",
      },
    ],
    faq: [
      {
        q: "Are the stickers safe to wash?",
        a: "Yes — they're waterproof and handle regular hand-washing. Dishwashers use very hot water and strong detergent, so hand-wash for the longest life.",
      },
      {
        q: "Will they stick to a steel bottle?",
        a: "Yes. Clean the bottle with a little rubbing alcohol first so the adhesive grips the steel properly.",
      },
      {
        q: "What size fits a water bottle?",
        a: "3″ fits most bottles and flasks. Use \"See actual size\" on a sticker to check it against your bottle.",
      },
    ],
  },
];

export function surfaceBySlug(slug: string): Surface | undefined {
  return SURFACES.find((s) => s.slug === slug);
}

/**
 * Stickers for a surface: tagged or categorised for it first (newest first),
 * then — so a page is never thin — every other sticker, since vinyl works on
 * all of these surfaces.
 */
export function stickersForSurface(
  surface: Surface,
  products: Product[],
  categories: Category[]
): { matched: Product[]; others: Product[] } {
  const catIds = new Set(categories.filter((c) => surface.categories.includes(c.slug)).map((c) => c.id));
  const tags = new Set(surface.tags);
  const fits = (p: Product) =>
    p.tags.some((t) => tags.has(t.toLowerCase())) || (p.categoryIds ?? []).some((id) => catIds.has(id));
  const matched = products.filter(fits);
  const others = products.filter((p) => !fits(p));
  return { matched, others };
}
