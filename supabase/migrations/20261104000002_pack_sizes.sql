-- Poster packs can mix sizes: each poster's own size (longest side, inches —
-- 6 = 4 × 6 in, 9 = 6 × 9 in, both 2:3), in the same order as pack_items.
-- The pack has one price; there is no size to pick.
alter table public.products
  add column if not exists pack_sizes smallint[] not null default '{}';
