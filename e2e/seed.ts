import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { LOCAL_ANON_KEY, LOCAL_SERVICE_KEY, LOCAL_SUPABASE_URL } from './env'

export const PASSWORD = 'E2e-test-password-1!'

export function adminClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function anonClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export interface Seeded {
  email: string
  orgId: string
  customerName: string
  sku: string
  productName: string
}

function ok<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data === null) throw new Error(`seed ${what}: ${res.error?.message ?? 'no data'}`)
  return res.data
}

/**
 * A fresh company with an approved owner, one customer, one product and a
 * cost entry. Everything is unique per call, so tests never collide and the
 * local database never needs cleaning.
 */
export async function seedCompany(label: string): Promise<Seeded> {
  const admin = adminClient()
  const id = randomUUID().slice(0, 8)
  const email = `${label}-${id}@e2e.test`

  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (created.error || !created.data.user) throw new Error(`seed user: ${created.error?.message}`)

  const org = ok<{ id: string }>(await admin.from('organizations').insert({ name: `E2E ${label} ${id}`, slug: `e2e-${label}-${id}` }).select('id').single(), 'organization')
  await ok(
    await admin.from('user_profiles').insert({
      auth_user_id: created.data.user.id,
      organization_id: org.id,
      email,
      full_name: `Owner ${id}`,
      role: 'organization_owner',
      status: 'active',
    }).select('id').single(),
    'profile'
  )

  const customerName = `Acme Paper ${id}`
  await ok(await admin.from('customers').insert({ organization_id: org.id, name: customerName, contact_email: `buyer-${id}@e2e.test` }).select('id').single(), 'customer')

  const sku = `E2E-${id.toUpperCase()}`
  const productName = `2-Ply Tissue ${id}`
  const product = ok<{ id: string }>(
    await admin.from('products').insert({ organization_id: org.id, sku_code: sku, name: productName, ply: 2, case_pack_qty: 96, unit_of_measure: 'case' }).select('id').single(),
    'product'
  )
  await ok(
    await admin.from('cost_inputs').insert({ organization_id: org.id, product_id: product.id, raw_material_cost: 6, packaging_cost: 0.5, labor_cost: 1, freight_cost_per_unit: 0.5, effective_date: new Date().toISOString().slice(0, 10) }).select('id').single(),
    'cost input'
  )
  return { email, orgId: org.id, customerName, sku, productName }
}
