'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Customer, Order, OrderLine, OrderLineCost, Product } from '@/types'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { rollUp, summarizeBucket } from '@/lib/margin/rollup'

export default function MarginDashboardPage() {
  const supabase = createClient()

  // Margin is rolled up from booked orders (order_lines), not open quotes —
  // this is realized/committed margin, not pipeline. Quotes stay visible
  // per-quote on their own detail page.
  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*')
      if (error) throw error
      return data as Order[]
    },
  })

  const { data: orderLines, isLoading } = useQuery({
    queryKey: ['all-order-lines'],
    queryFn: async () => {
      const { data, error } = await supabase.from('order_lines').select('*')
      if (error) throw error
      return data as OrderLine[]
    },
  })

  const { data: lineCosts } = useQuery({
    queryKey: ['all-order-line-costs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('order_line_costs').select('*')
      if (error) throw error
      return data as OrderLineCost[]
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*')
      if (error) throw error
      return data as Product[]
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

  const skuFor = (id: string) => products?.find((p) => p.id === id)?.sku_code ?? id
  // A line with no cost row has no cost on file; it is not free.
  const costByLine = useMemo(
    () => new Map((lineCosts ?? []).filter((c) => c.unit_cost_snapshot !== null).map((c) => [c.order_line_id, c.unit_cost_snapshot as number])),
    [lineCosts]
  )
  const unitCostFor = (lineId: string) => costByLine.get(lineId) ?? 0
  const hasCost = (lineId: string) => costByLine.has(lineId)
  const orderFor = (id: string) => orders?.find((o) => o.id === id)
  const customerNameForOrder = (orderId: string) => {
    const order = orderFor(orderId)
    if (!order) return 'Unknown'
    return customers?.find((c) => c.id === order.customer_id)?.name ?? 'Unknown'
  }

  const bySku = useMemo(() => {
    if (!orderLines) return []
    return rollUp(
      orderLines.map((l) => ({
        label: skuFor(l.product_id),
        revenue: l.qty * l.unit_price,
        cost: l.qty * unitCostFor(l.id),
        costed: hasCost(l.id),
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderLines, products, costByLine])

  const byCustomer = useMemo(() => {
    if (!orderLines) return []
    return rollUp(
      orderLines.map((l) => ({
        label: customerNameForOrder(l.order_id),
        revenue: l.qty * l.unit_price,
        cost: l.qty * unitCostFor(l.id),
        costed: hasCost(l.id),
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderLines, orders, customers, costByLine])

  const totals = useMemo(() => {
    const rows = rollUp(
      (orderLines ?? []).map((l) => ({
        label: 'all',
        revenue: l.qty * l.unit_price,
        cost: l.qty * unitCostFor(l.id),
        costed: hasCost(l.id),
      }))
    )
    return rows[0] ?? { key: 'all', label: 'all', revenue: 0, costedRevenue: 0, cost: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderLines, costByLine])
  const overall = summarizeBucket(totals)
  const totalRevenue = totals.revenue
  const totalCost = totals.cost

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Margin Dashboard</h1>
        <p className="text-sm text-gray-500">
          Realized margin from booked orders (not open quotes), rolled up by SKU and by customer.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Total revenue</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Total cost</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totalCost)}</p>
          {overall.uncostedRevenue > 0 && <p className="mt-1 text-xs text-amber-600">Only for lines that have a cost on file</p>}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Blended margin</p>
          <p className={cn('mt-1 text-xl font-bold', overall.margin === null ? 'text-gray-400' : overall.margin < 15 ? 'text-red-600' : 'text-green-700')}>
            {overall.margin === null ? '—' : formatPercent(overall.margin)}
          </p>
          {overall.uncostedRevenue > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              {formatCurrency(overall.uncostedRevenue)} of revenue has no cost on file and is left out.
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-900">Margin by SKU</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td className="px-4 py-6 text-gray-500" colSpan={3}>Loading…</td></tr>}
              {!isLoading && bySku.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={3}>No booked orders yet.</td></tr>
              )}
              {bySku.map((b) => {
                const { margin, uncostedRevenue } = summarizeBucket(b)
                return (
                  <tr key={b.key}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.label}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(b.revenue)}</td>
                    <td className={cn('px-4 py-3 font-semibold', margin === null ? 'text-gray-400' : margin < 15 ? 'text-red-600' : 'text-green-700')}>
                      {margin === null ? '—' : formatPercent(margin)}
                      {uncostedRevenue > 0 && (
                        <span className="block text-xs font-normal text-amber-600">
                          {margin === null ? 'no cost on file' : `${formatCurrency(uncostedRevenue)} has no cost`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-900">Margin by customer</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td className="px-4 py-6 text-gray-500" colSpan={3}>Loading…</td></tr>}
              {!isLoading && byCustomer.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={3}>No booked orders yet.</td></tr>
              )}
              {byCustomer.map((b) => {
                const { margin, uncostedRevenue } = summarizeBucket(b)
                return (
                  <tr key={b.key}>
                    <td className="px-4 py-3 text-gray-700">{b.label}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(b.revenue)}</td>
                    <td className={cn('px-4 py-3 font-semibold', margin === null ? 'text-gray-400' : margin < 15 ? 'text-red-600' : 'text-green-700')}>
                      {margin === null ? '—' : formatPercent(margin)}
                      {uncostedRevenue > 0 && (
                        <span className="block text-xs font-normal text-amber-600">
                          {margin === null ? 'no cost on file' : `${formatCurrency(uncostedRevenue)} has no cost`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
