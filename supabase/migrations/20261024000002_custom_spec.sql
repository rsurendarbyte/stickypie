-- QR and name stickers: save what to draw (QR content + label, or name, font,
-- colours and style) on the order line instead of an uploaded image. The admin
-- draws the print file from it when downloading.
alter table public.order_items
  add column if not exists custom_spec jsonb;
