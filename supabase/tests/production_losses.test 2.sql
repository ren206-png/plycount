-- ============================================================
-- pgTAP tests for supabase/migrations/20261016018_production_losses.sql
-- Damaged/scrapped product log: admins only, scoped to their own organization.
-- Same RLS-simulation pattern as the other files. Run with: supabase test db
-- ============================================================
begin;
select plan(13);

insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'loss-a'),
  ('22222222-2222-2222-2222-222222222222', 'Org B', 'loss-b');

insert into public.products (id, organization_id, name, sku_code, unit_of_measure) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Kraft roll A', 'LA-1', 'roll'),
  ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Kraft roll B', 'LB-1', 'roll');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin-a@loss.local'),
  ('a0000000-0000-0000-0000-0000000000b1', 'staff-a@loss.local'),
  ('a0000000-0000-0000-0000-0000000000c1', 'admin-b@loss.local'),
  ('a0000000-0000-0000-0000-0000000000d1', 'pending-a@loss.local');

insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin-a@loss.local', 'Admin A', 'administrator', 'active'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'staff-a@loss.local', 'Staff A', 'sales_rep', 'active'),
  ('a0000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'admin-b@loss.local', 'Admin B', 'administrator', 'active'),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'pending-a@loss.local', 'Pending A', 'administrator', 'pending');

-- a loss in each org, inserted as the table owner
insert into public.production_losses (id, organization_id, product_id, qty, stage, reason, recorded_by) values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 5, 'converting', 'machine_jam', 'a0000000-0000-0000-0000-00000000000a'),
  ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 9, 'packaging', 'handling_damage', 'a0000000-0000-0000-0000-0000000000c1');

-- ============================================================
-- ADMIN of Org A
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*) from public.production_losses), 1::bigint, 'an admin sees only their own organization''s losses');
select lives_ok(
  $$insert into public.production_losses (organization_id, product_id, qty, stage, reason) values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 3, 'warehouse', 'moisture_damage')$$,
  'an admin can log a loss for their own product'
);
select is((select recorded_by from public.production_losses where qty = 3), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'the database records who logged it');
select throws_ok(
  $$insert into public.production_losses (organization_id, product_id, qty, stage, reason) values ('11111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 1, 'converting', 'other')$$,
  '42501', null, 'an admin cannot log a loss against another organization''s product'
);
select throws_ok(
  $$insert into public.production_losses (organization_id, product_id, qty, stage, reason) values ('22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 1, 'converting', 'other')$$,
  '42501', null, 'an admin cannot log a loss into another organization'
);
select throws_ok(
  $$insert into public.production_losses (organization_id, product_id, qty, stage, reason) values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 0, 'converting', 'other')$$,
  '23514', null, 'a loss must be at least one unit'
);
select throws_ok(
  $$insert into public.production_losses (organization_id, product_id, qty, stage, reason) values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1, 'converting', 'because')$$,
  '23514', null, 'the reason must be one of the known reasons'
);
with updated as (update public.production_losses set qty = 6 where id = 'f1111111-1111-1111-1111-111111111111' returning id)
select is((select count(*) from updated), 1::bigint, 'an admin can correct their own entry');
with updated as (update public.production_losses set qty = 1 where id = 'f2222222-2222-2222-2222-222222222222' returning id)
select is((select count(*) from updated), 0::bigint, 'an admin cannot edit another organization''s entry');
with deleted as (delete from public.production_losses where id = 'f1111111-1111-1111-1111-111111111111' returning id)
select is((select count(*) from deleted), 1::bigint, 'an admin can delete their own entry');
reset role;

-- ============================================================
-- STAFF (sales basics), and a not-yet-approved admin: nothing at all
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.production_losses), 0::bigint, 'staff cannot read the loss log');
select throws_ok(
  $$insert into public.production_losses (organization_id, product_id, qty, stage, reason) values ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1, 'converting', 'other')$$,
  '42501', null, 'staff cannot log a loss'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*) from public.production_losses), 0::bigint, 'a pending (unapproved) admin sees nothing');
reset role;

select * from finish();
rollback;
