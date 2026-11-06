-- A 240px picture for places that show a product very small (hero wall tiles,
-- search results, cart and order walls). Null until it's built: falls back to thumb_url.
alter table public.products add column if not exists tiny_url text;
