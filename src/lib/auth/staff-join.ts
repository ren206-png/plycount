// ============================================================
// Staff "request access" bookkeeping. The /staff/join page stashes the
// person's name on their auth user metadata at sign-up; once they have a
// session (right away, or after confirming their email and signing in) the
// AuthProvider reads it back and calls request_staff_access(), which creates
// a pending sales_rep profile in the factory's organization. Same pattern as
// the company signup's pending_org_* fields.
// ============================================================
export const STAFF_JOIN_NAME_KEY = 'pending_staff_full_name'

export function pendingStaffName(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.[STAFF_JOIN_NAME_KEY]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
