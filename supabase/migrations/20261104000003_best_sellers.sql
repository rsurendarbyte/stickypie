-- Best sellers for the shop's home hero: how many of each product were sold in
-- paid orders over the last p_days days (all time when that window is quiet).
-- Only product ids and counts come out — no order, customer or price details —
-- so the public shop may call it.
create or replace function public.best_sellers(p_days integer default 60)
returns table (product_id uuid, sold integer)
language sql stable security definer set search_path = public as $$
  with paid as (
    select oi.product_id, oi.quantity, o.created_at
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id and p.is_active
    where o.status in ('paid', 'packed', 'shipped', 'delivered')
  ),
  recent as (
    select product_id, sum(quantity)::int as sold
    from paid
    where created_at > now() - make_interval(days => greatest(p_days, 1))
    group by product_id
  ),
  ever as (
    select product_id, sum(quantity)::int as sold from paid group by product_id
  )
  select product_id, sold
  from (select * from recent union all select * from ever where not exists (select 1 from recent)) s
  order by sold desc
  limit 60
$$;

revoke all on function public.best_sellers(integer) from public;
grant execute on function public.best_sellers(integer) to anon, authenticated;
