-- Festivals & special days (admin → Festivals): each gets its own page and,
-- around its date, a row at the top of the home page.
-- null = the built-in list (Kannada Rajyotsava, Puducherry Liberation Day).
alter table public.store_settings
  add column if not exists festivals jsonb;

alter table public.store_settings
  drop constraint if exists store_settings_festivals_is_array,
  add constraint store_settings_festivals_is_array
    check (festivals is null or jsonb_typeof(festivals) = 'array');
