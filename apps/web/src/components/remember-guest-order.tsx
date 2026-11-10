"use client";

import { useEffect } from "react";

/** Saves a guest order's link key into this browser's cookie (see /api/orders/[id]/remember). */
export default function RememberGuestOrder({ orderId, linkKey }: { orderId: string; linkKey: string }) {
  useEffect(() => {
    fetch(`/api/orders/${orderId}/remember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: linkKey }),
    }).catch(() => {});
  }, [orderId, linkKey]);
  return null;
}
