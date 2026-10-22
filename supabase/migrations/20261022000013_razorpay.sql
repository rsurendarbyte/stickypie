-- Razorpay as a payment gateway. cf_order_id / cf_payment_id now hold the
-- gateway's order / payment ids for whichever provider took the order.
alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider in ('cashfree', 'razorpay', 'simulator'));

-- Which gateway new checkouts use, switched from admin → Settings. Orders
-- already placed keep their own gateway (orders.payment_provider).
alter table public.store_settings
  add column if not exists payment_gateway text not null default 'cashfree'
    check (payment_gateway in ('cashfree', 'razorpay'));
