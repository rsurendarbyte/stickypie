-- Unique people, not page loads, for the admin's Analytics page. Nothing about
-- the visitor is stored: each browser remembers the last day it was counted and
-- sends that day along, so its 1 moves from the old day to today. A person is
-- then only ever in one day's count, and adding up any recent days can't count
-- them twice. Clearing browser data, or a second browser, counts as a new person.
create table if not exists public.daily_visitors (
  day date primary key,
  people integer not null default 0
);

alter table public.daily_visitors enable row level security;
drop policy if exists "admins read daily visitors" on public.daily_visitors;
create policy "admins read daily visitors" on public.daily_visitors for select using (public.is_admin());

create or replace function public.record_visitor(p_prev date default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_prev >= today then return; end if;
  update daily_visitors set people = greatest(people - 1, 0) where day = p_prev;
  insert into daily_visitors (day, people) values (today, 1)
  on conflict (day) do update set people = daily_visitors.people + 1;
end
$$;

revoke all on function public.record_visitor(date) from public;
grant execute on function public.record_visitor(date) to anon, authenticated;

-- The same for each sticker. `views` keeps counting every visit.
alter table public.product_views add column if not exists people integer not null default 0;

drop function if exists public.record_product_view(uuid);
create function public.record_product_view(p_product uuid, p_new boolean default false, p_prev date default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  counted boolean := p_new and (p_prev is null or p_prev < today);
begin
  if counted then
    update product_views set people = greatest(people - 1, 0) where product_id = p_product and day = p_prev;
  end if;
  insert into product_views (product_id, day, views, people)
  select id, today, 1, case when counted then 1 else 0 end
  from products where id = p_product and is_active
  on conflict (product_id, day) do update
    set views = product_views.views + 1, people = product_views.people + excluded.people;
end
$$;

revoke all on function public.record_product_view(uuid, boolean, date) from public;
grant execute on function public.record_product_view(uuid, boolean, date) to anon, authenticated;
