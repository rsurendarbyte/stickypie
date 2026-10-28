"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag } from "lucide-react";
import {
  CUSTOM_PRODUCT_PREFIX,
  TEXT_STICKER_NAME,
  customSizes,
  formatINR,
  formatInches,
} from "@stickypie/shared";
import { STICKER_FONTS } from "@/lib/sticker-fonts";
import { drawTextSticker, loadStickerFont, type TextSticker, type TextStickerStyle } from "@/lib/text-art";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { cardSkinFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import { useCart } from "./cart-context";
import CustomBookBar from "./custom-book-bar";
import PriceWait from "./price-wait";

const COLORS = [
  { name: "Pink", hex: "#e8336d" },
  { name: "Orange", hex: "#f97316" },
  { name: "Yellow", hex: "#facc15" },
  { name: "Green", hex: "#16a34a" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Black", hex: "#111318" },
  { name: "White", hex: "#ffffff" },
];
const STYLES: { id: TextStickerStyle; label: string }[] = [
  { id: "cut", label: "Cut-out" },
  { id: "label", label: "Label" },
];
const MAX_LINE1 = 18;
const MAX_LINE2 = 30;


export default function TextStickerBuilder() {
  const settings = useStoreSettings();
  // prices come from the admin's settings: placeholders until they've loaded
  const pricesReady = settings.loaded;
  const features = useFeatures();
  const sizes = customSizes(settings.textPrices);
  const { add, openCart } = useCart();
  const skin = cardSkinFor("name-stickers", useSkinSeed());

  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [fontId, setFontId] = useState(STICKER_FONTS[0].id);
  const [color, setColor] = useState(COLORS[0].hex);
  const [color2, setColor2] = useState<string | null>(null);
  const [painting, setPainting] = useState<"main" | "small">("main");
  const [style, setStyle] = useState<TextStickerStyle>("cut");
  const [size, setSize] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const chosen = sizes.find((s) => s.inches === size) ?? sizes[0];
  const font = STICKER_FONTS.find((f) => f.id === fontId) ?? STICKER_FONTS[0];
  const ready = line1.trim().length > 0;
  const hasSmall = line2.trim().length > 0;
  const target = hasSmall ? painting : "main";
  const sticker: TextSticker = { line1, line2, family: font.family, weight: font.weight, color, color2, style };
  // A white label would hide its white letters.
  const swatches = target === "main" && style === "label" ? COLORS.filter((c) => c.name !== "White") : COLORS;
  const current = target === "main" ? color : (color2 ?? (style === "label" ? "#ffffff" : "#111318"));

  // Live preview (small render) once the font is in.
  useEffect(() => {
    if (!ready) {
      setPreview(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(async () => {
      await loadStickerFont(font.family, font.weight);
      if (live) setPreview(drawTextSticker(sticker, 640).toDataURL("image/png"));
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, line1, line2, fontId, color, color2, style]);

  if (settings.loaded && (!features.customStickers || sizes.length === 0)) {
    return (
      <p className="mt-8 rounded-2xl border border-line bg-ink2 px-5 py-6 text-fog">
        Name stickers aren&apos;t available right now. Please check back soon.
      </p>
    );
  }

  function pickStyle(next: TextStickerStyle) {
    setStyle(next);
    if (next === "label" && color === "#ffffff") setColor(COLORS[0].hex);
  }

  function paint(hex: string) {
    if (target === "main") setColor(hex);
    else setColor2(hex);
  }

  async function addToCart(thenCheckout: boolean) {
    if (!chosen || busy) return;
    if (!ready) {
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      nameRef.current?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    await loadStickerFont(font.family, font.weight);
    const ref = crypto.randomUUID();
    // No image is stored or uploaded: the order keeps the text, font, colours
    // and style, and the admin draws the print file from that.
    const thumb = drawTextSticker(sticker, 240).toDataURL("image/png");
    const added = add(
      {
        productId: `${CUSTOM_PRODUCT_PREFIX}${ref}`,
        size: chosen.inches,
        sizeLabel: `${formatInches(chosen.inches)}″ name sticker`,
        slug: "name-stickers",
        name: `${TEXT_STICKER_NAME} · ${line1.trim()}`,
        price: chosen.price,
        imageUrl: thumb,
        thumbUrl: thumb,
        stock: null,
        custom: true,
        customRef: ref,
        customKind: "text",
        customSpec: { kind: "text", line1: line1.trim(), line2: line2.trim(), font: font.id, color, color2, style },
      },
      qty
    );
    setBusy(false);
    if (!added) return;
    setQty(1);
    if (thenCheckout) window.location.assign("/checkout");
    else openCart();
  }

  const field =
    "h-10 w-full rounded-xl border border-line bg-ink px-3.5 text-sm outline-none transition-colors placeholder:text-fog/60 focus:border-brand/60";
  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
      on ? "border-brand bg-brand/[0.06] text-brand" : "border-line text-fog hover:text-snow"
    }`;
  const segment = (on: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
      on ? "bg-white text-snow shadow-sm" : "text-fog hover:text-snow"
    }`;
  const heading = "text-xs font-semibold tracking-wide text-fog uppercase";

  return (
    <div className="mt-5 grid max-w-3xl gap-4 rounded-3xl border border-line bg-ink2 p-4 shadow-[0_20px_50px_-30px_rgba(16,24,40,0.35)] sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-5 sm:p-5">
      {/* Live preview — the image always fits inside the box */}
      <div
        style={skin.art}
        className="relative h-[150px] self-start overflow-hidden rounded-2xl sm:sticky sm:top-24 sm:h-[220px]"
      >
        {preview ? (
          <img
            src={preview}
            alt="Your name sticker"
            className="sticker-cut absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] -rotate-2 object-contain"
          />
        ) : (
          <div className="absolute inset-4 grid place-items-center rounded-[18px] border-[3px] border-dashed border-brand/50 bg-white/85">
            <span className={`text-2xl text-snow/40 ${font.className}`}>Your name</span>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1.15fr_1fr]">
          <input
            ref={nameRef}
            className={field}
            value={line1}
            maxLength={MAX_LINE1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="Your name or text"
            aria-label="Main text"
          />
          <input
            className={field}
            value={line2}
            maxLength={MAX_LINE2}
            onChange={(e) => {
              setLine2(e.target.value);
              if (!e.target.value.trim()) setPainting("main");
            }}
            placeholder="Small line (optional)"
            aria-label="Small line under it"
          />
        </div>

        <div>
          <p className={heading}>Font</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {STICKER_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFontId(f.id)}
                className={`rounded-full border px-3 py-1 text-[15px] leading-6 transition-colors ${
                  f.id === fontId ? "border-brand bg-brand/[0.06] text-brand" : "border-line bg-ink text-snow hover:border-snow/30"
                } ${f.className}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={heading}>Colour &amp; style</p>
            <div className="inline-flex rounded-full bg-panel p-0.5">
              {STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => pickStyle(s.id)} className={segment(style === s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {hasSmall && (
            <div className="mt-1.5 inline-flex rounded-full bg-panel p-0.5">
              <button type="button" onClick={() => setPainting("main")} className={segment(target === "main")}>
                {style === "label" ? "Label" : "Name"}
              </button>
              <button type="button" onClick={() => setPainting("small")} className={segment(target === "small")}>
                Small line
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {swatches.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                title={c.name}
                onClick={() => paint(c.hex)}
                className={`size-6 rounded-full border-2 sm:size-7 border-white shadow-[0_0_0_1px_rgba(16,24,40,0.18)] transition-transform ${
                  current === c.hex ? "scale-110 ring-2 ring-brand ring-offset-1" : "hover:scale-105"
                }`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className={heading}>
            Size <span className="font-normal normal-case tracking-normal">· longest side</span>
          </p>
          <div role="radiogroup" aria-label="Sticker size" className="mt-1.5 flex flex-wrap gap-1.5">
            {sizes.map((s) => {
              const active = s.inches === chosen?.inches;
              return (
                <button
                  key={s.inches}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSize(s.inches)}
                  className={`rounded-xl border px-3 py-1 text-sm transition-all ${
                    active ? "border-brand bg-brand/[0.06] ring-1 ring-brand" : "border-line bg-ink hover:border-snow/30"
                  }`}
                >
                  <span className="font-display font-bold">{formatInches(s.inches)}″</span>{" "}
                  <span className={`font-bold ${active ? "text-brand" : "text-fog"}`}>{pricesReady ? formatINR(s.price) : <PriceWait />}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="sticker-pill inline-flex items-center gap-1 rounded-full p-1">
            <button
              type="button"
              aria-label="Fewer"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid size-8 place-items-center rounded-full bg-white/70"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center font-bold tabular-nums">{qty}</span>
            <button
              type="button"
              aria-label="More"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="grid size-8 place-items-center rounded-full bg-white/70"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {[5, 10, 25, 50].map((n) => (
            <button key={n} type="button" onClick={() => setQty(n)} className={chip(qty === n)}>
              {n}
            </button>
          ))}
        </div>

        {chosen && (
          <div className="hidden flex-wrap items-center gap-2 rounded-2xl bg-ink p-2.5 sm:flex">
            <span className="mr-auto pl-1">
              <span className="block text-[11px] text-fog">
                {qty} × {formatInches(chosen.inches)}″
              </span>
              <span className="font-display text-xl font-bold">{pricesReady ? formatINR(chosen.price * qty) : <PriceWait />}</span>
            </span>
            <button
              type="button"
              disabled={busy || !pricesReady}
              onClick={() => addToCart(false)}
              aria-label="Add to cart"
              className="peel-btn peel-btn--light flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold disabled:opacity-50"
            >
              <ShoppingBag className="size-4" /> Add
            </button>
            <button
              type="button"
              disabled={busy || !pricesReady}
              onClick={() => addToCart(true)}
              className="peel-btn peel-btn--brand flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
            >
              Book now <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </div>
      {chosen && (
        <CustomBookBar
          total={pricesReady ? chosen.price * qty : null}
          summary={`${qty} × ${formatInches(chosen.inches)}″ name sticker`}
          hint={ready ? null : "Type your name to start"}
          busy={busy}
          onAdd={() => addToCart(false)}
          onBook={() => addToCart(true)}
        />
      )}
    </div>
  );
}
