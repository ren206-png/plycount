// ============================================================
// Who may add and manage whom on a company's team. These rules mirror the
// database (migration 020, guard_user_profile_changes), which is what actually
// enforces them; this copy decides what the Team page offers and gates the
// invite route (which writes with the service role and so must check itself).
//
//   owner     adds and manages managers and staff
//   manager   (role "administrator") adds and manages staff only
//   staff     manages no one
//   platform administrator: anything, except no one edits them from here
// Nobody changes their own role or access.
// ============================================================
import type { UserRole } from '@/types'

export type InvitableRole = 'administrator' | 'sales_rep'

export const ROLE_LABEL: Record<UserRole, string> = {
  platform_admin: 'Platform admin',
  organization_owner: 'Owner',
  administrator: 'Manager',
  sales_rep: 'Staff',
  client_viewer: 'Customer portal',
}

export const roleLabel = (role: UserRole | string | null | undefined) =>
  (role && ROLE_LABEL[role as UserRole]) || 'Unknown'

export const ROLE_BLURB: Record<InvitableRole, string> = {
  administrator:
    'Full day-to-day access: costs, margins, quotes, orders, invoices, imports and the damaged-goods log. Can add and manage staff, but not other managers.',
  sales_rep:
    'Sales basics: view customers, products, price books and orders; create and email quotes. Never sees costs, margins or invoices.',
}

const isOwnerLike = (role: UserRole) => role === 'platform_admin' || role === 'organization_owner'
const isAdminLevel = (role: UserRole) => isOwnerLike(role) || role === 'administrator'

/** Roles the actor may hand out when adding someone. */
export function assignableRoles(actor: UserRole): InvitableRole[] {
  if (isOwnerLike(actor)) return ['administrator', 'sales_rep']
  if (actor === 'administrator') return ['sales_rep']
  return []
}

export function canInviteRole(actor: UserRole, role: UserRole | string): boolean {
  return assignableRoles(actor).includes(role as InvitableRole)
}

export interface MemberRef {
  role: UserRole
  authUserId: string
}

export interface MemberPermissions {
  /** May switch between manager and staff. */
  canChangeRole: boolean
  /** May suspend or reactivate. */
  canChangeAccess: boolean
}

export function memberPermissions(actor: MemberRef, target: MemberRef): MemberPermissions {
  const none = { canChangeRole: false, canChangeAccess: false }
  if (!isAdminLevel(actor.role)) return none
  if (actor.authUserId === target.authUserId) return none

  switch (target.role) {
    case 'sales_rep':
      // Any admin manages staff; only an owner or platform admin changes who is a manager.
      return { canChangeRole: isOwnerLike(actor.role), canChangeAccess: true }
    case 'administrator':
      return isOwnerLike(actor.role) ? { canChangeRole: true, canChangeAccess: true } : none
    case 'organization_owner':
      // Only the platform administrator changes an owner, and only their access here.
      return actor.role === 'platform_admin' ? { canChangeRole: false, canChangeAccess: true } : none
    default:
      return none // platform admins and customer-portal users are managed elsewhere
  }
}

export type MemberStatus = 'active' | 'suspended' | 'pending' | 'invited' | 'deactivated'

export const STATUS_LABEL: Record<MemberStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Waiting for approval',
  invited: 'Invited',
  deactivated: 'Turned away',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function validInviteEmail(email: string): boolean {
  return email.length <= 254 && EMAIL.test(email)
}
