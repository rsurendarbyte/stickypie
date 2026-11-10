// StickyPie app service worker: lets phones install the shop as an app, and
// makes going back (or coming back) instant even on a slow network or in
// Instagram's browser, which never keeps the previous page in memory:
// - the shop's code, styles and fonts (/_next/static, file names change with
//   every build, so a saved copy is always right) come from the phone;
// - shop pages show the phone's copy at once and fetch a fresh one behind it
//   for next time. Prices, stock and the cart always come live from the
//   database after the page shows, so a saved page never shows a stale price.
// Checkout, payment, orders, account and the API are never saved. A page that
// can't load while offline (and was never saved) gets a small "you're offline" note.
const PAGES = "sp-pages-v1";
const STATIC = "sp-static-v1";
const MAX_PAGES = 80;
const PRIVATE = /^\/(api|checkout|pay|order|account|print-job|j)(\/|$)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

const offline = () =>
  new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>StickyPie</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;text-align:center;color:#15161e"><div><p style="font-size:44px;margin:0">📶</p><h1 style="font-size:20px">You\'re offline</h1><p style="color:#667">Check your connection and try again.</p><button onclick="location.reload()" style="margin-top:8px;padding:12px 22px;border:0;border-radius:12px;background:#ffc93c;font-weight:700;font-size:15px">Try again</button></div>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

/** Keeps the page cache from growing for ever: drops the oldest saved pages. */
async function trim() {
  const cache = await caches.open(PAGES);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGES)).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // built files: the name changes with the content, so the saved copy is always right
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode !== "navigate" || PRIVATE.test(url.pathname)) {
    if (req.mode === "navigate") event.respondWith(fetch(req).catch(offline));
    return;
  }

  // a shop page: the saved copy at once (the address without ad tracking etc.),
  // a fresh one fetched behind it for next time
  const key = new Request(url.origin + url.pathname);
  event.respondWith(
    caches.open(PAGES).then(async (cache) => {
      const saved = await cache.match(key);
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected && (res.headers.get("content-type") ?? "").includes("text/html")) {
            cache.put(key, res.clone()).then(trim);
          }
          return res;
        })
        .catch(() => null);
      if (saved) {
        event.waitUntil(fresh);
        return saved;
      }
      return (await fresh) ?? offline();
    })
  );
});
