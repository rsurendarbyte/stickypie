"use client";

import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { formatINR, priceForSize } from "@stickypie/shared";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import { defaultSize, toCartProduct } from "./size-picker";

export default function AddToCartButton({
  product,
  qty = 1,
  size = "md",
  stickerSize,
  className = "",
}: {
  product: Product;
  qty?: number;
  size?: "md" | "lg";
  /** Chosen sticker size (inches); defaults to the lowest-priced size. */
  stickerSize?: number | null;
  className?: string;
}) {
  const { add, items } = useCart();
  const out = product.stock === 0;
  const chosen = stickerSize === undefined ? defaultSize(product) : stickerSize;
  const price = priceForSize(product, chosen)?.price ?? product.price;
  const inCart = items.find((item) => lineKey(item) === lineKey({ productId: product.id, size: chosen }));

  // Already in the cart → the button becomes the synced quantity stepper.
  if (inCart && !out) {
    return (
      <div className={`inline-flex flex-wrap items-center gap-3 ${className}`}>
        <CartStepper item={inCart} size={size} />
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
    if (out) return;
    add(toCartProduct(product, chosen, price), qty);
  }

  const sizing =
    size === "lg" ? "h-12 px-7 text-base rounded-xl" : "h-10 px-5 text-sm rounded-lg";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={out}
      className={`inline-flex items-center justify-center gap-2 font-semibold text-white transition-all duration-200 ${
        out
          ? "cursor-not-allowed bg-panel text-fog"
          : "pie-gradient shadow-lg shadow-brand/25 hover:brightness-110 active:scale-95"
      } ${sizing} ${className}`}
    >
      {out ? (
        "Out of stock"
      ) : (
        <>
          <ShoppingBag className="size-5" /> Add to cart
        </>
      )}
    </button>
  );
}
