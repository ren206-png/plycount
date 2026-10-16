'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Customer, Invoice, InvoiceBalance, Order } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'
import { STATUS_LABEL, STATUS_STYLE, daysOverdue, displayStatus, owedTotals, type DisplayStatus } from '@/lib/invoicing'

type Filter = 'all' | 'open' | 'overdue' | 'paid' | 'draft'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Drafts' },
]

const matches = (f: Filter, s: DisplayStatus) =>
  f === 'all' ? true : f === 'open' ? s === 'sent' || s === 'overdue' : f === 'overdue' ? s === 'overdue' : f === 'paid' ? s === 'paid' : s === 'draft'

export default function InvoicesPage() {
  const supabase = createClient()
  const [filter, setFilter] = useState<Filter>('open')
  // Captured once so render stays pure.
  const today = useState(() => new Date().toISOString().slice(0, 10))[0]

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as Invoice[]
    },
  })
  const { data: balances } = useQuery({
    queryKey: ['invoice-balances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_balances').select('*')
      if (error) throw error
      return data as InvoiceBalance[]
    },
  })
  const { data: orders } = useQuery({
    queryKey: ['orders-customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('id, customer_id')
      if (error) throw error
      return data as Pick<Order, 'id' | 'customer_id'>[]
    },
  })
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*')
      if (error) throw error
      return data as Customer[]
    },
  })

  const rows = useMemo(() => {
    const balanceFor = new Map((balances ?? []).map((b) => [b.invoice_id, Number(b.balance)]))
    const customerForOrder = new Map((orders ?? []).map((o) => [o.id, o.customer_id]))
    const nameFor = new Map((customers ?? []).map((c) => [c.id, c.name]))
    return (invoices ?? []).map((i) => {
      const balance = balanceFor.get(i.id) ?? Number(i.total_amount)
      return {
        invoice: i,
        balance,
        customer: nameFor.get(customerForOrder.get(i.order_id) ?? '') ?? '—',
        shown: displayStatus({ status: i.status, due_date: i.due_date, balance }, today),
      }
    })
  }, [invoices, balances, orders, customers, today])

  const totals = useMemo(
    () => owedTotals(rows.map((r) => ({ status: r.invoice.status, due_date: r.invoice.due_date, total_amount: Number(r.invoice.total_amount), balance: r.balance })), today),
    [rows, today]
  )
  const visible = rows.filter((r) => matches(filter, r.shown))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
      <p className="mb-6 text-sm text-gray-500">What you have billed, what has been paid, and what is late.</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Owed to you</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totals.outstanding)}</p>
          <p className="text-xs text-gray-500">{totals.openCount} open {totals.openCount === 1 ? 'invoice' : 'invoices'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Overdue</p>
          <p className={cn('mt-1 text-xl font-bold', totals.overdue > 0 ? 'text-red-600' : 'text-gray-900')}>{formatCurrency(totals.overdue)}</p>
          <p className="text-xs text-gray-500">{totals.overdueCount} overdue {totals.overdueCount === 1 ? 'invoice' : 'invoices'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Drafts not sent</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{rows.filter((r) => r.invoice.status === 'draft').length}</p>
          <p className="text-xs text-gray-500">Open an order to create one</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter invoices">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold',
              filter === f.value ? 'bg-brand-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td className="px-4 py-6 text-gray-500" colSpan={8}>Loading…</td></tr>}
            {!isLoading && visible.length === 0 && (
              <tr><td className="px-4 py-6 text-gray-500" colSpan={8}>No invoices here.</td></tr>
            )}
            {visible.map(({ invoice: i, balance, customer, shown }) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{i.invoice_number}</td>
                <td className="px-4 py-3 text-gray-700">{customer}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[shown])}>{STATUS_LABEL[shown]}</span>
                  {shown === 'overdue' && i.due_date && (
                    <span className="ml-2 text-xs text-red-600">{daysOverdue(i.due_date, today)} days</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{i.issue_date ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{i.due_date ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(Number(i.total_amount))}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{i.status === 'draft' || i.status === 'void' ? '—' : formatCurrency(balance)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/invoices/${i.id}`} className="font-medium text-brand-600 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
