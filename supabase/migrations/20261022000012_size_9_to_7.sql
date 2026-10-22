-- The largest sticker size is now 7″ instead of 9″ (same prices). Past orders
-- keep the size they were bought in.
update public.products p
  set sizes = (
    select jsonb_agg(
      case when (s->>'inches')::numeric = 9 then jsonb_set(s, '{inches}', '7') else s end
      order by o
    )
    from jsonb_array_elements(p.sizes) with ordinality e(s, o)
  )
  where exists (select 1 from jsonb_array_elements(p.sizes) s where (s->>'inches')::numeric = 9);
