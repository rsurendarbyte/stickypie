"use client";

// Keeps a copy of the cart for the admin's Carts page (save_cart in Supabase).
// Runs in the background, straight to Supabase: the cart itself lives in this
// browser and works the same if a save fails. Only what the admin needs is
// sent, never what a shopper typed or made for a custom sticker.
import { authClient } from "./shopper-auth";
import type { CartItem } from "@/components/cart-context";

const TOKEN_KEY = "stickypie.cart.token";
const SENT_KEY = "stickypie.cart.sent";
const PLACED_KEY = "stickypie.cart.placed";
const WAIT_MS = 1500;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** This browser's cart id, sent with checkout to link the cart to its order. */
export function cartToken(): string | undefined {
  try {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) return saved;
    const token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return undefined;
  }
}

function toLines(items: CartItem[]) {
  return items.map((item) => ({
    id: item.productId,
    // A name sticker's name carries the shopper's own words after the " · ".
    name: item.customKind === "text" ? item.name.split(" · ")[0] : item.name,
    size: item.sizeLabel,
    qty: item.qty,
    price: item.price,
  }));
}

/** Once a visit, the shop notes roughly where this cart came from (see /api/cart-place). */
function notePlace(token: string) {
  if (sessionStorage.getItem(PLACED_KEY) === token) return;
  sessionStorage.setItem(PLACED_KEY, token);
  void fetch("/api/cart-place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    keepalive: true,
  }).catch(() => {});
}

async function send(lines: ReturnType<typeof toLines>, sent: string) {
  const token = cartToken();
  if (!token) return;
  const { data } = (await authClient()?.auth.getSession()) ?? {};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_cart`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY!,
      Authorization: `Bearer ${data?.session?.access_token ?? ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token, p_items: lines }),
    keepalive: true,
  });
  // Unsaved changes go again with the next change or page load.
  if (!res.ok) return;
  if (lines.length) {
    localStorage.setItem(SENT_KEY, sent);
    notePlace(token);
  } else {
    localStorage.removeItem(SENT_KEY);
    // emptying a cart deletes its row, so the next one needs noting again
    sessionStorage.removeItem(PLACED_KEY);
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let waiting: (() => void) | undefined;

function sendNow() {
  clearTimeout(timer);
  waiting?.();
  waiting = undefined;
}

/** Saves the cart shortly after it last changed. Never throws. */
export function syncCart(items: CartItem[]) {
  if (!SUPABASE_URL || !ANON_KEY) return;
  try {
    const lines = toLines(items);
    const sent = JSON.stringify(lines);
    const last = localStorage.getItem(SENT_KEY);
    // A shopper with nothing to show costs no request.
    if (lines.length ? sent === last : last === null) {
      clearTimeout(timer);
      waiting = undefined;
      return;
    }
    clearTimeout(timer);
    waiting = () => void send(lines, sent).catch(() => {});
    timer = setTimeout(sendNow, WAIT_MS);
  } catch {
    // storage may be unavailable; the admin copy just waits
  }
}

// Leaving or switching app must not lose the last change.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", sendNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendNow();
  });
}
