-- Times shoppers tried to save a sticker's picture (right-click, long-press or
-- drag on its image), next to the page views. Only a count, like views.
alter table public.product_views add column if not exists saves integer not null default 0;

create or replace function public.record_product_save(p_product uuid)
returns void
language sql volatile security definer set search_path = public as $$
  insert into product_views (product_id, day, views, saves)
  select id, (now() at time zone 'Asia/Kolkata')::date, 0, 1
  from products where id = p_product and is_active
  on conflict (product_id, day) do update set saves = product_views.saves + 1
$$;

revoke all on function public.record_product_save(uuid) from public;
grant execute on function public.record_product_save(uuid) to anon, authenticated;
