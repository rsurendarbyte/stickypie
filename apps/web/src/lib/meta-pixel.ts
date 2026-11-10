// Meta (Facebook / Instagram) pixel, for ads: tells Meta which ads lead to
// views, carts and paid orders so it can optimise for sales.
//
// Off unless NEXT_PUBLIC_META_PIXEL_ID is set — it's only set in the
// production env file, so dev and local builds never send events. The script
// loads straight from Meta (connect.facebook.net), not through our Worker.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/**
 * Runs in <head> before the pixel and before the app starts: a guest order link
 * (/order/<id>?k=…) loses its ?k from the address bar, so Meta (which sends the
 * full page URL with every event) never receives the key that opens the order.
 * The page was already drawn with the key, and RememberGuestOrder keeps it in
 * this browser's cookie so a reload still opens the order.
 */
export const PRIVATE_URL_SCRIPT = `(function(){try{var l=location;if(!/^\\/order\\//.test(l.pathname))return;var q=new URLSearchParams(l.search);if(!q.has("k"))return;q.delete("k");var s=q.toString();history.replaceState(history.state,"",l.pathname+(s?"?"+s:"")+l.hash)}catch(e){}})();`;

/** Pages whose address itself is a secret (print-job token, password-reset link): no pixel at all. */
const NO_PIXEL_PATHS = "^\\/(print-job|account\\/reset|pay\\/simulator)(\\/|$)";

/** Meta's standard loader, then a PageView for the page that loaded it. */
export const META_PIXEL_SCRIPT = META_PIXEL_ID
  ? `if(!new RegExp(${JSON.stringify(NO_PIXEL_PATHS)}).test(location.pathname))!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(
      META_PIXEL_ID
    )});fbq('track','PageView');`
  : "";

type Fbq = (command: "track", event: string, params?: Record<string, unknown>, options?: { eventID: string }) => void;

/**
 * Sends a standard event (ViewContent, AddToCart, InitiateCheckout, Purchase).
 * `eventId` lets Meta drop a duplicate if the same event is also sent from
 * the server later (Conversions API).
 */
export function trackMeta(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (!fbq) return;
  try {
    fbq("track", event, params, eventId ? { eventID: eventId } : undefined);
  } catch {
    // ad tracking must never break the shop
  }
}

/** Sends `event` once per key in this browser (e.g. one Purchase per order). */
export function trackMetaOnce(key: string, event: string, params?: Record<string, unknown>, eventId?: string) {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  const storeKey = `stickypie.meta.${key}`;
  try {
    if (localStorage.getItem(storeKey)) return;
    localStorage.setItem(storeKey, "1");
  } catch {
    // storage blocked: send it anyway (rare double count beats none)
  }
  trackMeta(event, params, eventId);
}
