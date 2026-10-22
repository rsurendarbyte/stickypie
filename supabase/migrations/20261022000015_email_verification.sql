-- 6-digit codes that prove a new shopper owns their email before the account
-- is created. Only the storefront server (service role) touches this table.
create table if not exists public.email_verifications (
  email text primary key check (email = lower(email)),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  sends smallint not null default 1,
  window_start timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);
alter table public.email_verifications enable row level security;
-- No policies: anon/authenticated can't read or write; the service role bypasses RLS.
