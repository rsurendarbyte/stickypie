-- Shiprocket shipping: references to the Shiprocket order/shipment, the label,
-- and the courier's latest status (from Shiprocket's tracking webhook).
alter table public.orders
  add column if not exists shiprocket_order_id text,
  add column if not exists shiprocket_shipment_id text,
  add column if not exists shipping_label_url text,
  add column if not exists courier_status text,
  add column if not exists courier_status_at timestamptz;

create index if not exists orders_shiprocket_order_idx on public.orders (shiprocket_order_id);
create index if not exists orders_tracking_number_idx on public.orders (tracking_number);
