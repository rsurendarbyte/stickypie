-- Contact form messages + product reviews (left after delivery, shown once an
-- admin approves them).

-- ── Contact messages ─────────────────────────────────────────────────────────
-- Written by the storefront server (service role); read by admins only.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (phone is null or char_length(phone) <= 20),
  order_code text check (order_code is null or char_length(order_code) <= 20),
  topic text not null default 'general'
    check (topic in ('order', 'custom', 'bulk', 'feedback', 'general')),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
drop policy if exists "admins read messages" on public.contact_messages;
create policy "admins read messages" on public.contact_messages for select using (public.is_admin());
drop policy if exists "admins update messages" on public.contact_messages;
create policy "admins update messages" on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete messages" on public.contact_messages;
create policy "admins delete messages" on public.contact_messages for delete using (public.is_admin());

-- ── Product reviews ──────────────────────────────────────────────────────────
-- One review per purchased order line, only after delivery (checked by the
-- storefront server, which inserts with the service role).
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, status);
create index if not exists product_reviews_status_idx on public.product_reviews (status, created_at desc);

alter table public.product_reviews enable row level security;
drop policy if exists "shoppers read own reviews" on public.product_reviews;
create policy "shoppers read own reviews" on public.product_reviews for select using (auth.uid() = user_id);
drop policy if exists "admins read reviews" on public.product_reviews;
create policy "admins read reviews" on public.product_reviews for select using (public.is_admin());
drop policy if exists "admins update reviews" on public.product_reviews;
create policy "admins update reviews" on public.product_reviews
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete reviews" on public.product_reviews;
create policy "admins delete reviews" on public.product_reviews for delete using (public.is_admin());

-- Public, approved-only view (no user ids / order ids exposed).
create or replace view public.product_reviews_public as
  select id, product_id, author_name, rating, body, created_at
  from public.product_reviews
  where status = 'approved';
grant select on public.product_reviews_public to anon, authenticated;

-- Approving / un-approving a review changes what shoppers see → bump the
-- storefront cache version (pending reviews don't).
create or replace function public.touch_catalog_version_reviews()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.status = 'approved')
     or (tg_op = 'UPDATE' and (old.status = 'approved' or new.status = 'approved'))
     or (tg_op = 'INSERT' and new.status = 'approved') then
    update public.store_settings set catalog_version = clock_timestamp() where id = 1;
  end if;
  return null;
end;
$$;

drop trigger if exists product_reviews_catalog_version on public.product_reviews;
create trigger product_reviews_catalog_version
  after insert or update or delete on public.product_reviews
  for each row execute function public.touch_catalog_version_reviews();
