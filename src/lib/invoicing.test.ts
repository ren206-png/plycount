import { describe, expect, it } from 'vitest'
import { addDays, daysOverdue, displayStatus, dueDateFor, owedTotals, parseNetDays, toCents } from './invoicing'

describe('parseNetDays', () => {
  it('reads the usual ways credit terms are written', () => {
    expect(parseNetDays('Net 30')).toBe(30)
    expect(parseNetDays('net30')).toBe(30)
    expect(parseNetDays('NET 45 days')).toBe(45)
    expect(parseNetDays('2/10 net 30')).toBe(30)
    expect(parseNetDays('30 days')).toBe(30)
    expect(parseNetDays('60')).toBe(60)
  })

  it('treats pay-on-receipt wording as zero days', () => {
    for (const t of ['Due on receipt', 'COD', 'cash on delivery', 'Immediate', 'prepaid']) {
      expect(parseNetDays(t), t).toBe(0)
    }
  })

  it('gives up (null) on anything it cannot read', () => {
    for (const t of [null, undefined, '', '   ', 'by arrangement', 'end of the month']) {
      expect(parseNetDays(t as string | null), String(t)).toBeNull()
    }
  })
})

describe('due dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-15', 30)).toBe('2026-11-14')
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19')
    expect(addDays('2026-02-20', 10)).toBe('2026-03-02')
  })

  it('uses the customer terms, and 30 days when they are missing or unreadable', () => {
    expect(dueDateFor('2026-10-15', 'Net 15')).toBe('2026-10-30')
    expect(dueDateFor('2026-10-15', 'Due on receipt')).toBe('2026-10-15')
    expect(dueDateFor('2026-10-15', null)).toBe('2026-11-14')
    expect(dueDateFor('2026-10-15', 'by arrangement')).toBe('2026-11-14')
  })
})

describe('displayStatus', () => {
  const today = '2026-10-15'
  it('calls a sent invoice past its due date with money owing overdue', () => {
    expect(displayStatus({ status: 'sent', due_date: '2026-10-14', balance: 50 }, today)).toBe('overdue')
  })

  it('is not overdue on the due date itself, once paid, or with nothing owing', () => {
    expect(displayStatus({ status: 'sent', due_date: '2026-10-15', balance: 50 }, today)).toBe('sent')
    expect(displayStatus({ status: 'paid', due_date: '2026-09-01', balance: 0 }, today)).toBe('paid')
    expect(displayStatus({ status: 'sent', due_date: '2026-09-01', balance: 0 }, today)).toBe('sent')
  })

  it('never makes a draft or void invoice overdue', () => {
    expect(displayStatus({ status: 'draft', due_date: '2026-01-01', balance: 10 }, today)).toBe('draft')
    expect(displayStatus({ status: 'void', due_date: '2026-01-01', balance: 10 }, today)).toBe('void')
  })

  it('counts whole days overdue', () => {
    expect(daysOverdue('2026-10-01', '2026-10-15')).toBe(14)
    expect(daysOverdue('2026-10-20', '2026-10-15')).toBe(0)
  })
})

describe('owedTotals', () => {
  const today = '2026-10-15'
  const rows = [
    { status: 'sent' as const, due_date: '2026-11-01', total_amount: 100.1, balance: 100.1 },
    { status: 'sent' as const, due_date: '2026-10-01', total_amount: 200.2, balance: 150.2 },
    { status: 'paid' as const, due_date: '2026-09-01', total_amount: 999, balance: 0 },
    { status: 'draft' as const, due_date: null, total_amount: 500, balance: 500 },
    { status: 'void' as const, due_date: null, total_amount: 700, balance: 700 },
  ]

  it('adds up what is owed on sent invoices only, and what part of that is overdue', () => {
    const t = owedTotals(rows, today)
    expect(t.outstanding).toBe(250.3)
    expect(t.overdue).toBe(150.2)
    expect(t.openCount).toBe(2)
    expect(t.overdueCount).toBe(1)
  })

  it('does not drift on cents', () => {
    expect(owedTotals([{ status: 'sent', due_date: null, total_amount: 0.3, balance: 0.1 }, { status: 'sent', due_date: null, total_amount: 0.3, balance: 0.2 }], today).outstanding).toBe(0.3)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
})
