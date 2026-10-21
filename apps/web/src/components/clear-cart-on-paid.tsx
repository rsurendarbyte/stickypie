"use client";

import { useEffect } from "react";
import { useCart } from "./cart-context";

/** Empties the cart exactly once after an order is confirmed paid. */
export default function ClearCartOnPaid({ orderId, paid }: { orderId: string; paid: boolean }) {
  const { clear } = useCart();

  useEffect(() => {
    if (!paid) return;
    const key = `stickypie.cleared.${orderId}`;
    try {
      if (!localStorage.getItem(key)) {
        clear();
        localStorage.setItem(key, "1");
      }
    } catch {
      clear();
    }
  }, [paid, orderId, clear]);

  return null;
}
