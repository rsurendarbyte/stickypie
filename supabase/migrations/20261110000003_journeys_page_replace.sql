-- journey_ingest: a page sent again replaces its earlier copy wherever it sits
-- (it was appended twice when an earlier page index was missing). Same as
-- 20261110000002 now has; this file brings databases that ran the first copy up to date.

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

  insert into journey_sessions (id, visitor_id, visit_no, entry_path, source, campaign, device, place)
  values (
    v_sid, (p->>'vid')::uuid, greatest(coalesce((p->>'visit')::int, 1), 1),
    left(p->>'entry', 200), left(p->>'source', 40), left(p->>'campaign', 80),
    left(p->>'device', 60), left(p->>'place', 120)
  )
  on conflict (id) do nothing;

  select pages, events into v_pages, v_events from journey_sessions where id = v_sid for update;

  for v_page in select * from jsonb_array_elements(coalesce(p->'pages', '[]'::jsonb)) loop
    v_i := (v_page->>'i')::int;
    v_page := jsonb_build_object(
      'i', v_i, 'p', left(v_page->>'p', 200), 't', v_page->'t',
      'ms', least(greatest(coalesce((v_page->>'ms')::bigint, 0), 0), 86400000)
    );
    -- the same page sent again (its time grew): replace it where it sits
    select o - 1 into v_at from jsonb_array_elements(v_pages) with ordinality a(x, o)
      where (x->>'i')::int = v_i order by o desc limit 1;
    if v_at is not null then
      v_pages := jsonb_set(v_pages, array[v_at::text], v_page);
    elsif jsonb_array_length(v_pages) < 300 then
      v_pages := v_pages || jsonb_build_array(v_page);
    end if;
  end loop;

  if jsonb_array_length(v_events) < 400 then
    v_events := v_events || (
      select coalesce(jsonb_agg(jsonb_build_object(
        'e', left(x->>'e', 32), 't', x->'t', 'p', left(x->>'p', 200), 'd', x->'d'
      )), '[]'::jsonb)
      from (select x from jsonb_array_elements(v_new_events) x limit 60) s
    );
  end if;

  update journey_sessions set
    pages = v_pages,
    events = v_events,
    last_at = now(),
    last_path = coalesce(left(v_pages->(jsonb_array_length(v_pages) - 1)->>'p', 200), last_path),
    device = coalesce(device, left(p->>'device', 60)),
    place = coalesce(place, left(p->>'place', 120)),
    cart_token = coalesce(cart_token, case when p->>'cart' ~ '^[0-9a-f-]{36}$' then (p->>'cart')::uuid end),
    order_id = coalesce(case when p->>'order' ~ '^[0-9a-f-]{36}$' then (p->>'order')::uuid end, order_id),
    added_to_cart = added_to_cart or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'add_to_cart'),
    opened_checkout = opened_checkout or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'checkout'),
    pay_clicked = pay_clicked or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'pay_click'),
    paid = paid or exists (select 1 from jsonb_array_elements(v_new_events) x where x->>'e' = 'paid')
  where id = v_sid;

  -- now and then, forget visits older than 60 days
  if random() < 0.01 then
    delete from journey_sessions where last_at < now() - interval '60 days';
  end if;
end $$;

revoke all on function public.journey_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.journey_ingest(jsonb) to service_role;
