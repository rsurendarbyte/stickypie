"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
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
 * Always-visible cart bar pinned to the bottom (every screen size) while the
 * cart has items — tap the left side to review, or jump straight to checkout.
 */
export default function CartStrip() {
  const { count, subtotal, openCart } = useCart();
  const pathname = usePathname();
  const settings = useStoreSettings();

  if (count === 0 || cartUiHidden(pathname)) return null;

  const shortBy = belowMinimum(settings, subtotal);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-snow pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_-10px_rgba(16,24,40,0.35)]">
      <div className="mx-auto flex h-16 w-full max-w-[1700px] items-center gap-3 px-4 text-white sm:h-20 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={openCart}
          className="flex min-w-0 items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-80"
          aria-label="Review cart"
        >
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-white/10">
            <ShoppingBag className="size-4" />
            <span className="pie-gradient absolute -top-1 -right-1 grid min-w-[17px] place-items-center rounded-full px-1 text-[9px] leading-[17px] font-bold">
              {count}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] whitespace-nowrap text-white/60">
              {count} item{count === 1 ? "" : "s"} in cart
              <span className="hidden sm:inline"> · tap to view</span>
            </span>
            <span className="block font-display text-[15px] leading-tight font-bold">
              {formatINR(subtotal)}
            </span>
          </span>
        </button>

        {/* Minimum-order progress fills the middle on wider screens */}
        <div className="mx-auto hidden min-w-0 max-w-sm flex-1 px-4 lg:block">
          {shortBy > 0 ? (
            <>
              <p className="truncate text-[11px] text-white/70">
                Add <span className="font-bold text-white">{formatINR(shortBy)}</span> more · minimum
                order <span className="font-bold text-white">{formatINR(settings.minOrder)}</span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="pie-gradient h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((subtotal / Math.max(settings.minOrder, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-center text-[12px] font-semibold text-mint">
              ✓ Minimum order reached · shipping & GST added at checkout
            </p>
          )}
        </div>

        {shortBy > 0 ? (
          <Link
            href="/stickers"
            className="ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-snow transition-all hover:bg-white/90 active:scale-[0.98] sm:h-12 sm:px-6 lg:ml-0"
          >
            Add {formatINR(shortBy)} more <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link
            href="/checkout"
            className="peel-btn peel-btn--brand ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-5 text-sm font-bold active:scale-[0.98] sm:h-12 sm:px-7 lg:ml-0"
          >
            Checkout<span className="hidden sm:inline"> · {formatINR(subtotal)}</span>{" "}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
