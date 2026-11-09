"use client";

import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { formatINR, priceForSize, withFinish } from "@stickypie/shared";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import { defaultSize, toCartProduct, useLineFinish } from "./size-picker";
import { useWallLine } from "@/lib/wall-picks";

export default function AddToCartButton({
  product,
  qty = 1,
  size = "md",
  stickerSize,
  sticker = false,
  showPrice = false,
  className = "",
}: {
  product: Product;
  qty?: number;
  size?: "md" | "lg";
  /** Chosen sticker size (inches); defaults to the lowest-priced size. */
  stickerSize?: number | null;
  /** Sticker-style button (yellow, white die-cut edge, corner peel on hover). */
  sticker?: boolean;
  /** "Add to cart · ₹80" — keeps the price right next to the action. */
  showPrice?: boolean;
  className?: string;
}) {
  const { add, items } = useCart();
  const out = product.stock === 0;
  const finish = useLineFinish(product);
  const chosen = stickerSize === undefined ? defaultSize(product) : stickerSize;
  const price = priceForSize(withFinish(product, finish), chosen)?.price ?? product.price;
  const { gaps, line } = useWallLine(product, price);
  const inCart = items.find((item) => lineKey(item) === lineKey(line ?? { productId: product.id, size: chosen, finish }));

  // Already in the cart → the button becomes the synced quantity stepper.
  if (inCart && !out) {
    return (
      <div className={`inline-flex flex-wrap items-center gap-3 ${className}`}>
        <CartStepper item={inCart} size={size} sticker={sticker} />
        <span
          className={`inline-flex items-center gap-1.5 font-semibold text-mint ${
            size === "lg" ? "text-base" : "text-sm"
          }`}
        >
          <Check className="size-5" strokeWidth={2.75} /> In cart ·{" "}
          {formatINR(inCart.qty * inCart.price)}
        </span>
      </div>
    );
  }

  function onClick() {
    if (out || gaps) return;
    add(line ?? toCartProduct(product, chosen, price), qty);
  }

  const sizing =
    size === "lg" ? "h-12 px-7 text-base rounded-xl" : "h-10 px-5 text-sm rounded-lg";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={out || gaps > 0}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 ${
        out || gaps
          ? "cursor-not-allowed bg-panel font-semibold text-fog"
          : sticker
            ? "peel-btn font-bold"
            : "peel-btn peel-btn--brand font-bold"
      } ${sizing} ${className}`}
    >
      {out ? (
        "Out of stock"
      ) : gaps ? (
        `Fill ${gaps} empty ${gaps === 1 ? "spot" : "spots"}`
      ) : (
        <>
          <ShoppingBag className={`size-5 ${sticker ? "peel-icon" : ""}`} /> Add to cart
          {showPrice && <span className="tabular-nums">· {formatINR(price)}</span>}
        </>
      )}
    </button>
  );
}
