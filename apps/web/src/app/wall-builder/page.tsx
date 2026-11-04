import type { Metadata } from "next";
import BackButton from "@/components/back-button";
import WallBuilder, { type WallPoster } from "@/components/wall-builder";
import { getDriver } from "@/lib/data";
import { isMiniPoster, isPosterPack } from "@/lib/poster";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Build Your Own Poster Wall – Pick Any Posters",
  description:
    "Choose a wall layout and pick every poster yourself. 4 × 6 and 6 × 9 in posters on 300 GSM poster paper, glue dots or double-sided tape included. Ships across India.",
  path: "/wall-builder",
});

export default async function WallBuilderPage() {
  const products = await getDriver().listProducts({ activeOnly: true });
  const posters: WallPoster[] = products
    .filter((p) => isMiniPoster(p) && !isPosterPack(p) && p.stock !== 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.thumbUrl ?? p.imageUrl,
      prices: Object.fromEntries(p.sizes.map((s) => [s.inches, s.price])),
    }));

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 pt-20 pb-32 sm:px-8 sm:pt-24 sm:pb-24">
      {/* desktop: Back on the page (phones have it in the header) */}
      <div className="mb-3 hidden sm:block">
        <BackButton fallback="/stickers/mini-posters" />
      </div>
      <h1 className="font-display text-2xl font-bold sm:text-4xl">Build your wall</h1>
      <p className="mt-1 text-sm leading-relaxed text-fog">Pick a layout, then choose every poster yourself.</p>
      <WallBuilder posters={posters} />
    </div>
  );
}
