-- next_invoice_number() was callable by anyone with the public anon key
-- (rpc/next_invoice_number), so invoice numbers could be burned and the GST
-- series left with gaps. Only the delivered-order trigger needs it.
--
-- The trigger runs as whoever marks the order delivered (an admin's signed-in
-- role), so it becomes security definer first; then nobody else may call the
-- numbering function directly.

create or replace function public.assign_invoice_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.invoice_number is null then
    new.invoice_date := now();
    new.invoice_number := public.next_invoice_number(new.invoice_date);
  end if;
  return new;
end;
$$;

revoke execute on function public.next_invoice_number(timestamptz) from public, anon, authenticated;
revoke execute on function public.assign_invoice_number() from public, anon, authenticated;
