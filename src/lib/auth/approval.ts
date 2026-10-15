// ============================================================
// Account approval. Self-service signups start as `pending` and
// have no access until a platform admin approves them (see
// supabase/migrations/20261015015_account_approval.sql, which
// enforces this in RLS; this helper is the app-side mirror used by
// the middleware and UI).
//
//   active    — approved staff
//   invited   — customer-portal login created by the invite API
//   pending   — waiting for approval (no access)
//   suspended / deactivated — shut out
// ============================================================
type ProfileStatus = 'active' | 'invited' | 'pending' | 'suspended' | 'deactivated'

export function hasAccess(status: ProfileStatus | string | null | undefined): boolean {
  return status === 'active' || status === 'invited'
}

export function isPending(status: string | null | undefined): boolean {
  return status === 'pending'
}
