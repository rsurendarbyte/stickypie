-- Journeys, kept light for Supabase's free plan (500 MB database):
-- * a visit keeps at most 80 pages and 120 steps (was 300 / 400), 40 of each per send
-- * a visit that never added to cart and left no name, phone or email is trimmed
--   after 7 days: its page list and steps go, the one-line summary stays (entry and
--   last page, source, device, city), so the funnel and "came from" still count it
-- * every visit goes after 30 days (the admin's longest range)
-- Cleanup runs now and then from journey_ingest, through indexes, a few thousand
-- rows at a time.

-- visits that still carry their full page list, oldest first (for the 7-day trim)
create index if not exists journey_sessions_full on public.journey_sessions (last_at)
  where pages <> '[]'::jsonb and not added_to_cart and contact_phone is null and contact_email is null;

create or replace function public.journey_ingest(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sid uuid := (p->>'sid')::uuid;
  v_pages jsonb;
  v_events jsonb;
  v_page jsonb;
  v_i int;
  v_at int;
  v_new_events jsonb := coalesce(p->'events', '[]'::jsonb);
begin
  if v_sid is null or (p->>'vid') is null then return; end if;

  insert into journey_sessions (id, visitor_id, visit_no, entry_path, source, campaign, device, place,
    referrer, utm_medium, utm_content, from_ad, screen, lang)
  values (
    v_sid, (p->>'vid')::uuid, greatest(coalesce((p->>'visit')::int, 1), 1),
    left(p->>'entry', 120), left(p->>'source', 40), left(p->>'campaign', 80),
    left(p->>'device', 60), left(p->>'place', 120),
    left(p->>'referrer', 80), left(p->>'medium', 40), left(p->>'content', 80),
    coalesce((p->>'ad')::boolean, false), left(p->>'screen', 20), left(p->>'lang', 20)
  )
  on conflict (id) do nothing;

  select pages, events into v_pages, v_events from journey_sessions where id = v_sid for update;

  for v_page in select * from jsonb_array_elements(coalesce(p->'pages', '[]'::jsonb)) limit 40 loop
    v_i := (v_page->>'i')::int;
    v_page := jsonb_build_object(
      'i', v_i, 'p', left(v_page->>'p', 120), 't', v_page->'t',
      'ms', least(greatest(coalesce((v_page->>'ms')::bigint, 0), 0), 86400000)
    );
    -- the same page sent again (its time grew): replace it where it sits
    select o - 1 into v_at from jsonb_array_elements(v_pages) with ordinality a(x, o)
      where (x->>'i')::int = v_i order by o desc limit 1;
    if v_at is not null then
      v_pages := jsonb_set(v_pages, array[v_at::text], v_page);
    elsif jsonb_array_length(v_pages) < 80 then
      v_pages := v_pages || jsonb_build_array(v_page);
    end if;
  end loop;

  if jsonb_array_length(v_events) < 120 then
    v_events := v_events || (
      select coalesce(jsonb_agg(jsonb_build_object(
        'e', left(x->>'e', 32), 't', x->'t', 'p', left(x->>'p', 120), 'd', x->'d'
      )), '[]'::jsonb)
      from (select x from jsonb_array_elements(v_new_events) x
            limit least(40, 120 - jsonb_array_length(v_events))) s
    );
  end if;

  update journey_sessions set
    pages = v_pages,
    events = v_events,
    last_at = now(),
    last_path = coalesce(left(v_pages->(jsonb_array_length(v_pages) - 1)->>'p', 120), last_path),
    device = coalesce(device, left(p->>'device', 60)),
    place = coalesce(place, left(p->>'place', 120)),
    screen = coalesce(screen, left(p->>'screen', 20)),
    lang = coalesce(lang, left(p->>'lang', 20)),
    -- what a guest typed at checkout, kept with the visit so the shop can follow up
    contact_name = coalesce(left(p->'contact'->>'name', 80), contact_name),
    contact_email = coalesce(left(p->'contact'->>'email', 120), contact_email),
    contact_phone = coalesce(left(p->'contact'->>'phone', 10), contact_phone),
    contact_at = case when p ? 'contact' then now() else contact_at end,
    cart_token = coalesce(cart_token, case when p->>'cart' ~ '^[0-9a-f-]{36}$' then (p->>'cart')::uuid end),
    order_id = coalesce(case when p->>'order' ~ '^[0-9a-f-]{36}$' then (p->>'order')::uuid end, order_id),
    added_to_cart = added_to_cart or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'add_to_cart'),
    opened_checkout = opened_checkout or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'checkout'),
    pay_clicked = pay_clicked or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'pay_click'),
    paid = paid or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'paid')
  where id = v_sid;

  -- now and then (about 1 send in 100): trim quick-look visits, forget old ones
  if random() < 0.01 then
    update journey_sessions set pages = '[]'::jsonb, events = '[]'::jsonb
    where id in (
      select id from journey_sessions
      where pages <> '[]'::jsonb and not added_to_cart and contact_phone is null and contact_email is null
        and last_at < now() - interval '7 days'
      order by last_at limit 2000
    );
    delete from journey_sessions where id in (
      select id from journey_sessions where last_at < now() - interval '30 days'
      order by last_at limit 5000
    );
  end if;
end $$;

revoke all on function public.journey_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.journey_ingest(jsonb) to service_role;

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
        s.contact_name, s.contact_email, s.contact_phone, s.contact_at,
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
