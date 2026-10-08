-- ============================================================
-- pgTAP tests for supabase/migrations/20261008014_security_hardening.sql
--
-- Each block reproduces an attack found in the 2026-10-08 security
-- review and asserts it is now refused, plus regression checks that
-- legitimate staff behavior is unchanged. Same RLS-simulation pattern
-- as portal_rls.test.sql: `set local role` + `request.jwt.claims`.
--
-- Run with: supabase test db
-- ============================================================
begin;
select plan(31);

-- ---- fixtures -------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Factory A', 'sec-a'),
  ('22222222-2222-2222-2222-222222222222', 'Other Co B', 'sec-b');

insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer One'),
  ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Customer Two'),
  ('c3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'SecretCo');

insert into public.products (id, organization_id, name, sku_code, unit_of_measure) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'On One''s quote', 'SEC-1', 'roll'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Not on any of One''s docs', 'SEC-2', 'roll');

insert into public.cost_inputs (organization_id, product_id, raw_material_cost, packaging_cost, labor_cost, freight_cost_per_unit, effective_date, source)
values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 3.10, 0.40, 0.80, 0.25, '2026-01-01', 'manual');

insert into public.price_books (id, organization_id, customer_id, name, is_contract, effective_start) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Customer Two contract', true, '2026-01-01');
insert into public.price_book_lines (price_book_id, product_id, unit_price, min_qty)
values ('b0000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 4.55, 1);

insert into public.quotes (id, organization_id, customer_id, status) values
  ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'sent');
insert into public.quote_lines (id, quote_id, product_id, qty, unit_price, unit_cost_snapshot)
values ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 10, 5.00, 3.00);
insert into public.orders (id, organization_id, customer_id) values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@sec.local'),
  ('a0000000-0000-0000-0000-00000000000b', 'rep@sec.local'),
  ('a0000000-0000-0000-0000-0000000000c1', 'vic@sec.local'),
  ('a0000000-0000-0000-0000-0000000000d1', 'mallory@sec.local');

insert into public.user_profiles (auth_user_id, organization_id, customer_id, email, full_name, role) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', null, 'admin@sec.local', 'Admin', 'administrator'),
  ('a0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', null, 'rep@sec.local', 'Rep', 'sales_rep'),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'vic@sec.local', 'Vic (portal)', 'client_viewer'),
  ('a0000000-0000-0000-0000-0000000000d1', '22222222-2222-2222-2222-222222222222', null, 'mallory@sec.local', 'Mallory', 'organization_owner');

-- ============================================================
-- PORTAL LOGIN (Vic, scoped to Customer One)
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is((select count(*) from public.cost_inputs), 0::bigint, 'portal login cannot read internal costs');
select is((select count(*) from public.price_books), 0::bigint, 'portal login cannot read price books');
select is((select count(*) from public.price_book_lines), 0::bigint, 'portal login cannot read other customers'' contract prices');
select is((select count(*) from public.products where id = 'a1111111-1111-1111-1111-111111111111'), 1::bigint, 'portal login still sees a product on its own sent quote');
select is((select count(*) from public.products where id = 'a2222222-2222-2222-2222-222222222222'), 0::bigint, 'portal login does not see products outside its own documents');

with updated as (update public.products set name = 'HACKED' returning id)
select is((select count(*) from updated), 0::bigint, 'portal login cannot rename products');

select throws_ok(
  $$insert into public.products (organization_id, name, sku_code, unit_of_measure) values ('11111111-1111-1111-1111-111111111111', 'x', 'X', 'roll')$$,
  '42501', null, 'portal login cannot create products'
);

with updated as (update public.price_book_lines set unit_price = 0.01 returning id)
select is((select count(*) from updated), 0::bigint, 'portal login cannot change prices');

select throws_ok(
  $$update public.user_profiles set customer_id = null where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'portal login cannot remove its own customer scope'
);

select throws_ok(
  $$update public.user_profiles set role = 'platform_admin' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'portal login cannot make itself platform_admin'
);

select is((select count(*) from public.user_profiles), 1::bigint, 'portal login sees only its own profile, not the org roster');
select is((select count(*) from public.latest_cost_input('a1111111-1111-1111-1111-111111111111') where id is not null), 0::bigint, 'latest_cost_input returns nothing to a portal login');
select throws_ok(
  $$select public.log_quote_conversion('d1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'portal login cannot write audit entries'
);
reset role;

-- ============================================================
-- ORDINARY USER OF ANOTHER ORG (Mallory) — the self-promotion attack
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select throws_ok(
  $$update public.user_profiles set role = 'platform_admin' where auth_user_id = 'a0000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a user cannot grant themselves platform_admin'
);
select throws_ok(
  $$update public.user_profiles set organization_id = '11111111-1111-1111-1111-111111111111' where auth_user_id = 'a0000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a user cannot move themselves into another org'
);
select is((select count(*) from public.customers where organization_id = '11111111-1111-1111-1111-111111111111'), 0::bigint, 'other-org user sees none of Factory A''s customers');
select is((select count(*) from public.latest_cost_input('a1111111-1111-1111-1111-111111111111') where id is not null), 0::bigint, 'other-org user cannot read Factory A costs via latest_cost_input');
select throws_ok(
  $$select public.log_quote_conversion('d1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'other-org user cannot forge Factory A audit entries'
);
reset role;

-- ============================================================
-- STAFF (administrator) — regression: normal work still works
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*) from public.cost_inputs), 1::bigint, 'staff still read cost inputs');
select is((select count(*) from public.user_profiles), 3::bigint, 'staff still see their org roster (3 profiles in their org)');

with updated as (update public.products set name = 'Renamed by staff' where id = 'a1111111-1111-1111-1111-111111111111' returning id)
select is((select count(*) from updated), 1::bigint, 'staff can still edit products');

select is(public.resolve_unit_price('c2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 5), 4.55::numeric, 'staff still resolve contract prices');

with updated as (update public.user_profiles set role = 'administrator' where auth_user_id = 'a0000000-0000-0000-0000-00000000000b' returning id)
select is((select count(*) from updated), 1::bigint, 'an org admin can still change a colleague''s role');

select throws_ok(
  $$update public.user_profiles set role = 'platform_admin' where auth_user_id = 'a0000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'an org admin cannot grant platform_admin'
);
select throws_ok(
  $$update public.user_profiles set role = 'organization_owner' where auth_user_id = 'a0000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'an org admin cannot change their own role'
);

select lives_ok(
  $$select public.log_quote_conversion('d1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111')$$,
  'staff can still log a quote conversion for their own org'
);
select is((select count(*) from public.audit_log where action = 'quote.converted_to_order'), 1::bigint, 'the conversion audit row was written');
reset role;

-- ============================================================
-- Function exposure
-- ============================================================
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select public.check_rate_limit('k', 1, 60)$$, '42501', null, 'anonymous callers cannot execute check_rate_limit');
select throws_ok($$select public.latest_cost_input('a1111111-1111-1111-1111-111111111111')$$, '42501', null, 'anonymous callers cannot execute latest_cost_input');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$select public.check_rate_limit('k', 1, 60)$$, '42501', null, 'logged-in users cannot execute check_rate_limit directly');
reset role;

set local role service_role;
select is(public.check_rate_limit('k', 5, 60), true, 'the service role (the app''s admin client) can still use check_rate_limit');
reset role;

select * from finish();
rollback;
