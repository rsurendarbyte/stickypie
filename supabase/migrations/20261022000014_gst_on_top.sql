-- GST is now added on top of prices at checkout:
--   total = subtotal + shipping_fee + gst_amount
-- gst_amount / gst_rate are NULL for orders placed before this, whose prices
-- already included GST (their invoices keep working the old way).
alter table public.orders
  add column if not exists gst_amount integer check (gst_amount is null or gst_amount >= 0),
  add column if not exists gst_rate numeric(5, 2) check (gst_rate is null or (gst_rate >= 0 and gst_rate <= 28));
