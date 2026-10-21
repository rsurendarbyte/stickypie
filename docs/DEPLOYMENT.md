# Deploying StickyPie on Cloudflare (free plan)

Everything below stays on **free tiers**: Cloudflare Workers (free), Cloudflare
R2 (free), Supabase (free), plus your Cashfree merchant account.

| Piece | Where it runs | Free-tier reality |
| --- | --- | --- |
| Home / Browse / product pages | Workers **static assets** (prerendered shells) | **Unlimited & free** — static requests never count |
| Live catalog data (stock, prices, new drops) | Browser → **Supabase REST API** directly | Free; no redeploy needed for catalog changes |
| Checkout, order status, Cashfree webhook | **Cloudflare Worker** (OpenNext adapter) | 100,000 requests/day free ≈ tens of thousands of *orders*/day |
| JS/CSS, fonts, seeded sticker PNGs | Workers **static assets** | Unlimited & free |
| Uploaded sticker images | **Cloudflare R2** bucket | 10 GB free, **zero egress fees**, CDN-cached on your domain |
| Admin (`apps/admin`) | Your machine (by design) | n/a |
| Database | Supabase | free project |

**How "unlimited reach" works here:** browsing never touches the Worker. Pages
ship as prerendered static files (free at any traffic level) containing a
build-time catalog snapshot, and the visitor's browser then refreshes the
catalog straight from Supabase (public anon key; RLS only exposes active
products). Only buying consumes Worker requests — a purchase is ~3–5
invocations, so the free plan covers vastly more orders than a new store will
see. If you ever outgrow it, Workers Paid (US$5/month, 10M requests) removes
the cap with zero code changes. Bandwidth is never billed on either plan.

Redeploys (`npm run deploy:dev` / `npm run deploy:prod`) are only needed to refresh the *prerendered
snapshot* (nice for SEO and first paint) — shoppers already see live data
without one, and checkout always re-validates stock server-side.

---

## 1 · One-time Cloudflare setup

```bash
cd apps/web
npx wrangler login          # opens the browser to authorize your Cloudflare account
```

**Create the image bucket (R2):**

```bash
npx wrangler r2 bucket create stickypie-images
```

Then in the Cloudflare dashboard → **R2 → stickypie-images → Settings**:

1. **Public access**: enable the `r2.dev` dev URL (fine to start), or — better,
   once your domain is on Cloudflare — add a **custom domain** like
   `images.yourdomain.com` (gives full CDN caching + no r2.dev rate limits).
2. **R2 → Manage API tokens → Create API token**: *Object Read & Write*,
   scoped to this bucket. Copy the Access Key ID + Secret.

**Give the admin app the R2 credentials** — in `apps/admin/.env.local`:

```env
R2_ACCOUNT_ID=<your account id (dashboard → R2 → right sidebar)>
R2_ACCESS_KEY_ID=<from the token>
R2_SECRET_ACCESS_KEY=<from the token>
R2_BUCKET=stickypie-images
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev   # or https://images.yourdomain.com
```

From then on, every image you upload in the admin goes to R2 and is served
with `immutable` cache headers (free egress, cached at the edge).

## 2 · Two environments: dev and production

| | dev | production |
|---|---|---|
| URL | https://dev.stickypie.in | https://stickypie.in |
| Worker | `stickypie-web` | `stickypie-web-production` |
| Search engines | **blocked** (noindex everywhere) | **indexed** (sitemap, canonical URLs, rich results) |
| Deploy | `npm run deploy:dev` | `npm run deploy:prod` |

Both are defined in [apps/web/wrangler.jsonc](../apps/web/wrangler.jsonc).
Non-secret config (`SITE_ENV`, `SITE_URL`, `SUPABASE_URL`, `CASHFREE_ENV`)
lives in each environment's `vars` there — edit it there, nowhere else.

**Always deploy with the npm scripts, never bare `wrangler deploy`.** Pages are
prerendered at build time, so their SEO settings (robots meta, canonical URLs)
are baked into the HTML. [scripts/deploy.mjs](../apps/web/scripts/deploy.mjs)
feeds the environment's `vars` into the build so the HTML and the Worker always
agree, and for dev it adds a `_headers` file so even static pages send
`X-Robots-Tag: noindex`.

How each environment handles search engines:

- **dev / local** — `<meta name="robots" content="noindex">` on every page,
  `X-Robots-Tag: noindex` on every response, empty sitemap. robots.txt
  deliberately does *not* block crawling: Google has to fetch a page to see its
  noindex, and blocking would leave any already-indexed dev URLs stuck.
- **production** — indexable, canonical URLs on stickypie.in, Open Graph /
  Twitter share cards, Product structured data (price, stock) on every sticker
  page, WebSite + Organization data on the home page, `/sitemap.xml` built live
  from the catalog (new stickers appear without a redeploy), robots.txt pointing
  to it. Checkout, order and payment pages are noindex in every environment.

**Set each environment's secrets once** (stored encrypted by Cloudflare, never
in git). Pipe the value in from your env file so it never appears on screen:

```bash
cd apps/web
grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Repeat for `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`. For production add
`--env production` to each command (and use the production keys).

**Build-time env:** the deploy build runs on your machine and reads
`apps/web/.env.local` for the catalog snapshot and the browser's live catalog
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

**Tip:** stop the local dev server (`npm run dev`) before deploying — both use
the same `.next` build folder; restart dev afterwards.

## 3 · Deploy

```bash
npm run deploy:dev
```

```bash
npm run deploy:prod
```

(from the repo root.) The script prints the target and whether indexing is
enabled before it builds. To try a build locally in the Workers runtime first:
`npm run preview:cf --workspace stickypie-web`.

## 4 · Domains

`stickypie.in` is already on Cloudflare. The custom domains in `wrangler.jsonc`
(`dev.stickypie.in`, `stickypie.in`) are attached automatically on deploy;
HTTPS is automatic.

- **www**: add a Cloudflare **Redirect Rule** (dashboard → Rules → Redirect
  Rules → template "Redirect from WWW to root") so `www.stickypie.in` 301s to
  `stickypie.in`. One canonical host is better for SEO.
- **Images**: R2 → stickypie-images → Settings → Custom domains →
  `images.stickypie.in`, then update `R2_PUBLIC_URL` in the admin env.
- **Payment webhooks** need no dashboard setup: each order tells Cashfree to
  notify its own site's `/api/webhooks/cashfree`, so dev and production (and
  any other app on the same Cashfree account) never mix.
- **Search Console**: after the first production deploy, add `stickypie.in` in
  Google Search Console (DNS verification works with Cloudflare) and submit
  `https://stickypie.in/sitemap.xml`. Do *not* add dev.stickypie.in.

## 5 · Admin stays local

```bash
npm run dev:admin                          # against dev (.env.local)
npm run build:admin && npm run start:admin # against prod (.env.production.local)
```

It only needs outbound HTTPS to Supabase and R2 — nothing is exposed to the
internet. If you ever host it, keep it behind a VPN / Cloudflare Access / IP
allowlist. (Vercel or any Node host also works for the storefront if you ever
switch; the app itself is host-agnostic.)

## Go-live checklist

- [ ] Supabase **prod** project migrated (`20261020000001_init.sql`) + admin user added (`make-admin.sql`)
- [ ] `wrangler login` done; R2 bucket created with public access; admin `.env` has the R2 keys
- [ ] Production Worker secrets set with `--env production` (`SUPABASE_SERVICE_ROLE_KEY`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`)
- [ ] Cashfree KYC approved, stickypie.in whitelisted; `CASHFREE_ENV` = `production` in the production vars
- [ ] `npm run deploy:prod`; www → root redirect rule; R2 custom domain + `R2_PUBLIC_URL` updated
- [ ] stickypie.in added to Google Search Console and `sitemap.xml` submitted
- [ ] Legal/contact pages customized with your real business details
- [ ] One real test order placed and refunded from the Cashfree dashboard
