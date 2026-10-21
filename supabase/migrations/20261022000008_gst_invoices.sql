-- GST tax invoices: seller details (admin → Settings) + an invoice number that
-- is assigned the moment an order is marked delivered (never before).

alter table public.store_settings
  add column if not exists business_name text,
  add column if not exists gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$'),
  add column if not exists business_address text,
  add column if not exists invoice_hsn text not null default '3919',
  add column if not exists gst_rate numeric(5, 2) not null default 18 check (gst_rate >= 0 and gst_rate <= 28),
  add column if not exists invoice_prefix text not null default 'SP'
    check (invoice_prefix ~ '^[A-Z0-9-]{1,8}$');

alter table public.orders
  add column if not exists invoice_number text unique,
  add column if not exists invoice_date timestamptz;

create sequence if not exists public.invoice_seq;

-- "SP/2026-27/00042" — Indian financial year (April–March).
create or replace function public.next_invoice_number(p_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefix text;
  v_year int := extract(year from p_at at time zone 'Asia/Kolkata');
  v_month int := extract(month from p_at at time zone 'Asia/Kolkata');
  v_fy text;
begin
  select invoice_prefix into v_prefix from public.store_settings where id = 1;
  if v_month < 4 then v_year := v_year - 1; end if;
  v_fy := v_year || '-' || lpad(((v_year + 1) % 100)::text, 2, '0');
  return coalesce(v_prefix, 'SP') || '/' || v_fy || '/' || lpad(nextval('public.invoice_seq')::text, 5, '0');
end;
$$;

create or replace function public.assign_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.invoice_number is null then
    new.invoice_date := now();
    new.invoice_number := public.next_invoice_number(new.invoice_date);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_invoice on public.orders;
create trigger orders_assign_invoice
  before update on public.orders
  for each row execute function public.assign_invoice_number();

-- Orders already delivered before this migration get numbers in delivery order.
do $$
declare r record;
begin
  for r in
    select id, coalesce(delivered_at, updated_at) as at from public.orders
    where status = 'delivered' and invoice_number is null
    order by coalesce(delivered_at, updated_at)
  loop
    update public.orders
      set invoice_date = r.at, invoice_number = public.next_invoice_number(r.at)
      where id = r.id;
  end loop;
end $$;
