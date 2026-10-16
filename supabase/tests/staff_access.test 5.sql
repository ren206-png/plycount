-- ============================================================
-- pgTAP tests for supabase/migrations/20261015016_staff_access_and_cost_split.sql
-- Staff ("sales basics" = role sales_rep), the cost split, and the atomic
-- quote->order conversion. Same RLS-simulation pattern as the other files.
-- Run with: supabase test db
-- ============================================================
begin;
select plan(31);

-- ---- fixtures -------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Staff Test Org', 'staff-org');

insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer One'),
  ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Customer Two');

insert into public.products (id, organization_id, name, sku_code, unit_of_measure) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Kraft roll', 'ST-1', 'roll');

-- cost 3.10 + 0.40 + 0.80 + 0.25 = 4.55 per unit
insert into public.cost_inputs (organization_id, product_id, raw_material_cost, packaging_cost, labor_cost, freight_cost_per_unit, effective_date, source)
values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 3.10, 0.40, 0.80, 0.25, '2026-01-01', 'manual');

insert into public.price_books (id, organization_id, customer_id, name, is_contract, effective_start) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Contract', true, '2026-01-01');
insert into public.price_book_lines (price_book_id, product_id, unit_price, min_qty)
values ('b0000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 6.00, 1);

-- a portal customer's own sent quote (line inserted as the table owner; the trigger still fires)
insert into public.quotes (id, organization_id, customer_id, status) values
  ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'sent');
insert into public.quote_lines (id, quote_id, product_id, qty, unit_price)
values ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 10, 6.00);

insert into public.orders (id, organization_id, customer_id) values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111');
insert into public.order_lines (id, order_id, product_id, qty, unit_price)
values ('f2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 5, 6.00);
insert into public.invoices (id, organization_id, order_id, status) values
  ('f3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'sent');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@staff.local'),
  ('a0000000-0000-0000-0000-0000000000b1', 'sam@staff.local'),
  ('a0000000-0000-0000-0000-0000000000c1', 'portal@staff.local');

insert into public.user_profiles (auth_user_id, organization_id, customer_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', null, 'admin@staff.local', 'Admin', 'administrator', 'active'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', null, 'sam@staff.local', 'Sam (staff)', 'sales_rep', 'active'),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'portal@staff.local', 'Portal', 'client_viewer', 'invited');

-- ============================================================
-- STAFF (Sam, sales_rep): can view and quote, nothing more
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select is((select count(*) from public.customers), 2::bigint, 'staff can view customers');
select is((select count(*) from public.products), 1::bigint, 'staff can view products');
select is((select count(*) from public.price_book_lines), 1::bigint, 'staff can view price books');
select is((select count(*) from public.orders), 1::bigint, 'staff can view orders');
select is((select count(*) from public.cost_inputs), 0::bigint, 'staff cannot read cost inputs');
select is((select count(*) from public.latest_cost_input('a1111111-1111-1111-1111-111111111111') where id is not null), 0::bigint, 'staff cannot read cost via latest_cost_input');
select is((select count(*) from public.invoices), 0::bigint, 'staff cannot read invoices');
select is((select count(*) from public.user_profiles), 1::bigint, 'staff see only their own profile, not the roster');

select lives_ok(
  $$insert into public.quotes (id, organization_id, customer_id, status) values ('d2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'draft')$$,
  'staff can create a quote'
);
select lives_ok(
  $$insert into public.quote_lines (id, quote_id, product_id, qty, unit_price) values ('e2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 4, 6.00)$$,
  'staff can add a line to their quote'
);
with updated as (update public.quote_lines set unit_price = 5.50 where id = 'e2222222-2222-2222-2222-222222222222' returning id)
select is((select count(*) from updated), 1::bigint, 'staff can edit a quote line');
select is((select count(*) from public.quote_line_costs), 0::bigint, 'staff cannot read quote line costs');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('quote_lines', 'order_lines') and column_name in ('unit_cost_snapshot', 'margin_pct', 'cost_effective_date')), 0::bigint, 'quote and order lines no longer carry any cost or margin column');

select throws_ok(
  $$insert into public.customers (organization_id, name) values ('11111111-1111-1111-1111-111111111111', 'x')$$,
  '42501', null, 'staff cannot create customers'
);
with updated as (update public.products set name = 'HACKED' returning id)
select is((select count(*) from updated), 0::bigint, 'staff cannot change products');
select throws_ok(
  $$insert into public.price_books (organization_id, name, effective_start) values ('11111111-1111-1111-1111-111111111111', 'x', '2026-01-01')$$,
  '42501', null, 'staff cannot create price books'
);
with updated as (update public.price_book_lines set unit_price = 0.01 returning id)
select is((select count(*) from updated), 0::bigint, 'staff cannot change prices');
select throws_ok(
  $$insert into public.orders (organization_id, customer_id) values ('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'staff cannot create orders'
);
with deleted as (delete from public.quotes where id = 'd2222222-2222-2222-2222-222222222222' returning id)
select is((select count(*) from deleted), 0::bigint, 'staff cannot delete quotes');
select throws_ok(
  $$select public.convert_quote_to_order('d2222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'staff cannot convert a quote to an order'
);
reset role;

-- ============================================================
-- ADMIN (Alice): sees the captured cost, converts atomically
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select unit_cost_snapshot from public.quote_line_costs where quote_line_id = 'e2222222-2222-2222-2222-222222222222'), 4.55::numeric, 'the cost was captured by the database on the staff-created line, and the admin can read it');
select throws_ok(
  $$insert into public.quote_line_costs (quote_line_id, unit_cost_snapshot) values ('e1111111-1111-1111-1111-111111111111', 0.01)$$,
  '42501', null, 'nobody can write costs directly (not even an admin)'
);
select lives_ok(
  $$select public.convert_quote_to_order('d2222222-2222-2222-2222-222222222222')$$,
  'an admin can convert a quote to an order'
);
select is((select status from public.quotes where id = 'd2222222-2222-2222-2222-222222222222'), 'accepted', 'the converted quote is marked accepted');
select is((select count(*) from public.order_lines ol join public.orders o on o.id = ol.order_id where o.quote_id = 'd2222222-2222-2222-2222-222222222222'), 1::bigint, 'the order lines were created');
select is((select olc.unit_cost_snapshot from public.order_line_costs olc join public.order_lines ol on ol.id = olc.order_line_id join public.orders o on o.id = ol.order_id where o.quote_id = 'd2222222-2222-2222-2222-222222222222'), 4.55::numeric, 'the hidden cost was carried onto the order line');
select is((select count(*) from public.audit_log where action = 'quote.converted_to_order'), 1::bigint, 'the conversion was written to the audit log');
select throws_ok(
  $$select public.convert_quote_to_order('d2222222-2222-2222-2222-222222222222')$$,
  '22023', null, 'an already converted quote cannot be converted twice'
);
reset role;

-- ============================================================
-- PORTAL customer: still sees their quote, never any cost
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.quote_lines), 1::bigint, 'portal customer still sees their own quote lines');
select is((select count(*) from public.quote_line_costs), 0::bigint, 'portal customer cannot read quote line costs');
select throws_ok(
  $$select public.convert_quote_to_order('d1111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'portal customer cannot convert a quote'
);
reset role;

select * from finish();
rollback;
