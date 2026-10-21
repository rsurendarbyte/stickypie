-- Grant admin-app access to an existing Supabase Auth user.
-- (Simpler: `npm run admin:create` does all of this from the terminal.)
--
-- 1. Supabase dashboard → Authentication → Users → "Add user" (email + password).
-- 2. Replace the email below and run this in the SQL editor. Don't commit
--    the real address — this repo is public.

insert into public.admin_users (user_id)
select id from auth.users where email = 'admin@example.com'
on conflict (user_id) do nothing;

-- Verify:
-- select u.email from public.admin_users a join auth.users u on u.id = a.user_id;
