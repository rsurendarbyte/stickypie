import type { Metadata } from "next";
import { ArrowRight, ImageUp, QrCode, Sparkles, Type } from "lucide-react";
import CustomRequestForm from "@/components/custom-request-form";
import HoverLink from "@/components/hover-link";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Custom Stickers – Your Design or QR Code, Printed in India",
  description:
    "Make your own stickers: print your logo, photo or artwork, or create a UPI / WhatsApp / website QR code sticker. Waterproof die-cut vinyl, any quantity, shipped across India.",
  path: "/custom-stickers",
});

const OPTIONS = [
  {
    href: "/custom-stickers/design",
    icon: ImageUp,
    title: "Your design",
    text: "Upload your logo, photo or artwork and we print it as a die-cut sticker.",
    cta: "Upload your design",
  },
  {
    href: "/qr-code-stickers",
    icon: QrCode,
    title: "QR code sticker",
    text: "UPI payments, WhatsApp, Instagram or your website — with a label like “Scan to pay”.",
    cta: "Make a QR sticker",
  },
];

const COMING_SOON = [
  { icon: Type, title: "Name & text stickers", text: "Your name or a short line in fun sticker fonts." },
  { icon: Sparkles, title: "Sticker packs", text: "Pick a few designs and get them as one pack." },
];

/** Custom stickers: choose what to make first. */
export default function CustomStickersPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 pb-24 sm:px-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Custom stickers</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-fog">
        What would you like to make? Waterproof die-cut vinyl, printed to order and shipped across India.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ href, icon: Icon, title, text, cta }) => (
          <HoverLink
            key={href}
            href={href}
            className="group rounded-3xl border border-line bg-ink2 p-5 shadow-[0_20px_50px_-34px_rgba(16,24,40,0.4)] transition-all hover:-translate-y-0.5 hover:border-brand/50 sm:p-6"
          >
            <span className="pie-gradient grid size-12 place-items-center rounded-2xl text-white shadow-lg shadow-brand/25">
              <Icon className="size-6" />
            </span>
            <span className="mt-4 block font-display text-xl font-bold">{title}</span>
            <span className="mt-1 block text-sm text-fog">{text}</span>
            <span className="peel-btn mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold">
              {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </HoverLink>
        ))}
      </div>

      <h2 className="mt-8 text-xs font-semibold tracking-widest text-fog uppercase">Coming soon</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {COMING_SOON.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-ink2/60 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel text-fog">
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
    </div>
  );
}
