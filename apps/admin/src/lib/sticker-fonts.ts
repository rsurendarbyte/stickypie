// The same Google fonts the storefront's name sticker maker offers, so the
// admin draws exactly what the shopper designed. Ids match TEXT_STICKER_FONTS.
import { Bungee, Fredoka, Lobster, Luckiest_Guy, Pacifico, Permanent_Marker } from "next/font/google";
import type { TextStickerFontId } from "@stickypie/shared";

const fredoka = Fredoka({ subsets: ["latin"], weight: "700", display: "swap" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", display: "swap" });
const bungee = Bungee({ subsets: ["latin"], weight: "400", display: "swap" });
const luckiest = Luckiest_Guy({ subsets: ["latin"], weight: "400", display: "swap" });
const lobster = Lobster({ subsets: ["latin"], weight: "400", display: "swap" });

export const STICKER_FONT_FAMILY: Record<TextStickerFontId, string> = {
  bubbly: fredoka.style.fontFamily,
  comic: luckiest.style.fontFamily,
  script: pacifico.style.fontFamily,
  retro: lobster.style.fontFamily,
  marker: marker.style.fontFamily,
  block: bungee.style.fontFamily,
};
