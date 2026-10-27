// Search copy + Google structured data shared by the storefront pages.
// Words people actually search for in India ("car stickers", "laptop
// stickers", "waterproof vinyl stickers", "peel and stick") are woven into
// real, readable text — never hidden or stuffed.
import type { Category, Product, PublicReview } from "@stickypie/shared";
import { categoryPath, formatINR } from "@stickypie/shared";
import { SITE_NAME, absoluteUrl } from "./site";
import { siteUrl } from "./mode";

/** Where parcels go and how long they take (matches the shipping policy). */
const HANDLING_DAYS = { min: 2, max: 4 };
const TRANSIT_DAYS = { min: 3, max: 5 };

/** "Made in India" → "Made in India Sticker"; leaves "… Decal/Badge/Pack" alone. */
export function seoName(product: Product): string {
  return /sticker|decal|badge|pack|label/i.test(product.name) ? product.name : `${product.name} Sticker`;
}

function sizeList(product: Product): string {
  const inches = product.sizes.map((s) => s.inches).sort((a, b) => a - b);
  return inches.length ? inches.map((i) => `${i}″`).join(", ") : "";
}

export function productSeoTitle(product: Product): string {
  return `${seoName(product)} – Waterproof Vinyl Decal`;
}

export function productSeoDescription(product: Product): string {
  const sizes = sizeList(product);
  const pitch = `Buy the ${seoName(product)} from ${SITE_NAME}, online in India from ${formatINR(product.price)}${
    sizes ? ` in ${sizes} sizes` : ""
  }. Waterproof, UV-safe die-cut vinyl for car, bike, laptop & helmet. Peel and stick.`;
  const lead = product.description.trim();
  const text = lead ? `${lead} ${pitch}` : pitch;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

/** Plain-language details shown on every sticker page (and read by Google). */
export function productDetails(product: Product, categoryNames: string[]) {
  const name = seoName(product);
  const sizes = sizeList(product);
  const cats = categoryNames.length ? categoryNames.join(", ") : null;
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
  return `Browse ${count} ${name} sticker${count === 1 ? "" : "s"} from ${SITE_NAME} — waterproof die-cut vinyl decals for your car, bike, laptop, helmet and more. Every ${name} sticker is printed to order in the size you pick and shipped across India.`;
}

export type Faq = { q: string; a: string };

/** Live numbers the answers quote (see lib/shop-facts.ts); null = not offered. */
export type ShopFacts = {
  designs: number;
  posters: number;
  stickerFrom: number | null;
  posterFrom: number | null;
  custom: { inches: number; price: number }[];
  qr: { inches: number; price: number }[];
  text: { inches: number; price: number }[];
  /** AI avatar sticker packs: minimum packs, price per pack and the style names, or null when off. */
  avatar: { packs: number; price: number; styles: string[] } | null;
};

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
            a: `Yes — ${facts.posters} mini posters of cars, bikes and more, printed as stickers you can put on a car, bike, laptop, bottle, fridge or wall, from ${formatINR(
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
 * AI avatar sticker questions, for /avatar-stickers (all of them), the home
 * page (the first one) and /llms.txt. Empty while the packs are off.
 */
export function avatarFaq(facts: ShopFacts): Faq[] {
  const avatar = facts.avatar;
  if (!avatar) return [];
  const { packs, price, styles } = avatar;
  const named = styles.slice(0, 8).join(", ");
  return [
    {
      q: "Can I get AI stickers of myself made from a photo?",
      a: `Yes. ${SITE_NAME} turns your selfie into AI avatar stickers — a cartoon version of you in trending styles like ${named} — and prints them as waterproof die-cut vinyl stickers, shipped across India. Pick at least ${packs} styles, one sticker pack each, for ${formatINR(price)} a pack (${formatINR(packs * price)} for ${packs}). Start at stickypie.in/avatar-stickers.`,
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
      a: `${formatINR(price)} per sticker pack, one pack per style, with a minimum of ${packs} packs (${formatINR(packs * price)}). Avatar sticker orders have no minimum order value; shipping is worked out at checkout from your pin code.`,
    },
    {
      q: "What photo should I send for avatar stickers?",
      a: "One clear, well-lit photo of your face looking at the camera, without sunglasses or heavy filters. You upload it from your order page after paying, and it's only used to make your stickers.",
    },
    {
      q: "Where can I stick my avatar stickers?",
      a: "Anywhere smooth: laptops, phones, water bottles, cars, bikes, helmets, diaries and fridges. They're printed on waterproof vinyl, so they're fine indoors or out. They also make a fun gift for friends, couples and kids.",
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
    q: "Are StickyPie stickers waterproof?",
    a: "Yes. Every sticker is printed on premium vinyl that is waterproof, scratch-resistant and UV-safe, so it works on cars, bikes, helmets, bottles and laptops, indoors or out.",
  },
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

const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: HANDLING_DAYS.min, maxValue: HANDLING_DAYS.max, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: TRANSIT_DAYS.min, maxValue: TRANSIT_DAYS.max, unitCode: "DAY" },
  },
};

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
  reviews: PublicReview[]
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
    shippingDetails: SHIPPING_DETAILS,
    hasMerchantReturnPolicy: RETURN_POLICY,
  };
  // One offer per size, each with its own price — what Google Shopping and AI
  // answers read to show "₹14 for 3″, ₹80 for 6″…".
  const offers = sizes.map((s) => ({
    "@type": "Offer",
    ...offerBase,
    ...(s.inches ? { name: `${s.inches} inch`, sku: `${product.slug}-${s.inches}in` } : {}),
    price: s.price,
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
    material: "Vinyl",
    ...(mainCategory ? { category: `Stickers > ${mainCategory.name}` } : { category: "Stickers" }),
    ...(product.tags.length ? { keywords: product.tags.join(", ") } : {}),
    ...(sizes[0].inches
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "Sizes",
            value: sizes.map((s) => `${s.inches}″`).join(", "),
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
      { "@type": "ListItem", position: 1, name: "Stickers", item: absoluteUrl("/stickers") },
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

export function storeStructuredData(supportEmail: string) {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: SITE_NAME,
    url: siteUrl(),
    logo: absoluteUrl("/icons/icon-512.png"),
    description:
      "Online sticker shop in India: waterproof die-cut vinyl stickers and decals for cars, bikes, laptops and helmets.",
    areaServed: { "@type": "Country", name: "India" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: supportEmail, areaServed: "IN" },
    hasMerchantReturnPolicy: RETURN_POLICY,
  };
}
