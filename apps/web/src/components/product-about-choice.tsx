"use client";

import { type ComponentProps } from "react";
import { ProductAbout } from "@/components/seo-blocks";
import { useFinish } from "@/lib/poster-finish";

type About = ComponentProps<typeof ProductAbout>;

/** A mini poster's details follow the shopper's choice: wall poster or sticker. */
export default function ProductAboutChoice({ poster, sticker }: { poster: About; sticker: About }) {
  return <ProductAbout {...(useFinish() === "sticker" ? sticker : poster)} />;
}
