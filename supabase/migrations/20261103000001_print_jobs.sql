-- Print jobs: the admin makes a public link for the printing person
-- (/print-job/<key>) with the order's stickers, files and A3 sheets, no prices.
-- The link works only while the order is paid; once packed it closes by itself.
alter table public.orders add column if not exists print_token text;
create unique index if not exists orders_print_token_idx
  on public.orders (print_token) where print_token is not null;
