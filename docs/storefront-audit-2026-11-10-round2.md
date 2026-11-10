# Storefront audit, round 2 (2026-11-10, evening)

This round was read-only, run against `dev` at 7933ab0 and the live stickypie.in after today's deploy.
- `tsc` passes, and the production build passes.

"Checked" means I confirmed the finding myself: on the live site, or by reading the code. Round 1 is in `storefront-audit-2026-11-10.md`.

## What today's fixes achieved (verified)
- **Page weight:** first-load JS dropped from about 384 KB to about 290 KB per page (home 295 KB, poster 300 KB, checkout 285 KB, measured live).
  - supabase-js is in no page's first load.
  - The puzzle game is its own 5.5 KB chunk.
- **Payment retry:** it now needs the guest key. An order id alone gets a 404.
- **Order key:** `?k=` is stripped before the Meta pixel. Next keeps the stripped URL when the page starts. The referrer policy covers anything before that.
- **Puzzle round:** it can't be forged and the replay is correct. It is not proof that a person played (see #6).
- **Copy:** all 191 poster titles, every FAQ answer and the feed material (526 poster items, "Poster Paper") are correct.
- **Security headers:** sent on Worker pages and on the static files.
- **Invoice numbers:** the RPC is locked on both databases (checked: anon gets "permission denied", and the trigger runs as the database owner).
- **Puzzle game split:** nothing went missing (confetti, timer, hints and ticket are all there).

## Fix first

| # | Area | Finding | Where | Fix |
|---|------|---------|-------|-----|
| 1 | Security | **Plain HTTP is served.** `http://stickypie.in` returns 200 with no redirect, and there's no HSTS. Checkout can load over http, and guest order pages fall back to the sign-in wall because the guest cookie is https-only. *Checked live.* | Cloudflare zone setting | Turn on "Always Use HTTPS" in Cloudflare, then add an HSTS header. |
| 2 | Speed | **Built JS, CSS, fonts and icons are never cached** (`max-age=0, must-revalidate`). Every page open re-checks about 15 files: first visits, Instagram's in-app browser, iOS. The deploy script's `_headers` has no long-cache rule. This predates today. *Checked live.* | `scripts/deploy.mjs` | Add `/_next/static/*` immutable for 1 year, and icons for 1 day. |
| 3 | Regression (mine) | **A failed supabase-js download breaks sign-in until reload.** The failed import is kept forever, and the shopper sees a raw "Failed to fetch dynamically imported module". *Checked.* | `lib/shopper-auth.ts:28` | Clear `loading` on failure and show the normal network error. |
| 4 | Regression (mine) | **Admin "View as customer" → invoice saves the customer's order into the admin's browser cookie** (180 days). The order page checks for an admin; the invoice page doesn't. *Checked.* | `order/[id]/invoice/page.tsx:61` | Skip `RememberGuestOrder` when the viewer is an admin. |
| 5 | Accounts | **The 5-wrong-tries limit on sign-up codes can be raced.** It reads the count first and writes it afterwards. Parallel guesses can crack a code, giving an account on someone else's email that then claims their guest orders. *Checked.* | `lib/email-codes.ts:96-106` | One atomic `update … where attempts < 5 returning` (an RPC). |
| 6 | Money | **The puzzle prize is still effectively unlimited for guests.** A script can solve rounds, the prize cookie can be copied, and the "once per email/phone" rule only counts paid orders, with unverified guest details. The impact is mostly people reusing it with fresh emails. *Checked.* | `api/puzzle`, `api/checkout:378` | Business call: keep the percent small, or limit it to signed-in accounts, or record used phones/rounds. |
| 7 | Puzzle UX | **Real solvers can be told "The 10% offer has ended".** Any failed claim shows that message: a slow network that missed the round, a timeout, a 400. Add to cart is hidden too. *Checked.* | `components/puzzle-game.tsx:262,483` | Show "ended" only for a 410. Otherwise retry, or show "Couldn't unlock, try again". |
| 8 | Content / SEO | **178 of 191 mini poster descriptions (and 4 wall sets) say "for your car, bike, laptop, bottle, fridge or wall".** These come from the database and feed the meta description, JSON-LD, the Merchant feed (370 lines) and llms.txt. Poster tags car/bike/laptop also become JSON-LD keywords. *Checked live.* | database `products.description`, `seo.ts` keywords | A script to rewrite the descriptions and filter those tags out of keywords. |
| 9 | Content / SEO | **`/car-stickers`, `/bike-stickers`, `/laptop-stickers` and `/helmet-stickers` list mini posters** (9–12 links each) under "Die-Cut Vinyl Car Decals". *Checked live.* | `lib/surfaces.ts:505`, `app/[surface]/page.tsx:67` | Leave posters out of the sticker surface pages. |
| 10 | Content | **Every poster page still sends the old "vinyl sticker" About block to the browser** ("Premium vinyl, peel and stick", "Sticks on cars…"). It's dead code, but crawlers and LLMs can read it. *Checked.* | `sticker/[slug]/page.tsx:141`, `seo.ts:79-93` | Delete the sticker branch. |

## Next

**Security**
- **Open redirect after sign-in:** `/account?next=/\evil.com` lands a signed-in shopper on another site. *Checked* (`account-client.tsx:38`). Fix: compare origins with `new URL`.
- **`?fb=` feedback token reaches Meta:** it isn't stripped like `?k=` is. Strip `fb`, and auth params on every path.
- **Remember endpoint:** a cross-site form could fill a shopper's guest cookie with someone else's orders. Require JSON content-type and same-origin.
- `claimGuestOrders` doesn't escape `*`. This is harmless while public sign-up stays off (it's off on both projects).
- **Still open from round 1:**
  - no rate limits (own-poster upload, contact, sign-up codes);
  - secrets keyed on the service-role key;
  - public photo buckets;
  - review photos trust the browser's file type;
  - `save_cart` is open to anyone;
  - no request size cap;
  - wall stock is checked only against 0.

**Speed**
- **A saved old page can't load the new lazy chunks after a deploy** (service worker + lazy imports). Reload once when a chunk fails to load, or version the service worker.
- **zod (about 25 KB) loads on every page:** the shared package exports its schemas from the index. Use a separate `./schemas` import.
- **About 105 KB of logo/icon preloads go before the poster image:** the logo is 960 px for a 149 px slot, and `icon-192.png` is 50 KB.
- **A tab that was a guest misses a sign-in made in another tab** (regression, mine). Listen for `storage` events.
- Drop `code=` from the auth URL check (it loads 63 KB for nothing).
- **Still open from round 1:**
  - the whole catalogue downloads (reviews could at least get a column list);
  - hero timers keep running off screen;
  - the tap canvas resizes as the address bar moves;
  - Pay makes serial calls;
  - blurs on mid-range phones;
  - safe-area padding does nothing (no `viewportFit`);
  - small tap targets.

**SEO / Merchant**
- **GST:** prices in the feed and JSON-LD don't include 18% GST. This risks Merchant price-mismatch rejections.
- **Permanent sale prices:** posters 150 → 60, walls 449 → 145, always. Merchant may treat a sale that never ends as misleading.
- **Wrong HSN code:** posters are invoiced under the sticker HSN (3919). Paper posters are normally 4911. Check with your accountant.
- **Wrong design count:** the home FAQ says "318 die-cut vinyl sticker designs", but that count includes the posters.
- **Puzzle variant page:** its JSON-LD carries wall-poster prices.
- **Offer names:** they say "6 inch" for 4×6 posters.
- **llms.txt:** it says "Mini Posters stickers".
- The feed, sitemap and llms.txt only update on deploy (`force-static`).
- Small items: `/order/<bad id>` returns 200; `/puzzle` is noindex with a canonical; empty shipping rates give Infinity.

**Robustness and accessibility (still open)**
- The error page shows the raw message, and there's no `global-error.tsx`.
- Overlays don't move or trap focus.
- Checkout errors aren't linked to their fields.
- Pinch zoom is off.
- The iPhone install card shows in the Google app, where Add to Home Screen isn't available (exclude `GSA`).
