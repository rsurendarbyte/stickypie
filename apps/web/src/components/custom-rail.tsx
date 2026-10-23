"use client";

import { ArrowRight, ImageUp, QrCode, Sparkles, Type } from "lucide-react";
import { customSizes, formatINR } from "@stickypie/shared";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { cardSkinFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import HoverLink from "./hover-link";
import Row from "./row";

/**
 * Home rail right after New Drops: the ways to make your own sticker, as cards
 * the same size as the sticker cards around them, each with its starting price.
 */
export default function CustomRail() {
  const features = useFeatures();
  const settings = useStoreSettings();
  const seed = useSkinSeed();
  if (!features.customStickers) return null;

  const from = (prices: Record<string, number>) => {
    const sizes = customSizes(prices);
    return sizes.length ? Math.min(...sizes.map((s) => s.price)) : null;
  };
  const cards = [
    {
      href: "/custom-stickers/design",
      icon: ImageUp,
      title: "Your design",
      text: "Logo, photo or artwork",
      from: from(settings.customPrices),
      skin: "custom-design",
    },
    {
      href: "/qr-code-stickers",
      icon: QrCode,
      title: "QR code sticker",
      text: "UPI, WhatsApp, website",
      from: from(settings.qrPrices),
      skin: "qr-code-stickers",
    },
    {
      href: "/name-stickers",
      icon: Type,
      title: "Name & text",
      text: "Your name in fun fonts",
      from: from(settings.textPrices),
      skin: "name-stickers",
    },
  ].filter((c) => c.from !== null);
  if (!cards.length) return null;

  return (
    <Row title="Make your own" href="/custom-stickers">
      {cards.map(({ href, icon: Icon, title, text, from: price, skin }) => {
        const s = cardSkinFor(skin, seed);
        return (
          <HoverLink
            key={href}
            href={href}
            style={{ backgroundColor: s.card }}
            className="group relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-line transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] sm:w-48 md:w-52"
          >
            {/* art: a blank die-cut sticker with the option's icon, slightly tilted */}
            <div className="relative grid aspect-square place-items-center overflow-hidden" style={s.art}>
              <span className="grid size-[58%] -rotate-6 place-items-center rounded-[28%] border-[5px] border-white bg-white/70 shadow-[0_14px_28px_-14px_rgba(16,24,40,0.45)] transition-transform duration-300 group-hover:rotate-0">
                <span className="pie-gradient grid size-[62%] place-items-center rounded-[26%] text-white shadow-md shadow-brand/30">
                  <Icon className="size-[48%]" />
                </span>
              </span>
              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand uppercase shadow-sm">
                <Sparkles className="size-3" /> Custom
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-fog">{text}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-xs text-fog">
                  from <span className="font-display text-base font-bold text-snow">{formatINR(price!)}</span>
                </span>
                <span className="peel-btn grid size-9 place-items-center rounded-xl">
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </div>
          </HoverLink>
        );
      })}
    </Row>
  );
}
