"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { formatINR } from "@stickypie/shared";
import AddToCartButton from "./add-to-cart-button";
import { useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import QtyStepper from "./qty-stepper";

export default function ProductPurchase({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const { add, count, items } = useCart();
  const out = product.stock === 0;
  const inCart = items.find((item) => item.productId === product.id);

  function addNow() {
    if (out) return;
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.stock,
      },
      qty
    );
  }

  return (
    <>
      {/* Desktop: inline controls (the button swaps to a synced stepper once in cart) */}
      <div className="mt-5 hidden flex-wrap items-center gap-3 lg:flex">
        {!out && !inCart && <QtyStepper value={qty} onChange={setQty} max={product.stock} />}
        <AddToCartButton product={product} qty={qty} size="lg" />
      </div>

      {/* Mobile: buy bar pinned to the bottom (above the cart strip when it's showing) */}
      <div
        className={`fixed inset-x-0 z-40 border-t border-line bg-ink/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.18)] backdrop-blur-md lg:hidden ${
          count > 0
            ? "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-3 sm:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]"
            : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {inCart && !out ? (
          <div className="flex items-center justify-between gap-3">
            <CartStepper item={inCart} />
            <span className="flex items-center gap-1.5 text-sm font-bold text-mint">
              <Check className="size-4" strokeWidth={3} /> In cart ·{" "}
              {formatINR(inCart.qty * inCart.price)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {!out && <QtyStepper value={qty} onChange={setQty} max={product.stock} />}
            <button
              type="button"
              onClick={addNow}
              disabled={out}
              aria-label={out ? "Out of stock" : `Add ${qty} to cart`}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${
                out
                  ? "cursor-not-allowed bg-panel text-fog/60"
                  : "pie-gradient text-white shadow-lg shadow-brand/25 active:scale-[0.98]"
              }`}
            >
              {out ? (
                "Out of stock"
              ) : (
                <>
                  <ShoppingBag className="size-4" /> Add to cart ·{" "}
                  {formatINR(product.price * qty)}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
