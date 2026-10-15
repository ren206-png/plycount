// ============================================================
// Shared "is this role an org admin" check, mirroring the SQL
// is_org_admin() function (see 20260704001_organizations.sql)
// and the client-side deriveFlags() in AuthProvider. Needed
// server-side for routes that write to tables with no RLS policy
// at all (e.g. quickbooks_connections) and so must authorize the
// caller in application code instead of relying on the database.
// ============================================================
import type { UserRole } from '@/types'

const ADMIN_ROLES: UserRole[] = ['platform_admin', 'organization_owner', 'administrator']

// Staff = anyone who is not a customer-portal login. Portal logins
// (client_viewer) are read-only by design, so they must never trigger
// actions that use the organization's own credentials (email sending,
// QuickBooks/Xero writes).
export function isStaffRole(role: UserRole | null | undefined): boolean {
  return !!role && role !== 'client_viewer'
}

export function isPlatformAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'platform_admin'
}

// What an account is asking for, in words the approver recognizes.
export function describeRole(role: UserRole | null | undefined): string {
  switch (role) {
    case 'sales_rep':
      return 'Staff access request'
    case 'organization_owner':
      return 'New company signup'
    case 'administrator':
      return 'Administrator'
    case 'platform_admin':
      return 'Platform administrator'
    case 'client_viewer':
      return 'Customer portal'
    default:
      return 'Account'
  }
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}
