"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { belowMinimum, formatINR } from "@stickypie/shared";
import { useStoreSettings } from "@/lib/live-catalog";
import { lineKey, useCart } from "./cart-context";
import QtyStepper from "./qty-stepper";

export default function CartDrawer() {
  const { items, count, subtotal, isOpen, closeCart, setQty, remove } = useCart();
  const settings = useStoreSettings();
  const shortBy = belowMinimum(settings, subtotal);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={closeCart}
        className={`absolute inset-0 bg-snow/35 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-ink2 shadow-2xl ring-1 ring-line transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
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
              <p className="font-display text-lg font-semibold">Nothing sticky yet</p>
              <p className="mt-1 text-sm text-fog">Your cart is empty. Let&apos;s fix that.</p>
            </div>
            <Link
              href="/stickers"
              onClick={closeCart}
              className="pie-gradient rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
            >
              Browse stickers
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {items.map((item) => {
                return (
                  <li key={lineKey(item)} className="flex gap-3">
                    <Link
                      href={`/sticker/${item.slug}`}
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
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/sticker/${item.slug}`}
                          onClick={closeCart}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
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
                          <span className="font-medium text-snow/80">{item.size}″ · </span>
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

            <div className="border-t border-line px-5 py-4">
              {shortBy === 0 ? (
                <p className="flex items-center gap-2 text-xs font-medium text-mint">
                  <CheckCircle2 className="size-4" /> Minimum order reached — you can check out
                </p>
              ) : (
                <div>
                  <p className="flex items-center gap-2 text-xs text-fog">
                    <Truck className="size-4" />
                    Add <span className="font-semibold text-snow">{formatINR(shortBy)}</span> more
                    to reach the {formatINR(settings.minOrder)} minimum order
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
              </div>

              {shortBy > 0 ? (
                <Link
                  href="/stickers"
                  onClick={closeCart}
                  className="mt-4 block w-full rounded-xl bg-snow py-3 text-center text-sm font-bold text-white shadow-lg shadow-black/10 transition-all hover:bg-snow/90"
                >
                  Add {formatINR(shortBy)} more — browse stickers →
                </Link>
              ) : (
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="pie-gradient mt-4 block w-full rounded-xl py-3 text-center text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
                >
                  Checkout · {formatINR(subtotal)} + shipping
                </Link>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
