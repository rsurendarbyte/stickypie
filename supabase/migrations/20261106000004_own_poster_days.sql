-- How long a shopper's own posters are kept after delivery (admin → Store settings).
alter table public.store_settings
  add column if not exists own_poster_days integer not null default 7;
