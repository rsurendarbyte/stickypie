"use client";

import {
  ArrowRight,
  Camera,
  ImageUp,
  QrCode,
  Smile,
  Sparkles,
  Type,
} from "lucide-react";
import {
  avatarBook,
  avatarSheetsPrice,
  customSizes,
  formatINR,
} from "@stickypie/shared";
import { useEffect, useState } from "react";
import PriceWait from "./price-wait";
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
  // The "Stickers of YOU" card cycles through every style's sticker: one face, many looks.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = window.setInterval(() => setShown((n) => n + 1), 2200);
    return () => window.clearInterval(t);
  }, []);
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
  ].filter(
    (c) =>
      c.from !== null &&
      (c.href === "/avatar-stickers" || features.customStickers),
  );
  const styleCards = book
    ? settings.avatarStyles.flatMap((st) =>
        st.covers.slice(0, 2).map((src) => ({ label: st.label, src })),
      )
    : [];
  if (!cards.length && !styleCards.length) return null;

  return (
    <Row title="Make your own" href="/custom-stickers">
      {styleCards.length > 0 && (
        <LeadCard
          stickers={styleCards.map((c) => c.src)}
          shown={shown}
          price={settings.loaded ? formatINR(book!.price) : <PriceWait />}
        />
      )}
      {styleCards.map(({ label, src }, i) => (
        <PageLink
          key={src}
          href={`/avatar-stickers?style=${encodeURIComponent(label)}`}
          aria-label={`${label} AI avatar stickers of you`}
          className="rail-card-drawn group relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-ink2 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] sm:w-48 md:w-52"
        >
          {/* art: the style's sample avatar, shown one of three ways (picked at random per visit) */}
          <StickerArt
            design={STYLE_DESIGNS[(seed + i * 7) % STYLE_DESIGNS.length]}
            pictures={
              <img
                src={src}
                alt={`${label} style avatar sticker sample`}
                loading="lazy"
                className="col-start-1 row-start-1 h-full min-h-0 w-full object-contain drop-shadow-[0_8px_12px_rgba(16,24,40,0.25)]"
              />
            }
          />
          <div className="p-3">
            {/* the AI tag sits here, not on the picture, so it never covers the sticker */}
            <div className="flex items-center justify-between gap-1.5">
              <p className="min-w-0 truncate text-sm font-semibold">{label}</p>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand uppercase">
                <Sparkles className="size-3" /> AI
              </span>
            </div>
            <p className="flex items-center gap-1 truncate text-xs text-fog">
              <Camera className="size-3 shrink-0" /> Your photo → {label}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-fog">
                <span className="font-display text-base font-bold text-snow">
                  {settings.loaded ? formatINR(book!.price) : <PriceWait />}
                </span>{" "}
                a pack
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
            <div
              className="relative grid aspect-square place-items-center overflow-hidden"
              style={s.art}
            >
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
                  from{" "}
                  <span className="font-display text-base font-bold text-snow">
                    {settings.loaded ? formatINR(price!) : <PriceWait />}
                  </span>
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

/** The style cards' picture, one of three ways (C, D, E from the design round), at random per visit. */
export const STYLE_DESIGNS = ["upload", "ad", "me"] as const;
export type ArtDesign = "frame" | (typeof STYLE_DESIGNS)[number];

/** A card's picture area: the soft dotted background and the sticker shown one way. */
export function StickerArt({
  design,
  pictures,
  label = false,
}: {
  design: ArtDesign;
  pictures: React.ReactNode;
  label?: boolean;
}) {
  const corner = "absolute size-5 border-brand";
  return (
    <div className="relative flex aspect-square flex-col items-center overflow-hidden bg-gradient-to-br from-brand-soft via-[#fff8ec] to-[#eef6ff] px-[9%] pt-[6%] pb-[7%]">
      <span
        aria-hidden
        className="absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(16,24,40,0.10)_1px,transparent_1px)] [background-size:14px_14px]"
      />
      {label && (
        // selfie → sticker
        <span className="relative z-10 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-snow shadow-sm">
          <Camera className="size-3.5 text-brand" /> Selfie
          <ArrowRight className="size-3 text-fog" />
          <Sparkles className="size-3.5 text-brand" /> Sticker
        </span>
      )}
      {design === "frame" && (
        // camera viewfinder: four even corners, the sticker centred inside
        <span className="relative mt-[5%] grid min-h-0 w-[88%] flex-1 place-items-center p-[3%]">
          <span
            aria-hidden
            className={`${corner} top-0 left-0 rounded-tl-lg border-t-[3px] border-l-[3px]`}
          />
          <span
            aria-hidden
            className={`${corner} top-0 right-0 rounded-tr-lg border-t-[3px] border-r-[3px]`}
          />
          <span
            aria-hidden
            className={`${corner} bottom-0 left-0 rounded-bl-lg border-b-[3px] border-l-[3px]`}
          />
          <span
            aria-hidden
            className={`${corner} right-0 bottom-0 rounded-br-lg border-r-[3px] border-b-[3px]`}
          />
          <span className="grid size-full min-h-0 place-items-center [&>img]:max-h-full [&>img]:min-h-0">
            {pictures}
          </span>
        </span>
      )}
      {design === "upload" && (
        // looks like the real first step: add your selfie (a sticker of you pops out)
        <span className="relative mt-[7%] min-h-0 w-full flex-1">
          <span className="absolute inset-x-[2%] top-[8%] bottom-[2%] flex items-end rounded-2xl border-2 border-dashed border-brand/60 bg-white/80 p-2 text-brand">
            {/* one line: camera + "Add your selfie", under the sticker */}
            <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-2.5 pl-0.5 text-[11px] font-bold whitespace-nowrap shadow-sm">
              <span className="grid size-6 place-items-center rounded-full bg-brand text-white">
                <Camera className="size-3.5" />
              </span>
              Add your selfie
            </span>
          </span>
          <span className="absolute -top-[8%] right-[2%] grid h-[78%] rotate-[8deg] place-items-center">
            {pictures}
          </span>
        </span>
      )}
      {design === "ad" && (
        // an ad: big words, big sticker
        <span className="relative mt-[5%] min-h-0 w-full flex-1">
          <span className="absolute top-0 left-0 z-10 font-display text-[15px] leading-[1] font-bold text-snow sm:text-[17px]">
            YOUR
            <br />
            FACE
            <br />
            <span className="text-brand">AS</span>
            <br />
            <span className="text-brand">STICKERS</span>
          </span>
          <span className="absolute right-[-4%] bottom-[-3%] grid w-[58%] -rotate-[4deg] place-items-center">
            {pictures}
          </span>
        </span>
      )}
      {design === "me" && (
        // a big sticker saying "That's ME!"
        <span className="relative mt-[4%] grid min-h-0 w-full flex-1 place-items-end justify-end">
          <span className="grid h-[86%] min-h-0 w-[80%] place-items-center">
            {pictures}
          </span>
          <span className="absolute top-[2%] left-0 z-10 rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 font-display text-[13px] leading-none font-bold text-snow shadow-md">
            That&apos;s <span className="text-brand">ME!</span> 😍
          </span>
        </span>
      )}
    </div>
  );
}

/** The "Stickers of YOU" card that leads the row: the viewfinder (design A), cycling every style's sticker. */
function LeadCard({
  stickers,
  shown,
  price,
}: {
  stickers: string[];
  shown: number;
  price: React.ReactNode;
}) {
  // The current sticker, and the next one loading unseen so each switch is instant.
  const pictures = [0, 1].map((ahead) => {
    const n = (shown + ahead) % stickers.length;
    return (
      <img
        key={n}
        src={stickers[n]}
        alt=""
        className={`col-start-1 row-start-1 h-full min-h-0 w-full object-contain drop-shadow-[0_8px_12px_rgba(16,24,40,0.25)] ${
          ahead ? "opacity-0" : "animate-hero-img-in"
        }`}
      />
    );
  });
  return (
    <PageLink
      href="/avatar-stickers"
      aria-label="Turn your photo into AI stickers"
      className="rail-card-drawn group relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-brand/40 bg-ink2 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] sm:w-48 md:w-52"
    >
      <StickerArt design="frame" pictures={pictures} label />
      <div className="p-3">
        <p className="truncate text-sm font-semibold">Stickers of YOU</p>
        <p className="truncate text-xs text-fog">Selfie in, stickers out</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-xs text-fog">
            <span className="font-display text-base font-bold text-snow">
              {price}
            </span>{" "}
            a pack
          </span>
          <span className="peel-btn grid size-9 place-items-center rounded-xl">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </PageLink>
  );
}
