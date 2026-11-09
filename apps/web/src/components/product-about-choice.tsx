"use client";

import { type ComponentProps } from "react";
import { ProductAbout } from "@/components/seo-blocks";
import { useFinish } from "@/lib/poster-finish";

type About = ComponentProps<typeof ProductAbout>;

/** A mini poster's details follow the shopper's choice (older sticker orders keep their own text). */
export default function ProductAboutChoice({ poster, sticker }: { poster: About; sticker: About }) {
  return <ProductAbout {...(useFinish() === "sticker" ? sticker : poster)} />;
}
