-- Thank-you offers are approved by hand: an admin reads the customer's
-- feedback and creates their offer (or records "no offer") from admin → Offers.
-- The default % (printed on the card, pre-filled when approving) is a setting.

alter table public.store_settings
  add column if not exists thanks_percent integer not null default 10 check (thanks_percent between 1 and 50);

drop policy if exists "admins insert coupons" on public.coupons;
create policy "admins insert coupons" on public.coupons for insert with check (public.is_admin());

-- "No offer" decisions are stored as a switched-off row with 0%.
alter table public.coupons drop constraint if exists coupons_percent_check;
alter table public.coupons add constraint coupons_percent_check check (percent between 0 and 50);
