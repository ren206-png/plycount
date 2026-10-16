import { describe, expect, it } from 'vitest'
import { assignableRoles, canInviteRole, memberPermissions, roleLabel, validInviteEmail } from './team'

const owner = { role: 'organization_owner' as const, authUserId: 'o' }
const manager = { role: 'administrator' as const, authUserId: 'm' }
const manager2 = { role: 'administrator' as const, authUserId: 'm2' }
const staff = { role: 'sales_rep' as const, authUserId: 's' }
const root = { role: 'platform_admin' as const, authUserId: 'p' }
const portal = { role: 'client_viewer' as const, authUserId: 'c' }

describe('who can be added', () => {
  it('owners and the platform admin add managers and staff; managers add staff only; staff add no one', () => {
    expect(assignableRoles('organization_owner')).toEqual(['administrator', 'sales_rep'])
    expect(assignableRoles('platform_admin')).toEqual(['administrator', 'sales_rep'])
    expect(assignableRoles('administrator')).toEqual(['sales_rep'])
    expect(assignableRoles('sales_rep')).toEqual([])
    expect(assignableRoles('client_viewer')).toEqual([])
  })

  it('never lets anyone add an owner, a platform admin or a portal user from here', () => {
    for (const actor of ['platform_admin', 'organization_owner', 'administrator'] as const) {
      for (const role of ['organization_owner', 'platform_admin', 'client_viewer', 'nonsense']) {
        expect(canInviteRole(actor, role), `${actor} -> ${role}`).toBe(false)
      }
    }
    expect(canInviteRole('administrator', 'administrator')).toBe(false)
    expect(canInviteRole('organization_owner', 'administrator')).toBe(true)
  })
})

describe('memberPermissions', () => {
  it('lets an owner manage managers and staff', () => {
    expect(memberPermissions(owner, manager)).toEqual({ canChangeRole: true, canChangeAccess: true })
    expect(memberPermissions(owner, staff)).toEqual({ canChangeRole: true, canChangeAccess: true })
  })

  it('lets a manager suspend staff but not change roles or touch managers and owners', () => {
    expect(memberPermissions(manager, staff)).toEqual({ canChangeRole: false, canChangeAccess: true })
    expect(memberPermissions(manager, manager2)).toEqual({ canChangeRole: false, canChangeAccess: false })
    expect(memberPermissions(manager, owner)).toEqual({ canChangeRole: false, canChangeAccess: false })
  })

  it('lets staff manage no one', () => {
    expect(memberPermissions(staff, staff)).toEqual({ canChangeRole: false, canChangeAccess: false })
    expect(memberPermissions(staff, { ...staff, authUserId: 's2' })).toEqual({ canChangeRole: false, canChangeAccess: false })
  })

  it('never lets anyone change themselves', () => {
    for (const a of [owner, manager, staff, root]) expect(memberPermissions(a, a)).toEqual({ canChangeRole: false, canChangeAccess: false })
  })

  it('lets only the platform admin change an owner, and never edit a platform admin or portal user here', () => {
    expect(memberPermissions(root, owner)).toEqual({ canChangeRole: false, canChangeAccess: true })
    expect(memberPermissions(owner, { ...owner, authUserId: 'o2' })).toEqual({ canChangeRole: false, canChangeAccess: false })
    expect(memberPermissions(owner, root)).toEqual({ canChangeRole: false, canChangeAccess: false })
    expect(memberPermissions(owner, portal)).toEqual({ canChangeRole: false, canChangeAccess: false })
  })
})

describe('labels and emails', () => {
  it('calls the administrator role "Manager"', () => {
    expect(roleLabel('administrator')).toBe('Manager')
    expect(roleLabel('organization_owner')).toBe('Owner')
    expect(roleLabel('sales_rep')).toBe('Staff')
    expect(roleLabel(null)).toBe('Unknown')
  })

  it('accepts ordinary emails and rejects malformed ones', () => {
    expect(validInviteEmail('a@b.co')).toBe(true)
    for (const e of ['', 'a', 'a@b', 'a b@c.com', '@c.com', 'a@@c.com']) expect(validInviteEmail(e), e).toBe(false)
  })
})
