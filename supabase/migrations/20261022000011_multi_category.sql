-- A sticker can belong to several categories. products.category_ids holds them
-- all (first = main category); products.category_id is kept in sync with the
-- first one so breadcrumbs and older code keep working.
-- Then every combined category ("Memes & Fun", "Trippy / Alcoholic"…) is split
-- in two: the first part keeps the category's id (home rails, links), the
-- second becomes a new category right after it, and stickers go in both.

alter table public.products
  add column if not exists category_ids uuid[] not null default '{}';

update public.products
  set category_ids = array[category_id]
  where category_id is not null and category_ids = '{}';

create index if not exists products_category_ids_idx on public.products using gin (category_ids);

create or replace function public.sync_product_categories()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.category_ids) = 0 and new.category_id is not null then
      new.category_ids := array[new.category_id];
    end if;
  elsif new.category_ids is not distinct from old.category_ids
        and new.category_id is distinct from old.category_id then
    -- Old-style write of the main category only: make it the first.
    new.category_ids := case
      when new.category_id is null then '{}'::uuid[]
      else array[new.category_id] || array_remove(old.category_ids, new.category_id)
    end;
  end if;
  new.category_id := new.category_ids[1];
  return new;
end;
$$;

drop trigger if exists products_sync_categories on public.products;
create trigger products_sync_categories
  before insert or update on public.products
  for each row execute function public.sync_product_categories();

-- Deleting a category takes it off every sticker (the next one becomes main).
create or replace function public.remove_category_from_products()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products set category_ids = array_remove(category_ids, old.id)
    where old.id = any(category_ids);
  return old;
end;
$$;

drop trigger if exists categories_remove_from_products on public.categories;
create trigger categories_remove_from_products
  before delete on public.categories
  for each row execute function public.remove_category_from_products();

-- ── Split combined categories ────────────────────────────────────────────────
do $$
declare
  s record;
  v_old record;
  v_first_id uuid;
  v_second_id uuid;
begin
  for s in
    select * from (values
      ('adventure',                  'Adventure',     'adventure',     'Off-Road',     'off-road'),
      ('animals-pets',               'Animals',       'animals',       'Pets',         'pets'),
      ('desi-hindi-quotes',          'Desi',          'desi',          'Hindi Quotes', 'hindi-quotes'),
      ('gym-fitness',                'Gym',           'gym',           'Fitness',      'fitness'),
      ('inspirational-motivational', 'Inspirational', 'inspirational', 'Motivational', 'motivational'),
      ('memes',                      'Memes',         'memes',         'Fun',          'fun'),
      ('nature-outdoors',            'Nature',        'nature',        'Outdoors',     'outdoors'),
      ('racing',                     'Racing',        'racing',        'JDM',          'jdm'),
      ('retro-vintage',              'Retro',         'retro',         'Vintage',      'vintage'),
      ('spiritual-mandala',          'Spiritual',     'spiritual',     'Mandala',      'mandala'),
      ('startup-hustle',             'Startup',       'startup',       'Hustle',       'hustle'),
      ('trippy-alcoholic',           'Trippy',        'trippy',        'Alcoholic',    'alcoholic')
    ) as t(old_slug, first_name, first_slug, second_name, second_slug)
  loop
    select * into v_old from public.categories where slug = s.old_slug;
    if not found then continue; end if;
    -- Already split (re-run): the name no longer has two parts.
    if v_old.name !~ '&|/' then continue; end if;

    -- First part: reuse an existing category with that slug, else rename this one.
    select id into v_first_id from public.categories where slug = s.first_slug and id <> v_old.id;
    if v_first_id is null then
      update public.categories set name = s.first_name, slug = s.first_slug where id = v_old.id;
      v_first_id := v_old.id;
    end if;

    -- Second part: reuse if it exists, else add it right after the first.
    select id into v_second_id from public.categories where slug = s.second_slug;
    if v_second_id is null then
      update public.categories set sort = sort + 1 where sort > v_old.sort;
      insert into public.categories (name, slug, sort)
        values (s.second_name, s.second_slug, v_old.sort + 1)
        returning id into v_second_id;
    end if;

    -- Stickers in the combined category go in both parts: the first part takes
    -- its place (main category stays main), the second is added after, no repeats.
    update public.products p
      set category_ids = (
        select array_agg(x order by first_pos)
        from (
          select x, min(pos) as first_pos
          from unnest(array_replace(p.category_ids, v_old.id, v_first_id) || v_second_id)
            with ordinality as u(x, pos)
          group by x
        ) d
      )
      where v_old.id = any(p.category_ids);

    if v_first_id <> v_old.id then
      delete from public.categories where id = v_old.id;
    end if;
  end loop;
end $$;
