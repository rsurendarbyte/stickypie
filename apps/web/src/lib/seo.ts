// Search copy + Google structured data shared by the storefront pages.
// Words people actually search for in India ("car stickers", "laptop
// stickers", "vinyl stickers", "peel and stick") are woven into
// real, readable text — never hidden or stuffed.
import type { Category, Product, PublicReview, StoreSettings } from "@stickypie/shared";
import { POSTER_ADHESIVE, POSTER_PAPER, categoryPath, formatINR, packPosterSizes, packSizeSummary, type PosterFinish } from "@stickypie/shared";
import { SITE_NAME, absoluteUrl } from "./site";
import { siteUrl } from "./mode";
import { isInternalTag, isMiniPoster, isPoster, isPosterPack, posterSetName, sizeChipLabel } from "./poster";

/** Where parcels go and how long they take (matches the shipping policy). */
const HANDLING_DAYS = { min: 2, max: 4 };
const TRANSIT_DAYS = { min: 3, max: 5 };

/** "Made in India" → "Made in India Sticker"; leaves "… Decal/Badge/Pack" alone. */
export function seoName(product: Product): string {
  if (isPosterPack(product)) return wallSetName(product);
  if (isMiniPoster(product)) return /poster/i.test(product.name) ? product.name : `${product.name} Mini Poster`;
  return /sticker|decal|badge|pack|label/i.test(product.name) ? product.name : `${product.name} Sticker`;
}

/** "Red Line Wall Setup — 6 Mini Poster Pack" → "Red Line Wall Poster Set": what people search for. */
function wallSetName(product: Product): string {
  const name = posterSetName(product.name).replace(/\s*Wall Setup$/i, "");
  return `${name} ${/\bwall\b/i.test(name) ? "Poster Set" : "Wall Poster Set"}`;
}

function sizeList(product: Product): string {
  const inches = product.sizes.map((s) => s.inches).sort((a, b) => a - b);
  if (isPoster(product)) return inches.map((i) => `${sizeChipLabel(product, i).replace("×", " × ")} in`).join(", ");
  return inches.length ? inches.map((i) => `${i}″`).join(", ") : "";
}

export function productSeoTitle(product: Product): string {
  if (isPosterPack(product)) return `${seoName(product)} – ${product.packItems.length} Posters`;
  return isMiniPoster(product) ? `${seoName(product)} – Wall Poster or Vinyl Sticker` : `${seoName(product)} – Die-Cut Vinyl Decal`;
}

export function productSeoDescription(product: Product): string {
  if (isPosterPack(product)) {
    const pitch = `Buy the ${seoName(product)}: ${product.packItems.length} wall posters on ${POSTER_PAPER}, ${POSTER_ADHESIVE} included, for ${formatINR(product.price)}. Ships across India.`;
    const lead = product.description.trim();
    const text = lead ? `${pitch} ${lead}` : pitch;
    return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
  }
  const sizes = sizeList(product);
  const pitch = `Buy the ${seoName(product)} from ${SITE_NAME}, online in India from ${formatINR(product.price)}${
    sizes ? ` in ${sizes} sizes` : ""
  }. ${isPosterPack(product) ? `Printed on ${POSTER_PAPER}, ${POSTER_ADHESIVE} included.` : isMiniPoster(product) ? `Choose a ${POSTER_PAPER} wall poster or a vinyl sticker.` : "Die-cut vinyl for car, bike, laptop & helmet. Peel and stick."}`;
  const lead = product.description.trim();
  const text = lead ? `${lead} ${pitch}` : pitch;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

const POSTER_TIPS = `Wipe the wall clean and dry and plan the layout first (a pencil dot for each corner helps). Put the ${POSTER_ADHESIVE} on the back of each poster, then press it onto the wall.`;

/** Plain-language details shown on every sticker page (and read by Google). */
export function productDetails(product: Product, categoryNames: string[], finish: PosterFinish = "poster") {
  const name = seoName(product);
  const sizes = sizeList(product);
  const cats = categoryNames.length ? categoryNames.join(", ") : null;
  if (isPosterPack(product)) {
    const count = product.packItems.length;
    return {
      heading: `About the ${name}`,
      intro: `The ${name} is a set of ${count} matching mini posters, printed on ${POSTER_PAPER} for your order. Its posters are ${packSizeSummary(packPosterSizes(product))}, and ${POSTER_ADHESIVE} come in the box so you can put them up side by side, like the picture, for an instant wall collage.`,
      facts: [
        ["In the set", `${count} mini posters`],
        ["Material", POSTER_PAPER],
        ["In the box", `All ${count} posters plus ${POSTER_ADHESIVE}`],
        ["Poster sizes", packSizeSummary(packPosterSizes(product))],
        ["Price", `${formatINR(product.price)} for the whole set`],
        ["Goes on", "Walls, doors, cupboards and other smooth surfaces"],
        ["Shipping", `Dispatched in ${HANDLING_DAYS.min}–${HANDLING_DAYS.max} days, then ${TRANSIT_DAYS.min}–${TRANSIT_DAYS.max} days to reach you anywhere in India`],
      ] as [string, string][],
      tips: POSTER_TIPS,
    };
  }
  if (isMiniPoster(product) && finish === "sticker") {
    return {
      heading: `About the ${name} sticker`,
      intro: `This is the ${name} as a vinyl sticker, printed for your order${
        cats ? ` — part of our ${cats} collection` : ""
      }. It goes on a car, bike, helmet, laptop, water bottle or fridge. Just peel and stick.`,
      facts: [
        ["Material", "Premium vinyl, peel and stick"],
        ...(sizes ? [["Sizes", sizes]] : []),
        ["Price", product.sizes.length > 1 ? `From ${formatINR(product.price)}` : formatINR(product.price)],
        ["Sticks on", "Cars, bikes, helmets, laptops, bottles, fridges"],
        ["Shipping", `Dispatched in ${HANDLING_DAYS.min}–${HANDLING_DAYS.max} days, then ${TRANSIT_DAYS.min}–${TRANSIT_DAYS.max} days to reach you anywhere in India`],
      ] as [string, string][],
      tips: "Clean and dry the surface first, peel the sticker off its backing, press it down from the centre outwards and smooth out any air bubbles. Leave it 24 hours before washing.",
    };
  }
  if (isMiniPoster(product)) {
    return {
      heading: `About the ${name}`,
      intro: `This is the ${name} as a wall poster, printed for your order on ${POSTER_PAPER}${
        cats ? ` — part of our ${cats} collection` : ""
      }. ${POSTER_ADHESIVE[0].toUpperCase()}${POSTER_ADHESIVE.slice(1)} come with it, so it's ready to go up on your wall.`,
      facts: [
        ["Material", POSTER_PAPER],
        ...(sizes ? [["Sizes", sizes]] : []),
        ["Price", product.sizes.length > 1 ? `From ${formatINR(product.price)}` : formatINR(product.price)],
        ["In the box", `Your poster plus ${POSTER_ADHESIVE}`],
        ["Goes on", "Walls, doors, cupboards and other smooth surfaces"],
        ["Shipping", `Dispatched in ${HANDLING_DAYS.min}–${HANDLING_DAYS.max} days, then ${TRANSIT_DAYS.min}–${TRANSIT_DAYS.max} days to reach you anywhere in India`],
      ] as [string, string][],
      tips: POSTER_TIPS,
    };
  }
  return {
    heading: `About the ${name}`,
    intro: `The ${name} is a die-cut vinyl sticker printed for your order and cut to the shape of the design${
      cats ? ` — part of our ${cats} collection` : ""
    }. It goes on a car, bike, helmet, laptop, water bottle or phone case. Just peel and stick.`,
    facts: [
      ["Material", "Premium vinyl, die-cut to shape"],
      ...(sizes ? [["Sizes", `${sizes} (longest side)`]] : []),
      ["Price", product.sizes.length > 1 ? `From ${formatINR(product.price)}` : formatINR(product.price)],
      ["Sticks on", "Cars, bikes, helmets, laptops, bottles, phones, toolboxes"],
      ["Shipping", `Dispatched in ${HANDLING_DAYS.min}–${HANDLING_DAYS.max} days, then ${TRANSIT_DAYS.min}–${TRANSIT_DAYS.max} days to reach you anywhere in India`],
    ] as [string, string][],
    tips: "Clean and dry the surface first, peel the sticker off its backing, press it down from the centre outwards and smooth out any air bubbles. Leave it 24 hours before washing.",
  };
}

/** Intro text for a category page. */
export function categoryIntro(category: Category, count: number): string {
  const name = category.name.toLowerCase();
  if (/mini poster/.test(name)) {
    return `Browse ${count} ${name} from ${SITE_NAME}. Pick each one as a wall poster on ${POSTER_PAPER}, with ${POSTER_ADHESIVE} included, or as a vinyl sticker. Printed to order and shipped across India.`;
  }
  if (/poster/.test(name)) {
    return `Browse ${count} ${name} from ${SITE_NAME} — wall posters printed to order on ${POSTER_PAPER}, with ${POSTER_ADHESIVE} included, shipped across India.`;
  }
  return `Browse ${count} ${name} sticker${count === 1 ? "" : "s"} from ${SITE_NAME} — die-cut vinyl decals for your car, bike, laptop, helmet and more. Every ${name} sticker is printed to order in the size you pick and shipped across India.`;
}

export type Faq = { q: string; a: string };

/** Live numbers the answers quote (see lib/shop-facts.ts); null = not offered. */
export type ShopFacts = {
  /** Everything sold on its own: stickers and mini posters, not wall sets. */
  designs: number;
  posters: number;
  wallSets: number;
  wallSetFrom: number | null;
  stickerFrom: number | null;
  posterFrom: number | null;
  custom: { inches: number; price: number }[];
  qr: { inches: number; price: number }[];
  text: { inches: number; price: number }[];
  /** AI avatar sticker packs: minimum packs, price per pack, the style names and one picture per style. */
  avatar: { packs: number; price: number; extra: number; styles: string[]; pictures: { style: string; url: string }[] } | null;
};

/** The cheapest price across these products, at any size. */
export function lowestPrice(products: Product[]): number | null {
  const prices = products.flatMap((p) => (p.sizes.length ? p.sizes.map((s) => s.price) : [p.price]));
  return prices.length ? Math.min(...prices) : null;
}

const fromPrice = (sizes: { price: number }[]) => (sizes.length ? Math.min(...sizes.map((s) => s.price)) : null);
const sizePrices = (sizes: { inches: number; price: number }[]) =>
  sizes.map((s) => `${s.inches}″ ${formatINR(s.price)}`).join(", ");

/**
 * The questions people put to Google and AI assistants, answered in plain,
 * quotable sentences with the shop's real prices. Shown on the home page,
 * given to search engines as FAQ data, and listed in /llms.txt.
 */
export function storeFaq(facts: ShopFacts): Faq[] {
  const customFrom = fromPrice(facts.custom);
  const qrFrom = fromPrice(facts.qr);
  const textFrom = fromPrice(facts.text);
  const makeYourOwn = [
    customFrom !== null && `custom stickers from ${formatINR(customFrom)}`,
    qrFrom !== null && `QR code stickers from ${formatINR(qrFrom)}`,
    textFrom !== null && `name stickers from ${formatINR(textFrom)}`,
    facts.avatar && `AI avatar stickers of you from your photo (${formatINR(facts.avatar.price)} a pack)`,
  ].filter(Boolean);
  return [
    {
      q: "What is StickyPie?",
      a: `${SITE_NAME} (stickypie.in) is an online sticker and wall poster shop in India. It sells ${facts.designs} designs: die-cut vinyl stickers for cars, bikes, laptops and helmets${
        facts.posters ? ", mini posters" : ""
      }${facts.wallSets ? `, ${facts.wallSets} ready wall poster sets` : ""}${facts.avatar ? ", AI avatar stickers made from your photo" : ""} and custom stickers, printed to order and shipped across India.`,
    },
    ...wallPosterFaq(facts).slice(0, 2),
    ...(facts.posters
      ? [
          {
            q: "Are StickyPie mini posters stickers?",
            a: `You choose. A mini poster comes as a wall poster on ${POSTER_PAPER}, with ${POSTER_ADHESIVE} included, or as a vinyl sticker you peel and stick. Wall poster sets are always on poster paper.`,
          },
        ]
      : []),
    {
      q: "Where can I buy stickers online in India?",
      a: `${SITE_NAME} (stickypie.in) sells ${facts.designs} die-cut vinyl sticker designs online in India — car, bike, laptop, helmet and water bottle stickers${
        facts.posters ? ", plus mini posters" : ""
      }${facts.stickerFrom !== null ? `, from ${formatINR(facts.stickerFrom)}` : ""}. Every order is printed to order and shipped to pin codes across India.${
        makeYourOwn.length ? ` You can also make your own: ${makeYourOwn.join(", ")}.` : ""
      }`,
    },
    ...(facts.stickerFrom !== null
      ? [
          {
            q: `How much do ${SITE_NAME} stickers cost?`,
            a: `Stickers start at ${formatINR(facts.stickerFrom)} for the smallest size; bigger sizes cost more, and every sticker page lists the price of each size.${
              makeYourOwn.length ? ` Make-your-own options: ${makeYourOwn.join(", ")}.` : ""
            } Shipping is worked out at checkout from your pin code.`,
          },
        ]
      : []),
    ...(customFrom !== null
      ? [
          {
            q: "Can I get custom stickers made with my own logo or photo?",
            a: `Yes. Upload your logo, photo or artwork and ${SITE_NAME} prints it as a die-cut vinyl sticker in the size and quantity you pick (${sizePrices(
              facts.custom
            )} per sticker). You can send your design before or after paying. Start at stickypie.in/custom-stickers/design.`,
          },
        ]
      : []),
    ...(facts.avatar ? [avatarFaq(facts)[0]] : []),
    ...(qrFrom !== null
      ? [
          {
            q: "Do you make QR code stickers for UPI payments?",
            a: `Yes. ${SITE_NAME} makes QR code stickers for UPI payments, WhatsApp, Instagram or a website, with a label like “Scan to pay” (${sizePrices(
              facts.qr
            )}). Make one at stickypie.in/qr-code-stickers.`,
          },
        ]
      : []),
    ...(facts.posters && facts.posterFrom !== null
      ? [
          {
            q: "Do you sell mini posters?",
            a: `Yes — ${facts.posters} mini posters of cars, bikes and more, as wall posters on ${POSTER_PAPER} or as vinyl stickers, from ${formatINR(
              facts.posterFrom
            )}.`,
          },
        ]
      : []),
    ...BASE_FAQ,
    {
      q: "What payment methods do you accept? Is cash on delivery available?",
      a: "All orders are prepaid: UPI, debit or credit cards, netbanking or wallets, through a secure payment partner. Cash on delivery isn't available.",
    },
    {
      q: "Can I cancel or return an order?",
      a: "Stickers are printed to order, so an order can't be cancelled once the payment is confirmed. If an item arrives damaged or wrong, it's replaced free of charge, shipping included.",
    },
  ];
}

/**
 * Wall poster questions, for /wall-posters (all of them), the home page (the
 * first two) and /llms.txt. Empty while nothing is on sale.
 */
export function wallPosterFaq(facts: ShopFacts): Faq[] {
  const { posters, wallSets, posterFrom, wallSetFrom } = facts;
  if (!posters && !wallSets) return [];
  const range = [
    wallSets && `${wallSets} ready wall poster sets${wallSetFrom !== null ? ` from ${formatINR(wallSetFrom)}` : ""}`,
    posters && `${posters} single mini posters${posterFrom !== null ? ` from ${formatINR(posterFrom)}` : ""}`,
  ].filter(Boolean);
  return [
    {
      q: "Where can I buy wall posters online in India?",
      a: `${SITE_NAME} (stickypie.in) sells ${range.join(" and ")}: cars, bikes, Tamil cinema, cricket, motivational, devotional, travel and retro designs. They're printed to order on ${POSTER_PAPER} and shipped across India. See them all at stickypie.in/wall-posters.`,
    },
    {
      q: "How much do wall posters cost?",
      a: `${[
        posterFrom !== null && `Single mini posters start at ${formatINR(posterFrom)}`,
        wallSetFrom !== null && `wall poster sets start at ${formatINR(wallSetFrom)} for the whole set`,
      ].filter(Boolean).join(", and ")}. Every poster page lists its price, and shipping is worked out at checkout from your pin code.`,
    },
    {
      q: "What sizes do your wall posters come in?",
      a: "4 × 6 in and 6 × 9 in. Wall sets can mix the two, and each set's page shows how much wall it covers.",
    },
    {
      q: "What comes in a wall poster set?",
      a: `Every poster in the set, printed on ${POSTER_PAPER}, plus ${POSTER_ADHESIVE} to put them up. One set is one price, however many posters it has.`,
    },
    {
      q: "How do I put up the posters?",
      a: POSTER_TIPS,
    },
    {
      q: "Can I change the posters in a wall set?",
      a: "Yes. On any wall set's page, tap × on a poster and pick another one in its place. The set keeps its layout, sizes and price.",
    },
    {
      q: "Are the wall posters paper or vinyl?",
      a: `Wall poster sets are always on ${POSTER_PAPER}. A single mini poster can be either: choose a wall poster on paper, or a vinyl sticker you peel and stick.`,
    },
  ];
}

/** The price question for a poster subject page, from what's on it now. */
export function posterTopicFaq(label: string, products: Product[]): Faq | null {
  const single = lowestPrice(products.filter((p) => !isPosterPack(p)));
  const set = lowestPrice(products.filter(isPosterPack));
  if (single === null && set === null) return null;
  return {
    q: `How much do ${label} cost?`,
    a: `${[
      single !== null && `Single mini posters start at ${formatINR(single)}`,
      set !== null && `wall poster sets start at ${formatINR(set)} for the whole set`,
    ].filter(Boolean).join(", and ")}. Shipping is worked out at checkout from your pin code.`,
  };
}

/**
 * AI avatar sticker questions, for /avatar-stickers (all of them), the home
 * page (the first one) and /llms.txt. Empty while the packs are off.
 */
export function avatarFaq(facts: ShopFacts): Faq[] {
  const avatar = facts.avatar;
  if (!avatar) return [];
  const { packs, price, extra, styles } = avatar;
  const thenExtra = extra !== price ? `, then ${formatINR(extra)} for each extra pack` : "";
  const named = styles.slice(0, 8).join(", ");
  return [
    {
      q: "Can I get AI stickers of myself made from a photo?",
      a: `Yes. ${SITE_NAME} turns your selfie into AI avatar stickers — a cartoon version of you in trending styles like ${named} — and prints them as die-cut vinyl stickers, shipped across India. Pick at least ${packs} styles, one sticker pack each, for ${formatINR(price)} a pack (${formatINR(packs * price)} for ${packs}). Start at stickypie.in/avatar-stickers.`,
    },
    {
      q: "How do AI avatar stickers work?",
      a: `Pick your styles (${packs} or more), pay, then upload one clear photo of your face from your order page. We make an AI sticker pack of you in each style, show the finished stickers on your order page to download and share, then print them on vinyl and ship them.`,
    },
    {
      q: "Which avatar sticker styles can I choose?",
      a: `${styles.length} styles: ${styles.join(", ")}. Every style shows sample stickers before you order, and you get one pack per style you pick.`,
    },
    {
      q: "How much do avatar stickers cost?",
      a: `${formatINR(price)} per sticker pack, one pack per style, with a minimum of ${packs} packs (${formatINR(packs * price)})${thenExtra}. Avatar sticker orders have no minimum order value; shipping is worked out at checkout from your pin code.`,
    },
    {
      q: "What photo should I send for avatar stickers?",
      a: "One clear, well-lit photo of your face looking at the camera, without sunglasses or heavy filters. You upload it from your order page after paying, and it's only used to make your stickers.",
    },
    {
      q: "Are the avatar stickers really made with AI?",
      a: `Yes. ${SITE_NAME} uses an AI model to turn your photo into a cartoon avatar of you in each style you pick, so the artwork is AI-generated. You see the finished stickers on your order page before they're printed.`,
    },
    {
      q: "Can I get anime or chibi stickers of myself?",
      a: `Yes — anime and chibi are two of the ${styles.length} AI styles, along with ${styles.filter((s) => !/anime|chibi/i.test(s)).slice(0, 5).join(", ")} and more. Pick any ${packs} or more and you get a sticker pack of you in each.`,
    },
    {
      q: "How long do AI avatar stickers take to arrive?",
      a: "Once your stickers are made and shown on your order page, they're printed on vinyl, dispatched in 2–4 days and delivered in 3–5 days anywhere in India.",
    },
    {
      q: "Can I order avatar stickers as a gift?",
      a: "Yes. Use the photo of the person you're gifting (with their OK, or your child's photo as their parent) and ship to their address in India. Avatar stickers of friends, couples and kids make a fun birthday or anniversary gift.",
    },
    {
      q: "Where can I stick my avatar stickers?",
      a: "Anywhere smooth: laptops, phones, water bottles, cars, bikes, helmets, diaries and fridges. They also make a fun gift for friends, couples and kids.",
    },
  ];
}

/** Make-your-own questions with every size's price — for /custom-stickers. */
export function customFaq(facts: ShopFacts): Faq[] {
  return [
    ...(facts.custom.length
      ? [
          {
            q: "How much does a custom sticker cost?",
            a: `A custom sticker printed from your own design costs ${sizePrices(facts.custom)} per sticker (size = longest side), in any quantity. Shipping is worked out at checkout from your pin code.`,
          },
          {
            q: "How do I send my design?",
            a: "Pick a size and quantity, then add your logo, photo or artwork — before paying, or later from your order page. It's printed as a die-cut sticker cut to the shape of your design.",
          },
        ]
      : []),
    ...(facts.qr.length
      ? [
          {
            q: "How much does a QR code sticker cost?",
            a: `A QR code sticker costs ${sizePrices(facts.qr)}. It can open a UPI payment, WhatsApp chat, Instagram profile or website, with a label like “Scan to pay”, and you see it drawn before you order.`,
          },
        ]
      : []),
    ...(facts.text.length
      ? [
          {
            q: "How much does a name sticker cost?",
            a: `A name sticker — your name or a short line in a fun font and colour — costs ${sizePrices(facts.text)}. Great for bottles, bags, laptops and helmets.`,
          },
        ]
      : []),
  ];
}

const BASE_FAQ: Faq[] = [
  {
    q: "What sizes do the stickers come in?",
    a: "Most designs come in several sizes (measured on the longest side). You can preview the real size on your screen with \"See actual size\" on any sticker.",
  },
  {
    q: "Do you ship across India?",
    a: `Yes, we deliver to pin codes across India. Orders are dispatched within ${HANDLING_DAYS.min}–${HANDLING_DAYS.max} business days and usually arrive in ${TRANSIT_DAYS.min}–${TRANSIT_DAYS.max} days.`,
  },
  {
    q: "How do I apply a vinyl sticker?",
    a: "Clean and dry the surface, peel the sticker off its backing and press it down from the centre outwards. Smooth out any bubbles and avoid washing for 24 hours.",
  },
  {
    q: "Can I remove the sticker later?",
    a: "Yes. Warm it gently with a hair dryer and peel it off slowly — it comes away cleanly from paint, glass and laptop lids.",
  },
];

// The fee goes by zone and Google can't take zones inside India, so it gets the
// cheapest to dearest zone (admin → Settings). Before GST, same as the offer price.
const shippingDetails = (rates: StoreSettings["rates"]) => ({
  "@type": "OfferShippingDetails",
  shippingRate: {
    "@type": "MonetaryAmount",
    minValue: Math.min(...Object.values(rates)),
    maxValue: Math.max(...Object.values(rates)),
    currency: "INR",
  },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: HANDLING_DAYS.min, maxValue: HANDLING_DAYS.max, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: TRANSIT_DAYS.min, maxValue: TRANSIT_DAYS.max, unitCode: "DAY" },
  },
});

// Printed to order: damaged / wrong items are replaced free, other returns aren't taken.
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "IN",
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
};

/** Product + breadcrumb structured data for a sticker page. */
export function productStructuredData(
  product: Product,
  mainCategory: Category | null,
  reviews: PublicReview[],
  shippingRates: StoreSettings["rates"]
) {
  const url = absoluteUrl(`/sticker/${product.slug}`);
  const availability =
    product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
  const sizes = product.sizes.length
    ? [...product.sizes].sort((a, b) => a.inches - b.inches)
    : [{ inches: null as number | null, price: product.price }];
  // Prices are good for a year (Google wants a date; we change them by hand).
  const priceValidUntil = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const offerBase = {
    url,
    priceCurrency: "INR",
    itemCondition: "https://schema.org/NewCondition",
    availability,
    seller: { "@type": "Organization", name: SITE_NAME },
    shippingDetails: shippingDetails(shippingRates),
    hasMerchantReturnPolicy: RETURN_POLICY,
  };
  // One offer per size, each with its own price — what Google Shopping and AI
  // answers read to show "₹14 for 3″, ₹80 for 6″…".
  const offers = sizes.map((s) => ({
    "@type": "Offer",
    ...offerBase,
    ...(s.inches ? { name: `${s.inches} inch`, sku: `${product.slug}-${s.inches}in` } : {}),
    price: s.price,
    // Last edit, not created date: a price can't have changed since then.
    validFrom: product.updatedAt,
    priceValidUntil,
  }));

  const rated = reviews.filter((r) => r.rating >= 1);
  const ratingData = rated.length
    ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10,
          reviewCount: rated.length,
          bestRating: 5,
          worstRating: 1,
        },
        review: rated.slice(0, 5).map((r) => ({
          "@type": "Review",
          author: { "@type": "Person", name: r.authorName },
          datePublished: r.createdAt.slice(0, 10),
          reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          ...(r.body ? { reviewBody: r.body } : {}),
        })),
      }
    : {};

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: seoName(product),
    description: product.description || productSeoDescription(product),
    url,
    image: [absoluteUrl(product.imageUrl), ...(product.thumbUrl ? [absoluteUrl(product.thumbUrl)] : [])],
    sku: product.slug,
    mpn: product.slug,
    brand: { "@type": "Brand", name: SITE_NAME },
    material: isPosterPack(product) ? POSTER_PAPER : isMiniPoster(product) ? `${POSTER_PAPER} or vinyl` : "Vinyl",
    ...(mainCategory
      ? { category: `${isPoster(product) ? "Posters" : "Stickers"} > ${mainCategory.name}` }
      : { category: isPoster(product) ? "Posters" : "Stickers" }),
    ...(product.tags.length ? { keywords: product.tags.filter((t) => !isInternalTag(t)).join(", ") } : {}),
    ...(isPosterPack(product)
      ? {
          additionalProperty: [
            { "@type": "PropertyValue", name: "Posters in the set", value: product.packItems.length },
            { "@type": "PropertyValue", name: "Poster sizes", value: packSizeSummary(packPosterSizes(product)) },
          ],
        }
      : sizes[0].inches
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "Sizes",
            value: sizes.map((s) => (s.inches ? sizeChipLabel(product, s.inches) : "")).join(", "),
          },
        }
      : {}),
    offers: offers.length === 1 ? offers[0] : offers,
    ...ratingData,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      isPoster(product)
        ? { "@type": "ListItem", position: 1, name: "Wall Posters", item: absoluteUrl("/wall-posters") }
        : { "@type": "ListItem", position: 1, name: "Stickers", item: absoluteUrl("/stickers") },
      ...(mainCategory
        ? [{ "@type": "ListItem", position: 2, name: mainCategory.name, item: absoluteUrl(categoryPath(mainCategory.slug)) }]
        : []),
      { "@type": "ListItem", position: mainCategory ? 3 : 2, name: seoName(product), item: url },
    ],
  };

  return [productLd, breadcrumbLd];
}

/** ItemList of the stickers on a category / listing page. */
export function itemListStructuredData(products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/sticker/${p.slug}`),
      name: seoName(p),
    })),
  };
}

export function faqStructuredData(faq: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/**
 * Who StickyPie is, for search engines and AI answers. The name is shared with
 * an unrelated AR/VR research project, so the store spells out that this
 * StickyPie is the sticker shop at stickypie.in (alternate names, a
 * disambiguating line, and the brand as its own entity).
 */
export function storeStructuredData(supportEmail: string) {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${siteUrl()}/#store`,
    name: SITE_NAME,
    alternateName: ["StickyPie Stickers", "Sticky Pie", "StickyPie India", "stickypie.in"],
    url: siteUrl(),
    logo: absoluteUrl("/icons/icon-512.png"),
    image: absoluteUrl("/icons/icon-512.png"),
    slogan: "Stick your style",
    description:
      "StickyPie (stickypie.in) is an online sticker and wall poster shop in India: die-cut vinyl stickers and decals for cars, bikes, laptops and helmets, premium wall posters and wall poster sets, AI avatar stickers of you and custom stickers.",
    disambiguatingDescription:
      "StickyPie is the Indian online sticker and wall poster shop at stickypie.in — not the StickyPie gaze-based marking menu from AR/VR research.",
    brand: { "@type": "Brand", name: SITE_NAME, url: siteUrl(), logo: absoluteUrl("/icons/icon-512.png") },
    knowsAbout: ["wall posters", "wall poster sets", "mini posters", "car posters", "vinyl stickers", "car stickers", "bike stickers", "laptop stickers", "custom stickers", "AI avatar stickers"],
    areaServed: { "@type": "Country", name: "India" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: supportEmail, areaServed: "IN" },
    hasMerchantReturnPolicy: RETURN_POLICY,
  };
}
