-- ============================================================
-- pgTAP tests for supabase/migrations/20261015017_staff_join_request.sql
-- Run with: supabase test db
-- ============================================================
begin;
select plan(11);

-- ---- fixtures -------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Factory', 'join-factory'),
  ('22222222-2222-2222-2222-222222222222', 'Some other company', 'join-other');

insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Factory customer');
insert into public.products (id, organization_id, name, sku_code, unit_of_measure) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Roll', 'JN-1', 'roll');
insert into public.cost_inputs (organization_id, product_id, raw_material_cost, effective_date, source)
values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 3.10, '2026-01-01', 'manual');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000f1', 'owner@factory.local'),
  ('a0000000-0000-0000-0000-0000000000f2', 'newstaff@factory.local'),
  ('a0000000-0000-0000-0000-0000000000f3', 'existing@other.local');

insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'owner@factory.local', 'Owner', 'platform_admin', 'active'),
  ('a0000000-0000-0000-0000-0000000000f3', '22222222-2222-2222-2222-222222222222', 'existing@other.local', 'Existing', 'organization_owner', 'active');

-- ============================================================
-- A brand-new signup requests staff access
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000f2","role":"authenticated"}';

select is(public.request_staff_access('  New Staffer  '), '11111111-1111-1111-1111-111111111111'::uuid, 'the request joins the factory organization');
select is((select role from public.user_profiles where auth_user_id = 'a0000000-0000-0000-0000-0000000000f2'), 'sales_rep', 'the new profile is staff (sales_rep)');
select is((select status from public.user_profiles where auth_user_id = 'a0000000-0000-0000-0000-0000000000f2'), 'pending', 'the new profile waits for approval');
select is((select full_name from public.user_profiles where auth_user_id = 'a0000000-0000-0000-0000-0000000000f2'), 'New Staffer', 'the name is trimmed');
select is((select count(*) from public.customers), 0::bigint, 'a pending staff request sees no data');
select throws_ok($$select public.request_staff_access('Again')$$, '23505', null, 'a second request is refused');
select throws_ok($$select public.request_staff_access('   ')$$, '22023', null, 'an empty name is refused');
reset role;

-- ============================================================
-- Someone who already belongs to another company cannot use it to hop in
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select throws_ok($$select public.request_staff_access('Hopper')$$, '23505', null, 'an existing account cannot request to join the factory');
reset role;

-- ============================================================
-- Not callable without a login
-- ============================================================
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select public.request_staff_access('Anon')$$, '42501', null, 'anonymous callers cannot request access');
reset role;

-- ============================================================
-- After the platform admin approves, they are staff: can view, not see costs
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
update public.user_profiles set status = 'active' where auth_user_id = 'a0000000-0000-0000-0000-0000000000f2';
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select is((select count(*) from public.customers), 1::bigint, 'after approval the staff member can view customers');
select is((select count(*) from public.cost_inputs), 0::bigint, 'after approval the staff member still cannot read costs');
reset role;

select * from finish();
rollback;
