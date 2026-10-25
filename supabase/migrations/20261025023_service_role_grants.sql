-- ============================================================
-- 023_service_role_grants.sql
--
-- Same reproducibility gap as 013, for the server role. On the hosted
-- project the `service_role` (used only by the server, never the browser)
-- already holds full table privileges, but a database built purely from
-- these migrations (`supabase start`, a staging project, a rebuilt backup)
-- gives it none on the tables created here, so every server-side call that
-- uses the service key fails with "permission denied". Found while setting
-- up the browser tests, which seed their data with that key.
--
-- Idempotent, and a no-op on the hosted project (checked: 0 of 22 tables
-- missing it). The signed-out `anon` role is untouched and stays locked
-- out (migration 021).
-- ============================================================

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tables and sequences created by later migrations get the same.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
