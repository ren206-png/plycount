-- ============================================================
-- 016_staff_access_and_cost_split.sql
--
-- Two changes that belong together:
--
-- A) COST SPLIT. quote_lines and order_lines carried the unit cost
--    snapshot (and quote_lines a generated margin_pct, which reveals
--    cost just as well). Anyone who could read a quote line could read
--    the company's cost: customer-portal logins on their own quotes and,
--    once staff exist, sales staff. RLS cannot hide a column, so cost
--    now lives in separate tables that only org admins can read:
--      quote_line_costs(quote_line_id, unit_cost_snapshot, cost_effective_date)
--      order_line_costs(order_line_id, unit_cost_snapshot)
--    * A quote line's cost is captured by a trigger at insert time from
--      cost_inputs, so nobody can supply or fake it (before, the client
--      sent the number).
--    * Nobody has write policies on the cost tables: only the trigger and
--      convert_quote_to_order() (both SECURITY DEFINER) write to them.
--
-- B) STAFF ROLE ("sales basics"). Staff = role sales_rep. They may:
--      view customers, products, price books and orders;
--      create, edit and email quotes.
--    Everything else is admin-only (platform_admin, organization_owner,
--    administrator): raw costs and cost inputs, margins, changing
--    customers/products/prices, creating or changing orders,
--    invoices, the user roster, billing, integrations, approvals.
--    Enforced here in RLS, not only in the UI.
--
-- convert_quote_to_order() does the whole conversion atomically (it has
-- to carry the hidden cost snapshots across) and is admin-only.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cost tables
-- ------------------------------------------------------------
create table if not exists public.quote_line_costs (
  quote_line_id       uuid primary key references public.quote_lines(id) on delete cascade,
  unit_cost_snapshot  numeric,   -- null = no cost on file when the line was created
  cost_effective_date date
);

create table if not exists public.order_line_costs (
  order_line_id       uuid primary key references public.order_lines(id) on delete cascade,
  unit_cost_snapshot  numeric
);

alter table public.quote_line_costs enable row level security;
alter table public.order_line_costs enable row level security;

grant select on public.quote_line_costs to authenticated;
grant select on public.order_line_costs to authenticated;

-- ------------------------------------------------------------
-- 2. Move existing cost data, then drop the columns (idempotent)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'quote_lines' and column_name = 'unit_cost_snapshot') then
    insert into public.quote_line_costs (quote_line_id, unit_cost_snapshot, cost_effective_date)
    select id, unit_cost_snapshot, cost_effective_date from public.quote_lines
    on conflict (quote_line_id) do nothing;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'order_lines' and column_name = 'unit_cost_snapshot') then
    insert into public.order_line_costs (order_line_id, unit_cost_snapshot)
    select id, unit_cost_snapshot from public.order_lines
    on conflict (order_line_id) do nothing;
  end if;
end $$;

alter table public.quote_lines
  drop column if exists margin_pct,
  drop column if exists unit_cost_snapshot,
  drop column if exists cost_effective_date;

alter table public.order_lines
  drop column if exists unit_cost_snapshot;

-- ------------------------------------------------------------
-- 3. Capture the cost when a quote line is created
-- ------------------------------------------------------------
create or replace function public.capture_quote_line_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric;
  v_date date;
begin
  select ci.raw_material_cost + ci.packaging_cost + ci.labor_cost + ci.freight_cost_per_unit,
         ci.effective_date
    into v_cost, v_date
  from public.cost_inputs ci
  join public.quotes q on q.id = new.quote_id
  where ci.product_id = new.product_id
    and ci.organization_id = q.organization_id
    and ci.effective_date <= current_date
  order by ci.effective_date desc
  limit 1;

  insert into public.quote_line_costs (quote_line_id, unit_cost_snapshot, cost_effective_date)
  values (new.id, v_cost, v_date);

  return new;
end;
$$;

drop trigger if exists trg_capture_quote_line_cost on public.quote_lines;
create trigger trg_capture_quote_line_cost
  after insert on public.quote_lines
  for each row execute function public.capture_quote_line_cost();

revoke all on function public.capture_quote_line_cost() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Policies for the cost tables: org admins read; nobody writes directly
-- ------------------------------------------------------------
drop policy if exists "quote_line_costs_select" on public.quote_line_costs;
create policy "quote_line_costs_select" on public.quote_line_costs for select
  using (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (
        select 1 from public.quote_lines ql
        join public.quotes q on q.id = ql.quote_id
        where ql.id = quote_line_costs.quote_line_id
          and q.organization_id = public.my_org_id()
      )
    )
  );

drop policy if exists "order_line_costs_select" on public.order_line_costs;
create policy "order_line_costs_select" on public.order_line_costs for select
  using (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (
        select 1 from public.order_lines ol
        join public.orders o on o.id = ol.order_id
        where ol.id = order_line_costs.order_line_id
          and o.organization_id = public.my_org_id()
      )
    )
  );

-- ------------------------------------------------------------
-- 5. Staff restrictions on the existing tables
--    ADMIN = platform_admin, or is_org_admin() inside their own org.
--    STAFF = any non-portal member of the org (customer_id is null).
-- ------------------------------------------------------------

-- customers: staff view; admins write
drop policy if exists "customers_write" on public.customers;
create policy "customers_write" on public.customers for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

-- products: staff view; admins write
drop policy if exists "products_write" on public.products;
create policy "products_write" on public.products for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

-- price books and lines: staff view; admins write
drop policy if exists "price_books_write" on public.price_books;
create policy "price_books_write" on public.price_books for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "price_book_lines_write" on public.price_book_lines;
create policy "price_book_lines_write" on public.price_book_lines for all
  using (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.price_books pb where pb.id = price_book_lines.price_book_id and pb.organization_id = public.my_org_id())
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.price_books pb where pb.id = price_book_lines.price_book_id and pb.organization_id = public.my_org_id())
    )
  );

-- cost inputs and margin reviews: admins only (read and write)
drop policy if exists "cost_inputs_select" on public.cost_inputs;
create policy "cost_inputs_select" on public.cost_inputs for select
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "cost_inputs_write" on public.cost_inputs;
create policy "cost_inputs_write" on public.cost_inputs for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "margin_alert_reviews_select" on public.margin_alert_reviews;
create policy "margin_alert_reviews_select" on public.margin_alert_reviews for select
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "margin_alert_reviews_write" on public.margin_alert_reviews;
create policy "margin_alert_reviews_write" on public.margin_alert_reviews for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

-- quotes: staff create and edit (no delete); admins everything
drop policy if exists "quotes_write" on public.quotes;
create policy "quotes_insert" on public.quotes for insert
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));
create policy "quotes_update" on public.quotes for update
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.my_customer_id() is null));
create policy "quotes_delete" on public.quotes for delete
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "quote_lines_write" on public.quote_lines;
create policy "quote_lines_insert" on public.quote_lines for insert
  with check (
    public.is_platform_admin()
    or (
      public.my_customer_id() is null
      and exists (select 1 from public.quotes q where q.id = quote_lines.quote_id and q.organization_id = public.my_org_id())
    )
  );
create policy "quote_lines_update" on public.quote_lines for update
  using (
    public.is_platform_admin()
    or (
      public.my_customer_id() is null
      and exists (select 1 from public.quotes q where q.id = quote_lines.quote_id and q.organization_id = public.my_org_id())
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.my_customer_id() is null
      and exists (select 1 from public.quotes q where q.id = quote_lines.quote_id and q.organization_id = public.my_org_id())
    )
  );
create policy "quote_lines_delete" on public.quote_lines for delete
  using (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.quotes q where q.id = quote_lines.quote_id and q.organization_id = public.my_org_id())
    )
  );

-- orders and order lines: staff view; admins write
drop policy if exists "orders_write" on public.orders;
create policy "orders_write" on public.orders for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "order_lines_write" on public.order_lines;
create policy "order_lines_write" on public.order_lines for all
  using (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.orders o where o.id = order_lines.order_id and o.organization_id = public.my_org_id())
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.orders o where o.id = order_lines.order_id and o.organization_id = public.my_org_id())
    )
  );

-- invoices and lines: admins write; read = admins, or the portal customer's own non-draft ones
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices for select
  using (
    public.is_platform_admin()
    or (
      organization_id = public.my_org_id()
      and (
        (public.my_customer_id() is null and public.is_org_admin())
        or (
          public.my_customer_id() is not null
          and status <> 'draft'
          and exists (select 1 from public.orders o where o.id = invoices.order_id and o.customer_id = public.my_customer_id())
        )
      )
    )
  );

drop policy if exists "invoices_write" on public.invoices;
create policy "invoices_write" on public.invoices for all
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

drop policy if exists "invoice_lines_select" on public.invoice_lines;
create policy "invoice_lines_select" on public.invoice_lines for select
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.invoices i
      join public.orders o on o.id = i.order_id
      where i.id = invoice_lines.invoice_id
        and i.organization_id = public.my_org_id()
        and (
          (public.my_customer_id() is null and public.is_org_admin())
          or (public.my_customer_id() is not null and i.status <> 'draft' and o.customer_id = public.my_customer_id())
        )
    )
  );

drop policy if exists "invoice_lines_write" on public.invoice_lines;
create policy "invoice_lines_write" on public.invoice_lines for all
  using (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.invoices i where i.id = invoice_lines.invoice_id and i.organization_id = public.my_org_id())
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.is_org_admin()
      and exists (select 1 from public.invoices i where i.id = invoice_lines.invoice_id and i.organization_id = public.my_org_id())
    )
  );

-- user roster: your own profile, or (admins) the whole org
drop policy if exists "user_profiles_select" on public.user_profiles;
create policy "user_profiles_select" on public.user_profiles for select
  using (
    public.is_platform_admin()
    or auth_user_id = auth.uid()
    or (organization_id = public.my_org_id() and public.is_org_admin())
  );

-- ------------------------------------------------------------
-- 6. Quote -> order conversion, atomic and admin-only
-- ------------------------------------------------------------
create or replace function public.convert_quote_to_order(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_order_id uuid;
  v_line record;
  v_order_line_id uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id;
  if not found
     or not (public.is_platform_admin()
             or (v_quote.organization_id = public.my_org_id() and public.is_org_admin())) then
    raise exception 'quote not found' using errcode = '42501';
  end if;

  if v_quote.status not in ('draft', 'sent') then
    raise exception 'only a draft or sent quote can be converted' using errcode = '22023';
  end if;

  if not exists (select 1 from public.quote_lines where quote_id = p_quote_id) then
    raise exception 'quote has no lines to convert' using errcode = '22023';
  end if;

  insert into public.orders (organization_id, quote_id, customer_id, status)
  values (v_quote.organization_id, v_quote.id, v_quote.customer_id, 'open')
  returning id into v_order_id;

  for v_line in
    select ql.id, ql.product_id, ql.qty, ql.unit_price, qlc.unit_cost_snapshot
    from public.quote_lines ql
    left join public.quote_line_costs qlc on qlc.quote_line_id = ql.id
    where ql.quote_id = p_quote_id
    order by ql.created_at, ql.id
  loop
    insert into public.order_lines (order_id, product_id, qty, unit_price)
    values (v_order_id, v_line.product_id, v_line.qty, v_line.unit_price)
    returning id into v_order_line_id;

    insert into public.order_line_costs (order_line_id, unit_cost_snapshot)
    values (v_order_line_id, v_line.unit_cost_snapshot);
  end loop;

  update public.quotes set status = 'accepted' where id = p_quote_id;

  insert into public.audit_log (organization_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (
    v_quote.organization_id,
    auth.uid(),
    'quote.converted_to_order',
    'orders',
    v_order_id,
    jsonb_build_object('quote_id', p_quote_id, 'order_id', v_order_id)
  );

  return v_order_id;
end;
$$;

revoke all on function public.convert_quote_to_order(uuid) from public, anon;
grant execute on function public.convert_quote_to_order(uuid) to authenticated;

-- The standalone audit helper is now admin-only too.
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
    and public.is_org_admin();

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
