-- ============================================================
-- 021_revoke_anon_access.sql
--
-- Defense in depth: take away what the signed-out role never needs.
--
-- Supabase gives its public, signed-out role (`anon`) full table
-- permissions on every new table, and PostgreSQL lets everyone run any new
-- function. Row-level security already stops anon from seeing or changing
-- anything, but that left one lock between the internet and the data. PlyCount
-- has no signed-out data access at all (sign-in, sign-up and password reset go
-- through the Auth service, not these tables), so anon gets nothing:
--   * no permissions on any table, view or sequence in `public`
--   * no permission to run any function in `public`
--   * signed-in users (`authenticated`) and the server (`service_role`) keep
--     exactly what they had, nothing more
--   * the same lock-down applies to tables and functions created later, so a
--     forgotten `enable row level security` can no longer expose data
-- After this a signed-out API call is refused with "permission denied" instead
-- of being answered with an empty list.
-- ============================================================

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Functions. PostgreSQL grants EXECUTE to everyone by default, which includes
-- anon. For each function that is still open to everyone (the helpers that row
-- policies call), close it to everyone and hand it explicitly to the two roles
-- that use it. Functions that were already restricted on purpose (for example the
-- rate limiter, which only the server may call) are left exactly as they were:
-- nothing is granted to a role that did not have it.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('public', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end $$;

-- Any remaining explicit grant to anon goes too.
revoke execute on all functions in schema public from anon;

-- Things created from now on (by the role that runs migrations) start locked too.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
