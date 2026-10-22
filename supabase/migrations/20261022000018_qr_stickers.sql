-- QR code stickers (custom page → "QR code"): the shop generates the QR from a
-- link / UPI ID / WhatsApp number, priced per size here (admin → Settings).
-- A size missing or 0 isn't offered.
alter table public.store_settings
  add column if not exists qr_prices jsonb not null default '{"3": 49, "6": 99, "7": 149}'::jsonb;
