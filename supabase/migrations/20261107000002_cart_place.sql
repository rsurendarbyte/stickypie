-- Roughly where a cart came from, for the admin's Carts page: city and state from
-- the visitor's connection, written by the shop's server (/api/cart-place). Never the
-- IP address, and it goes with the cart after 30 days without a change.
alter table public.carts add column if not exists place text;

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
        k.id, k.status, k.items, k.item_count, k.value, k.place,
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
