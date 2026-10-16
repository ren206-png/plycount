// ============================================================
// The daily summary email to a company's administrators: margin alerts,
// overdue invoices and (for the platform administrator) accounts waiting for
// approval. Building the message is separate from loading data and sending, so
// the wording and the "say nothing when there is nothing to say" rule are
// tested.
// ============================================================
import { formatCurrency } from '@/lib/utils'

export interface DigestAlert {
  sku: string
  marginPct: number
  customer: string
}

export interface DigestOverdue {
  invoiceNumber: string
  customer: string
  balance: number
  daysOverdue: number
}

export interface DigestInput {
  recipientName: string | null
  orgName: string
  appUrl: string
  marginAlerts: DigestAlert[]
  overdue: DigestOverdue[]
  /** Only for the platform administrator; 0 for everyone else. */
  pendingApprovals: number
}

export const DIGEST_LIST_LIMIT = 5

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The email, or null when there is nothing worth interrupting someone for. */
export function buildDigest(i: DigestInput): { subject: string; text: string } | null {
  const overdueTotal = i.overdue.reduce((sum, o) => sum + Math.round(o.balance * 100), 0) / 100
  if (i.marginAlerts.length === 0 && i.overdue.length === 0 && i.pendingApprovals === 0) return null

  const headline: string[] = []
  if (i.marginAlerts.length > 0) headline.push(plural(i.marginAlerts.length, 'margin alert', 'margin alerts'))
  if (i.overdue.length > 0) headline.push(`${formatCurrency(overdueTotal)} overdue`)
  if (i.pendingApprovals > 0) headline.push(`${plural(i.pendingApprovals, 'account', 'accounts')} waiting for approval`)

  const lines: string[] = [`Hi${i.recipientName ? ` ${i.recipientName.split(' ')[0]}` : ''},`, '', `Here is what needs a look at ${i.orgName} today.`, '']

  if (i.pendingApprovals > 0) {
    lines.push(`ACCOUNTS WAITING FOR APPROVAL: ${i.pendingApprovals}`, `Review them: ${i.appUrl}/dashboard/admin/approvals`, '')
  }

  if (i.overdue.length > 0) {
    lines.push(`OVERDUE INVOICES: ${plural(i.overdue.length, 'invoice', 'invoices')}, ${formatCurrency(overdueTotal)} in total`)
    const worst = [...i.overdue].sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, DIGEST_LIST_LIMIT)
    for (const o of worst) {
      lines.push(`  - ${o.invoiceNumber}  ${o.customer}  ${formatCurrency(o.balance)}  ${plural(o.daysOverdue, 'day', 'days')} late`)
    }
    if (i.overdue.length > worst.length) lines.push(`  ...and ${i.overdue.length - worst.length} more`)
    lines.push(`See all: ${i.appUrl}/dashboard/invoices`, '')
  }

  if (i.marginAlerts.length > 0) {
    lines.push(`MARGIN ALERTS: ${plural(i.marginAlerts.length, 'price', 'prices')} below a healthy margin after a cost change`)
    const worst = [...i.marginAlerts].sort((a, b) => a.marginPct - b.marginPct).slice(0, DIGEST_LIST_LIMIT)
    for (const a of worst) lines.push(`  - ${a.sku}  ${a.customer}  ${a.marginPct.toFixed(1)}% margin`)
    if (i.marginAlerts.length > worst.length) lines.push(`  ...and ${i.marginAlerts.length - worst.length} more`)
    lines.push(`Review and reprice: ${i.appUrl}/dashboard/margin-alerts`, '')
  }

  lines.push('You get this email only on days when something needs attention.')
  return { subject: `PlyCount: ${headline.join(', ')}`, text: lines.join('\n') }
}
