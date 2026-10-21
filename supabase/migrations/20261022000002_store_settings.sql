-- Store-wide checkout settings, edited in the admin (Settings → Shipping & checkout).
-- One row (id = 1). Shipping is charged by zone, worked out from the shopper's
-- PIN code / state against the dispatch PIN code / state. There is no free
-- shipping; carts below min_order cannot be checked out.

create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  min_order integer not null default 900 check (min_order >= 0),
  origin_pincode text check (origin_pincode is null or origin_pincode ~ '^[1-9][0-9]{5}$'),
  origin_state text,
  ship_local integer not null default 40 check (ship_local >= 0),       -- same city / district (first 3 PIN digits)
  ship_state integer not null default 50 check (ship_state >= 0),       -- same state
  ship_national integer not null default 70 check (ship_national >= 0), -- rest of India
  ship_remote integer not null default 90 check (ship_remote >= 0),     -- North-East, J&K, Ladakh, islands
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

drop policy if exists "store settings are public" on public.store_settings;
create policy "store settings are public" on public.store_settings for select using (true);
drop policy if exists "admins update store settings" on public.store_settings;
create policy "admins update store settings" on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());
