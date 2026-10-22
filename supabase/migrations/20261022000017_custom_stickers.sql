-- Custom stickers: shoppers pick a size and quantity, pay a fixed price per
-- size (admin → Settings), then upload their artwork from the order page.
-- The file lives in Storage; the order line keeps its path.

-- Price per size in whole rupees, e.g. {"3": 49, "6": 99, "7": 149}.
-- A size missing or 0 isn't offered.
alter table public.store_settings
  add column if not exists custom_prices jsonb not null default '{"3": 49, "6": 99, "7": 149}'::jsonb;

-- Custom lines (product_id is null for them). The artwork is uploaded after
-- payment, so custom_file stays null until the shopper sends it.
alter table public.order_items
  add column if not exists is_custom boolean not null default false,
  add column if not exists custom_file text,
  -- Links the line to the artwork the shopper picked in their browser before
  -- paying, so the order page can upload it automatically once paid.
  add column if not exists custom_ref text;

-- Uploaded artwork: random object names, written only by the storefront
-- server (service role). Public read so the order page, emails and admin can
-- show it; names can't be guessed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('custom-stickers', 'custom-stickers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
