import { describe, expect, it } from 'vitest'
import { DIGEST_LIST_LIMIT, buildDigest, type DigestInput } from './digest'

const base: DigestInput = {
  recipientName: 'Ren Kay',
  orgName: 'Renco Enterprise',
  appUrl: 'https://www.plycounts.com',
  marginAlerts: [],
  overdue: [],
  pendingApprovals: 0,
}

describe('buildDigest', () => {
  it('sends nothing when there is nothing to report', () => {
    expect(buildDigest(base)).toBeNull()
  })

  it('leads with what matters in the subject', () => {
    const d = buildDigest({
      ...base,
      marginAlerts: [{ sku: 'A1', marginPct: 9.9, customer: 'Northside' }],
      overdue: [{ invoiceNumber: 'INV-0001', customer: 'Northside', balance: 1250.5, daysOverdue: 12 }],
      pendingApprovals: 2,
    })!
    expect(d.subject).toBe('PlyCount: 1 margin alert, $1,250.50 overdue, 2 accounts waiting for approval')
  })

  it('greets by first name and links to the right pages', () => {
    const d = buildDigest({ ...base, pendingApprovals: 1, marginAlerts: [{ sku: 'A1', marginPct: 5, customer: 'X' }] })!
    expect(d.text).toContain('Hi Ren,')
    expect(d.text).toContain('https://www.plycounts.com/dashboard/admin/approvals')
    expect(d.text).toContain('https://www.plycounts.com/dashboard/margin-alerts')
    expect(buildDigest({ ...base, recipientName: null, pendingApprovals: 1 })!.text.startsWith('Hi,')).toBe(true)
  })

  it('lists the worst items first and says how many more there are', () => {
    const overdue = Array.from({ length: DIGEST_LIST_LIMIT + 3 }, (_, n) => ({
      invoiceNumber: `INV-${String(n + 1).padStart(4, '0')}`,
      customer: 'C',
      balance: 10,
      daysOverdue: n + 1,
    }))
    const d = buildDigest({ ...base, overdue })!
    const body = d.text
    expect(body).toContain('INV-0008')
    expect(body.indexOf('INV-0008')).toBeLessThan(body.indexOf('INV-0007'))
    expect(body).not.toContain('INV-0001')
    expect(body).toContain('...and 3 more')
    expect(d.subject).toBe('PlyCount: $80.00 overdue')
  })

  it('uses singular and plural correctly and sorts alerts by lowest margin', () => {
    const d = buildDigest({
      ...base,
      marginAlerts: [
        { sku: 'OK', marginPct: 14, customer: 'X' },
        { sku: 'WORST', marginPct: 2.5, customer: 'Y' },
      ],
      overdue: [{ invoiceNumber: 'INV-0001', customer: 'Z', balance: 5, daysOverdue: 1 }],
    })!
    expect(d.text).toContain('1 day late')
    expect(d.text.indexOf('WORST')).toBeLessThan(d.text.indexOf('OK '))
    expect(d.subject).toContain('2 margin alerts')
  })

  it('does not add the approvals section for someone with none to approve', () => {
    const d = buildDigest({ ...base, marginAlerts: [{ sku: 'A', marginPct: 1, customer: 'X' }] })!
    expect(d.text).not.toContain('WAITING FOR APPROVAL')
  })
})
