import type { Metadata } from "next";
import BackButton from "@/components/back-button";
import AvatarStickerBuilder from "@/components/avatar-sticker-builder";
import CustomRequestForm from "@/components/custom-request-form";
import FaqItem from "@/components/faq-item";
import JsonLd from "@/components/json-ld";
import { avatarFaq, faqStructuredData } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";
import { SITE_NAME, absoluteUrl, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "AI Avatar Stickers – Waterproof Vinyl Stickers of You, From Your Photo",
  description:
    "Turn your selfie into AI avatar stickers in anime, chibi, 90s retro, 3D cartoon and more trending styles, printed on waterproof vinyl.",
  path: "/avatar-stickers",
});

export default async function AvatarStickersPage() {
  // Prices and styles answered in plain words, for shoppers, Google and AI assistants.
  const facts = await loadShopFacts();
  const faq = avatarFaq(facts);
  const offer = facts.avatar && {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "AI Avatar Stickers From Your Photo",
    description: `Custom AI avatar sticker packs made from your selfie in ${facts.avatar.styles.length} styles, printed on waterproof die-cut vinyl.`,
    brand: { "@type": "Brand", name: SITE_NAME },
    image: absoluteUrl("/avatar-samples/90s-retro-girl.webp"),
    url: absoluteUrl("/avatar-stickers"),
    offers: {
      "@type": "Offer",
      price: facts.avatar.packs * facts.avatar.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/avatar-stickers"),
    },
  };
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-44 sm:px-8 sm:pt-24 sm:pb-24">
      {faq.length > 0 && <JsonLd data={offer ? [offer, faqStructuredData(faq)] : faqStructuredData(faq)} />}
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
        print them on waterproof vinyl.
      </p>
      <AvatarStickerBuilder />
      {faq.length > 0 && (
        <section className="mt-12 max-w-3xl">
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
