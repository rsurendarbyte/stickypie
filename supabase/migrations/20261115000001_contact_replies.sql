-- Contact messages become conversations: the admin replies (emailed to the
-- shopper), the shopper answers on a private page (/contact/t/<id>?k=<key>).
--
-- Status: new (needs our reply) → replied (waiting on the shopper) → resolved.
-- A shopper answer moves it back to new, even from resolved.

alter table public.contact_messages
  add column if not exists access_key text not null
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

alter table public.contact_messages drop constraint if exists contact_messages_status_check;
alter table public.contact_messages
  add constraint contact_messages_status_check check (status in ('new', 'replied', 'resolved'));

create table if not exists public.contact_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages(id) on delete cascade,
  author text not null check (author in ('admin', 'customer')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists contact_replies_message_idx on public.contact_replies (message_id, created_at);

-- Shopper answers are written by the storefront server (service role).
alter table public.contact_replies enable row level security;
drop policy if exists "admins read replies" on public.contact_replies;
create policy "admins read replies" on public.contact_replies for select using (public.is_admin());
drop policy if exists "admins write replies" on public.contact_replies;
create policy "admins write replies" on public.contact_replies
  for insert with check (public.is_admin() and author = 'admin');
drop policy if exists "admins delete replies" on public.contact_replies;
create policy "admins delete replies" on public.contact_replies for delete using (public.is_admin());
