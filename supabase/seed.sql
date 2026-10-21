-- StickyPie demo catalog.
-- Generated from packages/shared/src/seed-data.json (npm run seed:sql) — do not edit by hand.
-- Safe to re-run: existing slugs are skipped.

insert into public.categories (name, slug, sort) values
  ('Memes & Fun', 'memes', 1),
  ('Racing & JDM', 'racing', 2),
  ('Adventure & Off-Road', 'adventure', 3),
  ('Warning Labels', 'warning', 4),
  ('Origin Badges', 'origin', 5),
  ('Sticker Packs', 'packs', 6)
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'mountain-road-drive', 'Mountain Road Drive', 'A full-colour alpine hairpin run frozen mid-corner — pines, peaks and tail lights. Die-cut vinyl for laptops, toolboxes and tailgates.', 199, null, c.id,
  '/stickers/mountain-road-drive.png', array['car', 'mountains', 'scenic', 'touge']::text[], true, true, 40,
  now() - interval '0 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'street-racer-decal', 'Street Racer Decal', 'Night-city energy for your panel, helmet or lid. Printed on tough gloss vinyl with a clean die-cut edge.', 189, null, c.id,
  '/stickers/street-racer-decal.png', array['racing', 'street', 'decal']::text[], true, true, 35,
  now() - interval '2 days'
from public.categories c where c.slug = 'racing'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'anti-theft-manual', 'Anti-Theft: Manual Transmission', 'This vehicle is protected by a manual transmission. The only anti-theft device that also builds character. Weatherproof bumper-grade vinyl.', 149, 199, c.id,
  '/stickers/anti-theft-manual.png', array['manual', 'funny', 'bumper', 'car']::text[], true, true, 60,
  now() - interval '4 days'
from public.categories c where c.slug = 'warning'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'caution', 'Caution!', 'A bold yellow triangle for toolboxes, flight cases and questionable decisions. UV-resistant and loud about it.', 99, null, c.id,
  '/stickers/caution.png', array['caution', 'warning', 'yellow']::text[], false, true, 0,
  now() - interval '6 days'
from public.categories c where c.slug = 'warning'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'limited-edition', 'Limited Edition Badge', 'Everything is a collector''s item if you believe hard enough. Ticket-style badge in punchy print colours.', 139, null, c.id,
  '/stickers/limited-edition.png', array['badge', 'limited', 'ticket']::text[], false, true, 25,
  now() - interval '8 days'
from public.categories c where c.slug = 'memes'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'made-in-germany', 'Made in Germany', 'Precision-engineered flex for German metal. Clean flag badge with a classic plate-style outline.', 119, null, c.id,
  '/stickers/made-in-germany.png', array['germany', 'flag', 'badge', 'euro']::text[], false, true, 45,
  now() - interval '10 days'
from public.categories c where c.slug = 'origin'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'made-in-japan-racing', 'Made in Japan — Racing', 'Rising-sun racing badge for JDM loyalists. Sun-proof inks that survive summer parking.', 129, null, c.id,
  '/stickers/made-in-japan-racing.png', array['japan', 'jdm', 'racing', 'badge']::text[], false, true, 38,
  now() - interval '12 days'
from public.categories c where c.slug = 'origin'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'made-in-india', 'Made in India', 'Tiranga badge with plate-style chrome lines. Desi build, global pride — sticks anywhere you do.', 119, null, c.id,
  '/stickers/made-in-india.png', array['india', 'flag', 'badge', 'desi']::text[], true, true, 80,
  now() - interval '14 days'
from public.categories c where c.slug = 'origin'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'made-in-japan', 'Made in Japan', 'The understated JDM essential. Flag badge, clean border, zero drama — the car does the talking.', 119, null, c.id,
  '/stickers/made-in-japan.png', array['japan', 'jdm', 'flag', 'badge']::text[], false, true, 42,
  now() - interval '16 days'
from public.categories c where c.slug = 'origin'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'country-badge-pack', 'Country Badge Pack', 'The full origin-badge collection in one sheet — Germany, Japan, India and friends. Mix, match, debate in the group chat.', 349, null, c.id,
  '/stickers/country-badge-pack.png', array['pack', 'flags', 'badges', 'sheet']::text[], false, true, 20,
  now() - interval '18 days'
from public.categories c where c.slug = 'packs'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'nos-arrow', 'NOS Arrow', 'Press the red button. Bold yellow arrow logo for bumpers, bottles and anything that needs +50 imaginary horsepower.', 149, null, c.id,
  '/stickers/nos-arrow.png', array['nos', 'nitro', 'racing', 'yellow']::text[], true, true, 3,
  now() - interval '20 days'
from public.categories c where c.slug = 'racing'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'turbo-snail', 'Turbo Snail (PSSHH)', 'Slow car fast energy. The certified turbo snail goes PSSHH on every gear change. Die-cut, blow-off valve not included.', 149, null, c.id,
  '/stickers/turbo-snail.png', array['turbo', 'snail', 'funny', 'boost']::text[], true, true, 55,
  now() - interval '22 days'
from public.categories c where c.slug = 'memes'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'wasted', 'WASTED', 'For Mondays, missed apexes and respawns. Big red letters, thick black outline, instant cutscene.', 129, 159, c.id,
  '/stickers/wasted.png', array['wasted', 'gaming', 'gta', 'meme']::text[], true, true, null,
  now() - interval '24 days'
from public.categories c where c.slug = 'memes'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'turbo-talk-warning', 'Warning: Turbo Talk', 'Warning — may start talking about turbos at any time. A public-service label for your helmet or laptop.', 129, null, c.id,
  '/stickers/turbo-talk-warning.png', array['turbo', 'warning', 'funny']::text[], false, true, 33,
  now() - interval '26 days'
from public.categories c where c.slug = 'warning'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'petrol-holic', 'Petrol-Holic', 'Self-diagnosed, fuel-injected and not seeking treatment. Nozzle badge for tanks, toolkits and desks.', 139, null, c.id,
  '/stickers/petrol-holic.png', array['petrol', 'fuel', 'funny']::text[], false, true, 47,
  now() - interval '28 days'
from public.categories c where c.slug = 'memes'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'gt3-rs-poster', 'GT3 RS Graphic', 'Track-weapon silhouette in full poster-grade print. For people whose phone wallpaper is also a spoiler.', 249, null, c.id,
  '/stickers/gt3-rs-poster.png', array['porsche', 'track', 'poster']::text[], false, true, 15,
  now() - interval '30 days'
from public.categories c where c.slug = 'racing'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'rsr-racing-poster', 'RSR Racing Poster', 'Endurance-racing livery art, poster-grade print. Coming soon to the shelf — currently in the pit lane.', 249, null, c.id,
  '/stickers/rsr-racing-poster.png', array['racing', 'livery', 'poster']::text[], false, false, 18,
  now() - interval '32 days'
from public.categories c where c.slug = 'racing'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'mud-charger', 'Mud Charger', 'A red 4x4 charging through the slop like rent is due. For people who wash their car twice a year, both times reluctantly.', 199, null, c.id,
  '/stickers/mud-charger.png', array['offroad', '4x4', 'jeep', 'mud']::text[], false, true, 22,
  now() - interval '34 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'offroad-hunters-trail', 'Offroad Hunters: Trail Logo', 'Trail-crew mark for the ones who find the route when the map gives up. Matte-friendly print.', 149, null, c.id,
  '/stickers/offroad-hunters-trail.png', array['offroad', 'trail', 'logo']::text[], false, true, 30,
  now() - interval '36 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'explore-more', 'Explore More', 'Mountain sunset badge with one instruction: explore more. Fits bottles, bumpers and fuel-tank daydreams.', 189, null, c.id,
  '/stickers/explore-more.png', array['adventure', 'sunset', 'mountains']::text[], false, true, 26,
  now() - interval '38 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'offroad-hunters-emblem', 'Offroad Hunters Emblem', 'Full-colour expedition emblem — peaks, tyres and zero tarmac. Earn it, then stick it.', 169, null, c.id,
  '/stickers/offroad-hunters-emblem.png', array['offroad', 'emblem', 'expedition']::text[], false, true, 28,
  now() - interval '40 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'supra-racing-cutout', 'Supra Racing Cutout', 'Glossy orange legend, cut to the body line. The poster car of an entire generation, now pocket-sized.', 219, 249, c.id,
  '/stickers/supra-racing-cutout.png', array['supra', 'jdm', 'orange', 'legend']::text[], true, true, 19,
  now() - interval '42 days'
from public.categories c where c.slug = 'racing'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'born-to-ride', 'Born to Ride', 'Motocross badge for the braaap committee. Dust, whips and Sunday morning single-track.', 179, null, c.id,
  '/stickers/born-to-ride.png', array['moto', 'motocross', 'ride']::text[], true, true, 36,
  now() - interval '44 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'offroad-sticker-sheet', 'Adventure Off-Road Sheet', 'A full sheet of off-road badges, compasses and trail marks — one peel, instant expedition rig.', 299, 349, c.id,
  '/stickers/offroad-sticker-sheet.png', array['pack', 'sheet', 'offroad', 'adventure']::text[], true, true, 24,
  now() - interval '46 days'
from public.categories c where c.slug = 'packs'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'offroad-collection', 'Off-Road Collection', 'The greatest hits of dirt: a curated collection of off-road marks and badges in one grab.', 329, null, c.id,
  '/stickers/offroad-collection.png', array['pack', 'collection', 'offroad']::text[], false, true, 16,
  now() - interval '48 days'
from public.categories c where c.slug = 'packs'
on conflict (slug) do nothing;

insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select 'moto-adventure-emblem', 'Moto Adventure Emblem', 'Teal-and-orange ADV emblem for panniers, lids and long-way-round plans. Rain happens; this sticker doesn''t care.', 159, null, c.id,
  '/stickers/moto-adventure-emblem.png', array['moto', 'adv', 'emblem', 'touring']::text[], false, true, 31,
  now() - interval '50 days'
from public.categories c where c.slug = 'adventure'
on conflict (slug) do nothing;

