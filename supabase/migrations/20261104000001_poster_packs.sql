-- Poster packs: a product that is a set of other posters (e.g. "Red Line — 6
-- car posters"). The pack lists its posters in wall order; the shopper picks
-- one size and every poster in the pack is printed at that size.
alter table public.products
  add column if not exists pack_items uuid[] not null default '{}';

-- An ordered pack keeps its posters as they were when it was bought
-- ([{ "name", "image_url" }], wall order), so printing never depends on the
-- catalogue staying the same.
alter table public.order_items
  add column if not exists pack_posters jsonb;
