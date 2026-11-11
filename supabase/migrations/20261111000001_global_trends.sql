-- What India is searching right now (Google Trends daily search trends, geo=IN),
-- so the shop's home page can put matching posters first ("Trending now" row,
-- rows that lead with matching products, and the "Trending" tag on cards).
-- Our own traffic is too small to say what's hot; the world's isn't.
--
-- Every hour the database fetches the public RSS feed itself (pg_cron + http,
-- both free on Supabase) and keeps the last 3 days of terms: the trend's own
-- title plus the names in the headlines Google links to it. The shop reads the table and
-- does the matching against the catalog in the browser.
-- Rows with source 'manual' are topics typed in by hand; the refresh never
-- touches them.
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.global_trends (
  term text not null,
  source text not null default 'google-in',
  traffic integer not null default 0,
  -- Capitalised words from the linked headlines, not the headlines (keeps the
  -- read small): key_names are in 2+ headlines (the story's real names), names
  -- in just one
  key_names text[] not null default '{}',
  names text[] not null default '{}',
  seen_at timestamptz not null default now(),
  primary key (term, source)
);

alter table public.global_trends enable row level security;
drop policy if exists "anyone reads global trends" on public.global_trends;
create policy "anyone reads global trends" on public.global_trends for select using (true);
drop policy if exists "admins edit global trends" on public.global_trends;
create policy "admins edit global trends" on public.global_trends for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.refresh_global_trends()
returns integer
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  body text;
  doc xml;
  n integer := 0;
begin
  select content into body
  from extensions.http((
    'GET', 'https://trends.google.com/trending/rss?geo=IN',
    array[extensions.http_header('User-Agent', 'Mozilla/5.0 (StickyPie trends)')], null, null
  )::extensions.http_request)
  where status = 200;
  if body is null then return 0; end if;
  doc := body::xml;

  with ns as (select array[array['ht', 'https://trends.google.com/trending/rss']] as ht),
  items as (
    select
      lower(trim((xpath('/item/title/text()', item))[1]::text)) as term,
      coalesce(nullif(regexp_replace((xpath('/item/ht:approx_traffic/text()', item, ns.ht))[1]::text, '[^0-9]', '', 'g'), ''), '0')::integer as traffic,
      xpath('/item/ht:news_item/ht:news_item_title/text()', item, ns.ht) as heads
    from ns, unnest(xpath('/rss/channel/item', doc)) item
  ),
  -- each Capitalised word and how many of the item's headlines carry it
  counted as (
    select i.term, i.traffic, w.word, w.c
    from items i
    left join lateral (
      select lower(m[1]) as word, count(distinct h.n)::int as c
      from unnest(i.heads) with ordinality h(x, n), regexp_matches(h.x::text, '([A-Z][A-Za-z0-9]{2,})', 'g') m
      group by 1
    ) w on true
  ),
  rows_out as (
    select term, max(traffic) as traffic,
      coalesce((array_agg(word order by c desc) filter (where c >= 2))[1:8], '{}') as key_names,
      coalesce((array_agg(word) filter (where c = 1))[1:10], '{}') as names
    from counted
    where term <> ''
    group by term
  )
  insert into global_trends (term, source, traffic, key_names, names, seen_at)
  select term, 'google-in', traffic, key_names, names, now() from rows_out
  on conflict (term, source) do update
    set traffic = greatest(global_trends.traffic, excluded.traffic),
        key_names = excluded.key_names, names = excluded.names, seen_at = now();
  get diagnostics n = row_count;

  delete from global_trends where source <> 'manual' and seen_at < now() - interval '3 days';
  return n;
end
$$;

revoke all on function public.refresh_global_trends() from public, anon, authenticated;

-- every hour, at minute 7
select cron.unschedule('refresh-global-trends') where exists (select 1 from cron.job where jobname = 'refresh-global-trends');
select cron.schedule('refresh-global-trends', '7 * * * *', 'select public.refresh_global_trends()');

-- fill it straight away
select public.refresh_global_trends();
