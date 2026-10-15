-- ============================================================
-- 015_account_approval.sql
--
-- "No approval, no access." Public signup stays open, but every new
-- account starts as `pending` and can see and change nothing until a
-- platform admin approves it.
--
-- Enforced in the database, not just the UI: the Supabase anon key is
-- public, so a pending user could otherwise call the API directly.
--   * my_org_id() now returns NULL unless the profile is active (or an
--     invited portal login). Every org-scoped RLS policy keys off it, so a
--     pending/suspended/deactivated account matches no org rows at all.
--     It can still read its own profile row (policy: auth_user_id =
--     auth.uid()), which is how the app shows the "waiting for approval"
--     screen.
--   * create_organization_with_owner() now creates the profile as
--     `pending`.
--   * Only a platform admin can move a profile out of `pending`
--     (extends the guard trigger from migration 014).
--
-- Existing accounts are unaffected (their status is already `active`
-- or, for portal logins, `invited`).
-- ============================================================

-- 1. Allow the new status value.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.user_profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.user_profiles
  add constraint user_profiles_status_check
  check (status in ('active', 'invited', 'pending', 'suspended', 'deactivated'));

-- 2. Only approved accounts belong to an organization for RLS purposes.
--    ('invited' is the status of customer-portal logins created by the
--    invite API; it must keep working.)
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
  limit 1;
$$;

-- 3. New self-service signups wait for approval.
create or replace function public.create_organization_with_owner(
  p_org_name text,
  p_org_slug text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug)
  values (p_org_name, p_org_slug)
  returning id into v_org_id;

  insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status)
  values (
    auth.uid(),
    v_org_id,
    (select email from auth.users where id = auth.uid()),
    p_full_name,
    'organization_owner',
    'pending'
  );

  return v_org_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, text) from public, anon;
grant execute on function public.create_organization_with_owner(text, text, text) to authenticated;

-- 4. Guard trigger: only a platform admin may approve (leave `pending`).
create or replace function public.guard_user_profile_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only constrain requests made through the API as a user. The service
  -- role (invite and approval flows), SECURITY DEFINER functions (signup)
  -- and migrations run as other roles and are unaffected.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if public.is_platform_admin() then
    return new;
  end if;

  if new.role = 'platform_admin' then
    raise exception 'only a platform admin can grant the platform_admin role'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- An org admin may add staff to their own org. Portal users are
    -- created only by the invite API (service role).
    if not (
      public.is_org_admin()
      and new.organization_id = public.my_org_id()
      and new.customer_id is null
      and new.role <> 'client_viewer'
      and new.status <> 'pending'
    ) then
      raise exception 'not allowed to create this user profile' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: identity, tenant and portal scope are immutable for everyone
  -- except a platform admin.
  if new.auth_user_id is distinct from old.auth_user_id
     or new.organization_id is distinct from old.organization_id
     or new.customer_id is distinct from old.customer_id
     or new.email is distinct from old.email then
    raise exception 'auth_user_id, organization_id, customer_id and email cannot be changed'
      using errcode = '42501';
  end if;

  -- Approval: nobody but a platform admin can take an account out of pending.
  if old.status = 'pending' and new.status is distinct from 'pending' then
    raise exception 'only a platform admin can approve an account' using errcode = '42501';
  end if;

  -- Role and status: an org admin may change a colleague's, never their
  -- own, and never move anyone into or out of the portal role.
  if new.role is distinct from old.role or new.status is distinct from old.status then
    if old.auth_user_id = auth.uid() then
      raise exception 'you cannot change your own role or status' using errcode = '42501';
    end if;
    if not public.is_org_admin() then
      raise exception 'only an organization admin can change a role or status' using errcode = '42501';
    end if;
    if new.role is distinct from old.role
       and (old.role = 'client_viewer' or new.role = 'client_viewer') then
      raise exception 'portal access is managed through the customer invite flow' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
