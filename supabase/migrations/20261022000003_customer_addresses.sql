-- Shoppers' saved delivery addresses (address book). Written straight from
-- the browser with the shopper's own session; RLS keeps each list private.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address1 text not null check (char_length(address1) between 4 and 120),
  address2 text check (address2 is null or char_length(address2) <= 120),
  city text not null check (char_length(city) between 2 and 60),
  state text not null check (char_length(state) between 2 and 60),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  is_default boolean not null default false,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_idx
  on public.customer_addresses (user_id, is_default desc, last_used_at desc);

-- At most one default address per shopper.
create unique index if not exists customer_addresses_one_default
  on public.customer_addresses (user_id) where is_default;

alter table public.customer_addresses enable row level security;

drop policy if exists "shoppers read own addresses" on public.customer_addresses;
create policy "shoppers read own addresses" on public.customer_addresses
  for select using (auth.uid() = user_id);
drop policy if exists "shoppers add own addresses" on public.customer_addresses;
create policy "shoppers add own addresses" on public.customer_addresses
  for insert with check (auth.uid() = user_id);
drop policy if exists "shoppers update own addresses" on public.customer_addresses;
create policy "shoppers update own addresses" on public.customer_addresses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "shoppers delete own addresses" on public.customer_addresses;
create policy "shoppers delete own addresses" on public.customer_addresses
  for delete using (auth.uid() = user_id);
