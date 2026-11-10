-- Shopper journeys for the admin's Journeys page: what each visitor looked at, for
-- how long, and how far they got (cart → checkout → pay → paid). One row per visit.
-- Written only by the shop's server (/api/journey, service role) through
-- journey_ingest(); read only by admins through admin_journeys(). No names,
-- emails, phones, addresses or URL query strings are stored — just paths,
-- timings, which checkout fields were filled (never what was typed), the cart
-- token (to link the visit to its cart and order) and Cloudflare's city guess.
-- Visits go after 60 days.

create table if not exists public.journey_sessions (
  id uuid primary key,                       -- the visit, made up by the browser
  visitor_id uuid not null,                  -- the browser, kept in its localStorage
  visit_no int not null default 1,           -- 1 = first visit from this browser
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  entry_path text,
  source text,                               -- "instagram ad", "instagram", "google", "direct"…
  campaign text,                             -- utm_campaign of the landing link
  device text,                               -- "iPhone · Instagram app", "Android · Chrome"…
  place text,                                -- "Chennai, Tamil Nadu"
  cart_token uuid,
  order_id uuid,
  pages jsonb not null default '[]'::jsonb,  -- [{i, p, t, ms}] in order
  events jsonb not null default '[]'::jsonb, -- [{e, t, p, d?}]
  last_path text,
  added_to_cart boolean not null default false,
  opened_checkout boolean not null default false,
  pay_clicked boolean not null default false,
  paid boolean not null default false
);

create index if not exists journey_sessions_last_at on public.journey_sessions (last_at desc);
create index if not exists journey_sessions_visitor on public.journey_sessions (visitor_id);

alter table public.journey_sessions enable row level security;
-- no policies: only the service role (the shop's server) and the functions below touch it
revoke all on public.journey_sessions from anon, authenticated;

/**
 * One batch from a browser: {sid, vid, visit, entry?, source?, campaign?, device?,
 * place?, cart?, order?, pages:[{i,p,t,ms}], events:[{e,t,p,d}]}.
 * A page with an index already stored replaces it (its time grows while open).
 */
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
