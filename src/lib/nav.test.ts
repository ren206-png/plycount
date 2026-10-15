import { describe, expect, it } from 'vitest'
import { APPROVALS_HREF, buildNav } from './nav'

describe('buildNav', () => {
  it('shows Account approvals to the platform admin, right under Overview', () => {
    const nav = buildNav(true)
    expect(nav[0].label).toBe('Overview')
    expect(nav[1]).toEqual({ href: APPROVALS_HREF, label: 'Account approvals' })
  })

  it('does not show Account approvals to anyone else', () => {
    expect(buildNav(false).some((i) => i.href === APPROVALS_HREF)).toBe(false)
  })

  it('keeps every other item for both audiences', () => {
    const others = buildNav(true).filter((i) => i.href !== APPROVALS_HREF)
    expect(others).toEqual(buildNav(false))
  })
})
