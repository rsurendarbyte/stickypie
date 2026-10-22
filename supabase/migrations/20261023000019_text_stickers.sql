-- Name & text stickers (custom page → "Name & text"): the shopper types a name
-- or short line, picks a font and colour, and the shop draws the sticker.
-- Priced per size here (admin → Settings). A size missing or 0 isn't offered.
alter table public.store_settings
  add column if not exists text_prices jsonb not null default '{"3": 39, "6": 79, "7": 119}'::jsonb;
