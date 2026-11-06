-- Deleting a storage file first has to find it, and that takes a select policy:
-- with only the delete policy, an admin's delete quietly matched nothing.
drop policy if exists "admins read own posters" on storage.objects;
create policy "admins read own posters" on storage.objects
  for select to authenticated
  using (bucket_id = 'custom-stickers' and (storage.foldername(name))[1] = 'own-posters' and public.is_admin());
