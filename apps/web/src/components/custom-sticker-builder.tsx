"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard, ImageUp, Minus, Plus, Ruler, ShoppingBag, Truck, X } from "lucide-react";
import {
  CUSTOM_PRODUCT_PREFIX,
  CUSTOM_STICKER_MAX_BYTES,
  CUSTOM_STICKER_NAME,
  CUSTOM_STICKER_TYPES,
  customArtKey,
  customSizes,
  formatINR,
  formatInches,
} from "@stickypie/shared";
import { idbSet } from "@/lib/idb";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { cardSkinFor } from "@/lib/palette";
import { shrinkImage } from "@/lib/shrink-image";
import { useSkinSeed } from "@/lib/skin-seed";
import { useCart } from "./cart-context";
import CustomBookBar from "./custom-book-bar";
import CustomRequestForm from "./custom-request-form";

/** Shown in the cart until the shopper sends their artwork (after paying). */
export const CUSTOM_STICKER_ICON = "/icons/custom-sticker.svg";

const QUICK_QTY = [5, 10, 25, 50];

const STEPS = [
  { icon: ImageUp, title: "Add your design", text: "Kept on your device until you pay" },
  { icon: Ruler, title: "Pick size & quantity", text: "Any size we offer, any number" },
  { icon: CreditCard, title: "Pay securely", text: "With the rest of your cart" },
  { icon: Truck, title: "We print & ship", text: "Across India" },
];

/** Print sharpness from pixels on the longest side vs. the printed size. */
function quality(px: number, inches: number): { label: string; tone: string } {
  const ppi = px / inches;
  if (ppi >= 250) return { label: "Great quality for this size", tone: "text-mint" };
  if (ppi >= 150) return { label: "Good quality for this size", tone: "text-mint" };
  return { label: `Low resolution for ${formatInches(inches)}″ — may print blurry`, tone: "text-gold" };
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-snow">
      <span className="pie-gradient grid size-6 place-items-center rounded-full text-xs font-bold text-white">{n}</span>
      {label}
    </p>
  );
}

/** Book custom stickers: optional design (kept in the browser until paid), size, quantity, total. */
export default function CustomStickerBuilder() {
  const settings = useStoreSettings();
  const features = useFeatures();
  const sizes = customSizes(settings.customPrices);
  const { add, openCart } = useCart();
  const router = useRouter();
  const skin = cardSkinFor("custom-stickers", useSkinSeed());

  const [size, setSize] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const chosen = sizes.find((s) => s.inches === size) ?? sizes[0];
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pixels, setPixels] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  if (settings.loaded && (!features.customStickers || sizes.length === 0)) {
    return (
      <>
        <p className="mt-8 rounded-2xl border border-line bg-ink2 px-5 py-6 text-fog">
          Custom stickers aren&apos;t available to order online right now — tell us what you need below.
        </p>
        <CustomRequestForm />
      </>
    );
  }

  function pick(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!(CUSTOM_STICKER_TYPES as readonly string[]).includes(next.type)) {
      setError("Please choose a PNG, JPG or WebP image.");
      return;
    }
    if (next.size > CUSTOM_STICKER_MAX_BYTES) {
      setError("That file is over 5 MB — please choose a smaller one.");
      return;
    }
    const url = URL.createObjectURL(next);
    const img = new Image();
    img.onload = () => setPixels(Math.max(img.naturalWidth, img.naturalHeight));
    img.src = url;
    setFile(next);
    setPreview(url);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setPixels(null);
  }

  async function addToCart(thenCheckout: boolean) {
    if (!chosen || busy) return;
    // The design is required; it stays on this device until the order is paid.
    if (!file) {
      setError("Add your design first — tap the box to choose your image.");
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    const ref = crypto.randomUUID();
    let thumb = CUSTOM_STICKER_ICON;
    if (file) {
      // Kept in this browser only; sent to us once the order is paid.
      await idbSet(customArtKey(ref), file);
      thumb = (await shrinkImage(file, 240, 40_000).then(toDataUrl).catch(() => null)) ?? CUSTOM_STICKER_ICON;
    }
    const added = add(
      {
        productId: `${CUSTOM_PRODUCT_PREFIX}${ref}`,
        size: chosen.inches,
        sizeLabel: `${formatInches(chosen.inches)}″ custom`,
        slug: "custom-stickers",
        name: CUSTOM_STICKER_NAME,
        price: chosen.price,
        imageUrl: thumb,
        thumbUrl: thumb,
        stock: null,
        custom: true,
        customRef: ref,
      },
      qty
    );
    setBusy(false);
    if (!added) return; // cart has regular stickers — the shopper decides in the prompt
    setQty(1);
    clearFile();
    if (thenCheckout) router.push("/checkout");
    else openCart();
  }

  const fit = pixels && chosen ? quality(pixels, chosen.inches) : null;
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={CUSTOM_STICKER_TYPES.join(",")}
      className="sr-only"
      onChange={(e) => {
        pick(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-ink2 shadow-[0_20px_50px_-30px_rgba(16,24,40,0.35)] lg:grid lg:grid-cols-[1.05fr_1fr]">
        {/* Design: preview on a sticker mat */}
        <div
          style={skin.art}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className="relative grid min-h-[300px] place-items-center p-8 sm:min-h-[380px]"
        >
          {fileInput}
          {preview ? (
            <>
              <img
                src={preview}
                alt="Your design"
                className="sticker-cut max-h-[300px] max-w-[85%] rotate-[-2deg] object-contain"
              />
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove design"
                className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/90 text-snow shadow"
              >
                <X className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="peel-btn peel-btn--light absolute bottom-4 left-4 rounded-xl px-3 py-1.5 text-xs font-bold"
              >
                Change design
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`grid aspect-square w-full max-w-[260px] place-items-center rounded-[28px] border-[3px] border-dashed bg-white/85 p-6 text-center shadow-lg backdrop-blur-sm transition-all ${
                dragging ? "scale-[1.03] border-brand" : "border-brand/50 hover:border-brand"
              }`}
            >
              <span>
                <ImageUp className="mx-auto size-11 text-brand" />
                <span className="mt-2 block font-display text-xl font-bold text-snow">Add your design</span>
                <span className="mt-1 block text-xs text-fog">Tap or drop · PNG, JPG, WebP · max 5 MB</span>
                <span className="mt-2 block text-[11px] text-fog">Sent to us only after you pay</span>
              </span>
            </button>
          )}
        </div>

        {/* Choices + total */}
        <div className="p-5 sm:p-7">
          {file && (
            <p className="mb-4 text-xs text-fog">
              <span className="block truncate">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB{pixels ? ` · ${pixels}px` : ""}
              </span>
              {fit && <span className={`font-semibold ${fit.tone}`}>{fit.label}</span>}
            </p>
          )}
          {error && <p className="mb-4 text-sm font-semibold text-brand">{error}</p>}

          <Step n={1} label="Size" />
          <div role="radiogroup" aria-label="Sticker size" className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
            {sizes.map((s) => {
              const active = s.inches === chosen?.inches;
              return (
                <button
                  key={s.inches}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSize(s.inches)}
                  className={`rounded-2xl border px-2 py-3 text-center transition-all ${
                    active ? "border-brand bg-brand/[0.06] ring-1 ring-brand" : "border-line bg-ink hover:border-snow/30"
                  }`}
                >
                  <span className="block font-display text-xl font-bold">{formatInches(s.inches)}″</span>
                  <span className={`block text-sm font-bold ${active ? "text-brand" : "text-snow"}`}>{formatINR(s.price)}</span>
                  <span className="block text-[11px] text-fog">each</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-fog">Longest side. The other side follows your design&apos;s shape.</p>

          <div className="mt-6">
            <Step n={2} label="Quantity" />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="sticker-pill inline-flex items-center gap-1 rounded-full p-1">
              <button
                type="button"
                aria-label="Fewer"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid size-9 place-items-center rounded-full bg-white/70"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center font-bold tabular-nums">{qty}</span>
              <button
                type="button"
                aria-label="More"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="grid size-9 place-items-center rounded-full bg-white/70"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {QUICK_QTY.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQty(n)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  qty === n ? "border-brand bg-brand/[0.06] text-brand" : "border-line text-fog hover:text-snow"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {chosen && (
            <div className="mt-6 rounded-2xl bg-ink p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-fog">
                  {qty} × {formatInches(chosen.inches)}″ custom sticker
                </span>
                <span className="font-display text-2xl font-bold">{formatINR(chosen.price * qty)}</span>
              </div>
              <div className="mt-3 hidden gap-2 sm:grid sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addToCart(false)}
                  className="peel-btn peel-btn--light flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
                >
                  <ShoppingBag className="size-4.5" /> Add to cart
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addToCart(true)}
                  className="peel-btn peel-btn--brand flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
                >
                  Book now <ArrowRight className="size-4.5" />
                </button>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-fog">
                Shipping and GST are added at checkout. Your design stays on this device and uploads right after
                payment — we check every file and call you if it needs a fix. You can add regular stickers to the
                same order.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 rounded-2xl border border-line bg-ink2/80 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-snow">{title}</span>
              <span className="block text-xs text-fog">{text}</span>
            </span>
          </li>
        ))}
      </ol>

      <CustomRequestForm />

      {chosen && (
        <CustomBookBar
          total={chosen.price * qty}
          summary={`${qty} × ${formatInches(chosen.inches)}″ custom sticker`}
          hint={file ? null : "Add your design to start"}
          busy={busy}
          onAdd={() => addToCart(false)}
          onBook={() => addToCart(true)}
        />
      )}
    </>
  );
}
