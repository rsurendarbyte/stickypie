import type { Metadata } from "next";
import BackButton from "@/components/back-button";
import CustomRequestForm from "@/components/custom-request-form";
import TextStickerBuilder from "@/components/text-sticker-builder";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Name Stickers – Custom Name & Text Stickers Online",
  description:
    "Make your own name sticker: type your name or a short line, pick a fun font and colour, and we print it as a waterproof die-cut vinyl sticker. Any quantity, shipped across India.",
  path: "/name-stickers",
});

export default function NameStickersPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 pb-44 sm:px-8 sm:pb-24">
      {/* desktop: Back on the page (phones have it in the header) */}
      <div className="mb-3 hidden sm:block">
        <BackButton fallback="/custom-stickers" />
      </div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Name &amp; text stickers</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-fog">
        Your name or a short line in a fun sticker font — for bottles, bags, laptops and helmets. Waterproof
        die-cut vinyl.
      </p>
      <TextStickerBuilder />
      <CustomRequestForm />
    </div>
  );
}
