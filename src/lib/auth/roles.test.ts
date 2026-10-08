import { describe, expect, it } from 'vitest'
import { isAdminRole, isStaffRole } from './roles'

describe('isStaffRole', () => {
  it('treats every non-portal role as staff', () => {
    expect(isStaffRole('platform_admin')).toBe(true)
    expect(isStaffRole('organization_owner')).toBe(true)
    expect(isStaffRole('administrator')).toBe(true)
    expect(isStaffRole('sales_rep')).toBe(true)
  })

  it('rejects customer-portal logins and missing roles', () => {
    expect(isStaffRole('client_viewer')).toBe(false)
    expect(isStaffRole(null)).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
  })
})

describe('isAdminRole', () => {
  it('only admin-tier roles count as admin', () => {
    expect(isAdminRole('organization_owner')).toBe(true)
    expect(isAdminRole('administrator')).toBe(true)
    expect(isAdminRole('sales_rep')).toBe(false)
    expect(isAdminRole('client_viewer')).toBe(false)
  })
})
