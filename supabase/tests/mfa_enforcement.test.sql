-- ============================================================
-- pgTAP tests for supabase/migrations/20261024022_mfa_enforcement.sql
-- A password-only session of an account that turned on two-step sign-in
-- sees nothing; everyone else is unaffected.
-- Run with: supabase test db
-- ============================================================
begin;
select plan(15);

insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'mfa-a');
insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer A');

-- 'secured' turned two-step sign-in on; 'plain' never did; 'pending_factor' started but never finished
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'secured@mfa.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'plain@mfa.local'),
  ('d0000000-0000-0000-0000-00000000000d', 'half@mfa.local');
insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'secured@mfa.local', 'Secured', 'organization_owner', 'active'),
  ('b0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'plain@mfa.local', 'Plain', 'administrator', 'active'),
  ('d0000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'half@mfa.local', 'Half', 'administrator', 'active');
-- (the real table has no defaults for id, created_at and updated_at)
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'totp', 'verified', now(), now()),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-00000000000d', 'totp', 'unverified', now(), now());

-- 1. password-only session of an account with two-step sign-in on
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}';
select is(public.mfa_satisfied(), false, 'a password-only session of an enrolled account is not satisfied');
select is(public.my_org_id(), null::uuid, 'it belongs to no organization');
select is(public.is_org_admin(), false, 'it is not an admin');
select is(public.is_org_owner(), false, 'it is not an owner');
select is((select count(*) from public.customers), 0::bigint, 'it reads no company data');
select throws_ok($$insert into public.customers (organization_id, name) values ('11111111-1111-1111-1111-111111111111', 'sneaky')$$, '42501', null, 'it cannot write company data either');
select is((select count(*) from public.user_profiles where auth_user_id = 'a0000000-0000-0000-0000-00000000000a'), 1::bigint, 'it can still read its own profile (so the app can ask for the code)');

-- 2. the same account after entering the code
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}';
select is(public.mfa_satisfied(), true, 'after the second step the session is satisfied');
select is(public.is_org_owner(), true, 'and the owner powers work again');
select is((select count(*) from public.customers), 1::bigint, 'and company data is visible again');

-- 3. accounts that never turned it on are untouched
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal1"}';
select is(public.mfa_satisfied(), true, 'an account without two-step sign-in is satisfied at aal1');
select is((select count(*) from public.customers), 1::bigint, 'and keeps full access');

-- 4. a half-finished enrolment must not lock anyone out
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated","aal":"aal1"}';
select is((select count(*) from public.customers), 1::bigint, 'an unverified factor does not block access');

-- 5. a token with no aal claim counts as password-only
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(public.mfa_satisfied(), false, 'a token without an aal claim is treated as password-only');
reset role;

-- 6. the signed-out role still cannot run it
set local role anon;
select throws_ok($$select public.mfa_satisfied()$$, '42501', null, 'the signed-out role cannot call it');
reset role;

select * from finish();
rollback;
