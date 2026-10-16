-- ============================================================
-- pgTAP tests for supabase/migrations/20261016020_team_roles.sql
-- Who may add and manage managers (administrators) and staff.
-- Run with: supabase test db
-- ============================================================
begin;
select plan(23);

insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'team-a'),
  ('22222222-2222-2222-2222-222222222222', 'Org B', 'team-b');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000a1', 'owner@a.local'),
  ('a0000000-0000-0000-0000-0000000000a2', 'owner2@a.local'),
  ('a0000000-0000-0000-0000-0000000000b1', 'manager@a.local'),
  ('a0000000-0000-0000-0000-0000000000b2', 'manager2@a.local'),
  ('a0000000-0000-0000-0000-0000000000c1', 'staff@a.local'),
  ('a0000000-0000-0000-0000-0000000000c2', 'staff2@a.local'),
  ('a0000000-0000-0000-0000-0000000000d1', 'owner@b.local'),
  ('a0000000-0000-0000-0000-0000000000e1', 'root@platform.local'),
  ('a0000000-0000-0000-0000-0000000000f1', 'newbie@a.local'),
  ('a0000000-0000-0000-0000-0000000000f2', 'newbie2@a.local'),
  ('a0000000-0000-0000-0000-0000000000f3', 'newbie3@a.local');

insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'owner@a.local', 'Owner A', 'organization_owner', 'active'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'owner2@a.local', 'Owner A2', 'organization_owner', 'active'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'manager@a.local', 'Manager A', 'administrator', 'active'),
  ('a0000000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'manager2@a.local', 'Manager A2', 'administrator', 'active'),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'staff@a.local', 'Staff A', 'sales_rep', 'active'),
  ('a0000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'staff2@a.local', 'Staff A2', 'sales_rep', 'active'),
  ('a0000000-0000-0000-0000-0000000000d1', '22222222-2222-2222-2222-222222222222', 'owner@b.local', 'Owner B', 'organization_owner', 'active'),
  ('a0000000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'root@platform.local', 'Root', 'platform_admin', 'active');

-- ============================================================
-- OWNER of Org A
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

with u as (update public.user_profiles set role = 'administrator' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c2' returning id)
select is((select count(*) from u), 1::bigint, 'an owner can promote staff to manager');
with u as (update public.user_profiles set role = 'sales_rep' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c2' returning id)
select is((select count(*) from u), 1::bigint, 'an owner can demote a manager to staff');
with u as (update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000b2' returning id)
select is((select count(*) from u), 1::bigint, 'an owner can suspend a manager');
with u as (update public.user_profiles set status = 'active' where auth_user_id = 'a0000000-0000-0000-0000-0000000000b2' returning id)
select is((select count(*) from u), 1::bigint, 'an owner can reactivate a manager');
select lives_ok(
  $$insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values ('a0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'newbie@a.local', 'Newbie', 'administrator', 'active')$$,
  'an owner can add a manager'
);
select throws_ok(
  $$update public.user_profiles set role = 'organization_owner' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'an owner cannot make someone else an owner'
);
select throws_ok(
  $$update public.user_profiles set role = 'platform_admin' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'an owner cannot grant platform_admin'
);
select throws_ok(
  $$update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'an owner cannot suspend another owner'
);
select throws_ok(
  $$update public.user_profiles set role = 'sales_rep' where auth_user_id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'an owner cannot change their own role'
);
with u as (update public.user_profiles set role = 'sales_rep' where auth_user_id = 'a0000000-0000-0000-0000-0000000000d1' returning id)
select is((select count(*) from u), 0::bigint, 'an owner cannot touch another company''s users');
reset role;

-- ============================================================
-- MANAGER (administrator) of Org A
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

with u as (update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1' returning id)
select is((select count(*) from u), 1::bigint, 'a manager can suspend staff');
with u as (update public.user_profiles set status = 'active' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1' returning id)
select is((select count(*) from u), 1::bigint, 'a manager can reactivate staff');
select lives_ok(
  $$insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values ('a0000000-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'newbie2@a.local', 'New Staff', 'sales_rep', 'active')$$,
  'a manager can add staff'
);
select throws_ok(
  $$insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values ('a0000000-0000-0000-0000-0000000000f3', '11111111-1111-1111-1111-111111111111', 'newbie3@a.local', 'New Manager', 'administrator', 'active')$$,
  '42501', null, 'a manager cannot add another manager'
);
select throws_ok(
  $$update public.user_profiles set role = 'administrator' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'a manager cannot promote staff to manager'
);
select throws_ok(
  $$update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000b2'$$,
  '42501', null, 'a manager cannot suspend another manager'
);
select throws_ok(
  $$update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'a manager cannot suspend the owner'
);
select throws_ok(
  $$update public.user_profiles set role = 'organization_owner' where auth_user_id = 'a0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'a manager cannot make themselves owner'
);
select throws_ok(
  $$update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'a manager cannot suspend themselves'
);
reset role;

-- ============================================================
-- STAFF cannot manage anyone
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
with u as (update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c2' returning id)
select is((select count(*) from u), 0::bigint, 'staff cannot suspend anyone (they cannot even see other people)');
select throws_ok(
  $$update public.user_profiles set role = 'administrator' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'staff cannot promote themselves'
);
reset role;

-- ============================================================
-- PLATFORM ADMIN can do anything, including handing out ownership
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
with u as (update public.user_profiles set role = 'organization_owner' where auth_user_id = 'a0000000-0000-0000-0000-0000000000c1' returning id)
select is((select count(*) from u), 1::bigint, 'the platform administrator can make someone an owner');
with u as (update public.user_profiles set status = 'suspended' where auth_user_id = 'a0000000-0000-0000-0000-0000000000a2' returning id)
select is((select count(*) from u), 1::bigint, 'the platform administrator can change an owner');
reset role;

select * from finish();
rollback;
