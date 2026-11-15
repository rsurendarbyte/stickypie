-- Live Messages in the admin: stream contact messages and replies over
-- Supabase Realtime. Row-level security still applies (admins only), so
-- shoppers never receive anyone's messages this way; their help bubble gets a
-- bare "something changed" signal on a channel named by their private key.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contact_messages'
  ) then
    alter publication supabase_realtime add table public.contact_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contact_replies'
  ) then
    alter publication supabase_realtime add table public.contact_replies;
  end if;
end $$;
