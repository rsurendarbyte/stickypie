-- How many times each sticker page was opened, one row per product per day
-- (India's calendar). Only a count — no visitor, IP or device is stored. The
-- shop adds 1 through record_product_view(); only admins can read the table.
create table if not exists public.product_views (
  product_id uuid not null references public.products (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (product_id, day)
);
create index if not exists product_views_day_idx on public.product_views (day);

alter table public.product_views enable row level security;
drop policy if exists "admins read product views" on public.product_views;
create policy "admins read product views" on public.product_views for select using (public.is_admin());

create or replace function public.record_product_view(p_product uuid)
returns void
language sql volatile security definer set search_path = public as $$
  insert into product_views (product_id, day, views)
  select id, (now() at time zone 'Asia/Kolkata')::date, 1
  from products where id = p_product and is_active
  on conflict (product_id, day) do update set views = product_views.views + 1
$$;

revoke all on function public.record_product_view(uuid) from public;
grant execute on function public.record_product_view(uuid) to anon, authenticated;
