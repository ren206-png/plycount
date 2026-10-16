// ============================================================
// Invoice maths and wording: due dates from credit terms, what to call an
// invoice (draft, sent, overdue, paid, void), and the money-owed totals.
// Plain functions so the rules that matter to cash are tested.
// ============================================================
import type { InvoiceStatus, PaymentMethod } from '@/types'

export const DEFAULT_PAYMENT_DAYS = 30

/**
 * Days allowed to pay, read from a customer's free-text credit terms.
 * "Net 30" -> 30, "net45 days" -> 45, "2/10 net 30" -> 30, "30 days" -> 30,
 * "Due on receipt" / "COD" -> 0. Anything else -> null (caller picks a default).
 */
export function parseNetDays(terms: string | null | undefined): number | null {
  if (!terms) return null
  const t = terms.trim().toLowerCase()
  if (t === '') return null
  if (/\b(due\s+on\s+receipt|on\s+receipt|upon\s+receipt|cod|cash\s+on\s+delivery|immediate(ly)?|prepaid|cia)\b/.test(t)) return 0
  const net = /net\s*(\d{1,3})\b/.exec(t)
  if (net) return Number(net[1])
  const plain = /^(\d{1,3})(\s*days?)?$/.exec(t)
  if (plain) return Number(plain[1])
  return null
}

/** YYYY-MM-DD plus a number of days (UTC, so no daylight-saving surprises). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function dueDateFor(issueDate: string, creditTerms: string | null | undefined): string {
  return addDays(issueDate, parseNetDays(creditTerms) ?? DEFAULT_PAYMENT_DAYS)
}

export type DisplayStatus = InvoiceStatus | 'overdue'

export interface StatusInput {
  status: InvoiceStatus
  due_date: string | null
  /** What is still owed. */
  balance: number
}

/** What the person should see: a sent invoice past its due date with money owing is "overdue". */
export function displayStatus(inv: StatusInput, today: string): DisplayStatus {
  if (inv.status === 'sent' && inv.due_date && inv.due_date < today && inv.balance > 0.004) return 'overdue'
  return inv.status
}

export function daysOverdue(dueDate: string, today: string): number {
  const ms = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${dueDate}T00:00:00Z`).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  overdue: 'Overdue',
  paid: 'Paid',
  void: 'Void',
}

export const STATUS_STYLE: Record<DisplayStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-gray-100 text-gray-400 line-through',
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'eft', label: 'Bank transfer / EFT' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]
export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m

/** Round to cents so sums of prices do not drift (0.1 + 0.2). */
export const toCents = (n: number) => Math.round(n * 100)
export const fromCents = (c: number) => c / 100

export interface OwedRow extends StatusInput {
  total_amount: number
}

export interface OwedTotals {
  /** Sent invoices not yet fully paid, including overdue ones. */
  outstanding: number
  overdue: number
  openCount: number
  overdueCount: number
}

export function owedTotals(rows: OwedRow[], today: string): OwedTotals {
  let outstanding = 0
  let overdue = 0
  let openCount = 0
  let overdueCount = 0
  for (const r of rows) {
    if (r.status !== 'sent' || r.balance <= 0.004) continue
    const cents = toCents(r.balance)
    outstanding += cents
    openCount++
    if (displayStatus(r, today) === 'overdue') {
      overdue += cents
      overdueCount++
    }
  }
  return { outstanding: fromCents(outstanding), overdue: fromCents(overdue), openCount, overdueCount }
}
