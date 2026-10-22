-- Feature switches, toggled from admin → Features. Keys the storefront
-- doesn't know are ignored; missing keys use the default in shared/features.ts.
alter table public.store_settings
  add column if not exists features jsonb not null default '{}'::jsonb;
