-- Shopper accounts + order tracking.
--
-- Orders belong to the signed-in shopper who placed them. Shoppers can READ
-- their own orders and items (order history / tracking) but get no insert,
-- update or delete rights — orders are created by the storefront server and
-- only admins change them, so customers cannot cancel. cancel_order() already
-- refuses anyone who is not an admin.

alter table public.orders
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists packed_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists courier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text;

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

create policy "customers read own orders" on public.orders
  for select using (auth.uid() = user_id);

create policy "customers read own order items" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Stamp each fulfilment step the first time an order reaches it, whatever
-- code path changes the status.
create or replace function public.stamp_fulfilment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'packed' then new.packed_at := coalesce(new.packed_at, now()); end if;
    if new.status = 'shipped' then new.shipped_at := coalesce(new.shipped_at, now()); end if;
    if new.status = 'delivered' then new.delivered_at := coalesce(new.delivered_at, now()); end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_stamp_fulfilment on public.orders;
create trigger orders_stamp_fulfilment
  before update on public.orders
  for each row execute function public.stamp_fulfilment();
