-- Carts shoppers are still filling, for the admin's Carts page. Kept apart from
-- orders on purpose: a cart is not a sale, so print jobs, print sheets, revenue,
-- stock and wall locks never see one.
--
-- Each browser keeps a random token. It has at most one pending row (none once
-- the cart is empty); a paid checkout turns that row into "ordered", and the
-- next cart from that browser starts a new one.
--
-- Stored: the lines (product id, name, size, quantity, price) and, for a signed-in
-- shopper, their user id. No name, email, address or custom sticker details.
-- Rows go after 30 days without a change.

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  token uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ordered')),
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  value integer not null default 0,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ordered_at timestamptz
);

create unique index if not exists carts_pending_token on public.carts (token) where status = 'pending';
create index if not exists carts_user on public.carts (user_id) where status = 'pending';
create index if not exists carts_order on public.carts (order_id);
create index if not exists carts_updated on public.carts (updated_at desc);

alter table public.carts enable row level security;
drop policy if exists "admins read carts" on public.carts;
create policy "admins read carts" on public.carts for select using (public.is_admin());

-- Called straight from the shopper's browser (no Worker request). Lines are
-- rebuilt field by field, so only these fields are kept, and capped. A signed-in
-- shopper keeps one pending row across devices: the one they used last.
create or replace function public.save_cart(p_token uuid, p_items jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_items jsonb;
  v_count integer;
  v_value integer;
begin
  delete from carts where updated_at < now() - interval '30 days';

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    delete from carts where token = p_token and status = 'pending';
    return;
  end if;

  select
    jsonb_agg(line),
    sum((line->>'qty')::integer),
    sum((line->>'qty')::integer * (line->>'price')::integer)
  into v_items, v_count, v_value
  from (
    select jsonb_build_object(
      'id', left(i->>'id', 60),
      'name', left(coalesce(i->>'name', ''), 120),
      'size', left(i->>'size', 60),
      'qty', least(greatest(coalesce((i->>'qty')::numeric::integer, 1), 1), 99),
      'price', least(greatest(coalesce((i->>'price')::numeric::integer, 0), 0), 100000)
    ) as line
    from jsonb_array_elements(p_items) with ordinality as e(i, n)
    where n <= 50
  ) lines;

  if v_user is not null then
    delete from carts where user_id = v_user and status = 'pending' and token <> p_token;
  end if;

  insert into carts (token, user_id, items, item_count, value)
  values (p_token, v_user, v_items, v_count, v_value)
  on conflict (token) where status = 'pending' do update set
    user_id = coalesce(excluded.user_id, carts.user_id),
    items = excluded.items,
    item_count = excluded.item_count,
    value = excluded.value,
    updated_at = now();
end $$;

revoke all on function public.save_cart(uuid, jsonb) from public;
grant execute on function public.save_cart(uuid, jsonb) to anon, authenticated;

-- Paying turns the linked cart into "ordered". Webhooks can confirm a payment
-- with the shopper's browser long gone, so this sits on the order itself, and it
-- can never get in the way of a payment.
create or replace function public.mark_cart_ordered()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update carts set status = 'ordered', ordered_at = now()
  where order_id = new.id and status = 'pending';
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists orders_mark_cart_ordered on public.orders;
create trigger orders_mark_cart_ordered
  after update of status on public.orders
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.mark_cart_ordered();

-- The admin's Carts page: who it is (read from the login, not kept on the cart)
-- and how the order is doing.
create or replace function public.admin_carts()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(c) order by c.updated_at desc)
    from (
      select
        k.id, k.status, k.items, k.item_count, k.value,
        k.user_id, k.order_id, k.created_at, k.updated_at, k.ordered_at,
        u.email::text as email,
        coalesce(
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), '')
        ) as name,
        o.status as order_status
      from carts k
      left join auth.users u on u.id = k.user_id
      left join orders o on o.id = k.order_id
      order by k.updated_at desc
      limit 300
    ) c
  ), '[]'::jsonb);
end $$;

revoke execute on function public.admin_carts() from public, anon;
grant execute on function public.admin_carts() to authenticated;
