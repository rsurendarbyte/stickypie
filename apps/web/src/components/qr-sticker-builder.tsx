"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, Link2, Minus, MessageCircle, Plus, ShoppingBag, Type, Wallet } from "lucide-react";
import { CUSTOM_PRODUCT_PREFIX, QR_STICKER_NAME, customSizes, formatINR, formatInches } from "@stickypie/shared";
import { drawSticker } from "@/lib/qr-art";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { cardSkinFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import { useCart } from "./cart-context";
import CustomBookBar from "./custom-book-bar";

type Kind = "link" | "upi" | "whatsapp" | "instagram" | "text";

const KINDS: { kind: Kind; label: string; icon: typeof Link2; defaultLabel: string }[] = [
  { kind: "upi", label: "UPI payment", icon: Wallet, defaultLabel: "Scan to pay" },
  { kind: "link", label: "Website link", icon: Link2, defaultLabel: "Scan me" },
  { kind: "whatsapp", label: "WhatsApp", icon: MessageCircle, defaultLabel: "Chat on WhatsApp" },
  { kind: "instagram", label: "Instagram", icon: AtSign, defaultLabel: "Follow us" },
  { kind: "text", label: "Text", icon: Type, defaultLabel: "Scan me" },
];
const LABELS = ["Scan to pay", "Scan me", "Follow us", "Chat on WhatsApp", "Visit our website", "Wi-Fi inside"];
const MAX_LABEL = 22;

/** What the QR encodes, or an error message for the shopper. */
function qrContent(kind: Kind, a: string, b: string): { value: string } | { error: string } {
  const v = a.trim();
  if (!v) return { error: "" };
  switch (kind) {
    case "link": {
      const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(url) ? { value: url } : { error: "Enter a valid website link" };
    }
    case "upi":
      return /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(v)
        ? {
            value: `upi://pay?pa=${encodeURIComponent(v)}${b.trim() ? `&pn=${encodeURIComponent(b.trim())}` : ""}&cu=INR`,
          }
        : { error: "Enter a UPI ID like name@okaxis" };
    case "whatsapp": {
      const d = v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
      return /^[6-9]\d{9}$/.test(d) ? { value: `https://wa.me/91${d}` } : { error: "Enter a 10-digit mobile number" };
    }
    case "instagram": {
      const h = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
      return /^[\w.]{1,30}$/.test(h) ? { value: `https://instagram.com/${h}` } : { error: "Enter your Instagram username" };
    }
    case "text":
      return v.length <= 300 ? { value: v } : { error: "Keep it under 300 characters" };
  }
}


export default function QrStickerBuilder() {
  const settings = useStoreSettings();
  const features = useFeatures();
  const sizes = customSizes(settings.qrPrices);
  const { add, openCart } = useCart();
  const router = useRouter();
  const skin = cardSkinFor("qr-stickers", useSkinSeed());

  const [kind, setKind] = useState<Kind>("upi");
  const [main, setMain] = useState("");
  const [extra, setExtra] = useState("");
  const [label, setLabel] = useState("Scan to pay");
  const [labelTouched, setLabelTouched] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const chosen = sizes.find((s) => s.inches === size) ?? sizes[0];
  const content = useMemo(() => qrContent(kind, main, extra), [kind, main, extra]);
  const ready = "value" in content;

  // Live preview (small render) whenever the content or label changes.
  useEffect(() => {
    if (!ready) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(() => {
      try {
        setPreview(drawSticker(content.value, label.trim(), 480).toDataURL("image/png"));
      } catch {
        setPreview(null);
      }
    }, 150);
    return () => window.clearTimeout(t);
  }, [ready, content, label]);

  if (settings.loaded && (!features.customStickers || sizes.length === 0)) {
    return (
      <p className="mt-8 rounded-2xl border border-line bg-ink2 px-5 py-6 text-fog">
        QR code stickers aren&apos;t available right now. Please check back soon.
      </p>
    );
  }

  function pickKind(next: Kind) {
    setKind(next);
    setMain("");
    setExtra("");
    if (!labelTouched) setLabel(KINDS.find((k) => k.kind === next)!.defaultLabel);
  }

  async function addToCart(thenCheckout: boolean) {
    if (!chosen || busy) return;
    if (!ready) {
      const input = fieldsRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    const ref = crypto.randomUUID();
    // No image is stored or uploaded: the order keeps what the QR opens and
    // its label, and the admin draws the print file from that.
    const thumb = drawSticker(content.value, label.trim(), 200).toDataURL("image/png");
    const added = add(
      {
        productId: `${CUSTOM_PRODUCT_PREFIX}${ref}`,
        size: chosen.inches,
        sizeLabel: `${formatInches(chosen.inches)}″ QR code`,
        slug: "qr-code-stickers",
        name: QR_STICKER_NAME,
        price: chosen.price,
        imageUrl: thumb,
        thumbUrl: thumb,
        stock: null,
        custom: true,
        customRef: ref,
        customKind: "qr",
        customSpec: { kind: "qr", value: content.value, label: label.trim() },
      },
      qty
    );
    setBusy(false);
    if (!added) return;
    setQty(1);
    if (thenCheckout) router.push("/checkout");
    else openCart();
  }

  const field =
    "h-10 w-full rounded-xl border border-line bg-ink px-3.5 text-sm outline-none transition-colors placeholder:text-fog/60 focus:border-brand/60";

  return (
    <div className="mt-5 grid max-w-3xl gap-4 rounded-3xl border border-line bg-ink2 p-4 shadow-[0_20px_50px_-30px_rgba(16,24,40,0.35)] sm:grid-cols-[170px_1fr] sm:gap-6 sm:p-5">
      {/* Live preview */}
      <div style={skin.art} className="grid h-[200px] place-items-center self-start rounded-2xl p-4 sm:sticky sm:top-24 sm:h-[210px]">
        {preview ? (
          <img
            src={preview}
            alt="Your QR code sticker"
            className="sticker-cut max-h-full w-auto max-w-[140px] -rotate-2 rounded-[18px] object-contain"
          />
        ) : (
          <div className="grid aspect-[5/6] h-full max-h-[170px] place-items-center rounded-[18px] border-[3px] border-dashed border-brand/50 bg-white/85 p-3 text-center">
            <span className="text-xs text-fog">Your QR preview</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-snow">1. What should the QR open?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KINDS.map(({ kind: k, label: l, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => pickKind(k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                kind === k ? "border-brand bg-brand/[0.06] text-brand" : "border-line text-fog hover:text-snow"
              }`}
            >
              <Icon className="size-3.5" /> {l}
            </button>
          ))}
        </div>
        <div ref={fieldsRef} className="mt-2 grid gap-2 sm:grid-cols-2">
          {kind === "upi" && (
            <>
              <input className={field} value={main} onChange={(e) => setMain(e.target.value)} placeholder="UPI ID, e.g. shopname@okaxis" />
              <input className={field} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Name shown in the UPI app (optional)" />
            </>
          )}
          {kind === "link" && <input className={field} value={main} onChange={(e) => setMain(e.target.value)} placeholder="yourwebsite.com" />}
          {kind === "whatsapp" && (
            <input className={field} value={main} onChange={(e) => setMain(e.target.value)} inputMode="tel" placeholder="WhatsApp number (10 digits)" />
          )}
          {kind === "instagram" && <input className={field} value={main} onChange={(e) => setMain(e.target.value)} placeholder="@yourhandle" />}
          {kind === "text" && (
            <textarea
              className={`${field} h-20 py-2.5 sm:col-span-2`}
              value={main}
              onChange={(e) => setMain(e.target.value)}
              maxLength={300}
              placeholder="Any text — Wi-Fi password, a message…"
            />
          )}
          {"error" in content && content.error && <p className="text-xs font-semibold text-brand">{content.error}</p>}
        </div>

        <p className="mt-3.5 text-sm font-semibold text-snow">2. Label under the QR</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LABELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLabel(l);
                setLabelTouched(true);
              }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                label === l ? "border-brand bg-brand/[0.06] text-brand" : "border-line text-fog hover:text-snow"
              }`}
            >
              {l}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setLabel("");
              setLabelTouched(true);
            }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              label === "" ? "border-brand bg-brand/[0.06] text-brand" : "border-line text-fog hover:text-snow"
            }`}
          >
            No label
          </button>
        </div>
        <input
          className={`${field} mt-2`}
          value={label}
          maxLength={MAX_LABEL}
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelTouched(true);
          }}
          placeholder="Or type your own (max 22 letters)"
        />

        <p className="mt-3.5 text-sm font-semibold text-snow">3. Size &amp; quantity</p>
        <div role="radiogroup" aria-label="Sticker size" className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
          {sizes.map((s) => {
            const active = s.inches === chosen?.inches;
            return (
              <button
                key={s.inches}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSize(s.inches)}
                className={`rounded-xl border px-2 py-1.5 text-center transition-all ${
                  active ? "border-brand bg-brand/[0.06] ring-1 ring-brand" : "border-line bg-ink hover:border-snow/30"
                }`}
              >
                <span className="block font-display text-base font-bold">{formatInches(s.inches)}″</span>
                <span className={`block text-sm font-bold ${active ? "text-brand" : "text-snow"}`}>{formatINR(s.price)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="sticker-pill inline-flex items-center gap-1 rounded-full p-1">
            <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-9 place-items-center rounded-full bg-white/70">
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-bold tabular-nums">{qty}</span>
            <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid size-9 place-items-center rounded-full bg-white/70">
              <Plus className="size-4" />
            </button>
          </div>
          {[5, 10, 25, 50].map((n) => (
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
          <div className="mt-3.5 hidden rounded-2xl bg-ink p-3 sm:block">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-fog">
                {qty} × {formatInches(chosen.inches)}″ QR code sticker
              </span>
              <span className="font-display text-2xl font-bold">{formatINR(chosen.price * qty)}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => addToCart(false)}
                className="peel-btn peel-btn--light flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                <ShoppingBag className="size-4.5" /> Add to cart
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => addToCart(true)}
                className="peel-btn peel-btn--brand flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                Book now <ArrowRight className="size-4.5" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-fog">Scan the preview with your phone to check it before you book.</p>
          </div>
        )}
      </div>
      {chosen && (
        <CustomBookBar
          total={chosen.price * qty}
          summary={`${qty} × ${formatInches(chosen.inches)}″ QR code sticker`}
          hint={ready ? null : ("error" in content && content.error) || "Fill in what the QR should open"}
          busy={busy}
          onAdd={() => addToCart(false)}
          onBook={() => addToCart(true)}
        />
      )}
    </div>
  );
}
