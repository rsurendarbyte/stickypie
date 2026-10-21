# Supabase files

| File | Purpose |
| --- | --- |
| `migrations/20261020000001_init.sql` | Full schema: tables, RLS policies, RPCs, storage bucket. |
| `seed.sql` | Demo catalog as SQL (same data as `npm run seed:remote`). Optional. |
| `make-admin.sql` | Grants an auth user access to the admin app. |

## Running migrations (the script way)

One-time CLI setup (interactive — needs your Supabase login):

```bash
npx supabase login
```

```bash
npm run db:link        # links this repo to the dev project (asks the DB password)
```

Then every migration in `supabase/migrations/` applies with:

```bash
npm run db:push
```

> The initial migration was bootstrapped manually on the dev project
> (StickyPie-dev). After linking, tell the CLI it's already applied:
> `npx supabase migration repair --status applied 20261020000001`

For the **prod** project later: `npx supabase link --project-ref <prod-ref>`
then `npm run db:push` — it applies everything cleanly from scratch.

## Seeding the catalog (script)

```bash
npm run seed:remote    # idempotent; never overwrites products you've edited
```

## Creating an admin login (script)

```bash
npm run admin:create -- you@example.com
```

Prompts for a password (hidden), creates the confirmed auth user via the Admin
API and adds them to `admin_users`. Re-running it on an existing user just
re-grants admin access. (`make-admin.sql` remains as the SQL alternative.)

Add new migrations as `supabase/migrations/<YYYYMMDDHHMMSS>_name.sql`.
See [docs/SETUP.md](../docs/SETUP.md) for the full walkthrough.
