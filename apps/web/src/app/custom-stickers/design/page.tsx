import type { Metadata } from "next";
import BackButton from "@/components/back-button";
import CustomStickerBuilder from "@/components/custom-sticker-builder";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Print Your Own Design as a Sticker – Custom Stickers India",
  description:
    "Get your own design printed as a die-cut vinyl sticker. Choose your size and any quantity — logos, photos, artwork. Ships across India.",
  path: "/custom-stickers/design",
});

export default function CustomDesignPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-24 pb-44 sm:px-8 sm:pb-24">
      {/* desktop: Back on the page (phones have it in the header) */}
      <div className="mb-3 hidden sm:block">
        <BackButton fallback="/custom-stickers" />
      </div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Your design, as a sticker</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-fog">
        Your logo, photo or artwork as a die-cut vinyl sticker. Add your design, pick a size
        and quantity, and book — we print it to order and ship it across India.
      </p>
      <CustomStickerBuilder />
    </div>
  );
}
