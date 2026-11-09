// StickyPie app service worker: lets phones install the shop as an app.
// It caches nothing (prices and stock always come fresh); a page that can't
// load while offline gets a small "you're offline" note instead of an error.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>StickyPie</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;text-align:center;color:#15161e"><div><p style="font-size:44px;margin:0">📶</p><h1 style="font-size:20px">You\'re offline</h1><p style="color:#667">Check your connection and try again.</p><button onclick="location.reload()" style="margin-top:8px;padding:12px 22px;border:0;border-radius:12px;background:#ffc93c;font-weight:700;font-size:15px">Try again</button></div>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
    )
  );
});
