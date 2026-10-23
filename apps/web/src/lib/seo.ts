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
    }. It's waterproof and UV-safe, so it stays bright on a car, bike, helmet, laptop, water bottle or phone case. Just peel and stick.`,
    facts: [
      ["Material", "Premium vinyl, die-cut to shape"],
      ["Finish", "Waterproof, scratch-resistant, UV-safe"],
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

/** Common questions — shown on the home page and given to Google as FAQ data. */
export const STORE_FAQ: { q: string; a: string }[] = [
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

export function faqStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: STORE_FAQ.map(({ q, a }) => ({
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
