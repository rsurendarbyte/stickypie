import type { Metadata } from "next";
import BackButton from "@/components/back-button";
import AvatarStickerBuilder from "@/components/avatar-sticker-builder";
import CustomRequestForm from "@/components/custom-request-form";
import FaqItem from "@/components/faq-item";
import JsonLd from "@/components/json-ld";
import { avatarFaq, faqStructuredData } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";
import { formatINR } from "@stickypie/shared";
import { siteUrl } from "@/lib/mode";
import { SITE_NAME, absoluteUrl, pageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "AI Avatar Stickers – Vinyl Stickers of You, From Your Photo",
    description:
      "Turn your selfie into AI avatar stickers in anime, chibi, 90s retro, 3D cartoon and more trending styles, printed on vinyl.",
    path: "/avatar-stickers",
    image: "/avatar-samples/90s-retro-girl.webp",
  }),
  keywords: [
    "AI avatar stickers",
    "AI stickers of me",
    "stickers of myself from photo",
    "custom cartoon stickers India",
    "anime stickers of me",
    "chibi stickers from photo",
    "selfie stickers",
    "personalised stickers India",
    "StickyPie",
  ],
};

export default async function AvatarStickersPage() {
  // Prices and styles answered in plain words, for shoppers, Google and AI assistants.
  const facts = await loadShopFacts();
  const faq = avatarFaq(facts);
  const avatar = facts.avatar;
  const page = absoluteUrl("/avatar-stickers");
  const offer = avatar && {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "AI Avatar Stickers From Your Photo",
    alternateName: ["AI stickers of me", "Custom cartoon stickers from photo", "Selfie avatar stickers"],
    description: `Custom AI avatar sticker packs made from your selfie in ${avatar.styles.length} styles (${avatar.styles.join(", ")}), printed on die-cut vinyl and shipped across India.`,
    brand: { "@type": "Brand", name: SITE_NAME },
    category: "Custom stickers",
    image: avatar.pictures.length
      ? avatar.pictures.slice(0, 10).map((p) => p.url)
      : [absoluteUrl("/avatar-samples/90s-retro-girl.webp")],
    url: page,
    material: "Vinyl",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Styles", value: avatar.styles.join(", ") },
      { "@type": "PropertyValue", name: "Made with", value: "AI model, from your photo" },
      { "@type": "PropertyValue", name: "Minimum packs", value: avatar.packs },
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: avatar.packs * avatar.price,
      highPrice: avatar.packs * avatar.price + Math.max(avatar.styles.length - avatar.packs, 0) * avatar.extra,
      offerCount: Math.max(avatar.styles.length - avatar.packs + 1, 1),
      availability: "https://schema.org/InStock",
      url: page,
      seller: { "@id": `${siteUrl()}/#store` },
    },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Custom stickers", item: absoluteUrl("/custom-stickers") },
      { "@type": "ListItem", position: 3, name: "AI avatar stickers", item: page },
    ],
  };
  const howTo = avatar && {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to get AI avatar stickers of yourself",
    description: `Order a pack of AI-made stickers of you in each style you pick, from ${SITE_NAME}.`,
    totalTime: "P10D",
    estimatedCost: { "@type": "MonetaryAmount", currency: "INR", value: avatar.packs * avatar.price },
    step: [
      { name: "Pick your styles", text: `Choose ${avatar.packs} or more styles, like ${avatar.styles.slice(0, 4).join(", ")}. Each style is one sticker pack.` },
      { name: "Add your photo", text: "Add one clear, well-lit photo of your face looking at the camera." },
      { name: "Pay", text: `Pay online (${formatINR(avatar.price)} a pack). Shipping is added at checkout.` },
      { name: "See your stickers", text: "We make your stickers with an AI model and show them on your order page." },
      { name: "Get them delivered", text: "They're printed on vinyl and delivered anywhere in India." },
    ].map((st, i) => ({ "@type": "HowToStep", position: i + 1, url: page, ...st })),
  };
  const data = [offer, breadcrumb, howTo, faq.length ? faqStructuredData(faq) : null].filter(Boolean);
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-44 sm:px-8 sm:pt-24 sm:pb-24">
      <JsonLd data={data} />
      {/* desktop: Back on the page (phones have it in the header) */}
      <div className="mb-3 hidden sm:block">
        <BackButton fallback="/custom-stickers" />
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand uppercase">
        New · AI avatar sticker packs
      </span>
      <h1 className="mt-2 font-display text-[28px] leading-[1.1] font-bold sm:text-[42px]">
        AI stickers of you, in trending styles
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-fog sm:text-base">
        Pick your styles and send a selfie. We use AI to make a pack of avatar stickers of you in each style, then
        print them on vinyl.
      </p>
      <AvatarStickerBuilder />
      {avatar && (
        // Every style in words, for shoppers scrolling past and for search / AI answers.
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">AI sticker styles of you</h2>
          <p className="mt-2 text-sm leading-relaxed text-fog">
            Send one selfie and get a cartoon version of you, made with AI, in any of {avatar.styles.length} trending
            styles. Each style is a pack of stickers of you, printed on die-cut vinyl for laptops, phones,
            bottles, cars and bikes, and shipped across India. {formatINR(avatar.price)} a pack, {avatar.packs} packs or
            more{avatar.extra !== avatar.price && <>, then {formatINR(avatar.extra)} for each extra pack</>}.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {avatar.styles.map((st) => (
              <li
                key={st}
                className="rounded-full border border-line bg-ink2/80 px-3 py-1.5 text-xs font-semibold text-snow"
              >
                {st} stickers of you
              </li>
            ))}
          </ul>
        </section>
      )}
      {faq.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-xl font-bold">AI avatar stickers, answered</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
            {faq.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </section>
      )}
      <CustomRequestForm />
    </div>
  );
}
