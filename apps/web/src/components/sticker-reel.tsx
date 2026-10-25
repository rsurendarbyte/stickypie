"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronUp, LayoutList, Ruler, Share2, ShoppingBag, Truck } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { discountPercent, formatINR, inCategory } from "@stickypie/shared";
import { useLiveCatalog } from "@/lib/live-catalog";
import { cardSkinFor } from "@/lib/palette";
import { isMiniPoster } from "@/lib/poster";
import { useSkinSeed } from "@/lib/skin-seed";
import { PAGE_VIEW_ONCE_KEY } from "@/lib/view-script";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import PageLink from "./page-link";
import LabelModal from "./label-modal";
import { toCartProduct, useSizeChoice } from "./size-picker";
import TrueSizePreview from "./true-size-preview";

/**
 * Phones: "Swipe view" — the sticker page as a reel — one sticker per screen, swipe up for
 * the next (same category first, then the rest), size + Add to cart always at
 * the bottom, double-tap the art to add. Sits over the classic page, which
 * stays in the HTML for search engines. Every sticker opens in swipe view;
 * "Page view" switches to the page for the sticker on screen only (not
 * remembered). Desktop never shows it.
 *
 * Swiping never asks the server for anything: the catalog is already in the
 * browser (lib/live-catalog), the address bar follows the sticker on screen,
 * and only the stickers next to the one on screen are drawn.
 */

const HINT_KEY = "stickypie.reel-hint";
/** Stickers drawn either side of the one on screen (the rest are empty slots). */
const NEAR = 2;

type View = "reel" | "classic";


export default function StickerReel({
  initial,
  category,
}: {
  initial: Product;
  category: { id: string; name: string; slug: string } | null;
}) {
  // Swipe view, always (also what the static HTML shows on phones) — except the
  // one load that opens the page view of a sticker swiped to (lib/view-script).
  const [view, setView] = useState<View>("reel");
  useEffect(() => {
    if (document.documentElement.dataset.view !== "classic") return;
    setView("classic");
    try {
      sessionStorage.removeItem(PAGE_VIEW_ONCE_KEY);
    } catch {}
  }, []);
  const choose = (next: View, slug?: string) => {
    // Swiped to another sticker? Its own page view, not the one underneath.
    if (next === "classic" && slug && slug !== initial.slug) {
      try {
        sessionStorage.setItem(PAGE_VIEW_ONCE_KEY, `/sticker/${slug}`);
      } catch {}
      location.assign(`/sticker/${slug}`);
      return;
    }
    if (next === "classic") document.documentElement.dataset.view = "classic";
    else delete document.documentElement.dataset.view;
    setView(next);
  };

  // The page underneath doesn't scroll while the reel is open (phones only, see CSS).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("reel-open", view === "reel");
    return () => root.classList.remove("reel-open");
  }, [view]);

  // Page view's "Swipe view" button (in the sticker page's top row) asks for it back.
  useEffect(() => {
    const open = () => choose("reel");
    window.addEventListener("stickypie:swipe-view", open);
    return () => window.removeEventListener("stickypie:swipe-view", open);
  });

  if (view === "classic") return null;
  return <Reel initial={initial} category={category} onClassic={(slug) => choose("classic", slug)} />;
}

function Reel({
  initial,
  category,
  onClassic,
}: {
  initial: Product;
  category: { id: string; name: string; slug: string } | null;
  onClassic: (slug: string) => void;
}) {
  const { products } = useLiveCatalog({ categories: [], products: [initial] });
  const { count, openCart } = useCart();

  // This sticker first, then the rest of its category, then everything else.
  const list = useMemo(() => {
    const current = products.find((p) => p.id === initial.id) ?? initial;
    const others = products.filter((p) => p.id !== initial.id);
    const same = category ? others.filter((p) => inCategory(p, category.id)) : [];
    const rest = others.filter((p) => !same.includes(p));
    return [current, ...same, ...rest];
  }, [products, initial, category]);
  const sameCount = useMemo(
    () => (category ? list.filter((p) => inCategory(p, category.id)).length : list.length),
    [list, category]
  );

  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  // Which sticker fills the screen: keeps the address bar and tab title on it,
  // so sharing, refreshing and Google all land on that sticker's own page.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 }
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [list.length]);

  useEffect(() => {
    const p = list[active];
    if (!p) return;
    const path = `/sticker/${p.slug}`;
    if (location.pathname !== path) history.replaceState(history.state, "", path);
    document.title = `${p.name} · StickyPie`;
  }, [active, list]);

  // A one-time "swipe up" hint for first-timers.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      return;
    }
    setHint(true);
    const t = setTimeout(() => setHint(false), 3500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (active > 0) setHint(false);
  }, [active]);

  function back() {
    const sameSite = document.referrer.startsWith(location.origin);
    if (sameSite && history.length > 1) history.back();
    else location.assign(category ? `/stickers/${category.slug}` : "/stickers");
  }

  const inCat = active < sameCount;
  return (
    <div className="swipe-view-root fixed inset-0 z-[70] bg-ink sm:hidden" role="region" aria-label="Swipe view">
      <div ref={scroller} className="reel-scroller no-scrollbar">
        {/* Every sticker keeps an empty full-screen slot (so the scroll length
            and snap points stay put), but only the few next to the one on
            screen are drawn: a handful of stickers in the page, not the whole
            catalogue. */}
        {list.map((p, i) => (
          <section key={p.id} data-index={i} className="reel-item" aria-label={p.name}>
            {Math.abs(i - active) <= NEAR && <ReelItem product={p} onPageView={() => onClassic(p.slug)} />}
          </section>
        ))}
      </div>

      {/* Top bar: back, where you are, cart, classic view */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/90 text-snow shadow-md ring-1 ring-black/5 backdrop-blur"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="pointer-events-auto truncate rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-snow shadow-sm ring-1 ring-black/5 backdrop-blur">
          {inCat && category ? `${category.name} · ${active + 1} / ${sameCount}` : "More stickers"}
        </span>
        <button
          type="button"
          onClick={() => onClassic(list[active]?.slug ?? initial.slug)}
          aria-label="Switch to page view"
          className="pointer-events-auto ml-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-snow shadow-md ring-1 ring-black/5 backdrop-blur"
        >
          <LayoutList className="size-4" /> Page view
        </button>
        <button
          type="button"
          onClick={openCart}
          aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
          className="pointer-events-auto relative grid size-10 place-items-center rounded-full bg-white/90 text-snow shadow-md ring-1 ring-black/5 backdrop-blur"
        >
          <ShoppingBag className="size-5" />
          {count > 0 && (
            <span key={count} className="reel-bump absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </button>
      </div>

      {hint && (
        <div className="reel-hint pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center text-white">
          <ChevronUp className="size-8 drop-shadow" />
          <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold">Swipe up for more stickers</span>
        </div>
      )}
    </div>
  );
}

function ReelItem({
  product,
  onPageView,
}: {
  product: Product;
  onPageView: () => void;
}) {
  const { add, items, subtotal } = useCart();
  const skin = cardSkinFor(product.slug, useSkinSeed());
  const { sizes, size, setSize, price, compareAtPrice } = useSizeChoice(product);
  const off = discountPercent(price, compareAtPrice);
  const out = product.stock === 0;
  const poster = isMiniPoster(product);
  // This size already in the cart: a quantity stepper and Checkout instead of Add to cart.
  const inCart = items.find((item) => lineKey(item) === lineKey({ productId: product.id, size }));
  const [details, setDetails] = useState(false);
  const [trueSize, setTrueSize] = useState(false);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  function addToCart(at?: { x: number; y: number }) {
    if (out) return;
    add(toCartProduct(product, size, price));
    const id = Date.now();
    const spot = at ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
    setPops((p) => [...p, { id, ...spot }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  }

  // Double-tap the art = add to cart (like a heart on Instagram).
  function onArtTap(e: React.PointerEvent) {
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40) {
      lastTap.current = null;
      addToCart({ x: e.clientX, y: e.clientY });
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  async function share() {
    const url = `${location.origin}/sticker/${product.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  }

  const name = poster ? product.name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "") : product.name;
  return (
    <div className="relative flex h-full flex-col" style={skin.art}>
      {/* Art */}
      <div
        className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center px-10 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-4 select-none"
        onPointerUp={onArtTap}
      >
        <img
          src={product.thumbUrl ?? product.imageUrl}
          alt={product.name}
          draggable={false}
          className={`animate-float max-h-full max-w-full object-contain ${poster ? "poster-print" : "sticker-cut"} ${out ? "opacity-50 saturate-50" : ""}`}
        />
        {pops.map((p) => (
          <span key={p.id} aria-hidden className="reel-pop pointer-events-none fixed z-10" style={{ left: p.x, top: p.y }}>
            <span className="block -translate-x-1/2 -translate-y-1/2 rounded-2xl border-[3px] border-white bg-brand px-3 py-1.5 font-display text-sm font-bold text-white shadow-lg">
              +1 added
            </span>
          </span>
        ))}
      </div>

      {/* Side rail */}
      <div className="absolute right-3 bottom-[248px] flex flex-col items-center gap-3">
        {sizes.length > 0 && (
          <RailButton label="Size" onClick={() => setTrueSize(true)}>
            <Ruler className="size-5" />
          </RailButton>
        )}
        <RailButton label="Share" onClick={share}>
          <Share2 className="size-5" />
        </RailButton>
      </div>

      {/* Buy bar — always on screen */}
      <div className="rounded-t-[28px] border-t border-white bg-white/92 px-4 pt-3.5 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_30px_-18px_rgba(16,24,40,0.45)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {poster && <p className="text-[10px] font-bold tracking-wider text-brand uppercase">Mini poster</p>}
            <h2 className="line-clamp-2 font-display text-lg leading-tight font-bold">{name}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-xl leading-none font-bold text-gold">{formatINR(price)}</p>
            {compareAtPrice !== null && compareAtPrice > price && (
              <p className="mt-1 text-[11px] text-fog">
                <span className="line-through">{formatINR(compareAtPrice)}</span>
                {off !== null && <span className="ml-1 font-bold text-mint">{off}% off</span>}
              </p>
            )}
          </div>
        </div>
        {sizes.length > 1 && (
          <div role="radiogroup" aria-label="Sticker size" className="mt-3 grid grid-cols-3 gap-2">
            {sizes.map((s) => {
              const on = s.inches === size;
              return (
                <button
                  key={s.inches}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSize(s.inches)}
                  className={`rounded-xl border px-2 py-1.5 text-center transition-colors ${
                    on ? "border-brand bg-brand/[0.07] text-brand" : "border-line bg-white text-snow"
                  }`}
                >
                  <span className="block font-display text-sm font-bold">{s.inches}″</span>
                  <span className="block text-[11px]">{formatINR(s.price)}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDetails(true)}
            aria-label="Details"
            // icon only once in the cart, to make room for the stepper + Checkout
            className={`peel-btn peel-btn--light flex h-12 shrink-0 items-center justify-center gap-1 rounded-2xl text-sm font-bold ${inCart ? "w-12" : "px-4"}`}
          >
            <ChevronUp className="size-4" />
            {!inCart && "Details"}
          </button>
          {inCart ? (
            <>
              <CartStepper item={inCart} size="lg" sticker className="h-12 shrink-0" />
              <PageLink
                href="/checkout"
                className="peel-btn peel-btn--brand flex h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 text-sm font-bold whitespace-nowrap"
              >
                Checkout · {formatINR(subtotal)} <ArrowRight className="size-4 shrink-0" />
              </PageLink>
            </>
          ) : (
            <button
              type="button"
              disabled={out}
              onClick={() => addToCart()}
              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold ${
                out ? "cursor-not-allowed bg-panel text-fog" : "peel-btn"
              }`}
            >
              {out ? (
                "Out of stock"
              ) : (
                <>
                  <ShoppingBag className="peel-icon size-5" /> Add to cart · {formatINR(price)}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <LabelModal open={details} onClose={() => setDetails(false)} labelledBy={`reel-details-${product.id}`} placement="bottom" className="max-w-md p-5">
        <h3 id={`reel-details-${product.id}`} className="font-display text-lg font-bold">{name}</h3>
        {product.description && <p className="mt-2 text-sm leading-relaxed text-fog">{product.description}</p>}
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>Die-cut vinyl, peel and stick — size is the longest side.</li>
          <li>Goes on a car, bike, helmet, laptop, water bottle or phone case.</li>
          <li className="flex items-center gap-1.5">
            <Truck className="size-4 text-mint" /> Dispatched in 2–4 days, delivered in 3–5 days across India.
          </li>
        </ul>
        <button type="button" onClick={onPageView} className="mt-4 inline-block text-sm font-semibold text-brand">
          See the full page →
        </button>
      </LabelModal>

      {trueSize && (
        <TrueSizePreview
          open
          onClose={() => setTrueSize(false)}
          name={product.name}
          imageUrl={product.imageUrl}
          aspectRatio={product.aspectRatio}
          sizes={sizes}
          size={size}
          onSizeChange={setSize}
        />
      )}
    </div>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 text-[10px] font-bold text-snow">
      <span className="grid size-11 place-items-center rounded-full bg-white/90 shadow-md ring-1 ring-black/5 backdrop-blur">{children}</span>
      {label}
    </button>
  );
}
