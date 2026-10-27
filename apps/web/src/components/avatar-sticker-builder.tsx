"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Info,
  Plus,
  ShoppingBag,
  Shuffle,
  Sparkles,
  Truck,
  Trash2,
  X,
} from "lucide-react";
import {
  AVATAR_NOTE_MAX,
  AVATAR_STICKER_NAME,
  CUSTOM_PRODUCT_PREFIX,
  avatarBook,
  avatarBookLabel,
  avatarMaxSheets,
  avatarSheetsPrice,
  customArtKey,
  formatINR,
  type AvatarStyle,
} from "@stickypie/shared";
import { idbSet } from "@/lib/idb";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { shrinkImage } from "@/lib/shrink-image";
import ZoomPane from "./zoom-pane";
import AvatarArt from "./avatar-art";
import { useCart } from "./cart-context";
import CustomBookBar from "./custom-book-bar";
import CustomRequestForm from "./custom-request-form";
import LabelModal from "./label-modal";
import { TextField } from "./field";

const HOW = [
  { icon: BookOpen, title: "Pick your styles", text: "One style a pack" },
  { icon: Camera, title: "Add your photo", text: "Stays on your phone" },
  { icon: CreditCard, title: "Pay for the packs", text: "With your cart" },
  { icon: Truck, title: "AI makes, we ship", text: "Preview on your order" },
];

/** Repeating diagonal "SAMPLE · STICKYPIE" over sample sheets. */
const WATERMARK: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160"><text x="130" y="88" text-anchor="middle" transform="rotate(-28 130 80)" font-family="system-ui,sans-serif" font-size="22" font-weight="800" letter-spacing="3" fill="#111" fill-opacity="0.22">SAMPLE · STICKYPIE</text></svg>',
  )}")`,
  backgroundRepeat: "repeat",
};

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** A numbered step: white card with its title row. */
function StepCard({
  n,
  title,
  aside,
  done,
  children,
}: {
  n: number;
  title: string;
  aside?: React.ReactNode;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-ink2 p-4 shadow-[0_14px_40px_-30px_rgba(16,24,40,0.4)] sm:p-6">
      <div className="flex items-center gap-2.5">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
            done ? "bg-mint" : "pie-gradient"
          }`}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <h2 className="font-display text-lg leading-tight font-bold sm:text-xl">
          {title}
        </h2>
        {aside && <span className="ml-auto shrink-0">{aside}</span>}
      </div>
      <div className="mt-3.5 sm:mt-4">{children}</div>
    </section>
  );
}

/**
 * A style's card picture: the admin's card pictures (a girl and a boy),
 * cross-fading in turn — `offset` (seconds) staggers cards so they don't all
 * swap together — else the first sample sheet zoomed on its first sticker,
 * else the drawn stand-in.
 */
function StyleCover({
  style,
  offset = 0,
  className = "",
}: {
  style: AvatarStyle;
  offset?: number;
  className?: string;
}) {
  const { covers } = style;
  if (covers.length)
    return (
      <span
        className={`relative block bg-gradient-to-br from-[#fff1f5] to-[#eef6ff] ${className}`}
      >
        {covers.map((src, i) => (
          // Pinned to the box (not sized by the picture), so every card is the same size.
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            className={`absolute inset-[6%] size-[88%] object-contain drop-shadow-md ${
              covers.length > 1 ? "avatar-cover-swap" : ""
            }`}
            style={
              covers.length > 1
                ? { animationDelay: `${-(offset + i * 3)}s` }
                : undefined
            }
          />
        ))}
      </span>
    );
  if (style.images.length)
    return (
      <span className={`block overflow-hidden bg-white ${className}`}>
        <img
          src={style.images[0]}
          alt=""
          loading="lazy"
          className="size-full origin-[17%_26%] scale-[2.3] object-cover object-top"
        />
      </span>
    );
  return <AvatarArt style={style.label} className={`block ${className}`} />;
}

/**
 * Avatar sticker book: the shopper picks one style per page from the admin's
 * list (each with sample sheets), adds a photo (kept in this browser until
 * paid, then uploaded from the order page like a custom design) and books.
 * We make each page with AI and show them on the order page before printing.
 *
 * Phones: one column of steps, the book summary last and the Book now bar
 * pinned to the bottom. Desktop: steps on the left, the book summary sticky on
 * the right.
 */
export default function AvatarStickerBuilder() {
  const settings = useStoreSettings();
  const features = useFeatures();
  const book = avatarBook(settings);
  const { add, openCart } = useCart();

  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  // Sample sheets open full screen: the list and which one is showing.
  const [gallery, setGallery] = useState<{
    title: string;
    images: string[];
    at: number;
  } | null>(null);
  const [note, setNote] = useState("");
  /** Too few styles: ask whether to pick more or let us fill them at random. */
  const [short, setShort] = useState<{ thenCheckout: boolean } | null>(null);
  const stylesRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Consent that the stickers are made from their photo with an AI model: asked
  // in a pop-up on Book now / Add to cart, then booking carries on.
  const [agreed, setAgreed] = useState(false);
  const [askTerms, setAskTerms] = useState<{ thenCheckout: boolean } | null>(null);
  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );
  useEffect(() => {
    if (!gallery) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGallery(null);
      if (e.key === "ArrowRight")
        setGallery((g) => g && { ...g, at: (g.at + 1) % g.images.length });
      if (e.key === "ArrowLeft")
        setGallery(
          (g) =>
            g && { ...g, at: (g.at - 1 + g.images.length) % g.images.length },
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gallery]);

  const styles = settings.avatarStyles;
  // One sheet per picked style: at least the admin's minimum, up to every style.
  const min = book?.pages ?? 0;
  const max = avatarMaxSheets(styles.length);

  if (settings.loaded && (!features.avatarStickers || !book)) {
    return (
      <>
        <p className="mt-8 rounded-2xl border border-line bg-ink2 px-5 py-6 text-fog">
          Avatar stickers aren&apos;t available to order online right now — tell
          us what you need below.
        </p>
        <CustomRequestForm />
      </>
    );
  }

  async function pick(next: File | undefined) {
    setError(null);
    if (!next) return;
    setReading(true);
    try {
      // Phone photos are big: a 2000px copy is plenty for drawing from.
      const small = await shrinkImage(next, 2000, 2_500_000);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That photo couldn't be opened — try another one.",
      );
    } finally {
      setReading(false);
    }
  }

  function toggleStyle(label: string) {
    setError(null);
    setPicked((list) =>
      list.includes(label)
        ? list.filter((l) => l !== label)
        : list.length >= max
          ? list
          : [...list, label],
    );
  }

  // Arriving from a style card on the home page (?style=Anime): start with that style picked.
  const fromCard = useRef(false);
  useEffect(() => {
    if (fromCard.current) return;
    const wanted = new URLSearchParams(window.location.search).get("style");
    const hit = wanted && styles.find((st) => st.label.toLowerCase() === wanted.toLowerCase());
    if (!hit) return;
    fromCard.current = true;
    setPicked((list) => (list.includes(hit.label) ? list : [hit.label, ...list]));
  }, [styles]);

  const stylesDone = picked.length >= min && min > 0;
  const sheets = Math.max(picked.length, min);
  const total = book ? avatarSheetsPrice(book, picked.length) : 0;
  const missing =
    picked.length < min
      ? `Pick ${min - picked.length} more style${min - picked.length === 1 ? "" : "s"}`
      : !photo
        ? "Add your photo"
        : null;

  async function addToCart(thenCheckout: boolean, list: string[] = picked, consent = agreed) {
    if (!book || busy) return;
    if (list.length < min) {
      setError(null);
      setShort({ thenCheckout });
      return;
    }
    if (!photo) {
      setError("Add your photo");
      inputRef.current?.click();
      return;
    }
    if (!consent) {
      setAskTerms({ thenCheckout });
      return;
    }
    setError(null);
    setBusy(true);
    const ref = crypto.randomUUID();
    // Kept in this browser only; sent to us once the order is paid.
    await idbSet(customArtKey(ref), photo!);
    const thumb = await shrinkImage(photo!, 240, 40_000)
      .then(toDataUrl)
      .catch(() => "/icons/custom-sticker.svg");
    const added = add(
      {
        productId: `${CUSTOM_PRODUCT_PREFIX}${ref}`,
        size: null,
        sizeLabel: avatarBookLabel(list.length),
        slug: "avatar-stickers",
        name: AVATAR_STICKER_NAME,
        price: avatarSheetsPrice(book, list.length),
        imageUrl: thumb,
        thumbUrl: thumb,
        stock: null,
        custom: true,
        customRef: ref,
        customKind: "avatar",
        customSpec: {
          kind: "avatar",
          pages: list.length,
          styles: list,
          note: note.trim(),
        },
      },
      1,
    );
    setBusy(false);
    if (!added) return; // cart has regular stickers — the shopper decides in the prompt
    setPhoto(null);
    setPreview(null);
    setPicked([]);
    setNote("");
    if (thenCheckout) window.location.assign("/checkout");
    else openCart();
  }

  /** "Pick for me": fill up to the minimum with random styles, then carry on. */
  function pickForMe() {
    if (!short) return;
    const rest = styles
      .map((st) => st.label)
      .filter((l) => !picked.includes(l));
    for (let i = rest.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[k]] = [rest[k], rest[i]];
    }
    const list = [...picked, ...rest.slice(0, min - picked.length)];
    setPicked(list);
    const { thenCheckout } = short;
    setShort(null);
    void addToCart(thenCheckout, list);
  }

  const slots = Array.from(
    { length: sheets },
    (_, i) => styles.find((s) => s.label === picked[i]) ?? null,
  );

  return (
    <>
      <div className="mt-4 grid items-start gap-4 sm:mt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="space-y-4">
          {/* 1 — styles */}
          <div ref={stylesRef} className="scroll-mt-24">
            <StepCard
              n={1}
              title={`Choose ${min}+ styles`}
              done={stylesDone}
              aside={
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    stylesDone
                      ? "bg-mint/15 text-mint"
                      : "bg-brand/10 text-brand"
                  }`}
                >
                  {picked.length < min
                    ? `${picked.length} of ${min}`
                    : `${picked.length} picked`}
                </span>
              }
            >
              <p className="-mt-1 mb-3 text-xs text-fog">
                Tap a style to add it — each one is a sticker pack of you. Pick {min} or more.
              </p>
              {/* Phones: two big cards a row so the pictures read; more columns on wider screens */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                {styles.map((st, n) => {
                  const page = picked.indexOf(st.label) + 1;
                  const on = page > 0;
                  const full = !on && picked.length >= max;
                  return (
                    <div
                      key={st.label}
                      className={`relative overflow-hidden rounded-2xl ring-1 transition-all ${
                        on
                          ? "bg-brand/[0.06] ring-[2.5px] ring-brand"
                          : full
                            ? "bg-ink opacity-40 ring-line"
                            : "bg-ink ring-line hover:ring-snow/30"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={full}
                        aria-label={on ? `${st.label}, pack ${page} — tap to remove` : `Add ${st.label}`}
                        onClick={() => toggleStyle(st.label)}
                        className="block w-full disabled:cursor-not-allowed"
                      >
                        <StyleCover style={st} offset={n * 0.8} className="aspect-[5/4] w-full" />
                      </button>
                      {on && (
                        <span className="pie-gradient pointer-events-none absolute top-2 left-2 flex h-6 items-center gap-1 rounded-full pr-2 pl-1.5 text-[11px] font-bold text-white shadow ring-2 ring-white">
                          <Check className="size-3.5" strokeWidth={3} /> Pack {page}
                        </span>
                      )}
                      <div className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] leading-tight font-bold text-snow">
                            {st.label}
                          </span>
                          {st.images.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setGallery({ title: st.label, images: st.images, at: 0 })}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap text-brand hover:underline"
                            >
                              <Eye className="size-3.5 shrink-0" /> {st.images.length} sample{st.images.length === 1 ? "" : "s"}
                            </button>
                          ) : (
                            <span className="mt-1 block text-[11px] text-fog">AI sticker pack</span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={full}
                          onClick={() => toggleStyle(st.label)}
                          aria-label={on ? `Remove ${st.label}` : `Add ${st.label}`}
                          className={`grid size-9 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand active:scale-95 disabled:cursor-not-allowed ${
                            on
                              ? "bg-white text-red-500 shadow ring-1 ring-red-500/30 hover:bg-red-500 hover:text-white"
                              : "bg-white text-brand ring-[1.5px] ring-brand/40 hover:bg-brand hover:text-white"
                          }`}
                        >
                          {on ? <Trash2 className="size-4" strokeWidth={2.25} /> : <Plus className="size-4.5" strokeWidth={2.5} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </StepCard>
          </div>

          {/* 2 — photo */}
          <StepCard n={2} title="Add your photo" done={!!photo}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={reading}
                onClick={() => inputRef.current?.click()}
                aria-label={preview ? "Change photo" : "Choose photo"}
                className={`relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-[28%] sm:size-28 ${
                  preview
                    ? "ring-4 ring-white shadow-lg"
                    : "border-2 border-dashed border-brand/50 bg-brand/[0.04]"
                }`}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Your photo"
                    className="size-full object-cover"
                  />
                ) : (
                  <Camera className="size-8 text-brand" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-snow">
                  {preview ? "Looking good!" : "A clear selfie works best"}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-fog">
                  <li>Face clearly visible, good light</li>
                  <li>Just you — no group photos</li>
                </ul>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={reading}
                    onClick={() => inputRef.current?.click()}
                    className={`peel-btn h-9 rounded-xl px-4 text-xs font-bold ${preview ? "peel-btn--light" : "peel-btn--brand"}`}
                  >
                    {reading
                      ? "Opening…"
                      : preview
                        ? "Change photo"
                        : "Choose photo"}
                  </button>
                  {preview && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPreview(null);
                      }}
                      className="text-xs font-semibold text-fog hover:text-brand"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-ink px-3 py-2 text-[11px] leading-relaxed text-fog">
              Your photo stays on this phone and is sent to us only after you
              pay.
            </p>
          </StepCard>

          {/* 3 — optional note */}
          <StepCard n={3} title="Final touches (optional)" done={!!note.trim()}>
            <TextField
              label="Anything else? (optional)"
              placeholder="e.g. with my bike, wearing glasses"
              value={note}
              maxLength={AVATAR_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-fog">
              By ordering you confirm this is your own photo (or your
              child&apos;s, and you&apos;re their parent) — no celebrities or
              other people&apos;s photos.
            </p>
          </StepCard>
        </div>

        {/* Your sheets: fill in as styles are picked; sticky beside the steps on desktop */}
        {book && (
          <aside className="rounded-3xl border border-line bg-ink2 p-4 shadow-[0_20px_50px_-30px_rgba(16,24,40,0.45)] sm:p-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[30%] bg-ink ring-1 ring-line">
                {preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <Camera className="size-5 text-fog" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg leading-tight font-bold">
                  Your sticker packs
                </span>
                <span className="block text-xs text-fog">
                  {avatarBookLabel(sheets)}
                </span>
              </span>
            </div>
            <ol className="mt-4 grid grid-cols-4 gap-2">
              {slots.map((st, i) => (
                <li key={i} className="min-w-0">
                  {st ? (
                    <button
                      type="button"
                      onClick={() => toggleStyle(st.label)}
                      aria-label={`Remove ${st.label} from pack ${i + 1}`}
                      className="block w-full overflow-hidden rounded-xl ring-1 ring-line"
                    >
                      <StyleCover style={st} className="aspect-[3/4] w-full" />
                    </button>
                  ) : (
                    <span className="grid aspect-[3/4] w-full place-items-center rounded-xl border-2 border-dashed border-line text-sm font-bold text-fog/60">
                      {i + 1}
                    </span>
                  )}
                  <span className="mt-1 block truncate text-center text-[10px] font-semibold text-fog">
                    {st ? st.label : `Pack ${i + 1}`}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-4">
              <span className="text-sm text-fog">Price</span>
              <span className="font-display text-3xl font-bold">
                {formatINR(total)}
              </span>
            </div>
            {error && (
              <p className="mt-2 text-sm font-semibold text-brand">{error}</p>
            )}
            {!error && missing && (
              <p className="mt-2 text-xs font-semibold text-brand">{missing}</p>
            )}
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
            <p className="mt-3 text-[11px] leading-relaxed text-fog">
              Shipping and GST added at checkout. We make a pack of AI stickers
              of you in each style, show them on your order page, then print on
              vinyl and ship.
            </p>
          </aside>
        )}
      </div>

      {/* How it works */}
      <ol className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {HOW.map(({ icon: Icon, title, text }, i) => (
          <li
            key={title}
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-ink2/80 p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] leading-tight font-semibold text-snow">
                {i + 1}. {title}
              </span>
              <span className="block text-[11px] text-fog">{text}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* Sample sheets, full screen */}
      {gallery && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${gallery.title} samples`}
          onClick={() => setGallery(null)}
          className="fixed inset-0 z-[80] flex flex-col bg-black/85 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-semibold">
              {gallery.title}
              {gallery.images.length > 1 && (
                <span className="ml-2 text-white/60">
                  {gallery.at + 1} / {gallery.images.length}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setGallery(null)}
              aria-label="Close"
              className="grid size-10 place-items-center rounded-full bg-white text-neutral-900 shadow"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="relative grid min-h-0 flex-1 place-items-center py-3">
            {/* the sheet, sized to fit the screen, with a SAMPLE watermark over it */}
            {/* pinch / double-tap / +− to look closer; the watermark zooms with it */}
            <ZoomPane resetKey={`${gallery.title}-${gallery.at}`}>
            <span
              onContextMenu={(e) => e.preventDefault()}
              className="relative inline-block overflow-hidden rounded-xl bg-white select-none"
            >
              <img
                src={gallery.images[gallery.at]}
                alt={`${gallery.title} sample`}
                draggable={false}
                className="block max-h-[calc(100dvh-250px)] max-w-[calc(100vw-120px)] object-contain max-sm:max-w-[calc(100vw-32px)]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={WATERMARK}
              />
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold tracking-widest text-white uppercase">
                Sample
              </span>
            </span>
            </ZoomPane>
            {gallery.images.length > 1 &&
              ([-1, 1] as const).map((by) => (
                <button
                  key={by}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGallery(
                      (g) =>
                        g && {
                          ...g,
                          at: (g.at + by + g.images.length) % g.images.length,
                        },
                    );
                  }}
                  aria-label={by < 0 ? "Previous" : "Next"}
                  className={`absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow ${
                    by < 0 ? "left-0" : "right-0"
                  }`}
                >
                  {by < 0 ? (
                    <ChevronLeft className="size-5" />
                  ) : (
                    <ChevronRight className="size-5" />
                  )}
                </button>
              ))}
          </div>
          <p
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex max-w-xl items-start gap-2.5 rounded-2xl bg-gold px-4 py-3 text-[13px] leading-snug font-semibold text-neutral-900 shadow-lg"
          >
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              This is a sample to show the style. Yours is AI-generated from{" "}
              <b>your own photo</b> once you pay — we show it on your order page
              before printing.
            </span>
          </p>
        </div>
      )}

      <LabelModal
        open={!!short}
        onClose={() => setShort(null)}
        labelledBy="avatar-short-title"
        className="w-full max-w-sm p-5 sm:p-6"
      >
        <h2 id="avatar-short-title" className="font-display text-xl font-bold">
          Pick {Math.max(0, min - picked.length)} more style
          {min - picked.length === 1 ? "" : "s"}
        </h2>
        <p className="mt-1.5 text-sm text-fog">
          Each style is one sticker pack, and you need at least {min}. Choose
          them yourself, or we&apos;ll pick
          {picked.length ? " the rest" : ` ${min}`} at random for you.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setShort(null);
              stylesRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="peel-btn peel-btn--light flex h-12 items-center justify-center rounded-xl text-sm font-bold"
          >
            I&apos;ll pick
          </button>
          <button
            type="button"
            onClick={pickForMe}
            className="peel-btn peel-btn--brand flex h-12 items-center justify-center gap-1.5 rounded-xl text-sm font-bold"
          >
            <Shuffle className="size-4" /> Pick for me
          </button>
        </div>
      </LabelModal>

      <LabelModal
        open={!!askTerms}
        onClose={() => setAskTerms(null)}
        labelledBy="avatar-terms-title"
        className="w-full max-w-sm p-5 sm:p-6"
      >
        <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Sparkles className="size-5" />
        </span>
        <h2 id="avatar-terms-title" className="mt-3 font-display text-xl font-bold">
          Made with AI from your photo
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-fog">
          <li>• We make your stickers from your photo using an AI model, so the artwork is AI-generated.</li>
          <li>• You have the right to use this photo (yours, or your child&apos;s as their parent).</li>
          <li>• We show the stickers on your order page before printing.</li>
        </ul>
        <p className="mt-2 text-xs text-fog">
          By continuing you accept our{" "}
          <a href="/legal/terms" target="_blank" rel="noopener" className="font-semibold text-brand underline">
            terms
          </a>
          .
        </p>
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={() => setAskTerms(null)}
            className="peel-btn peel-btn--light flex h-12 items-center justify-center rounded-xl px-4 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const next = askTerms;
              setAgreed(true);
              setAskTerms(null);
              if (next) void addToCart(next.thenCheckout, picked, true);
            }}
            className="peel-btn peel-btn--brand flex h-12 items-center justify-center gap-1.5 rounded-xl text-sm font-bold"
          >
            <Check className="size-4" strokeWidth={3} /> I agree &amp; continue
          </button>
        </div>
      </LabelModal>

      {book && (
        <CustomBookBar
          total={total}
          summary={avatarBookLabel(sheets)}
          hint={missing}
          busy={busy}
          onAdd={() => addToCart(false)}
          onBook={() => addToCart(true)}
        />
      )}
    </>
  );
}
