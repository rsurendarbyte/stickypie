import type { Metadata } from "next";
import CustomStickerBuilder from "@/components/custom-sticker-builder";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Custom Stickers – Print Your Own Design Online in India",
  description:
    "Get your own design printed as a waterproof die-cut vinyl sticker. Choose your size and any quantity — logos, photos, artwork. Ships across India.",
  path: "/custom-stickers",
});

export default function CustomStickersPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-24 pb-24 sm:px-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Custom stickers</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-fog">
        Your logo, photo or artwork as a waterproof die-cut vinyl sticker. Add your design, pick a size
        and quantity, and book — we print it to order and ship it across India.
      </p>
      <CustomStickerBuilder />
    </div>
  );
}
