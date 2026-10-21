-- One optional photo per review. Stored in Supabase Storage (bucket
-- "review-photos", random object names). Uploaded by the storefront server
-- (service role) after the browser has shrunk it; removed when an admin
-- rejects or deletes the review.

alter table public.product_reviews
  add column if not exists photo_path text,
  add column if not exists photo_url text;

-- Public view: approved reviews only, now with the photo.
create or replace view public.product_reviews_public as
  select id, product_id, author_name, rating, body, created_at, photo_url
  from public.product_reviews
  where status = 'approved';
grant select on public.product_reviews_public to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admins (from the admin app's own session) may remove review photos.
drop policy if exists "admins delete review photos" on storage.objects;
create policy "admins delete review photos" on storage.objects
  for delete using (bucket_id = 'review-photos' and public.is_admin());
drop policy if exists "admins read review photos" on storage.objects;
create policy "admins read review photos" on storage.objects
  for select using (bucket_id = 'review-photos' and public.is_admin());
