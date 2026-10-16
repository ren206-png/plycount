-- ============================================================
-- 018_production_losses.sql
--
-- A log of product that was damaged or scrapped during manufacturing and
-- production (machine jams, material defects, handling damage, and so on).
--
-- Admins only, like cost inputs: the page shows the money lost, which is
-- derived from cost data staff must not see. Every row belongs to one
-- organization and one of that organization's products; RLS enforces both.
-- ============================================================
create table if not exists public.production_losses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  qty              integer not null check (qty > 0),
  stage            text not null
                     check (stage in ('converting', 'packaging', 'warehouse', 'shipping', 'other')),
  reason           text not null
                     check (reason in ('machine_jam', 'material_defect', 'operator_error', 'moisture_damage', 'handling_damage', 'quality_reject', 'other')),
  occurred_on      date not null default current_date,
  notes            text,
  recorded_by      uuid references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_production_losses_org_date
  on public.production_losses (organization_id, occurred_on desc);
create index if not exists idx_production_losses_product
  on public.production_losses (product_id);

alter table public.production_losses enable row level security;

drop policy if exists "production_losses_select" on public.production_losses;
create policy "production_losses_select" on public.production_losses for select to authenticated
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

-- Insert and update: the product must belong to the same organization as the row.
drop policy if exists "production_losses_insert" on public.production_losses;
create policy "production_losses_insert" on public.production_losses for insert to authenticated
  with check (
    (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
    and recorded_by = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and p.organization_id = production_losses.organization_id)
  );

drop policy if exists "production_losses_update" on public.production_losses;
create policy "production_losses_update" on public.production_losses for update to authenticated
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
  with check (
    (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()))
    and exists (select 1 from public.products p where p.id = product_id and p.organization_id = production_losses.organization_id)
  );

drop policy if exists "production_losses_delete" on public.production_losses;
create policy "production_losses_delete" on public.production_losses for delete to authenticated
  using (public.is_platform_admin() or (organization_id = public.my_org_id() and public.is_org_admin()));

-- Never reachable without signing in.
revoke all on public.production_losses from anon;
