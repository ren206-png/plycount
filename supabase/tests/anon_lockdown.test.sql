-- ============================================================
-- pgTAP tests for supabase/migrations/20261021021_revoke_anon_access.sql
-- The signed-out role gets nothing; signed-in users and the server are unaffected.
-- Run with: supabase test db
-- ============================================================
begin;
select plan(14);

insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'lock-a');
insert into public.customers (id, organization_id, name) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Customer A');
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000a', 'admin@lock.local');
insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin@lock.local', 'Admin', 'administrator', 'active');

-- the grants themselves
select is((select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p') and has_table_privilege('anon', c.oid, 'select, insert, update, delete')), 0::bigint, 'anon has no permission on any table or view');
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')), 0::bigint, 'anon cannot run any function');
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('public', p.oid, 'execute')), 0::bigint, 'functions are not open to everyone either');
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname not in ('check_rate_limit', 'capture_quote_line_cost') and not has_function_privilege('authenticated', p.oid, 'execute')), 0::bigint, 'signed-in users can still run every function they could before');
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('check_rate_limit', 'capture_quote_line_cost') and has_function_privilege('authenticated', p.oid, 'execute')), 0::bigint, 'the two server-only functions stay server-only (nothing was re-granted)');

-- what happens to a signed-out request
set local role anon;
select throws_ok($$select count(*) from public.customers$$, '42501', null, 'a signed-out read is refused outright');
select throws_ok($$insert into public.customers (organization_id, name) values ('11111111-1111-1111-1111-111111111111', 'x')$$, '42501', null, 'a signed-out write is refused');
select throws_ok($$select public.is_org_admin()$$, '42501', null, 'a signed-out call to a helper function is refused');
reset role;

-- signed-in work is untouched: policies still run their helper functions
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*) from public.customers), 1::bigint, 'a signed-in administrator still reads their company''s customers');
select is(public.is_org_admin(), true, 'helper functions still work when signed in');
select lives_ok($$insert into public.customers (organization_id, name) values ('11111111-1111-1111-1111-111111111111', 'New customer')$$, 'a signed-in administrator can still add data');
reset role;

-- the server role is untouched
set local role service_role;
select is((select count(*) from public.customers), 2::bigint, 'the server role still reads everything');
reset role;

-- things created later start locked too
create table public.zz_lockdown_probe (id int);
create function public.zz_lockdown_probe_fn() returns int language sql as $$ select 1 $$;
select is(has_table_privilege('anon', 'public.zz_lockdown_probe', 'select'), false, 'a table created later gives anon nothing');
select is(has_function_privilege('anon', 'public.zz_lockdown_probe_fn()', 'execute'), false, 'a function created later is closed to anon');

select * from finish();
rollback;
