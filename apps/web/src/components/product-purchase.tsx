"use client";

import { Check, RotateCcw, ShoppingBag } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { formatINR } from "@stickypie/shared";
import AddToCartButton from "./add-to-cart-button";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import { toCartProduct, useLineFinish } from "./size-picker";
import { WallReset } from "./wall-size-map";
import { useWallLine } from "@/lib/wall-picks";

export default function ProductPurchase({
  product,
  stickerSize,
  price,
}: {
  product: Product;
  /** Size picked on the product page (null for single-size stickers). */
  stickerSize: number | null;
  price: number;
}) {
  const { add, count, items } = useCart();
  const out = product.stock === 0;
  const finish = useLineFinish(product);
  const { posters: picks, gaps, line } = useWallLine(product, price);
  const inCart = items.find(
    (item) => lineKey(item) === lineKey(line ?? { productId: product.id, size: stickerSize, finish })
  );

  function addNow() {
    if (out || gaps) return;
    add(line ?? toCartProduct(product, stickerSize, price), 1);
  }

  // A changed wall: the way back sits by the buy button, so it reads as a custom order.
  const resetWall = (height: string) =>
    picks && (
      <WallReset product={product} price={price} className={`peel-btn peel-btn--warn inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold ${height}`}>
        <RotateCcw className="size-3.5" strokeWidth={2.5} /> Reset wall
      </WallReset>
    );

  return (
    <>
      {/* Desktop: inline controls (the button swaps to a synced stepper once in cart) */}
      <div className="mt-4 hidden flex-wrap items-center gap-3 lg:flex">
        {/* One control: Add to cart, which becomes the − / + stepper once added */}
        <AddToCartButton product={product} size="lg" stickerSize={stickerSize} sticker showPrice />
        {resetWall("h-12")}
      </div>

      {/* Mobile: buy bar pinned to the bottom (above the cart strip when it's showing) */}
      <div
        className={`fixed inset-x-0 z-40 border-t border-line bg-ink/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.18)] lg:hidden ${
          count > 0
            ? "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] pb-3 sm:bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]"
            : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {inCart && !out ? (
          <div className="flex items-center justify-between gap-2">
            <CartStepper item={inCart} sticker />
            <span className="flex items-center gap-1.5 text-sm font-bold whitespace-nowrap text-mint">
              <Check className="size-4" strokeWidth={3} /> In cart ·{" "}
              {formatINR(inCart.qty * inCart.price)}
            </span>
            {resetWall("h-11")}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addNow}
              disabled={out || gaps > 0}
              aria-label={out ? "Out of stock" : "Add to cart"}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${
                out || gaps
                  ? "cursor-not-allowed bg-panel text-fog/60"
                  : "peel-btn"
              }`}
            >
              {out ? (
                "Out of stock"
              ) : gaps ? (
                `Fill ${gaps} empty ${gaps === 1 ? "spot" : "spots"}`
              ) : (
                <>
                  <ShoppingBag className="peel-icon size-4" /> Add to cart ·{" "}
                  {formatINR(price)}
                </>
              )}
            </button>
            {resetWall("h-11")}
          </div>
        )}
      </div>
    </>
  );
}
