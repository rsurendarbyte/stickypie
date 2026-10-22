// Fonts offered on the name sticker maker. Loaded only where this module is
// imported (the name sticker page), not site-wide.
import {
  Bungee,
  Fredoka,
  Lobster,
  Luckiest_Guy,
  Pacifico,
  Permanent_Marker,
} from "next/font/google";

const fredoka = Fredoka({ subsets: ["latin"], weight: "700", display: "swap" });
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const marker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const bungee = Bungee({ subsets: ["latin"], weight: "400", display: "swap" });
const luckiest = Luckiest_Guy({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const lobster = Lobster({ subsets: ["latin"], weight: "400", display: "swap" });

export type StickerFont = {
  id: string;
  label: string;
  family: string;
  weight: number;
  className: string;
};

export const STICKER_FONTS: StickerFont[] = [
  {
    id: "bubbly",
    label: "Bubbly",
    family: fredoka.style.fontFamily,
    weight: 700,
    className: fredoka.className,
  },
  {
    id: "comic",
    label: "Comic",
    family: luckiest.style.fontFamily,
    weight: 400,
    className: luckiest.className,
  },
  {
    id: "script",
    label: "Script",
    family: pacifico.style.fontFamily,
    weight: 400,
    className: pacifico.className,
  },
  {
    id: "retro",
    label: "Retro",
    family: lobster.style.fontFamily,
    weight: 400,
    className: lobster.className,
  },
  {
    id: "marker",
    label: "Marker",
    family: marker.style.fontFamily,
    weight: 400,
    className: marker.className,
  },
  {
    id: "block",
    label: "Block",
    family: bungee.style.fontFamily,
    weight: 400,
    className: bungee.className,
  },
];
