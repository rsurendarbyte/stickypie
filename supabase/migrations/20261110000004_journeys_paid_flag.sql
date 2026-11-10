-- admin_journeys: "paid" is false, not null, for a visit with no order.
-- Same as 20261110000002 now has; brings databases that ran the first copy up to date.

/**
 * Visits for the admin, newest first, each with its visitor's totals and whether
 * the visit's order (or any order on its cart) was paid.
 */
create or replace function public.admin_journeys(p_days int default 7, p_limit int default 400)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(j) order by j.last_at desc)
    from (
      select
        s.id, s.visitor_id, s.visit_no, s.started_at, s.last_at, s.entry_path, s.source,
        s.campaign, s.device, s.place, s.cart_token, s.pages, s.events, s.last_path,
        s.added_to_cart, s.opened_checkout, s.pay_clicked,
        coalesce(s.order_id, k.order_id) as order_id,
        (s.paid or coalesce(o.status in ('paid','packed','shipped','delivered'), false)) as paid,
        v.visits, v.first_at
      from journey_sessions s
      -- the order this visit started on its cart (a cart token keeps its ordered carts)
      left join lateral (
        select c.order_id from carts c
        where c.token = s.cart_token and c.order_id is not null
          and coalesce(c.ordered_at, c.updated_at) between s.started_at and s.last_at + interval '2 hours'
        order by c.updated_at desc limit 1
      ) k on true
      left join orders o on o.id = coalesce(s.order_id, k.order_id)
      join lateral (
        select count(*)::int as visits, min(started_at) as first_at
        from journey_sessions w where w.visitor_id = s.visitor_id
      ) v on true
      where s.last_at > now() - make_interval(days => least(greatest(p_days, 1), 60))
      order by s.last_at desc
      limit least(greatest(p_limit, 1), 1000)
    ) j
  ), '[]'::jsonb);
end $$;

revoke all on function public.admin_journeys(int, int) from public, anon;
grant execute on function public.admin_journeys(int, int) to authenticated;
