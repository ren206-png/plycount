-- ============================================================
-- 014_security_hardening.sql
--
-- Closes holes found in the 2026-10-08 security review. Each was
-- reproduced against this repo's own migrations before the fix.
--
--  1. Privilege escalation via user_profiles. The self-update policy
--     had no column restriction, so any logged-in user could set
--     their own role to platform_admin (reading/writing every org),
--     or null their customer_id (turning a portal login into staff).
--     Fixed with a guard trigger + tighter policies.
--
--  2. Migration 009 made only 7 tables portal-aware. cost_inputs,
--     price_books, price_book_lines, products and
--     margin_alert_reviews stayed org-wide, so a portal login
--     (client_viewer) could read internal costs and other customers'
--     contract prices and WRITE products/prices. Now staff-only
--     (products stay readable for a portal login only where they
--     appear on that customer's own non-draft documents).
--     user_profiles is also no longer listable by portal logins
--     (it exposed other customers' portal emails).
--
--  3. SECURITY DEFINER pricing helpers (latest_cost_input,
--     resolve_price_book, resolve_unit_price) had no org check and
--     were executable by anyone, including anonymous callers.
--     They are now SECURITY INVOKER so RLS applies. This also fixes
--     resolve_price_book picking another org's default price book.
--
--  4. log_quote_conversion could write audit rows for any quote.
--     It now requires a staff caller and a quote in their own org.
--
--  5. check_rate_limit was callable by anyone via the API. It is
--     now service_role only (the app calls it through the admin
--     client).
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_profiles: block self-promotion and tenant/scope changes
-- ------------------------------------------------------------
create or replace function public.guard_user_profile_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only constrain requests made through the API as a user. The service
  -- role (invite flow), SECURITY DEFINER functions (signup) and
  -- migrations run as other roles and are unaffected.
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

drop trigger if exists trg_guard_user_profile_changes on public.user_profiles;
create trigger trg_guard_user_profile_changes
  before insert or update on public.user_profiles
  for each row execute function public.guard_user_profile_changes();

-- Defense in depth: the policies themselves also refuse the escalation.
drop policy if exists "user_profiles_update_self" on public.user_profiles;
create policy "user_profiles_update_self"
  on public.user_profiles for update
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    and organization_id = public.my_org_id()
    and role <> 'platform_admin'
  );

drop policy if exists "user_profiles_admin_manage" on public.user_profiles;
create policy "user_profiles_admin_manage"
  on public.user_profiles for all
  using (
    public.is_platform_admin()
    or (organization_id = public.my_org_id() and public.is_org_admin())
  )
  with check (
    public.is_platform_admin()
    or (
      organization_id = public.my_org_id()
      and public.is_org_admin()
      and role <> 'platform_admin'
    )
  );

-- A portal login sees only its own profile, not the org's roster.
drop policy if exists "user_profiles_select" on public.user_profiles;
create policy "user_profiles_select"
  on public.user_profiles for select
  using (
    public.is_platform_admin()
    or auth_user_id = auth.uid()
    or (organization_id = public.my_org_id() and public.my_customer_id() is null)
  );

-- ------------------------------------------------------------
-- 2. Staff-only tables: portal logins (my_customer_id() not null)
--    get no access.
-- ------------------------------------------------------------
drop policy if exists "cost_inputs_select" on public.cost_inputs;
create policy "cost_inputs_select" on public.cost_inputs for select
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

drop policy if exists "cost_inputs_write" on public.cost_inputs;
create policy "cost_inputs_write" on public.cost_inputs for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

drop policy if exists "price_books_select" on public.price_books;
create policy "price_books_select" on public.price_books for select
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

drop policy if exists "price_books_write" on public.price_books;
create policy "price_books_write" on public.price_books for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

drop policy if exists "price_book_lines_select" on public.price_book_lines;
create policy "price_book_lines_select" on public.price_book_lines for select
  using (
    public.is_platform_admin()
    or (
      public.my_customer_id() is null
      and exists (
        select 1 from public.price_books pb
        where pb.id = price_book_lines.price_book_id and pb.organization_id = public.my_org_id()
      )
    )
  );

drop policy if exists "price_book_lines_write" on public.price_book_lines;
create policy "price_book_lines_write" on public.price_book_lines for all
  using (
    public.is_platform_admin()
    or (
      public.my_customer_id() is null
      and exists (
        select 1 from public.price_books pb
        where pb.id = price_book_lines.price_book_id and pb.organization_id = public.my_org_id()
      )
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.my_customer_id() is null
      and exists (
        select 1 from public.price_books pb
        where pb.id = price_book_lines.price_book_id and pb.organization_id = public.my_org_id()
      )
    )
  );

drop policy if exists "margin_alert_reviews_select" on public.margin_alert_reviews;
create policy "margin_alert_reviews_select" on public.margin_alert_reviews for select
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

drop policy if exists "margin_alert_reviews_write" on public.margin_alert_reviews;
create policy "margin_alert_reviews_write" on public.margin_alert_reviews for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

-- products: staff see and manage everything; a portal login can read only
-- products that appear on its own customer's non-draft quotes or orders
-- (the portal pages show product names), and can never write.
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select
  using (
    public.is_platform_admin()
    or (
      organization_id = public.my_org_id()
      and (
        public.my_customer_id() is null
        or exists (
          select 1
          from public.quote_lines ql
          join public.quotes q on q.id = ql.quote_id
          where ql.product_id = products.id
            and q.customer_id = public.my_customer_id()
            and q.status <> 'draft'
        )
        or exists (
          select 1
          from public.order_lines ol
          join public.orders o on o.id = ol.order_id
          where ol.product_id = products.id
            and o.customer_id = public.my_customer_id()
        )
      )
    )
  );

drop policy if exists "products_write" on public.products;
create policy "products_write" on public.products for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));

-- ------------------------------------------------------------
-- 3. Pricing helpers: SECURITY INVOKER so RLS decides what a caller
--    can see. Not callable anonymously.
-- ------------------------------------------------------------
create or replace function public.latest_cost_input(p_product_id uuid, p_as_of date default current_date)
returns public.cost_inputs
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.cost_inputs
  where product_id = p_product_id
    and effective_date <= p_as_of
  order by effective_date desc
  limit 1;
$$;

create or replace function public.resolve_price_book(p_customer_id uuid, p_as_of date default current_date)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.price_books
  where (
    customer_id = p_customer_id
    or customer_id is null
  )
  and effective_start <= p_as_of
  and (effective_end is null or effective_end >= p_as_of)
  order by
    -- customer-specific book beats org-wide default (see migration 004
    -- for why this must be `customer_id is not null`).
    (customer_id is not null) desc,
    effective_start desc
  limit 1;
$$;

create or replace function public.resolve_unit_price(
  p_customer_id uuid,
  p_product_id  uuid,
  p_qty         integer,
  p_as_of       date default current_date
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select pbl.unit_price
  from public.price_book_lines pbl
  where pbl.price_book_id = public.resolve_price_book(p_customer_id, p_as_of)
    and pbl.product_id = p_product_id
    and p_qty >= pbl.min_qty
    and (pbl.max_qty is null or p_qty <= pbl.max_qty)
  order by pbl.min_qty desc
  limit 1;
$$;

revoke all on function public.latest_cost_input(uuid, date) from public, anon;
revoke all on function public.resolve_price_book(uuid, date) from public, anon;
revoke all on function public.resolve_unit_price(uuid, uuid, integer, date) from public, anon;
grant execute on function public.latest_cost_input(uuid, date) to authenticated;
grant execute on function public.resolve_price_book(uuid, date) to authenticated;
grant execute on function public.resolve_unit_price(uuid, uuid, integer, date) to authenticated;

-- ------------------------------------------------------------
-- 4. log_quote_conversion: staff only, quote and order must belong to
--    the caller's own org.
-- ------------------------------------------------------------
create or replace function public.log_quote_conversion(p_quote_id uuid, p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select q.organization_id into v_org_id
  from public.quotes q
  where q.id = p_quote_id
    and q.organization_id = public.my_org_id()
    and public.my_customer_id() is null;

  if v_org_id is null then
    raise exception 'quote not found' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.organization_id = v_org_id
  ) then
    raise exception 'order not found' using errcode = '42501';
  end if;

  insert into public.audit_log (organization_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (
    v_org_id,
    auth.uid(),
    'quote.converted_to_order',
    'orders',
    p_order_id,
    jsonb_build_object('quote_id', p_quote_id, 'order_id', p_order_id)
  );
end;
$$;

revoke all on function public.log_quote_conversion(uuid, uuid) from public, anon;
grant execute on function public.log_quote_conversion(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Remaining RPC exposure
-- ------------------------------------------------------------
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

revoke all on function public.create_organization_with_owner(text, text, text) from public, anon;
grant execute on function public.create_organization_with_owner(text, text, text) to authenticated;
