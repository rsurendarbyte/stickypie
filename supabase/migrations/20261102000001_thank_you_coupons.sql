-- Thank-you card: the QR opens the order's feedback without signing in (a
-- random per-order key in the link), and good feedback earns a one-time
-- discount code for the customer's next order.

-- Per-order key printed in the card's QR. Random per row (existing orders too).
alter table public.orders
  add column if not exists feedback_token text not null default replace(gen_random_uuid()::text, '-', '');

-- Discount applied at checkout (₹ off the sticker subtotal; GST is on the rest).
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_amount integer not null default 0;

-- Feedback from the card's link can come from a guest order (no account).
alter table public.product_reviews alter column user_id drop not null;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent integer not null check (percent between 1 and 90),
  -- One reward per order's feedback.
  source_order_id uuid not null unique references public.orders(id) on delete cascade,
  email text not null,
  phone text not null default '',
  expires_at timestamptz not null,
  used_order_id uuid references public.orders(id) on delete set null,
  used_at timestamptz,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;
-- The storefront uses the service role; only admins read/change codes directly.
drop policy if exists "admins read coupons" on public.coupons;
create policy "admins read coupons" on public.coupons for select using (public.is_admin());
drop policy if exists "admins update coupons" on public.coupons;
create policy "admins update coupons" on public.coupons
  for update using (public.is_admin()) with check (public.is_admin());

-- A code is spent when the order that used it is paid (whichever path marks it paid).
create or replace function public.spend_order_coupon()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.discount_code is not null then
    update public.coupons
       set used_order_id = new.id, used_at = now()
     where code = new.discount_code and used_order_id is null;
  end if;
  return new;
end $$;

drop trigger if exists orders_spend_coupon on public.orders;
create trigger orders_spend_coupon after update of status on public.orders
  for each row execute function public.spend_order_coupon();
