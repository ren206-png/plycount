-- ============================================================
-- 019_invoice_payments.sql
--
-- Sending invoices and getting paid.
--   * every invoice gets a sequential number per company (INV-0001, ...)
--   * issue date, due date, sent and paid timestamps
--   * invoice_payments: money received against an invoice (part payments ok)
--   * the invoice becomes 'paid' by itself when payments cover the total, and
--     goes back to 'sent' if a payment is removed
--   * invoice_balances: amount paid, balance and overdue flag per invoice
--
-- Payments are admin-only (the same people who can see invoices). The rules
-- live here in the database so they hold no matter what calls the API.
-- ============================================================

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists issue_date date,
  add column if not exists due_date date,
  add column if not exists sent_at timestamptz,
  add column if not exists paid_at timestamptz;

-- Number any invoices created before this migration, oldest first, per company.
with numbered as (
  select id, row_number() over (partition by organization_id order by created_at, id) as n
  from public.invoices
  where invoice_number is null
)
update public.invoices i
set invoice_number = 'INV-' || lpad(numbered.n::text, 4, '0')
from numbered
where i.id = numbered.id;

alter table public.invoices alter column invoice_number set not null;
create unique index if not exists idx_invoices_org_number on public.invoices (organization_id, invoice_number);

-- Sequential numbering per company. The advisory lock stops two invoices
-- created at the same moment from taking the same number; whatever number the
-- caller supplies is ignored.
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('invoice-number:' || new.organization_id::text, 0));
  select coalesce(max(substring(invoice_number from '^INV-(\d+)$')::integer), 0) + 1
    into next_n
  from public.invoices
  where organization_id = new.organization_id
    and invoice_number ~ '^INV-\d+$';
  new.invoice_number := 'INV-' || lpad(next_n::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_invoices_assign_number on public.invoices;
create trigger trg_invoices_assign_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- ------------------------------------------------------------
-- Payments
-- ------------------------------------------------------------
create table if not exists public.invoice_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  amount          numeric(14, 2) not null check (amount > 0),
  paid_on         date not null default current_date,
  method          text not null default 'other'
                    check (method in ('cheque', 'eft', 'cash', 'card', 'other')),
  reference       text,
  recorded_by     uuid references auth.users(id) default auth.uid(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice on public.invoice_payments (invoice_id);
create index if not exists idx_invoice_payments_org_date on public.invoice_payments (organization_id, paid_on desc);

alter table public.invoice_payments enable row level security;

drop policy if exists "invoice_payments_select" on public.invoice_payments;
create policy "invoice_payments_select" on public.invoice_payments for select to authenticated
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "invoice_payments_insert" on public.invoice_payments;
create policy "invoice_payments_insert" on public.invoice_payments for insert to authenticated
  with check (
    (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
    and recorded_by = auth.uid()
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.organization_id = invoice_payments.organization_id)
  );

-- No update policy: a wrong payment is deleted and entered again.
drop policy if exists "invoice_payments_delete" on public.invoice_payments;
create policy "invoice_payments_delete" on public.invoice_payments for delete to authenticated
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

revoke all on public.invoice_payments from anon;

-- A payment needs a sent invoice and cannot be more than what is still owed.
create or replace function public.check_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  paid numeric;
begin
  select id, status, total_amount into inv from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception 'invoice not found' using errcode = '23503';
  end if;
  if inv.status not in ('sent', 'paid') then
    raise exception 'send the invoice before recording a payment' using errcode = '23514';
  end if;
  select coalesce(sum(amount), 0) into paid from public.invoice_payments where invoice_id = new.invoice_id;
  if paid + new.amount > inv.total_amount + 0.004 then
    raise exception 'this payment is more than the balance owed' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_payments_check on public.invoice_payments;
create trigger trg_invoice_payments_check
  before insert on public.invoice_payments
  for each row execute function public.check_invoice_payment();

-- Keep the invoice's status in step with its payments.
create or replace function public.sync_invoice_paid_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_id uuid := coalesce(new.invoice_id, old.invoice_id);
  inv record;
  paid numeric;
begin
  select id, status, total_amount into inv from public.invoices where id = inv_id for update;
  if not found then
    return null;
  end if;
  select coalesce(sum(amount), 0) into paid from public.invoice_payments where invoice_id = inv_id;
  if inv.status = 'sent' and paid >= inv.total_amount - 0.004 and inv.total_amount > 0 then
    update public.invoices set status = 'paid', paid_at = now() where id = inv_id;
  elsif inv.status = 'paid' and paid < inv.total_amount - 0.004 then
    update public.invoices set status = 'sent', paid_at = null where id = inv_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_invoice_payments_sync on public.invoice_payments;
create trigger trg_invoice_payments_sync
  after insert or delete on public.invoice_payments
  for each row execute function public.sync_invoice_paid_status();

-- Status rules on the invoice itself: it cannot be called paid without the
-- money, and it cannot be voided once money has been recorded against it.
create or replace function public.guard_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid numeric;
begin
  if new.status is distinct from old.status and new.status in ('paid', 'void') then
    select coalesce(sum(amount), 0) into paid from public.invoice_payments where invoice_id = new.id;
    if new.status = 'paid' and paid < new.total_amount - 0.004 then
      raise exception 'an invoice is paid only when payments cover the total' using errcode = '23514';
    end if;
    if new.status = 'void' and paid > 0 then
      raise exception 'delete the recorded payments before voiding this invoice' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_guard_status on public.invoices;
create trigger trg_invoices_guard_status
  before update on public.invoices
  for each row execute function public.guard_invoice_status();

-- ------------------------------------------------------------
-- Balances. security_invoker: the caller's own access rules apply.
-- ------------------------------------------------------------
create or replace view public.invoice_balances
with (security_invoker = true) as
select
  i.id as invoice_id,
  i.organization_id,
  i.total_amount,
  coalesce(sum(p.amount), 0)::numeric(14, 2) as amount_paid,
  (i.total_amount - coalesce(sum(p.amount), 0))::numeric(14, 2) as balance,
  (
    i.status = 'sent'
    and i.due_date is not null
    and i.due_date < current_date
    and i.total_amount - coalesce(sum(p.amount), 0) > 0
  ) as is_overdue
from public.invoices i
left join public.invoice_payments p on p.invoice_id = i.id
group by i.id;

revoke all on public.invoice_balances from anon;
grant select on public.invoice_balances to authenticated;
