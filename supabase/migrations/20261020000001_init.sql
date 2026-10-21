-- StickyPie — initial schema, RLS policies, RPCs and storage bucket.
-- Run this in the Supabase SQL editor (or `supabase db push`) on BOTH your
-- dev project and your prod project. Safe to run once per project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price integer not null check (price >= 0),                -- whole INR
  compare_at_price integer check (compare_at_price > 0),    -- strike-through price
  category_id uuid references public.categories(id) on delete set null,
  image_url text not null default '',
  tags text[] not null default '{}',
  featured boolean not null default false,
  is_active boolean not null default true,                  -- "open for sale"
  stock integer check (stock >= 0),                         -- null = not tracked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_active_created_idx on public.products (is_active, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','packed','shipped','delivered','cancelled')),
  customer_name text not null,
  email text not null,
  phone text not null,
  address1 text not null,
  address2 text,
  city text not null,
  state text not null,
  pincode text not null,
  subtotal integer not null,
  shipping_fee integer not null default 0,
  total integer not null,
  payment_provider text not null default 'cashfree'
    check (payment_provider in ('cashfree','simulator')),
  cf_order_id text,
  cf_payment_id text,
  payment_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,            -- snapshot at purchase time
  unit_price integer not null,   -- snapshot at purchase time
  quantity integer not null check (quantity > 0),
  image_url text not null default ''
);

create index order_items_order_idx on public.order_items (order_id);

-- Who may use the admin app. Add rows with supabase/make-admin.sql.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;

create policy "categories are public"      on public.categories for select using (true);
create policy "admins insert categories"   on public.categories for insert with check (public.is_admin());
create policy "admins update categories"   on public.categories for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete categories"   on public.categories for delete using (public.is_admin());

create policy "active products are public" on public.products for select using (is_active or public.is_admin());
create policy "admins insert products"     on public.products for insert with check (public.is_admin());
create policy "admins update products"     on public.products for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete products"     on public.products for delete using (public.is_admin());

-- Orders are written by the storefront server (service role, bypasses RLS)
-- and read/updated by admins only. No anon access at all.
create policy "admins read orders"         on public.orders for select using (public.is_admin());
create policy "admins update orders"       on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "admins read order items"    on public.order_items for select using (public.is_admin());

create policy "read own admin row"         on public.admin_users for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Idempotent payment confirmation: pending/failed -> paid, decrement stock once.
-- Storefront server + Cashfree webhook only (service role).
create or replace function public.confirm_order_paid(
  p_order_id uuid,
  p_payment_id text default null,
  p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status not in ('pending', 'failed') then
    return; -- already confirmed (or in fulfillment) — nothing to do
  end if;

  update public.orders
     set status = 'paid',
         paid_at = now(),
         cf_payment_id = coalesce(p_payment_id, cf_payment_id),
         payment_note = coalesce(p_note, payment_note)
   where id = p_order_id;

  for v_item in
    select product_id, quantity from public.order_items
     where order_id = p_order_id and product_id is not null
  loop
    update public.products
       set stock = greatest(stock - v_item.quantity, 0)
     where id = v_item.product_id and stock is not null;
  end loop;
end $$;

revoke execute on function public.confirm_order_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_order_paid(uuid, text, text) to service_role;

-- Admin cancellation with restock (when payment had been captured).
create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status not in ('pending', 'paid', 'packed') then
    raise exception 'Cannot cancel a % order', v_order.status;
  end if;

  if v_order.status in ('paid', 'packed') then
    for v_item in
      select product_id, quantity from public.order_items
       where order_id = p_order_id and product_id is not null
    loop
      update public.products
         set stock = stock + v_item.quantity
       where id = v_item.product_id and stock is not null;
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
end $$;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;

-- Dashboard stats (admins only).
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;
  return jsonb_build_object(
    'products',       (select count(*) from products),
    'activeProducts', (select count(*) from products where is_active),
    'outOfStock',     (select count(*) from products where stock = 0),
    'lowStock',       (select count(*) from products where stock is not null and stock > 0 and stock <= 3),
    'totalOrders',    (select count(*) from orders),
    'ordersByStatus', coalesce(
      (select jsonb_object_agg(status, cnt)
         from (select status, count(*) as cnt from orders group by status) s),
      '{}'::jsonb
    ),
    'revenue', coalesce(
      (select sum(total) from orders where status in ('paid','packed','shipped','delivered')), 0
    ),
    'itemsSold', coalesce(
      (select sum(oi.quantity)
         from order_items oi
         join orders o on o.id = oi.order_id
        where o.status in ('paid','packed','shipped','delivered')), 0
    )
  );
end $$;

revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for product images (admin uploads)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public read product images" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "admins upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins update product images" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());
create policy "admins delete product images" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
