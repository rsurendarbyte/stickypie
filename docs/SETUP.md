# StickyPie setup guide

Three ways to run it, from zero-config to production:

| Mode | Database | Payments | Use for |
| --- | --- | --- | --- |
| **Demo** (default) | local JSON file | built-in simulator | first run, UI work |
| **Dev** | Supabase *dev* project | Cashfree **sandbox** | integration testing |
| **Prod** | Supabase *prod* project | Cashfree **production** | the live store |

The mode is decided per app purely by which env vars are set — there are no
code changes between environments.

---

## 1 · Demo mode (nothing to configure)

```bash
npm install
npm run dev
```

- Storefront: http://localhost:3000
- Admin: http://localhost:3100 — password = `ADMIN_DEV_PASSWORD`
  (default in `apps/admin/.env.example`; override it in `apps/admin/.env.local`)

Catalog + orders live in `data/dev-store.json` (git-ignored). Reset anytime
from **Admin → Settings → Reset demo data**. Checkout goes through
`/pay/simulator`, which marks orders paid/failed exactly like the real gateway
would.

---

## 2 · Supabase (database) — do this twice: dev & prod

1. Create a project at https://supabase.com (e.g. `stickypie-dev`, then later
   `stickypie-prod`).
2. SQL Editor → paste & run **`supabase/migrations/20261020000001_init.sql`**
   (tables, RLS policies, RPCs, and the public `product-images` storage bucket).
3. *(Optional)* run **`supabase/seed.sql`** to load the starter catalog.
   Note: seeded image paths like `/stickers/x.png` are served by the storefront
   app itself, so they work as long as the web app ships with those files.
   Images you upload later go to Supabase Storage with absolute URLs.
4. **Create your admin login**: Authentication → Users → *Add user* (email +
   password, tick "auto-confirm"). Then open **`supabase/make-admin.sql`**,
   put that email in, and run it. Only users in `admin_users` can use the
   admin console.
5. Copy the keys from *Project Settings → API*:

   **`apps/web/.env.local`** (storefront)
   ```env
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only! never NEXT_PUBLIC, never in git
   ```

   **`apps/admin/.env.local`** (admin console)
   ```env
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...           # anon key only; RLS does the rest
   ```

Restart `npm run dev` — the footer's "demo mode" badge disappears and the admin
login switches to email + password.

> **Why two different keys?** The storefront writes orders with the
> service-role key on the server (buyers have no accounts). The admin app signs
> in a real user and relies on Row Level Security — if someone steals the admin
> bundle they still can't touch data without an `admin_users` login.

---

## 3 · Cashfree (payments)

Until keys are set, checkout uses the simulator — you can build and test
everything else without a Cashfree account.

### Sandbox (dev)

1. Create a merchant account at https://merchant.cashfree.com and open
   **Developers → API Keys → Test/Sandbox**.
2. Put the sandbox App ID + Secret in **`apps/web/.env.local`**:
   ```env
   CASHFREE_ENV=sandbox
   CASHFREE_APP_ID=TEST...
   CASHFREE_SECRET_KEY=cfsk_...
   SITE_URL=http://localhost:3000
   ```
3. Restart and place an order — you'll land on Cashfree's hosted sandbox
   checkout. Use Cashfree's published test instruments (e.g. the success test
   UPI ID / test cards listed in their docs) to simulate payments.

The buyer returns to `/order/<id>`, where the server verifies the payment
status with Cashfree before showing success — the client is never trusted.

### Webhooks (recommended, required in prod)

Dashboard → Developers → **Webhooks** → add endpoint
`https://YOUR-DOMAIN/api/webhooks/cashfree` (API version 2023-08-01, payment
events). Signatures are verified with your secret key. Webhooks keep orders
correct even if the buyer closes the tab right after paying. (For local
webhook testing you'd need an https tunnel — the return-URL verification
already covers normal local testing.)

### Production

1. Complete Cashfree's KYC/activation (they review your site — the storefront
   already ships the required **Terms, Privacy, Refunds, Shipping and Contact**
   pages; customize the placeholder business details in
   `apps/web/src/app/legal/[slug]/page.tsx` and `contact/page.tsx` first).
2. In your production host's env (not a file in git):
   ```env
   CASHFREE_ENV=production
   CASHFREE_APP_ID=<live app id>
   CASHFREE_SECRET_KEY=<live secret>
   SITE_URL=https://yourdomain.com
   ```

---

## 4 · Environment matrix (copy-paste checklist)

| Variable | Where | Dev value | Prod value |
| --- | --- | --- | --- |
| `SUPABASE_URL` | web + admin | dev project URL | prod project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **web only** | dev service key | prod service key |
| `SUPABASE_ANON_KEY` | **admin only** | dev anon key | prod anon key |
| `CASHFREE_ENV` | web | `sandbox` | `production` |
| `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` | web | sandbox keys | live keys |
| `SITE_URL` | web | `http://localhost:3000` | `https://yourdomain.com` |
| `ADMIN_DEV_PASSWORD` | admin | anything (demo only) | — (unused with Supabase) |
| `NEXT_PUBLIC_WEB_URL` | admin | `http://localhost:3000` | `https://yourdomain.com` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | admin | — (optional) | Cloudflare R2 token |
| `R2_BUCKET` / `R2_PUBLIC_URL` | admin | — (optional) | `stickypie-images` / your images domain |

Image uploads: with the `R2_*` vars set, admin uploads go to **Cloudflare R2**
(the production setup — see [DEPLOYMENT.md](DEPLOYMENT.md)); otherwise Supabase
Storage; otherwise the local folder (demo).

### Pointing the local admin at prod

The admin console is designed to run on your machine. To manage the **live**
store, keep two env files in `apps/admin/`:

- `.env.local` → dev Supabase (daily development)
- `.env.production.local` → prod Supabase + `NEXT_PUBLIC_WEB_URL=https://yourdomain.com`

Then run the admin against prod with:

```bash
npm run build:admin && npm run start:admin   # next start reads .env.production.local
```

(Plain `npm run dev:admin` keeps using `.env.local` = dev.)
