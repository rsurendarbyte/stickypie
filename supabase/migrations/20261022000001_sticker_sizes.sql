-- Sticker sizes: each product can be sold in several sizes (3/6/9 inch = the
-- longest side), each with its own price. products.price / compare_at_price keep
-- mirroring the cheapest size so existing listings and "from ₹X" keep working.

alter table public.products
  add column if not exists sizes jsonb not null default '[]'::jsonb,
  -- artwork width / height, used to turn "6 inch" into real dimensions
  add column if not exists aspect_ratio numeric(8, 4);

alter table public.products
  drop constraint if exists products_sizes_is_array,
  add constraint products_sizes_is_array check (jsonb_typeof(sizes) = 'array'),
  drop constraint if exists products_aspect_ratio_positive,
  add constraint products_aspect_ratio_positive check (aspect_ratio is null or aspect_ratio > 0);

-- The size a shopper bought, frozen at order time for printing.
alter table public.order_items
  add column if not exists size_inches smallint,
  add column if not exists size_label text;
