"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "./cart-context";
import { useCart } from "./cart-context";

/**
 * Quantity stepper bound to a cart line, so every surface showing the same
 * sticker (card, hero, detail page) edits one synced quantity. Styled like
 * QtyStepper — raised white keys — with a trash key at qty 1 (tap = remove).
 */
export default function CartStepper({
  item,
  size = "md",
  className = "",
}: {
  item: CartItem;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { setQty, remove } = useCart();
  const atMax = item.stock !== null && item.qty >= Math.min(item.stock, 99);
  const lg = size === "lg";
  const sm = size === "sm";
  const key = `grid place-items-center rounded-lg border border-line bg-ink text-snow shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition-all hover:border-brand/50 hover:text-brand active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${
    lg ? "size-10" : sm ? "size-7 rounded-md" : "size-8"
  }`;

  return (
    <div className={`inline-flex shrink-0 items-center ${className}`}>
      <button
        type="button"
        aria-label={item.qty === 1 ? "Remove from cart" : "Decrease quantity"}
        onClick={() =>
          item.qty === 1 ? remove(item.productId) : setQty(item.productId, item.qty - 1)
        }
        className={key}
      >
        {item.qty === 1 ? (
          <Trash2 className="size-4 text-brand" strokeWidth={2.25} />
        ) : (
          <Minus className="size-4" strokeWidth={2.5} />
        )}
      </button>
      <span
        className={`text-center font-bold tabular-nums ${
          lg ? "w-10 text-base" : sm ? "w-6 text-sm" : "w-9 text-[15px]"
        }`}
      >
        {item.qty}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={atMax}
        onClick={() => setQty(item.productId, item.qty + 1)}
        className={key}
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
