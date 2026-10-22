"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "./cart-context";
import { lineKey, useCart } from "./cart-context";

/**
 * Quantity stepper bound to a cart line, so every surface showing the same
 * sticker (card, hero, detail page) edits one synced quantity. Styled like
 * QtyStepper — raised white keys — with a trash key at qty 1 (tap = remove).
 */
export default function CartStepper({
  item,
  size = "md",
  sticker = false,
  className = "",
}: {
  item: CartItem;
  size?: "sm" | "md" | "lg";
  /** Yellow sticker pill (white die-cut edge) to match the sticker buttons. */
  sticker?: boolean;
  className?: string;
}) {
  const { setQty, remove, items } = useCart();
  const key = lineKey(item);
  // Stock is shared by every size of the sticker.
  const inOtherSizes = items
    .filter((other) => other.productId === item.productId && lineKey(other) !== key)
    .reduce((sum, other) => sum + other.qty, 0);
  const atMax = item.stock !== null && item.qty + inOtherSizes >= Math.min(item.stock, 99);
  const lg = size === "lg";
  const sm = size === "sm";
  const keyClass = sticker
    ? `grid place-items-center rounded-full bg-white/70 text-[#3a2a00] transition-all hover:bg-white active:scale-90 disabled:pointer-events-none disabled:opacity-35 ${
        lg ? "size-9" : sm ? "size-7" : "size-8"
      }`
    : `grid place-items-center rounded-lg border border-line bg-ink text-snow shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition-all hover:border-brand/50 hover:text-brand active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${
        lg ? "size-10" : sm ? "size-7 rounded-md" : "size-8"
      }`;

  return (
    <div className={`inline-flex shrink-0 items-center ${sticker ? "sticker-pill" : ""} ${className}`}>
      <button
        type="button"
        aria-label={item.qty === 1 ? "Remove from cart" : "Decrease quantity"}
        onClick={() => (item.qty === 1 ? remove(key) : setQty(key, item.qty - 1))}
        className={keyClass}
      >
        {item.qty === 1 ? (
          <Trash2 className={`size-4 ${sticker ? "text-[#b42318]" : "text-brand"}`} strokeWidth={2.25} />
        ) : (
          <Minus className="size-4" strokeWidth={2.5} />
        )}
      </button>
      <span
        className={`text-center font-bold tabular-nums ${sticker ? "text-[#3a2a00]" : ""} ${
          lg ? "w-10 text-base" : sm ? "w-6 text-sm" : "w-9 text-[15px]"
        }`}
      >
        {item.qty}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={atMax}
        onClick={() => setQty(key, item.qty + 1)}
        className={keyClass}
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
