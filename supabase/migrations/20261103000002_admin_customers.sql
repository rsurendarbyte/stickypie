-- Admin "Customers" page: everyone with a shop login, whether they're signed in
-- right now, and what they've done (orders, reviews, messages, addresses).
-- Logins live in auth.* (not readable with the admin's own session), so these
-- are security-definer functions that refuse anyone who isn't an admin.
--
-- "Signed in" = the person has a live session (they haven't signed out on that
-- device). The shop refreshes a session about once an hour while a tab is
-- open, so a session refreshed in the last ~70 minutes means "online now".

create or replace function public.admin_customers()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(c) order by c.last_active_at desc nulls last)
    from (
      select
        u.id,
        u.email::text as email,
        coalesce(
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), '')
        ) as name,
        coalesce(
          nullif(u.phone, ''),
          (select a.phone from customer_addresses a where a.user_id = u.id
            order by a.is_default desc, a.last_used_at desc limit 1)
        ) as phone,
        u.created_at,
        u.email_confirmed_at,
        u.last_sign_in_at,
        u.banned_until,
        exists (select 1 from admin_users ad where ad.user_id = u.id) as is_admin,
        s.sessions,
        s.seen_at,
        greatest(s.seen_at, u.last_sign_in_at, o.last_order_at, u.created_at) as last_active_at,
        o.orders,
        o.paid_orders,
        o.spent,
        o.last_order_at,
        (select count(*)::int from customer_addresses a where a.user_id = u.id) as addresses,
        (select count(*)::int from product_reviews r where r.user_id = u.id) as reviews
      from auth.users u
      left join lateral (
        select
          count(*)::int as sessions,
          max(greatest(ss.created_at, ss.updated_at, ss.refreshed_at at time zone 'utc')) as seen_at
        from auth.sessions ss
        where ss.user_id = u.id and (ss.not_after is null or ss.not_after > now())
      ) s on true
      left join lateral (
        select
          count(*)::int as orders,
          count(*) filter (where od.status in ('paid','packed','shipped','delivered'))::int as paid_orders,
          coalesce(sum(od.total) filter (where od.status in ('paid','packed','shipped','delivered')), 0)::int as spent,
          max(od.created_at) as last_order_at
        from orders od
        where od.user_id = u.id
          and exists (select 1 from order_items oi where oi.order_id = od.id)
      ) o on true
    ) c
  ), '[]'::jsonb);
end $$;

revoke execute on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;

-- One customer: profile, devices they're signed in on, and a timeline.
create or replace function public.admin_customer(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  u auth.users;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  select * into u from auth.users where id = p_user;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', ss.created_at,
        'seen_at', greatest(ss.created_at, ss.updated_at, ss.refreshed_at at time zone 'utc'),
        'user_agent', ss.user_agent,
        'ip', host(ss.ip)
      ) order by greatest(ss.created_at, ss.updated_at, ss.refreshed_at at time zone 'utc') desc)
      from auth.sessions ss
      where ss.user_id = p_user and (ss.not_after is null or ss.not_after > now())
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(e order by e.at desc)
      from (
        select * from (
          -- Account
          select u.created_at as at, 'signup' as kind, 'Created account' as title,
                 null::text as detail, null::text as ref
          -- Sign-ins / sign-outs / password resets (Supabase's auth log, when it keeps one)
          union all
          select l.created_at,
                 case l.payload->>'action' when 'logout' then 'logout' else 'login' end,
                 case l.payload->>'action'
                   when 'login' then 'Signed in'
                   when 'logout' then 'Signed out'
                   when 'user_recovery_requested' then 'Asked for a password reset'
                   when 'user_updated_password' then 'Changed password'
                 end,
                 nullif(l.ip_address, ''), null
          from auth.audit_log_entries l
          where l.payload->>'actor_id' = p_user::text
            and l.payload->>'action' in ('login', 'logout', 'user_recovery_requested', 'user_updated_password')
          -- Orders and how far they got
          union all
          select od.created_at, 'order',
                 case when od.status in ('pending', 'failed') then 'Started checkout (not paid)'
                      when od.status = 'cancelled' then 'Placed order (cancelled)'
                      else 'Placed order' end,
                 'SP-' || upper(left(replace(od.id::text, '-', ''), 8)) || ' · ₹' || od.total
                   || ' · ' || (select case sum(oi.quantity) when 1 then '1 sticker' else sum(oi.quantity) || ' stickers' end
                                from order_items oi where oi.order_id = od.id),
                 od.id::text
          from orders od
          where od.user_id = p_user and exists (select 1 from order_items oi where oi.order_id = od.id)
          union all
          select od.paid_at, 'paid', 'Paid',
                 'SP-' || upper(left(replace(od.id::text, '-', ''), 8)) || ' · ₹' || od.total, od.id::text
          from orders od where od.user_id = p_user and od.paid_at is not null
          union all
          select od.delivered_at, 'delivered', 'Order delivered',
                 'SP-' || upper(left(replace(od.id::text, '-', ''), 8)), od.id::text
          from orders od where od.user_id = p_user and od.delivered_at is not null
          -- Reviews
          union all
          select r.created_at, 'review',
                 'Reviewed ' || coalesce(p.name, 'a sticker') || ' · ' || r.rating || '★',
                 nullif(left(r.body, 160), ''), r.order_id::text
          from product_reviews r left join products p on p.id = r.product_id
          where r.user_id = p_user
          -- Contact form (matched by email)
          union all
          select m.created_at, 'message', 'Sent a message (' || m.topic || ')',
                 left(m.message, 160), null
          from contact_messages m
          where lower(m.email) = lower(u.email)
          -- Address book
          union all
          select a.created_at, 'address', 'Saved an address', a.city || ' ' || a.pincode, null
          from customer_addresses a where a.user_id = p_user
        ) all_events
        order by at desc
        limit 300
      ) e
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function public.admin_customer(uuid) from public, anon;
grant execute on function public.admin_customer(uuid) to authenticated;
