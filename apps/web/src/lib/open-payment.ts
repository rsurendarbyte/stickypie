"use client";

import { SHOP_THEME } from "@stickypie/shared";

// Opens the gateway's payment screen for what /api/checkout or /api/pay/retry
// returned. Cashfree redirects to its hosted page; Razorpay opens its modal
// here, then the result is verified on our server before showing the order.

type Session =
  | { mode: "cashfree"; cfMode: "sandbox" | "production"; paymentSessionId: string }
  | {
      mode: "razorpay";
      keyId: string;
      rzpOrderId: string;
      orderId: string;
      amount: number;
      prefill: { name: string; email: string; contact: string };
      timeout: number;
    }
  | { mode: "paid" | "simulator"; url: string };

type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let razorpayScript: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  razorpayScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      razorpayScript = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return razorpayScript;
}

/**
 * Starts payment. `onClosed` runs if the shopper closes the Razorpay window
 * without paying (Cashfree instead returns them to the order page).
 */
export async function openPayment(
  session: Session,
  go: (url: string) => void,
  onClosed: (orderId: string) => void
): Promise<void> {
  if (session.mode === "cashfree") {
    const { load } = await import("@cashfreepayments/cashfree-js");
    const cashfree = await load({ mode: session.cfMode });
    await cashfree.checkout({ paymentSessionId: session.paymentSessionId, redirectTarget: "_self" });
    return;
  }
  if (session.mode !== "razorpay") {
    go(session.url);
    return;
  }

  await loadRazorpay();
  const orderUrl = `/order/${session.orderId}`;
  const rzp = new window.Razorpay!({
    key: session.keyId,
    order_id: session.rzpOrderId,
    amount: session.amount,
    currency: "INR",
    name: "StickyPie",
    description: "Sticker order",
    image: `${location.origin}/icons/icon-192.png`,
    prefill: session.prefill,
    theme: { color: SHOP_THEME.brand },
    timeout: session.timeout,
    retry: { enabled: true },
    // UPI, cards, netbanking and wallets only — no EMI / pay-later for small
    // orders. International cards are refused by the Razorpay account itself.
    method: { emi: false, cardless_emi: false, paylater: false },
    handler: async (result: RazorpayResult) => {
      // Paid at Razorpay — confirm on our server, then show the order.
      await fetch("/api/pay/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: session.orderId, ...result }),
      }).catch(() => {});
      window.location.assign(orderUrl);
    },
    modal: {
      ondismiss: () => onClosed(session.orderId),
      confirm_close: true,
    },
  });
  rzp.open();
}
