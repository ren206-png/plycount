-- ============================================================
-- pgTAP tests for supabase/migrations/20261016019_invoice_payments.sql
-- Invoice numbering, payments, paid status, and who can see what.
-- Run with: supabase test db
-- ============================================================
begin;
select plan(19);

insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'pay-a'),
  ('22222222-2222-2222-2222-222222222222', 'Org B', 'pay-b');

insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer A'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Customer B');

insert into public.orders (id, organization_id, customer_id) values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'),
  ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222');

-- invoices as the table owner: the trigger numbers them (a supplied number is ignored)
insert into public.invoices (id, organization_id, order_id, status, total_amount, invoice_number, due_date) values
  ('11000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'sent', 100.00, 'HACK-1', current_date + 5),
  ('11000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'draft', 50.00, null, null),
  ('11000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'sent', 80.00, null, current_date - 3),
  ('22000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'sent', 70.00, null, null);

select is((select invoice_number from public.invoices where id = '11000000-0000-0000-0000-000000000001'), 'INV-0001', 'the first invoice of a company is INV-0001 (a supplied number is ignored)');
select is((select invoice_number from public.invoices where id = '11000000-0000-0000-0000-000000000003'), 'INV-0003', 'numbers run in sequence within a company');
select is((select invoice_number from public.invoices where id = '22000000-0000-0000-0000-000000000001'), 'INV-0001', 'each company counts from 1 on its own');
select throws_ok(
  $$update public.invoices set invoice_number = 'INV-0001' where id = '11000000-0000-0000-0000-000000000003'$$,
  '23505', null, 'two invoices in one company can never share a number'
);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin-a@pay.local'),
  ('a0000000-0000-0000-0000-0000000000b1', 'staff-a@pay.local'),
  ('a0000000-0000-0000-0000-0000000000c1', 'admin-b@pay.local');
insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin-a@pay.local', 'Admin A', 'administrator', 'active'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'staff-a@pay.local', 'Staff A', 'sales_rep', 'active'),
  ('a0000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'admin-b@pay.local', 'Admin B', 'administrator', 'active');

-- ============================================================
-- ADMIN A: record payments
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$insert into public.invoice_payments (organization_id, invoice_id, amount, method, reference) values ('11111111-1111-1111-1111-111111111111', '11000000-0000-0000-0000-000000000001', 40.00, 'eft', 'ref-1')$$,
  'an admin can record a part payment on a sent invoice'
);
select is((select status from public.invoices where id = '11000000-0000-0000-0000-000000000001'), 'sent', 'a part payment leaves the invoice sent');
select is((select balance from public.invoice_balances where invoice_id = '11000000-0000-0000-0000-000000000001'), 60.00::numeric, 'the balance is the total minus what was paid');
select is((select recorded_by from public.invoice_payments where reference = 'ref-1'), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'the database records who entered the payment');
select throws_ok(
  $$insert into public.invoice_payments (organization_id, invoice_id, amount) values ('11111111-1111-1111-1111-111111111111', '11000000-0000-0000-0000-000000000001', 60.01)$$,
  '23514', null, 'a payment bigger than the balance is refused'
);
select lives_ok(
  $$insert into public.invoice_payments (organization_id, invoice_id, amount) values ('11111111-1111-1111-1111-111111111111', '11000000-0000-0000-0000-000000000001', 60.00)$$,
  'paying the exact balance is accepted'
);
select is((select status from public.invoices where id = '11000000-0000-0000-0000-000000000001'), 'paid', 'the invoice becomes paid by itself when payments cover the total');
select isnt((select paid_at from public.invoices where id = '11000000-0000-0000-0000-000000000001'), null, 'the paid time is recorded');
with deleted as (delete from public.invoice_payments where reference = 'ref-1' returning id)
select is((select count(*) from deleted), 1::bigint, 'an admin can delete a wrong payment');
select is((select status from public.invoices where id = '11000000-0000-0000-0000-000000000001'), 'sent', 'removing a payment reopens a paid invoice');
select throws_ok(
  $$insert into public.invoice_payments (organization_id, invoice_id, amount) values ('11111111-1111-1111-1111-111111111111', '11000000-0000-0000-0000-000000000002', 10)$$,
  '23514', null, 'a draft invoice cannot take a payment'
);
select throws_ok(
  $$insert into public.invoice_payments (organization_id, invoice_id, amount) values ('11111111-1111-1111-1111-111111111111', '22000000-0000-0000-0000-000000000001', 10)$$,
  '42501', null, 'an admin cannot record a payment against another company''s invoice'
);
select throws_ok(
  $$update public.invoices set status = 'paid' where id = '11000000-0000-0000-0000-000000000003'$$,
  '23514', null, 'an invoice cannot be marked paid without payments covering it'
);
select is((select is_overdue from public.invoice_balances where invoice_id = '11000000-0000-0000-0000-000000000003'), true, 'a sent invoice past its due date with a balance is overdue');
reset role;

-- ============================================================
-- STAFF: sees nothing about payments or balances
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.invoice_payments) + (select count(*) from public.invoice_balances), 0::bigint, 'staff see no payments and no invoice balances');
reset role;

select * from finish();
rollback;
