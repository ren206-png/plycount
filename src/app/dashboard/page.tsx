'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import type { Invoice, InvoiceBalance, MarginAlertReview, PriceBookLineMargin } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { owedTotals } from '@/lib/invoicing'
import { activeMarginAlerts } from '@/lib/margin/alerts'

const STEPS = [
  { href: '/dashboard/customers', title: 'Add a customer', desc: 'Distributors, institutions, wholesalers.' },
  { href: '/dashboard/products', title: 'Add your SKUs', desc: 'Ply, GSM, roll length, sheet count, case pack.' },
  { href: '/dashboard/cost-inputs', title: 'Enter cost inputs', desc: 'Raw material, packaging, labor, freight per SKU.' },
  { href: '/dashboard/price-books', title: 'Build a price book', desc: 'Contract or volume pricing, per customer, with effective dates.' },
  { href: '/dashboard/quotes', title: 'Build a quote', desc: 'See live margin per line as you price it.' },
]

export default function DashboardOverviewPage() {
  const { organization, isOrgAdmin } = useAuth()
  const supabase = createClient()
  // Captured once so render stays pure.
  const today = useState(() => new Date().toISOString().slice(0, 10))[0]

  const { data: lines } = useQuery({
    queryKey: ['price-book-line-margins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('price_book_line_margins').select('*')
      if (error) throw error
      return data as PriceBookLineMargin[]
    },
  })

  const { data: reviews } = useQuery({
    queryKey: ['margin-alert-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('margin_alert_reviews')
        .select('*')
        .order('reviewed_cost_effective_date', { ascending: false })
      if (error) throw error
      return data as MarginAlertReview[]
    },
  })

  // Money owed: admins only (staff cannot read invoices).
  const { data: invoices } = useQuery({
    queryKey: ['invoices-all'],
    enabled: isOrgAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as Invoice[]
    },
  })
  const { data: balances } = useQuery({
    queryKey: ['invoice-balances'],
    enabled: isOrgAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_balances').select('*')
      if (error) throw error
      return data as InvoiceBalance[]
    },
  })
  const owed = useMemo(() => {
    const balanceFor = new Map((balances ?? []).map((b) => [b.invoice_id, Number(b.balance)]))
    return owedTotals(
      (invoices ?? []).map((i) => ({
        status: i.status,
        due_date: i.due_date,
        total_amount: Number(i.total_amount),
        balance: balanceFor.get(i.id) ?? Number(i.total_amount),
      })),
      today
    )
  }, [invoices, balances, today])

  const alertCount = useMemo(() => activeMarginAlerts(lines ?? [], reviews ?? []).length, [lines, reviews])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome{organization ? `, ${organization.name}` : ''}
      </h1>
      <p className="mt-1 text-gray-600">
        Get a quote out the door with live margin visibility in five steps.
      </p>

      {isOrgAdmin && owed.openCount > 0 && (
        <Link
          href="/dashboard/invoices"
          className={`mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${
            owed.overdueCount > 0 ? 'border-red-300 bg-red-50 hover:bg-red-100' : 'border-gray-200 bg-white hover:border-brand-300'
          }`}
        >
          <span className="text-sm font-medium text-gray-800">
            {formatCurrency(owed.outstanding)} owed to you across {owed.openCount} open {owed.openCount === 1 ? 'invoice' : 'invoices'}
          </span>
          {owed.overdueCount > 0 && (
            <span className="text-sm font-semibold text-red-700">
              {formatCurrency(owed.overdue)} overdue ({owed.overdueCount}) →
            </span>
          )}
        </Link>
      )}

      {alertCount > 0 && (
        <Link
          href="/dashboard/margin-alerts"
          className="mt-6 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100"
        >
          <span className="text-sm font-medium text-amber-800">
            {alertCount} price{alertCount === 1 ? '' : 's'} {alertCount === 1 ? 'has' : 'have'} fallen below
            a healthy margin due to a cost change — review Margin Alerts →
          </span>
        </Link>
      )}

      <ol className="mt-8 space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold text-gray-900">{step.title}</span>
                <span className="block text-sm text-gray-500">{step.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
