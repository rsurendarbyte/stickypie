-- Avatar sticker book: the shopper picks one style per page and pays one
-- price for the book; their photo uploads after payment like a custom design.
-- We draw the pages by hand and attach the finished files to the order line
-- so the shopper sees them on the order page.

-- The book on sale: pages (one style each) and one price. Price 0 = off.
alter table public.store_settings
  add column if not exists avatar_book jsonb not null
    default '{"pages": 4, "price": 300}'::jsonb;

-- Styles the shopper picks from, one per page: card pictures of one avatar each
-- (a girl and a boy, rotated on the card) and sample sheets:
-- [{"label": "90s Retro", "covers": ["https://…"], "images": ["https://…"]}].
-- 90s Retro, Anime, Chibi, Comic Book, Action Figure, 3D Cartoon, Pixel Art, Clay Toy, Bollywood Poster, Superhero, Pencil Sketch, Watercolour Storybook, Street Graffiti, Desi Festive, K-Pop Idol and Pop Art start with the pictures and sheets bundled with the storefront.
alter table public.store_settings
  add column if not exists avatar_styles jsonb not null
    default '[{"label":"90s Retro","covers":["/avatar-samples/90s-retro-cover.webp","/avatar-samples/90s-retro-cover-boy.webp"],"images":["/avatar-samples/90s-retro-girl.webp","/avatar-samples/90s-retro-boy.webp"]},{"label":"Anime","covers":["/avatar-samples/anime-cover.webp","/avatar-samples/anime-cover-boy.webp"],"images":["/avatar-samples/anime-girl.webp","/avatar-samples/anime-boy.webp"]},{"label":"Chibi","covers":["/avatar-samples/chibi-cover.webp","/avatar-samples/chibi-cover-boy.webp"],"images":["/avatar-samples/chibi-girl.webp","/avatar-samples/chibi-boy.webp"]},{"label":"Comic Book","covers":["/avatar-samples/comic-cover.webp","/avatar-samples/comic-cover-boy.webp"],"images":["/avatar-samples/comic-girl.webp","/avatar-samples/comic-boy.webp"]},{"label":"Action Figure","covers":["/avatar-samples/action-figure-cover.webp","/avatar-samples/action-figure-cover-boy.webp"],"images":["/avatar-samples/action-figure-girl.webp","/avatar-samples/action-figure-boy.webp"]},{"label":"3D Cartoon","covers":["/avatar-samples/3d-cartoon-cover.webp","/avatar-samples/3d-cartoon-cover-boy.webp"],"images":["/avatar-samples/3d-cartoon-girl.webp","/avatar-samples/3d-cartoon-boy.webp"]},{"label":"Pixel Art","covers":["/avatar-samples/pixel-art-cover.webp","/avatar-samples/pixel-art-cover-boy.webp"],"images":["/avatar-samples/pixel-art-girl.webp","/avatar-samples/pixel-art-boy.webp"]},{"label":"Clay Toy","covers":["/avatar-samples/clay-toy-cover.webp","/avatar-samples/clay-toy-cover-boy.webp"],"images":["/avatar-samples/clay-toy-girl.webp","/avatar-samples/clay-toy-boy.webp"]},{"label":"Bollywood Poster","covers":["/avatar-samples/bollywood-cover.webp","/avatar-samples/bollywood-cover-boy.webp"],"images":["/avatar-samples/bollywood-girl.webp","/avatar-samples/bollywood-boy.webp"]},{"label":"Superhero","covers":["/avatar-samples/superhero-cover.webp","/avatar-samples/superhero-cover-boy.webp"],"images":["/avatar-samples/superhero-girl.webp","/avatar-samples/superhero-boy.webp"]},{"label":"Pencil Sketch","covers":["/avatar-samples/pencil-sketch-cover.webp","/avatar-samples/pencil-sketch-cover-boy.webp"],"images":["/avatar-samples/pencil-sketch-girl.webp","/avatar-samples/pencil-sketch-boy.webp"]},{"label":"Watercolour Storybook","covers":["/avatar-samples/storybook-cover.webp","/avatar-samples/storybook-cover-boy.webp"],"images":["/avatar-samples/storybook-girl.webp","/avatar-samples/storybook-boy.webp"]},{"label":"Street Graffiti","covers":["/avatar-samples/graffiti-cover.webp","/avatar-samples/graffiti-cover-boy.webp"],"images":["/avatar-samples/graffiti-girl.webp","/avatar-samples/graffiti-boy.webp"]},{"label":"Desi Festive","covers":["/avatar-samples/desi-cover.webp","/avatar-samples/desi-cover-boy.webp"],"images":["/avatar-samples/desi-girl.webp","/avatar-samples/desi-boy.webp"]},{"label":"Cricket Star","covers":[],"images":[]},{"label":"Cyberpunk Neon","covers":[],"images":[]},{"label":"Plush Toy","covers":[],"images":[]},{"label":"Big-Head Vinyl Toy","covers":[],"images":[]},{"label":"K-Pop Idol","covers":["/avatar-samples/kpop-cover.webp","/avatar-samples/kpop-cover-boy.webp"],"images":["/avatar-samples/kpop-girl.webp","/avatar-samples/kpop-boy.webp"]},{"label":"Pop Art","covers":["/avatar-samples/pop-art-cover.webp","/avatar-samples/pop-art-cover-boy.webp"],"images":["/avatar-samples/pop-art-girl.webp","/avatar-samples/pop-art-boy.webp"]},{"label":"Renaissance Portrait","covers":[],"images":[]}]'::jsonb;

-- Public URLs of the finished stickers (set from the admin).
alter table public.order_items
  add column if not exists finished_files jsonb not null default '[]'::jsonb;

-- Admins can't update order lines directly (RLS), so the admin sets the
-- finished files through this function.
create or replace function public.admin_set_finished_files(p_order_id uuid, p_item_id uuid, p_files jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;
  if jsonb_typeof(p_files) <> 'array' then
    raise exception 'Files must be a list';
  end if;
  update public.order_items
     set finished_files = p_files
   where id = p_item_id and order_id = p_order_id and is_custom;
  if not found then
    raise exception 'Order line not found';
  end if;
end;
$$;

revoke execute on function public.admin_set_finished_files(uuid, uuid, jsonb) from public, anon;
grant execute on function public.admin_set_finished_files(uuid, uuid, jsonb) to authenticated, service_role;

-- The admin uploads finished stickers into the custom-stickers bucket under
-- finished/ (public like the rest of the bucket, random names). Supabase
-- Storage sends CORS headers, so the order page can draw them into a share
-- image.
drop policy if exists "admins upload finished stickers" on storage.objects;
create policy "admins upload finished stickers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'custom-stickers' and (storage.foldername(name))[1] = 'finished' and public.is_admin());
