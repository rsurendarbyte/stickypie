-- Mid-size WebP rendition of the artwork for the big stages (hero, product
-- page). The storefront shows the card thumbnail instantly, then swaps up to
-- this instead of the multi-MB original PNG; the original stays the master
-- file and the true-size zoom.
alter table public.products
  add column if not exists display_url text;
