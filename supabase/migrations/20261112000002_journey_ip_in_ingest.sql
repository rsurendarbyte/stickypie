-- The visit's IP comes in with its journey batch (the shop's server adds it from
-- Cloudflare's cf-connecting-ip), so it costs no extra request: the first batch of
-- a visit that reaches the server saves it, whichever batch that is.
-- Same journey_ingest as 20261110000006_journeys_light.sql plus the ip column.

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
    referrer, utm_medium, utm_content, from_ad, screen, lang, ip)
  values (
    v_sid, (p->>'vid')::uuid, greatest(coalesce((p->>'visit')::int, 1), 1),
    left(p->>'entry', 120), left(p->>'source', 40), left(p->>'campaign', 80),
    left(p->>'device', 60), left(p->>'place', 120),
    left(p->>'referrer', 80), left(p->>'medium', 40), left(p->>'content', 80),
    coalesce((p->>'ad')::boolean, false), left(p->>'screen', 20), left(p->>'lang', 20),
    left(p->>'ip', 45)
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
    ip = coalesce(ip, left(p->>'ip', 45)),
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
