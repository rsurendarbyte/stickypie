"use client";

import Link from "@/components/page-link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { belowMinimum, formatINR } from "@stickypie/shared";
import { useStoreSettings } from "@/lib/live-catalog";
import { useCart } from "./cart-context";

/** Routes where the persistent cart UI would be noise. */
export function cartUiHidden(pathname: string): boolean {
  return (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/order") ||
    pathname.startsWith("/pay") ||
    pathname.startsWith("/contact")
  );
}

/**
 * "Your stickers are waiting" — a strip of washi tape stuck across the bottom
 * centre while the cart has items: what's in the cart, a progress bar towards
 * the minimum order, and Checkout / Add more. It gets slapped down from the
 * side, and every few seconds its right end lifts off the page and presses
 * back down; the sticker stack pops when something is added.
 */
export default function CartStrip() {
  const { items, count, subtotal, openCart, isOpen } = useCart();
  const pathname = usePathname();
  const settings = useStoreSettings();

  // Hidden while the cart itself is open (it says the same thing).
  // ...and until the real minimum order has loaded (never the built-in default)
  if (count === 0 || isOpen || cartUiHidden(pathname) || !settings.loaded) return null;

  const shortBy = belowMinimum(settings, subtotal, items);
  const progress =
    shortBy === 0
      ? 100
      : Math.min((subtotal / Math.max(settings.minOrder, 1)) * 100, 100);
  const stack = items.slice(-3).reverse(); // newest on top
  const label = `${count} sticker${count === 1 ? "" : "s"}`;
  // The custom sticker makers have their own bar pinned to the bottom on
  // phones (total + Book now); two bars there would cover the form.
  const maker = /^\/(custom-stickers\/design|name-stickers|qr-code-stickers|avatar-stickers)/.test(pathname);

  return (
    <div className={`${maker ? "max-sm:hidden " : ""}shift-with-cart pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+var(--tabbar,0px)+env(safe-area-inset-bottom,0px))] z-30 flex justify-center cart-tape-wrap sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]`}>
      <div className="cart-tape-box pointer-events-auto w-full max-w-[560px]">
        <div className="cart-tape flex items-center gap-2 py-2.5 pr-5 pl-4 max-[359px]:pr-4 max-[359px]:pl-3 sm:pr-7 sm:pl-6">
          <button
            type="button"
            onClick={openCart}
            aria-label={`Review cart: ${label}, ${formatINR(subtotal)}`}
            className="flex min-w-0 flex-1 items-center gap-3 text-left max-[359px]:gap-2"
          >
            {/* Fanned stack of what's in the cart; pops when the count changes */}
            <span
              key={count}
              className="cart-stack relative h-11 w-14 shrink-0 max-[359px]:w-11"
            >
              {stack.map((item, i) => (
                <span
                  key={`${item.productId}:${item.size ?? ""}`}
                  className="absolute top-1/2 left-1/2 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] size-10 place-items-center rounded-lg border-2 border-white bg-panel p-0.5 shadow-[0_3px_8px_-3px_rgba(16,24,40,0.4)]"
                  style={{
                    transform: `translate(-50%, -50%) translateX(${(i - (stack.length - 1) / 2) * 9}px) rotate(${[-8, 6, -3][i] ?? 0}deg)`,
                    zIndex: stack.length - i,
                  }}
                >
                  <img
                    src={item.thumbUrl ?? item.imageUrl}
                    alt=""
                    className="size-full object-contain"
                  />
                </span>
              ))}
              <span className="absolute -top-1.5 -right-1 z-10 grid min-w-[20px] place-items-center rounded-full border-2 border-white bg-snow px-1 text-[10px] leading-[16px] font-bold text-white">
                {count}
              </span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[15px] leading-tight font-bold text-[#5a2a06]">
                {shortBy > 0 ? (
                  "Almost there!"
                ) : (
                  <>
                    <span className="sm:hidden">Stickers waiting!</span>
                    <span className="hidden sm:inline">
                      Your stickers are waiting
                    </span>
                  </>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[#7a4318] sm:text-xs">
                {shortBy > 0 ? (
                  <>
                    Add <b className="text-[#5a2a06]">{formatINR(shortBy)}</b>{" "}
                    more<span className="hidden sm:inline"> to check out</span>
                  </>
                ) : (
                  <>
                    {label} ·{" "}
                    <b className="text-[#5a2a06]">{formatINR(subtotal)}</b>
                    <span className="hidden sm:inline"> · ready to ship</span>
                  </>
                )}
              </span>
              {/* Progress towards the minimum order */}
              <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/55">
                <span
                  className="block h-full rounded-full bg-[#f9530a] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </span>
          </button>

          <Link
            href={shortBy > 0 ? "/stickers" : "/checkout"}
            className="peel-btn peel-btn--brand flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold max-[359px]:px-3 sm:h-11 sm:px-4"
          >
            {shortBy > 0 ? "Add more" : "Checkout"}{" "}
            {/* narrow phones: no arrow, so the words beside it fit */}
            <ArrowRight className="size-4 max-[359px]:hidden" />
          </Link>
        </div>
      </div>
    </div>
  );
}
