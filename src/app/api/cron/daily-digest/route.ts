// ============================================================
// GET /api/cron/daily-digest — run once a day by Vercel Cron (see vercel.json).
//
// Emails each company's administrators a short summary of what needs
// attention (margin alerts, overdue invoices) and the platform administrator
// the number of accounts waiting for approval. Sends nothing on a quiet day.
//
// Protected by CRON_SECRET: Vercel sends it as "Authorization: Bearer ...".
// It reads across companies, so it uses the service-role client and only ever
// emails an administrator about their own company's data.
//   ?dryRun=1 reports counts without sending anything (for checking).
// ============================================================
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { activeMarginAlerts } from '@/lib/margin/alerts'
import { buildDigest, type DigestAlert, type DigestOverdue } from '@/lib/digest'
import { daysOverdue } from '@/lib/invoicing'
import { SITE_URL } from '@/lib/site'
import type { MarginAlertReview, PriceBookLineMargin } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['platform_admin', 'organization_owner', 'administrator']

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Daily summary is not configured (CRON_SECRET missing).' }, { status: 503 })
  }
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  if (!dryRun && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email delivery is not configured (RESEND_API_KEY missing).' }, { status: 501 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [recipients, orgs, lines, reviews, products, customers, invoices, balances, orders, pending] = await Promise.all([
    admin.from('user_profiles').select('email, full_name, role, organization_id').eq('status', 'active').in('role', ADMIN_ROLES),
    admin.from('organizations').select('id, name'),
    admin.from('price_book_line_margins').select('*'),
    admin.from('margin_alert_reviews').select('*').order('reviewed_cost_effective_date', { ascending: false }),
    admin.from('products').select('id, sku_code'),
    admin.from('customers').select('id, name'),
    admin.from('invoices').select('id, organization_id, order_id, invoice_number, due_date').eq('status', 'sent'),
    admin.from('invoice_balances').select('invoice_id, balance'),
    admin.from('orders').select('id, customer_id'),
    admin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  const failed = [recipients, orgs, lines, reviews, products, customers, invoices, balances, orders, pending].find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  const orgName = new Map((orgs.data ?? []).map((o) => [o.id as string, o.name as string]))
  const skuFor = new Map((products.data ?? []).map((p) => [p.id as string, p.sku_code as string]))
  const customerName = new Map((customers.data ?? []).map((c) => [c.id as string, c.name as string]))
  const customerForOrder = new Map((orders.data ?? []).map((o) => [o.id as string, o.customer_id as string]))
  const balanceFor = new Map((balances.data ?? []).map((b) => [b.invoice_id as string, Number(b.balance)]))

  // Per company: the alerts and overdue invoices that company's admins should hear about.
  const perOrg = new Map<string, { alerts: DigestAlert[]; overdue: DigestOverdue[] }>()
  for (const id of orgName.keys()) {
    const orgLines = ((lines.data ?? []) as PriceBookLineMargin[]).filter((l) => l.organization_id === id)
    const orgReviews = ((reviews.data ?? []) as MarginAlertReview[]).filter((r) => r.organization_id === id)
    const alerts = activeMarginAlerts(orgLines, orgReviews).map((l) => ({
      sku: skuFor.get(l.product_id) ?? '—',
      marginPct: l.margin_pct ?? 0,
      customer: l.customer_id ? customerName.get(l.customer_id) ?? 'a customer' : 'list price',
    }))
    const overdue: DigestOverdue[] = []
    for (const inv of invoices.data ?? []) {
      if (inv.organization_id !== id || !inv.due_date || inv.due_date >= today) continue
      const balance = balanceFor.get(inv.id) ?? 0
      if (balance <= 0.004) continue
      overdue.push({
        invoiceNumber: inv.invoice_number,
        customer: customerName.get(customerForOrder.get(inv.order_id) ?? '') ?? 'a customer',
        balance,
        daysOverdue: daysOverdue(inv.due_date, today),
      })
    }
    perOrg.set(id, { alerts, overdue })
  }

  const resend = dryRun ? null : new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL || 'quotes@plycount.app'
  const seen = new Set<string>()
  let sent = 0
  let quiet = 0
  let failures = 0

  for (const r of recipients.data ?? []) {
    const email = (r.email as string | null)?.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    const data = perOrg.get(r.organization_id as string) ?? { alerts: [], overdue: [] }
    const digest = buildDigest({
      recipientName: r.full_name as string | null,
      orgName: orgName.get(r.organization_id as string) ?? 'your company',
      appUrl: SITE_URL,
      marginAlerts: data.alerts,
      overdue: data.overdue,
      pendingApprovals: r.role === 'platform_admin' ? pending.count ?? 0 : 0,
    })
    if (!digest) {
      quiet++
      continue
    }
    if (dryRun) {
      sent++
      continue
    }
    const { error } = await resend!.emails.send({ from: `PlyCount <${from}>`, to: email, subject: digest.subject, text: digest.text })
    if (error) failures++
    else sent++
  }

  return NextResponse.json({ ok: failures === 0, dryRun, recipients: seen.size, wouldSendOrSent: sent, quiet, failures })
}
