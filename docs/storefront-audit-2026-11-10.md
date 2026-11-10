# Storefront audit (apps/web), 2026-11-10

This audit was read-only, on the `dev` branch. Nothing was changed or deployed.
- `tsc` passes with 0 errors.
- `npm run build` passes.
- Nearly every route is static or prebuilt.

"Checked" means the code was read to confirm the finding. "Plausible" means the code points that way, but it wasn't proven.

## Fix first

| # | Area | Finding | Where | Fix |
|---|------|---------|-------|-----|
| 1 | Money | The puzzle prize is given out without a solve. `POST /api/puzzle` sets the prize cookie, and the cookie can be shared. The "once per phone/email" rule only checks paid orders, and guest email and phone aren't verified. So a guest gets the admin's prize percent (up to 50%) off puzzle posters on every order. *Checked.* | `api/puzzle/route.ts:11`, `api/checkout/route.ts:375` | Tie the prize to a server-checked game session (signed puzzle id + minimum solve time). Cap the percent. |
| 2 | Privacy | The guest order key leaks to Meta. The pixel runs on every page, including `/order/<id>?k=…`, and sends the full URL. That key opens the shopper's address and phone. *Checked.* | `layout.tsx:106` | Don't load the pixel on `/order`, `/account`, `/pay`, `/print-job`. Add a `Referrer-Policy` header. |
| 3 | Privacy | `pay/retry` doesn't check who owns a guest order. Anyone with the order id gets the payment session and the name, email and phone. *Checked.* | `api/pay/retry/route.ts:24` | When the order has no `userId`, require `holdsGuestOrder(order)`. |
| 4 | Accounts | If public sign-up is on in Supabase Auth, someone can create an account on a shopper's email without the 6-digit code, then claim that shopper's guest orders. *Plausible: depends on a dashboard setting.* | `api/account/claim-orders/route.ts:13` | Turn off "Allow new users to sign up" on both Supabase projects. Admin-API account creation keeps working. |
| 5 | SEO / Google | Commit 3779c0f removed the Sticker option for mini posters, but the SEO copy still offers "vinyl sticker". This is in about 189 titles, meta descriptions, FAQ JSON-LD, llms.txt, and the Merchant feed (`g:material` "Poster Paper or Vinyl"). *Checked.* | `lib/seo.ts:36,49,132,195,301,518`; `lib/surfaces.ts:225,322,326,350,469`; `feeds/google.xml/route.ts:60` | Change to "wall poster or puzzle poster" and "Poster Paper". |
| 6 | Speed | supabase-js (64 KB compressed, the largest chunk) loads on every page for guests too, through nav, the tab bar and auth-sync in the layout. *Checked.* | `lib/shopper-auth.ts:7` | Read the saved session from localStorage first. Load supabase-js with `import()` only when signed in or when sign-in opens. |
| 7 | Speed | The whole catalogue goes to the phone: `products?select=*`, 462 rows, 169 KB compressed. If `catalog_version` is bumped on stock changes, every sale makes every returning visitor download it again. *Checked.* | `lib/live-catalog.ts:122` | Select only the list columns (drop description, trim tags). Fetch stock separately. |
| 8 | Speed | The puzzle game (28 KB compressed) is imported into every page. *Checked.* | `components/puzzle-launcher.tsx:7` | Load it with `next/dynamic` on first launch, and preload when idle. |
| 9 | Deploys | The service worker never updates: same file, fixed cache names. The code cache is never trimmed. A saved page can point at deleted code files after a deploy, and the version-check reload can get the same old page again. *Checked (structure); the race is plausible.* | `public/sw.js:11-12,47-85`, `version-check.tsx:36` | Stamp BUILD_ID into sw.js at deploy and delete old caches on activate. Make the version reload bypass the saved page. |
| 10 | Server CPU | About 870 pages use `revalidate = 600`. Each sticker-page refresh makes 7–8 Supabase calls one after another, including all approved reviews and the product fetched twice. That risks free-plan CPU errors. Prices and stock already load live in the browser. *Plausible.* | `sticker/[slug]/page.tsx:29,42-104`, `stickers/[category]/page.tsx:41,61` | Use `revalidate = 86400` (or an admin-triggered refresh). Wrap driver calls in `cache()` and run them with `Promise.all`. |

## Next

**Security and abuse**
- `next_invoice_number()` is callable with the public anon key and never revoked, so anyone can burn GST invoice numbers. Checked. Fix: `revoke execute … from public, anon, authenticated`.
- No rate limit or bot check on own-poster upload (5 MB to a public bucket, never cleaned up), contact or sign-up-code emails. A script could use up the about 100/day email quota. Fix: Turnstile + Cloudflare rate limits, and a sweep for unused uploads.
- The 5-wrong-tries limit on sign-up codes is read-then-write, so it can be raced (`lib/email-codes.ts:92`). Fix: one atomic `update … where attempts < 5 returning`.
- Checkout still accepts `finish: "sticker"` for mini posters (`packages/shared/src/schemas.ts:90`).
- No security headers on prod (`next.config.ts:14`). Add `frame-ancestors 'none'`, `nosniff` and `Referrer-Policy`.
- Guest keys, puzzle cookies and code hashes are all signed with `SUPABASE_SERVICE_ROLE_KEY`, falling back to `""` if it's unset. Rotating that key breaks every guest link. Use a separate `LINK_SECRET` and refuse to run without it.
- Lower priority:
  - customer photos stay in public buckets forever;
  - review photos trust the browser's file type;
  - `save_cart` lets anyone write fake carts;
  - wall stock isn't checked against the quantity;
  - zod 3.25 has a high advisory (cap the request size at about 64 KB before parsing);
  - the payment simulator may be open on dev if the dev Worker has no gateway keys.

**SEO / Google Merchant**
- Feed and JSON-LD prices don't include GST. Google may want tax-inclusive prices outside the US and Canada. Plausible.
- The feed and sitemap are `force-static`, so price and stock changes and new posters wait for a deploy. Add `revalidate = 3600`.
- `/sticker/x/puzzle` carries the wall-poster price in its JSON-LD. `/puzzle/[slug]` is noindex but also sets a canonical.

**Mobile**
- Safe-area padding (about 16 files) does nothing on iPhone, because the viewport has no `viewportFit: "cover"` (`layout.tsx:80`). Checked.
- The hero keeps changing slides and measuring peels while scrolled out of view (`hero.tsx:130-140,661-688`).
- The full-screen tap canvas resizes (about 10 MB) when the address bar hides while scrolling (`cursor-trail.tsx`).
- Mid-range Androids, which aren't in lite mode, still get blurs in the hero, the header cart button, the card ruler and `.poster-tape`.
- Pay runs about 15 serial Supabase calls and reads settings 3 times (`api/checkout/route.ts`).
- On sticker pages the poster image isn't high priority, while about 105 KB of logo and icon preloads go before it.
- Pinch zoom is off on purpose (`layout.tsx:84`). It's an accessibility and Lighthouse hit. If it's turned back on, inputs need 16 px text.
- Smaller items:
  - the State field can't be autofilled;
  - the card ruler (28 px) and the header cart (36 px) are small tap targets;
  - "What's inside" loads 480 px thumbnails into 80 px tiles.

**Robustness and accessibility**
- `app/error.tsx` shows the raw `error.message`, and there's no `global-error.tsx`.
- Overlays (puzzle, zoom, cart drawer, swipe view) don't move or trap keyboard focus.
- Checkout field errors aren't linked to their inputs (`aria-invalid` / `aria-describedby`).

## Checked and fine
- **Prices:** every line is re-priced on the server, along with shipping, GST and the minimum order.
- **Payments:**
  - only a check against the gateway's own API marks an order paid (amount + INR);
  - the webhooks check their signatures in constant time and reject everything when the secret is unset;
  - the simulator can't be reached on prod.
- **Order and invoice pages:** they need the owner, the 128-bit guest key or an admin. Print-job tokens are random and show no customer details.
- **Database security:** row security is on for all 14 tables, and orders can be read only by their owner or an admin.
- **Secrets:** no secrets are in git or the bundle. `NEXT_PUBLIC_` holds only public values.
- **Service worker:** it never caches `/api`, `/checkout`, `/pay`, `/order`, `/account` or `/print-job`.
- **Indexing per environment:** dev is noindex (meta, header and `_headers`). No dev host leaks into prod. Canonicals, 404s and thin-category noindex are correct.
- **Content rules:** no waterproof or UV, no pie wording, and no GSM in shopper copy. The only exception is the demo-only `seed-data.json`.
- **Checkout inputs:** correct types and autocomplete, and the mobile buy bar is always on screen.
