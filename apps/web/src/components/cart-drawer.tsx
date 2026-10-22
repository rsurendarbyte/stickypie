"use client";

import HoverLink from "./hover-link";
import { useEffect, useState } from "react";
import { CheckCircle2, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { belowMinimum, formatINR } from "@stickypie/shared";
import { useStoreSettings } from "@/lib/live-catalog";
import { lineKey, useCart, itemHref } from "./cart-context";
import QtyStepper from "./qty-stepper";

export default function CartDrawer() {
  const { items, count, subtotal, isOpen, closeCart, setQty, remove } =
    useCart();
  const settings = useStoreSettings();
  const shortBy = belowMinimum(settings, subtotal);
  // "open" = sticking on, "closing" = peeling off, then gone.
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  useEffect(() => {
    if (isOpen) {
      setPhase("open");
      return;
    }
    setPhase((p) => (p === "open" ? "closing" : p));
    // Fallback if animations are off (lite mode / reduced motion).
    const t = window.setTimeout(
      () => setPhase((p) => (p === "closing" ? "closed" : p)),
      600,
    );
    return () => window.clearTimeout(t);
  }, [isOpen]);

  // Desktop: the shop slides over to make room (no overlay, keep browsing).
  // Phone: a bottom sheet over a light scrim, with the page behind locked.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    const root = document.documentElement;
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      root.dataset.cartOpen = "";
      if (!window.matchMedia("(min-width: 1024px)").matches)
        root.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      delete root.dataset.cartOpen;
      root.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden={!isOpen}
    >
      {/* Phone only: light scrim behind the sheet; tap to close. */}
      <div
        onClick={closeCart}
        className={`absolute inset-0 bg-snow/25 transition-opacity duration-300 lg:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
      />
      {/* The cart is a sticker label: it sticks on when opened and peels off when closed. */}
      {phase !== "closed" && (
        <aside
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && phase === "closing")
              setPhase("closed");
          }}
          className={`cart-label absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] border-x-[3px] border-t-[3px] border-white bg-ink2 shadow-[0_-20px_50px_-20px_rgba(16,24,40,0.35)] lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:max-h-none lg:w-[27rem] lg:rounded-[28px] lg:border-[3px] lg:shadow-[0_24px_60px_-24px_rgba(16,24,40,0.45)] ${
            phase === "open"
              ? "cart-label--on pointer-events-auto"
              : "cart-label--off"
          }`}
          role="dialog"
          aria-label="Shopping cart"
        >
          {/* sheet handle (phone) */}
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="mx-auto mt-2.5 block h-1.5 w-11 shrink-0 rounded-full bg-snow/15 lg:hidden"
          />
          <div className="flex items-center justify-between border-b border-line px-5 py-3 lg:py-4">
            <p className="font-display text-lg font-semibold">
              Your cart{" "}
              <span className="text-sm font-normal text-fog">
                ({count} {count === 1 ? "sticker" : "stickers"})
              </span>
            </p>
            <button
              type="button"
              aria-label="Close cart"
              onClick={closeCart}
              className="grid size-9 place-items-center rounded-full text-fog transition-colors hover:bg-snow/5 hover:text-snow"
            >
              <X className="size-5" />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="grid size-20 place-items-center rounded-full bg-panel">
                <ShoppingBag className="size-9 text-fog" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">
                  Nothing sticky yet
                </p>
                <p className="mt-1 text-sm text-fog">
                  Your cart is empty. Let&apos;s fix that.
                </p>
              </div>
              <HoverLink
                href="/stickers"
                onClick={closeCart}
                className="peel-btn peel-btn--brand rounded-xl px-6 py-2.5 text-sm font-semibold"
              >
                Browse stickers
              </HoverLink>
            </div>
          ) : (
            <>
              <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {items.map((item) => {
                  return (
                    <li key={lineKey(item)} className="flex gap-3">
                      <HoverLink
                        href={itemHref(item)}
                        onClick={closeCart}
                        className="grid size-16 shrink-0 place-items-center rounded-xl bg-panel p-1.5 ring-1 ring-line"
                      >
                        <img
                          src={item.thumbUrl ?? item.imageUrl}
                          loading="lazy"
                          decoding="async"
                          alt={item.name}
                          className="sticker-cut-sm max-h-full max-w-full object-contain"
                        />
                      </HoverLink>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <HoverLink
                            href={itemHref(item)}
                            onClick={closeCart}
                            className="truncate text-sm font-medium hover:underline"
                          >
                            {item.name}
                          </HoverLink>
                          <button
                            type="button"
                            aria-label={`Remove ${item.name}`}
                            onClick={() => remove(lineKey(item))}
                            className="shrink-0 text-fog transition-colors hover:text-brand"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-fog">
                          {item.size && (
                            <span className="font-medium text-snow/80">
                              {item.size}″ ·{" "}
                            </span>
                          )}
                          {formatINR(item.price)} each
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <QtyStepper
                            compact
                            value={item.qty}
                            max={item.stock}
                            onChange={(next) => setQty(lineKey(item), next)}
                          />
                          <p className="text-sm font-semibold">
                            {formatINR(item.price * item.qty)}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-line px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                {shortBy === 0 ? (
                  <p className="flex items-center gap-2 text-xs font-medium text-mint">
                    <CheckCircle2 className="size-4" /> Minimum order reached —
                    you can check out
                  </p>
                ) : (
                  <div>
                    <p className="flex items-center gap-2 text-xs text-fog">
                      <Truck className="size-4" />
                      Add{" "}
                      <span className="font-semibold text-snow">
                        {formatINR(shortBy)}
                      </span>{" "}
                      more to reach the {formatINR(settings.minOrder)} minimum
                      order
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
                      <div
                        className="pie-gradient h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((subtotal / Math.max(settings.minOrder, 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-fog">
                    <span>Subtotal</span>
                    <span className="text-snow">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-fog">
                    <span>Shipping</span>
                    <span className="text-xs">By distance, at checkout</span>
                  </div>
                  <div className="flex justify-between text-fog">
                    <span>GST</span>
                    <span className="text-xs">Added at checkout</span>
                  </div>
                </div>

                {shortBy > 0 ? (
                  <HoverLink
                    href="/stickers"
                    onClick={closeCart}
                    className="peel-btn mt-4 block w-full rounded-xl py-3 text-center text-sm font-bold"
                  >
                    Add {formatINR(shortBy)} more — browse stickers →
                  </HoverLink>
                ) : (
                  <HoverLink
                    href="/checkout"
                    onClick={closeCart}
                    className="peel-btn peel-btn--brand mt-4 block w-full rounded-xl py-3 text-center text-sm font-bold"
                  >
                    Checkout · {formatINR(subtotal)} + shipping & GST
                  </HoverLink>
                )}
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
