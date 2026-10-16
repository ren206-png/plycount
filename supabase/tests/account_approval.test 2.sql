-- ============================================================
-- pgTAP tests for supabase/migrations/20261015015_account_approval.sql
-- ("no approval, no access"). Same RLS-simulation pattern as the other
-- test files. Run with: supabase test db
-- ============================================================
begin;
select plan(17);

-- ---- fixtures -------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Approved Co', 'appr-a'),
  ('22222222-2222-2222-2222-222222222222', 'Pending Co', 'appr-p');

insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Approved customer'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Pending-org customer');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@approved.local'),
  ('a0000000-0000-0000-0000-0000000000b1', 'quinn@approved.local'),
  ('a0000000-0000-0000-0000-0000000000c1', 'pat@pending.local'),
  ('a0000000-0000-0000-0000-0000000000d1', 'portal@approved.local'),
  ('a0000000-0000-0000-0000-0000000000e1', 'sam@suspended.local'),
  ('a0000000-0000-0000-0000-0000000000f1', 'root@platform.local'),
  ('a0000000-0000-0000-0000-0000000000f2', 'zed@new.local');

insert into public.user_profiles (auth_user_id, organization_id, customer_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', null, 'owner@approved.local', 'Owner', 'organization_owner', 'active'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', null, 'quinn@approved.local', 'Quinn', 'sales_rep', 'pending'),
  ('a0000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222', null, 'pat@pending.local', 'Pat', 'organization_owner', 'pending'),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'portal@approved.local', 'Portal', 'client_viewer', 'invited'),
  ('a0000000-0000-0000-0000-0000000000e1', '22222222-2222-2222-2222-222222222222', null, 'sam@suspended.local', 'Sam', 'organization_owner', 'suspended'),
  ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', null, 'root@platform.local', 'Root', 'platform_admin', 'active');

-- ============================================================
-- PENDING account (Pat, owner of her own brand-new org)
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is((select count(*) from public.user_profiles), 1::bigint, 'pending user can read only their own profile (to show the waiting screen)');
select is((select status from public.user_profiles limit 1), 'pending', 'pending user sees their own pending status');
select is((select count(*) from public.organizations), 0::bigint, 'pending user cannot read even their own organization');
select is((select count(*) from public.customers), 0::bigint, 'pending user cannot read their own org''s customers');
select is(public.my_org_id(), null::uuid, 'my_org_id() is null for a pending user');
select throws_ok(
  $$insert into public.customers (organization_id, name) values ('22222222-2222-2222-2222-222222222222', 'x')$$,
  '42501', null, 'pending user cannot create data'
);
select throws_ok(
  $$update public.user_profiles set status = 'active' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'pending user cannot approve themselves'
);
reset role;

-- ============================================================
-- SUSPENDED account is shut out the same way
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is((select count(*) from public.customers), 0::bigint, 'suspended user sees no org data');
reset role;

-- ============================================================
-- APPROVED staff (regression) and org admins
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*) from public.customers), 1::bigint, 'approved owner still sees their org''s data');
select throws_ok(
  $$update public.user_profiles set status = 'active' where auth_user_id = 'a0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'an org admin cannot approve a pending colleague (platform admin only)'
);
reset role;

-- ============================================================
-- PORTAL login (status invited) must keep working
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*) from public.customers), 1::bigint, 'portal login (status invited) still sees its own customer');
reset role;

-- ============================================================
-- PLATFORM ADMIN approves Pat, and Pat then has access
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
with updated as (update public.user_profiles set status = 'active' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1' returning id)
select is((select count(*) from updated), 1::bigint, 'a platform admin can approve a pending account');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.customers), 1::bigint, 'after approval the account sees its own org''s data');
select is((select count(*) from public.organizations), 1::bigint, 'after approval the account sees its own organization');
reset role;

-- ============================================================
-- Signup function creates PENDING profiles
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select lives_ok(
  $$select public.create_organization_with_owner('New Co', 'appr-new', 'Zed')$$,
  'a brand-new user can still sign up'
);
select is((select status from public.user_profiles where auth_user_id = 'a0000000-0000-0000-0000-0000000000f2'), 'pending', 'a self-service signup starts as pending');
select is((select count(*) from public.customers), 0::bigint, 'a new signup cannot see any data until approved');
reset role;

select * from finish();
rollback;
