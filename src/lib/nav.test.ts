import { describe, expect, it } from 'vitest'
import { APPROVALS_HREF, buildNav, canAccessPath } from './nav'

const platformAdmin = { isPlatformAdmin: true, isOrgAdmin: true }
const orgAdmin = { isPlatformAdmin: false, isOrgAdmin: true }
const staff = { isPlatformAdmin: false, isOrgAdmin: false }

describe('buildNav', () => {
  it('shows Account approvals to the platform admin, right under Overview', () => {
    const nav = buildNav(platformAdmin)
    expect(nav[0].label).toBe('Overview')
    expect(nav[1]).toEqual({ href: APPROVALS_HREF, label: 'Account approvals' })
  })

  it('gives org admins the full menu without approvals', () => {
    const nav = buildNav(orgAdmin)
    expect(nav.some((i) => i.href === APPROVALS_HREF)).toBe(false)
    expect(nav.map((i) => i.label)).toContain('Cost Inputs')
    expect(nav.map((i) => i.label)).toContain('Billing')
    expect(nav.map((i) => i.label)).toContain('Damaged goods')
    expect(nav.map((i) => i.label)).toContain('Import data')
    expect(nav.map((i) => i.label)).toContain('Invoices')
  })

  it('gives staff only the sales basics', () => {
    expect(buildNav(staff).map((i) => i.label)).toEqual([
      'Overview',
      'Customers',
      'Products (SKUs)',
      'Price Books',
      'Quotes',
      'Orders',
    ])
  })
})

describe('canAccessPath', () => {
  it('lets staff open the pages they are meant to use', () => {
    for (const p of [
      '/dashboard',
      '/dashboard/customers',
      '/dashboard/products',
      '/dashboard/price-books',
      '/dashboard/price-books/abc',
      '/dashboard/quotes',
      '/dashboard/quotes/new',
      '/dashboard/quotes/abc',
      '/dashboard/orders',
      '/dashboard/orders/abc',
    ]) {
      expect(canAccessPath(p, staff), p).toBe(true)
    }
  })

  it('keeps staff out of costs, margins, settings and edit forms', () => {
    for (const p of [
      '/dashboard/cost-inputs',
      '/dashboard/production-losses',
      '/dashboard/import',
      '/dashboard/invoices',
      '/dashboard/invoices/abc',
      '/dashboard/margin',
      '/dashboard/margin-alerts',
      '/dashboard/settings/billing',
      '/dashboard/settings/integrations',
      '/dashboard/customers/new',
      '/dashboard/customers/abc',
      '/dashboard/products/new',
      '/dashboard/products/abc',
      '/dashboard/price-books/new',
      '/dashboard/orders/new',
      APPROVALS_HREF,
    ]) {
      expect(canAccessPath(p, staff), p).toBe(false)
    }
  })

  it('gives org admins everything except the approvals page', () => {
    expect(canAccessPath('/dashboard/cost-inputs', orgAdmin)).toBe(true)
    expect(canAccessPath('/dashboard/customers/abc', orgAdmin)).toBe(true)
    expect(canAccessPath(APPROVALS_HREF, orgAdmin)).toBe(false)
  })

  it('gives the platform admin everything', () => {
    expect(canAccessPath(APPROVALS_HREF, platformAdmin)).toBe(true)
    expect(canAccessPath('/dashboard/cost-inputs', platformAdmin)).toBe(true)
  })
})
