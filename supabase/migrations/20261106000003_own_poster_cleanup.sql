-- A shopper's own wall posters are deleted some days after delivery, or by the admin. The order
-- keeps the poster's name and size, without its picture.
drop policy if exists "admins delete own posters" on storage.objects;
create policy "admins delete own posters" on storage.objects
  for delete to authenticated
  using (bucket_id = 'custom-stickers' and (storage.foldername(name))[1] = 'own-posters' and public.is_admin());

-- Admins can't update order lines directly (RLS).
create or replace function public.clear_own_posters(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;
  update public.order_items i
     set pack_posters = (
           select jsonb_agg(case when p ? 'own' then p || '{"image_url": ""}'::jsonb else p end order by n)
             from jsonb_array_elements(i.pack_posters) with ordinality t(p, n)
         ),
         image_url = coalesce((
           select p->>'image_url'
             from jsonb_array_elements(i.pack_posters) with ordinality t(p, n)
            where not p ? 'own'
            order by n limit 1
         ), '')
   where i.order_id = p_order_id and i.pack_posters @> '[{"own": true}]'::jsonb;
end;
$$;
revoke all on function public.clear_own_posters(uuid) from public, anon;
grant execute on function public.clear_own_posters(uuid) to authenticated, service_role;
