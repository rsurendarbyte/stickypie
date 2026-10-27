import type { Metadata } from "next";
import { ArrowRight, ImageUp, QrCode, Smile, Sparkles, Type } from "lucide-react";
import CustomRequestForm from "@/components/custom-request-form";
import FaqItem from "@/components/faq-item";
import JsonLd from "@/components/json-ld";
import PageLink from "@/components/page-link";
import { customFaq, faqStructuredData } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Custom Stickers – Your Design, Name or QR Code, Printed in India",
  description:
    "Make your own stickers: print your logo, photo or artwork, make a name sticker in fun fonts, or create a UPI / WhatsApp / website QR code sticker. Waterproof die-cut vinyl, any quantity, shipped across India.",
  path: "/custom-stickers",
});

const OPTIONS = [
  {
    href: "/avatar-stickers",
    icon: Smile,
    title: "Avatar stickers of you",
    text: "Send a photo, pick trending styles — AI makes sticker packs of you.",
  },
  {
    href: "/custom-stickers/design",
    icon: ImageUp,
    title: "Your design",
    text: "Upload your logo, photo or artwork.",
  },
  {
    href: "/qr-code-stickers",
    icon: QrCode,
    title: "QR code sticker",
    text: "UPI, WhatsApp or website QR.",
  },
  {
    href: "/name-stickers",
    icon: Type,
    title: "Name & text",
    text: "Your name in fun sticker fonts.",
  },
];

const COMING_SOON = [
  { icon: Sparkles, title: "Sticker packs", text: "A few designs as one pack." },
];

/** Custom stickers: choose what to make first. */
export default async function CustomStickersPage() {
  // Prices answered in plain words, for shoppers and AI assistants alike.
  const faq = customFaq(await loadShopFacts());
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 pb-24 sm:px-8">
      {faq.length > 0 && <JsonLd data={faqStructuredData(faq)} />}
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Custom stickers</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-fog">
        What would you like to make? Waterproof die-cut vinyl, printed to order and shipped across India.
      </p>

      <div className="mt-5 grid gap-2.5 lg:grid-cols-3 lg:gap-3">
        {OPTIONS.map(({ href, icon: Icon, title, text }) => (
          <PageLink
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-ink2 p-3 shadow-[0_14px_36px_-28px_rgba(16,24,40,0.45)] transition-all hover:-translate-y-0.5 hover:border-brand/50 sm:p-3.5"
          >
            <span className="pie-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-md shadow-brand/25">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base leading-tight font-bold">{title}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-fog">{text}</span>
            </span>
            <span className="peel-btn grid size-8 shrink-0 place-items-center rounded-full transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </PageLink>
        ))}
      </div>

      <h2 className="mt-6 text-xs font-semibold tracking-widest text-fog uppercase">Coming soon</h2>
      <div className="mt-2 grid gap-2.5 lg:grid-cols-3 lg:gap-3">
        {COMING_SOON.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-ink2/60 p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-panel text-fog">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-snow">{title}</span>
              <span className="block text-xs text-fog">{text}</span>
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-snow/[0.06] px-2.5 py-1 text-[10px] font-bold tracking-wide text-fog uppercase">
              Soon
            </span>
          </div>
        ))}
      </div>

      <CustomRequestForm />

      {faq.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Custom sticker questions</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
            {faq.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
