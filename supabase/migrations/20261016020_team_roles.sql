-- ============================================================
-- 020_team_roles.sql
--
-- Who may add and manage administrators ("managers").
--
-- Roles in a company:
--   organization_owner  runs the company in PlyCount; can add and manage
--                       managers and staff
--   administrator       a "manager": full day-to-day access (costs, invoices,
--                       import, ...); can add and manage staff only
--   sales_rep           staff ("sales basics")
--
-- Before this, any administrator could promote anyone to administrator or even
-- owner. Now, enforced in the database (the app can be bypassed, this cannot):
--   * only an owner of the same company, or the platform administrator, can add
--     a manager, change a manager's role, or suspend / reactivate a manager
--   * a manager can add and manage staff, but not other managers or the owner
--   * ownership is handed out only by the platform administrator, and an owner
--     can be changed only by the platform administrator
--   * nobody changes their own role or status (unchanged)
-- The platform administrator, the service role and security-definer functions
-- (signup, approvals, invites) are unaffected, as before.
-- ============================================================

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
  );
$$;

create or replace function public.guard_user_profile_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller_is_owner boolean;
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

  -- Ownership is handed out only by the platform administrator.
  if new.role = 'organization_owner' and (tg_op = 'INSERT' or old.role is distinct from 'organization_owner') then
    raise exception 'only the platform administrator can make someone an owner'
      using errcode = '42501';
  end if;

  caller_is_owner := public.is_org_owner() and new.organization_id = public.my_org_id();

  if tg_op = 'INSERT' then
    -- An org admin may add staff to their own org; only an owner may add a
    -- manager. Portal users are created only by the invite API (service role).
    if not (
      public.is_org_admin()
      and new.organization_id = public.my_org_id()
      and new.customer_id is null
      and new.role <> 'client_viewer'
      and new.status <> 'pending'
    ) then
      raise exception 'not allowed to create this user profile' using errcode = '42501';
    end if;
    if new.role = 'administrator' and not caller_is_owner then
      raise exception 'only an owner can add a manager' using errcode = '42501';
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

  -- Role and status.
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
    -- An owner can be changed only by the platform administrator.
    if old.role = 'organization_owner' then
      raise exception 'only the platform administrator can change an owner' using errcode = '42501';
    end if;
    -- Managers are managed only by an owner of the same company.
    if (old.role = 'administrator' or new.role = 'administrator') and not caller_is_owner then
      raise exception 'only an owner can change a manager''s role or access' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
