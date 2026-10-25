-- ============================================================
-- 022_mfa_enforcement.sql
--
-- Two-step sign-in (authenticator app) is enforced in the database, not
-- just in the pages: the Supabase anon key is public, so someone who only
-- knew a password could otherwise call the API directly and skip the
-- second step the app asks for.
--
--   * mfa_satisfied() is true when the session has passed the second step
--     (JWT `aal` = aal2) OR the account has not turned two-step sign-in on
--     (no verified factor). It is false only for a password-only session
--     of an account that did turn it on.
--   * The five helper functions every RLS policy keys off now also require
--     it, so such a session matches no organization, customer or admin
--     rows at all. It can still read its own profile row (that policy uses
--     auth.uid() directly), which is how the app finds out it must ask for
--     the code.
--
-- Accounts that never enrol are unaffected. Nothing is forced on anyone.
-- ============================================================

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid()
        and status = 'verified'
    );
$$;

create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.user_profiles
  where auth_user_id = auth.uid()
    and status in ('active', 'invited')
    and public.mfa_satisfied()
  limit 1;
$$;

create or replace function public.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select customer_id from public.user_profiles
  where auth_user_id = auth.uid()
    and public.mfa_satisfied()
  limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid()
      and role = 'platform_admin'
      and status = 'active'
      and public.mfa_satisfied()
  );
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid()
      and role in ('platform_admin', 'organization_owner', 'administrator')
      and status = 'active'
      and public.mfa_satisfied()
  );
$$;

create or replace function public.is_org_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where auth_user_id = auth.uid()
      and role = 'organization_owner'
      and status = 'active'
      and public.mfa_satisfied()
  );
$$;

-- Same access model as every other function here (see 021): signed-in
-- users and the server may run it, the signed-out role may not.
revoke execute on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated, service_role;

-- ------------------------------------------------------------
-- Lost phone? A platform administrator (or the project owner, through the
-- Supabase SQL editor / CLI) resets one person's two-step sign-in with:
--   delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'person@example.com');
-- They then sign in with their password alone and can set it up again.
-- ------------------------------------------------------------
