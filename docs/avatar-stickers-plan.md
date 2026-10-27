> **Update 2026-10-27 (pricing):** one sheet per picked style; the shopper picks at least the minimum (admin, default 4) and can pick more. Price is per sheet (default ₹300, so 4 sheets = ₹1,200). `avatarBook.pages` = minimum sheets, `avatarBook.price` = price per sheet.

> **Update 2026-10-27 (later):** shopper and admin wording now says "sticker sheets", not "book": one sheet per picked style (code names like `avatarBook` / `pages` are unchanged).

> **Update 2026-10-27:** it's now a sticker book, not packs. Admin sets pages (default 4) and one book price (default ₹1200). The shopper picks exactly one trending style per page (90s retro, anime, action figure…); the styles and their sample images are managed in admin → Avatar book. Books skip the ₹900 minimum order.

> **Decision (user, 2026-10-27):** no AI runs on the site itself. Shopper picks styles and uploads a photo, then pays; the photo uploads after payment, the same as custom. The team generates the stickers with AI tools outside the site and uploads the finished pages in admin. Shopper-facing copy says the stickers are AI-generated (not hand-drawn). The on-site AI sections below are parked.

# Avatar stickers: plan (draft, nothing built yet)

Shopper uploads a selfie, picks interests/styles, gets a set of personalised sticker avatars, shares them, and orders them as die-cut vinyl.

## What already exists (we reuse it)
- **Custom makers** (`/custom-stickers/design`, `/name-stickers`, `/qr-code-stickers`): a builder page, then `CustomBookBar` pinned at the bottom on phones, then a cart line with id `custom:<ref>` and `customKind` + `customSpec`, then checkout prices it from per-size prices in `store_settings`.
- **Uploaded design flow**: artwork stays in the shopper's browser (IndexedDB, key `custom-art:<ref>`) until payment. After payment the order page uploads it (`POST /api/orders/[id]/custom-file`, Supabase bucket `custom-stickers`). Uploads are only allowed while the order is `paid`.
- **Admin order view** shows the custom file, or draws the print file from `customSpec` (QR/name), with a download button.
- **Feature flags** (`packages/shared/src/features.ts`) so the new product can be switched on/off from admin.

## Proposed flow (phone first)
1. `/avatar-stickers`: the hero says "Turn your selfie into stickers". There's one big **Upload selfie** button and a camera option.
2. A consent tick: "This is my photo, I'm 18+ (or a parent uploading for their child)".
3. Pick up to 3 interests as chips (Cricket, Gaming, Anime style, Travel, Coding, Music, Festive, Bike/Car, Gym, Chai).
4. Tap **Make my stickers**. The browser shrinks the photo (about 1024px, using the existing `shrink-image.ts`) and sends it to our Worker `/api/avatar/generate`. The Worker calls the AI provider and returns 4 stickers. The photo is never saved by us.
5. Previews (watermarked) show in a swipe grid, with share buttons: WhatsApp, Instagram story image (a 1080×1920 card made in the browser), and a share link.
6. Pick stickers and a size, then Add / Book now. This is the same `CustomBookBar` and cart line (`customKind: "avatar"`).
7. **After payment**, the same as custom: the order page uploads the clean high-res PNG of each chosen sticker to the bucket, and admin downloads it for printing.

### "After payment only, same as custom": yes
- Before payment, nothing is stored on our server. The generated stickers come back to the phone and sit in IndexedDB, exactly like custom art.
- The one difference is that to make a preview, the photo has to go to the AI company (through our Worker) before payment. There's no way around that. We pick a provider that doesn't train on API data, and we say so in the consent line.
- After payment, only the chosen sticker PNGs are uploaded (not the selfie). They're kept for 90 days after delivery, then auto-deleted.

## Cost (prices from fal.ai pages, Oct 2026; check before launch)
| Model | Per image | Set of 4 | Notes |
|---|---|---|---|
| FLUX.1 Kontext pro | ~$0.04 | ~₹14 | good likeness, cheap |
| Seedream 5 Lite | ~$0.035 | ~₹12 | cheapest |
| Nano Banana 2 (Gemini Flash Image) | ~$0.06–0.08 | ~₹20–27 | best likeness + sticker style |
| Nano Banana Pro | ~$0.15 | ~₹50 | top quality |
| GPT Image 2 edit | ~$0.22 | ~₹75 | too costly per preview |

Upscaling for 6″/7″ prints (1024px → 2048px+) costs about $0.01–0.02 per printed sticker and is done only after payment.

**Risk:** every preview costs us money even when nobody buys. If 1 in 10 people buys, each order carries about ₹140–270 of wasted previews. So we need limits: sign-in to generate, a few sets per account per day, and a rate limit per IP.

## Print file / die-cut
- The prompt asks for a sticker-style avatar with a thick white border on a plain background.
- Background removal happens after payment (provider bg-removal, about $0.01) to get a transparent PNG.
- Admin gets a high-res PNG with the cut line traced from the alpha (the same way `.sticker-cut` draws it), so it's ready for the cutter.

## Safety
- Consent tick plus 18+ (or parent) statement. Text on the page says "no celebrity / someone else's photo".
- The provider's built-in moderation applies to both uploads and outputs. Blocked results show a polite retry message.
- No selfie storage. Admin can see the generated art only for paid orders.

## Home page
- Hero slide 1 becomes the avatar maker (before/after demo + **Make my stickers** button). The phone tab bar "Custom" tab opens it first.
- Before/after demo images: the shop owner supplies these (we don't generate catalogue art ourselves).
