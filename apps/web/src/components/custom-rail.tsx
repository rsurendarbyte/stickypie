"use client";

import { ArrowRight, ImageUp, QrCode, Smile, Sparkles, Type } from "lucide-react";
import { avatarBook, avatarSheetsPrice, customSizes, formatINR } from "@stickypie/shared";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { cardSkinFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import PageLink from "./page-link";
import Row from "./row";

/**
 * First home rail: the ways to make your own sticker, as cards
 * the same size as the sticker cards around them, each with its starting price.
 * The AI avatar styles lead the row: one card per sample avatar (a style's girl
 * and boy each get their own card), opening the maker with that style picked.
 */
export default function CustomRail() {
  const features = useFeatures();
  const settings = useStoreSettings();
  const seed = useSkinSeed();
  if (!features.customStickers && !features.avatarStickers) return null;

  const from = (prices: Record<string, number>) => {
    const sizes = customSizes(prices);
    return sizes.length ? Math.min(...sizes.map((s) => s.price)) : null;
  };
  const book = features.avatarStickers ? avatarBook(settings) : null;
  const cards = [
    {
      href: "/avatar-stickers",
      icon: Smile,
      title: "Avatar stickers",
      text: "Sticker packs of you, from a photo",
      from: book ? avatarSheetsPrice(book, 0) : null,
      skin: "avatar-stickers",
    },
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
  ].filter((c) => c.from !== null && (c.href === "/avatar-stickers" || features.customStickers));
  const styleCards = book
    ? settings.avatarStyles.flatMap((st) => st.covers.slice(0, 2).map((src) => ({ label: st.label, src })))
    : [];
  if (!cards.length && !styleCards.length) return null;

  return (
    <Row title="Make your own" href="/custom-stickers">
      {styleCards.map(({ label, src }) => (
        <PageLink
          key={src}
          href={`/avatar-stickers?style=${encodeURIComponent(label)}`}
          aria-label={`${label} AI avatar stickers of you`}
          className="rail-card-drawn group relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-ink2 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] sm:w-48 md:w-52"
        >
          {/* art: one sample avatar of the style as a die-cut sticker */}
          <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#fff1f5] via-[#fff8ec] to-[#eef6ff]">
            <span
              aria-hidden
              className="absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(16,24,40,0.10)_1px,transparent_1px)] [background-size:14px_14px]"
            />
            <img
              src={src}
              alt={`${label} style avatar sticker sample`}
              loading="lazy"
              className="absolute inset-[8%] size-[84%] object-contain drop-shadow-[0_10px_14px_rgba(16,24,40,0.22)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2"
            />
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand uppercase shadow-sm">
              <Sparkles className="size-3" /> AI avatar
            </span>
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-semibold">{label}</p>
            <p className="truncate text-xs text-fog">AI stickers of you</p>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-fog">
                <span className="font-display text-base font-bold text-snow">{formatINR(book!.price)}</span> a pack
              </span>
              <span className="peel-btn grid size-9 place-items-center rounded-xl">
                <ArrowRight className="size-4" />
              </span>
            </div>
          </div>
        </PageLink>
      ))}
      {cards.map(({ href, icon: Icon, title, text, from: price, skin }) => {
        const s = cardSkinFor(skin, seed);
        return (
          <PageLink
            key={href}
            href={href}
            style={{ backgroundColor: s.card }}
            className="rail-card-drawn group relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-line transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] sm:w-48 md:w-52"
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
          </PageLink>
        );
      })}
    </Row>
  );
}
