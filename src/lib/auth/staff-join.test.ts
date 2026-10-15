import { describe, expect, it } from 'vitest'
import { pendingStaffName, STAFF_JOIN_NAME_KEY } from './staff-join'

describe('pendingStaffName', () => {
  it('returns the trimmed name stored at sign-up', () => {
    expect(pendingStaffName({ [STAFF_JOIN_NAME_KEY]: '  Sam Carter ' })).toBe('Sam Carter')
  })

  it('returns null when there is no pending request', () => {
    expect(pendingStaffName(null)).toBeNull()
    expect(pendingStaffName(undefined)).toBeNull()
    expect(pendingStaffName({})).toBeNull()
    expect(pendingStaffName({ [STAFF_JOIN_NAME_KEY]: null })).toBeNull()
    expect(pendingStaffName({ [STAFF_JOIN_NAME_KEY]: '   ' })).toBeNull()
  })

  it('ignores a value that is not a string', () => {
    expect(pendingStaffName({ [STAFF_JOIN_NAME_KEY]: 42 })).toBeNull()
    expect(pendingStaffName({ [STAFF_JOIN_NAME_KEY]: { name: 'x' } })).toBeNull()
  })
})
