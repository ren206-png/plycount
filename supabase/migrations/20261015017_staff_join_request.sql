-- ============================================================
-- 017_staff_join_request.sql
--
-- Staff "request access". A person signs up (Supabase Auth) and then calls
-- request_staff_access(full_name). That creates a profile in the FACTORY'S
-- organization (the organization of the oldest active platform admin) with
-- role sales_rep and status `pending`. A pending account has no access
-- (migration 015) until the platform admin approves it from Account
-- approvals; after approval they are staff ("sales basics", migration 016).
--
-- The caller cannot choose the organization or the role: both are fixed
-- inside the function. It is SECURITY DEFINER only because an ordinary user
-- is not allowed to insert profiles; it can do nothing but create this one
-- pending row for the caller.
-- ============================================================
create or replace function public.request_staff_access(p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if v_name = '' or length(v_name) > 120 then
    raise exception 'a full name (up to 120 characters) is required' using errcode = '22023';
  end if;

  select organization_id into v_org_id
  from public.user_profiles
  where role = 'platform_admin' and status = 'active'
  order by created_at
  limit 1;

  if v_org_id is null then
    raise exception 'staff access requests are not available right now' using errcode = 'P0001';
  end if;

  -- user_profiles.auth_user_id is unique, so a second request (or a request
  -- from someone who already has a profile) fails with 23505.
  insert into public.user_profiles (auth_user_id, organization_id, email, full_name, role, status)
  values (
    auth.uid(),
    v_org_id,
    (select email from auth.users where id = auth.uid()),
    v_name,
    'sales_rep',
    'pending'
  );

  return v_org_id;
end;
$$;

revoke all on function public.request_staff_access(text) from public, anon;
grant execute on function public.request_staff_access(text) to authenticated;
