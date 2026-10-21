-- Home page layout (admin → Home page): the ordered list of product rails.
-- null = the built-in default (Top picks, New drops, a row per category).
alter table public.store_settings
  add column if not exists home_rails jsonb;

alter table public.store_settings
  drop constraint if exists store_settings_home_rails_is_array,
  add constraint store_settings_home_rails_is_array
    check (home_rails is null or jsonb_typeof(home_rails) = 'array');
