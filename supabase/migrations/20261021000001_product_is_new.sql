-- "NEW" badge is chosen per product in the admin instead of being derived
-- from the creation date. Existing products start without the badge.
alter table public.products
  add column if not exists is_new boolean not null default false;
