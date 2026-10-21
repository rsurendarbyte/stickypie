# StickyPie 🥧 — *Stick your style.*

A full sticker-store setup in one monorepo:

| App | What it is | Port |
| --- | --- | --- |
| **`apps/web`** | Customer storefront — dark, Netflix-style browsing (hero drop, Top-10 row, category rails), cart, checkout with **Cashfree** (UPI/cards/netbanking), order tracking pages. | `3000` |
| **`apps/admin`** | Separate admin console with its own login — inventory & stock, "open for sale" toggles, add/edit products with image upload, categories, order fulfilment, dashboard. Meant to run **locally**. | `3100` |

Plus `packages/shared` (types, validation, data drivers), `supabase/` (schema,
RLS policies, seed) and `docs/` (setup & deployment guides).

## Quick start (zero config)

```bash
npm install
npm run dev
```

- Storefront → http://localhost:3000
- Admin → http://localhost:3100 (demo password: see `apps/admin/.env.example`)

With no env vars set, everything runs in **demo mode**: the catalog and orders
live in a local JSON file (`data/dev-store.json`) shared by both apps, and
checkout uses a built-in payment simulator. Nothing external is needed.

## Going real

1. **Database** — create two Supabase projects (dev & prod), run
   `supabase/migrations/20261020000001_init.sql` on each, optionally `supabase/seed.sql`
   for the starter catalog. → full steps in [docs/SETUP.md](docs/SETUP.md)
2. **Payments** — put your Cashfree **sandbox** keys in dev and **production**
   keys in prod (`apps/web` env). Until then the simulator stands in.
3. **Deploy** — storefront to **Cloudflare Workers** (free plan) with sticker
   images on **Cloudflare R2** (free, zero egress); the admin app stays on
   your machine and can point at dev or prod. → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Everyday commands

```bash
npm run dev          # both apps (web :3000, admin :3100)
npm run dev:web      # storefront only
npm run dev:admin    # admin only
npm run build        # production build of both
npm run deploy:dev   # build + deploy to dev.stickypie.in (hidden from search engines)
npm run deploy:prod  # build + deploy to stickypie.in (indexed, with sitemap)
npm run seed:sql     # regenerate supabase/seed.sql from the seed catalog
```

## How the pieces fit

```
apps/web ──────────┐        orders (service role) ┌─────────────┐
  storefront       ├──────▶ products/categories ─▶│  Supabase    │
  + /api/checkout  │        confirm_order_paid    │  (dev/prod)  │
  + /api/webhooks/cashfree ─ payment webhooks ───▶│  + Storage   │
                   │                              └─────────────┘
apps/admin ────────┘   RLS: admins (admin_users table) manage the
  login + console      catalog & orders with the anon key only.

Demo mode swaps Supabase for data/dev-store.json and Cashfree for /pay/simulator.
```

- Prices are whole rupees (INR). Free shipping ≥ ₹499, else flat ₹49
  (`packages/shared/src/constants.ts`).
- Stock is decremented exactly once when a payment is confirmed (idempotent
  RPC `confirm_order_paid`); cancelling a paid order restocks it.
- Product images: upload from the admin product form — with `R2_*` env vars set
  they go to a Cloudflare R2 bucket (production; free egress, CDN-cached);
  otherwise Supabase Storage; in demo mode, `apps/web/public/stickers/`.

## Where things are

```
apps/web/src/app          pages (home, browse, sticker/[slug], checkout, order/[id], legal/*)
apps/web/src/app/api      checkout, cashfree webhook, payment simulator
apps/admin/src/app        dashboard, products, categories, orders, settings, login
packages/shared/src       types, zod schemas, constants, local + supabase drivers
supabase/                 20261020000001_init.sql (schema/RLS/RPCs), seed.sql, make-admin.sql
docs/                     SETUP.md, DEPLOYMENT.md
```
