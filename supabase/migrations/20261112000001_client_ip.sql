-- The visitor's IP address on Journeys and Carts, and the shop owner's own
-- devices ("This is me") so the admin can tell their own test visits apart.
-- The IP comes from Cloudflare's cf-connecting-ip header, written only by the
-- shop's server (service role); only admins read it. Journeys still go after
-- 30 days and carts after 30 days without a change, the IP with them.

alter table public.journey_sessions add column if not exists ip text;
alter table public.carts add column if not exists ip text;

-- An IP or a browser (journey visitor id) the admin marked as their own.
create table if not exists public.own_devices (
  id uuid primary key default gen_random_uuid(),
  ip text,
  visitor_id uuid,
  label text,
  created_at timestamptz not null default now(),
  check (ip is not null or visitor_id is not null)
);
create unique index if not exists own_devices_ip on public.own_devices (ip) where ip is not null;
create unique index if not exists own_devices_visitor on public.own_devices (visitor_id) where visitor_id is not null;

alter table public.own_devices enable row level security;
revoke all on public.own_devices from anon;
drop policy if exists "admins manage own devices" on public.own_devices;
create policy "admins manage own devices" on public.own_devices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.own_devices to authenticated;

-- the admin reads at most 30 days (nothing older is kept)
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
        s.referrer, s.utm_medium, s.utm_content, s.from_ad, s.screen, s.lang,
        s.contact_name, s.contact_email, s.contact_phone, s.contact_at, s.ip,
        cart.items as cart_items, cart.value as cart_value,
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
      -- what's in this browser's cart now (unpaid)
      left join lateral (
        select c.items, c.value from carts c
        where c.token = s.cart_token and c.status = 'pending' limit 1
      ) cart on true
      join lateral (
        select count(*)::int as visits, min(started_at) as first_at
        from journey_sessions w where w.visitor_id = s.visitor_id
      ) v on true
      where s.last_at > now() - make_interval(days => least(greatest(p_days, 1), 30))
      order by s.last_at desc
      limit least(greatest(p_limit, 1), 1000)
    ) j
  ), '[]'::jsonb);
end $$;

revoke all on function public.admin_journeys(int, int) from public, anon;
grant execute on function public.admin_journeys(int, int) to authenticated;

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
        k.id, k.status, k.items, k.item_count, k.value, k.place, k.ip,
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
