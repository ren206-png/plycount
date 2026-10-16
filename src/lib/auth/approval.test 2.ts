import { describe, expect, it } from 'vitest'
import { hasAccess, isPending } from './approval'

describe('hasAccess', () => {
  it('lets approved staff and portal logins in', () => {
    expect(hasAccess('active')).toBe(true)
    expect(hasAccess('invited')).toBe(true)
  })

  it('keeps pending, suspended and deactivated accounts out', () => {
    expect(hasAccess('pending')).toBe(false)
    expect(hasAccess('suspended')).toBe(false)
    expect(hasAccess('deactivated')).toBe(false)
  })

  it('fails closed on anything unexpected', () => {
    expect(hasAccess(null)).toBe(false)
    expect(hasAccess(undefined)).toBe(false)
    expect(hasAccess('')).toBe(false)
    expect(hasAccess('ACTIVE')).toBe(false)
    expect(hasAccess('admin')).toBe(false)
  })
})

describe('isPending', () => {
  it('is true only for pending', () => {
    expect(isPending('pending')).toBe(true)
    expect(isPending('active')).toBe(false)
    expect(isPending(null)).toBe(false)
  })
})
