-- Address type for the shopper's address book (Home / Work / Other).
alter table public.customer_addresses
  add column if not exists label text not null default 'Home';

alter table public.customer_addresses
  drop constraint if exists customer_addresses_label_check,
  add constraint customer_addresses_label_check check (label in ('Home', 'Work', 'Other'));
