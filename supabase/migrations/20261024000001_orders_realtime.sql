-- Live new-order alerts in the admin panel: stream order changes over Supabase
-- Realtime. Row-level security still applies (only admins can read orders), so
-- shoppers never receive other people's orders.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
