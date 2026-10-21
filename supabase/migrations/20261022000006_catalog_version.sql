-- Cheap change detection for the storefront cache.
--
-- store_settings.catalog_version moves forward whenever anything a shopper
-- sees changes (products incl. stock, categories, settings / home layout).
-- Browsers keep the catalog in IndexedDB and only re-download it when this
-- stamp differs — one tiny request per page load instead of several.

alter table public.store_settings
  add column if not exists catalog_version timestamptz not null default now();

-- Small card image (WebP) next to the full-size artwork.
alter table public.products
  add column if not exists thumb_url text;

-- Any change to settings / home layout bumps the stamp.
create or replace function public.touch_catalog_version_self()
returns trigger language plpgsql as $$
begin
  new.catalog_version := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists store_settings_catalog_version on public.store_settings;
create trigger store_settings_catalog_version
  before update on public.store_settings
  for each row execute function public.touch_catalog_version_self();

-- Product / category writes bump it once per statement (security definer so
-- admin sessions, the storefront server and payment RPCs can all touch it).
create or replace function public.touch_catalog_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.store_settings set catalog_version = clock_timestamp() where id = 1;
  return null;
end;
$$;

drop trigger if exists products_catalog_version on public.products;
create trigger products_catalog_version
  after insert or update or delete on public.products
  for each statement execute function public.touch_catalog_version();

drop trigger if exists categories_catalog_version on public.categories;
create trigger categories_catalog_version
  after insert or update or delete on public.categories
  for each statement execute function public.touch_catalog_version();
