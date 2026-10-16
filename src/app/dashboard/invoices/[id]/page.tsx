'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import type { Customer, Invoice, InvoiceBalance, InvoiceLine, InvoicePayment, Order, OrderLine, PaymentMethod, Product } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { cn, formatCurrency, isUUID, formatUnitPrice } from '@/lib/utils'
import { PAYMENT_METHODS, STATUS_LABEL, STATUS_STYLE, daysOverdue, displayStatus, dueDateFor, methodLabel, toCents } from '@/lib/invoicing'
import { toast } from 'sonner'

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { isOrgAdmin } = useAuth()
  const isValidId = isUUID(params.id)
  // Captured once so render stays pure.
  const today = useState(() => new Date().toISOString().slice(0, 10))[0]

  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('eft')
  const [reference, setReference] = useState('')

  const { data: invoice } = useQuery({
    queryKey: ['invoice', params.id],
    enabled: isValidId,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', params.id).single()
      if (error) throw error
      return data as Invoice
    },
  })
  const { data: balance } = useQuery({
    queryKey: ['invoice-balance', params.id],
    enabled: isValidId,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_balances').select('*').eq('invoice_id', params.id).single()
      if (error) throw error
      return data as InvoiceBalance
    },
  })
  const { data: lines } = useQuery({
    queryKey: ['invoice-detail-lines', params.id],
    enabled: isValidId,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_lines').select('*').eq('invoice_id', params.id).order('created_at')
      if (error) throw error
      return data as InvoiceLine[]
    },
  })
  const { data: orderLines } = useQuery({
    queryKey: ['invoice-order-lines', params.id, lines?.length],
    enabled: !!lines && lines.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('order_lines').select('*').in('id', (lines ?? []).map((l) => l.order_line_id))
      if (error) throw error
      return data as OrderLine[]
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
  const { data: order } = useQuery({
    queryKey: ['orders', invoice?.order_id],
    enabled: !!invoice?.order_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', invoice!.order_id).single()
      if (error) throw error
      return data as Order
    },
  })
  const { data: customer } = useQuery({
    queryKey: ['customers', order?.customer_id],
    enabled: !!order?.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').eq('id', order!.customer_id).single()
      if (error) throw error
      return data as Customer
    },
  })
  const { data: payments } = useQuery({
    queryKey: ['invoice-payments', params.id],
    enabled: isValidId,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_payments').select('*').eq('invoice_id', params.id).order('paid_on').order('created_at')
      if (error) throw error
      return data as InvoicePayment[]
    },
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invoice', params.id] }),
      queryClient.invalidateQueries({ queryKey: ['invoice-balance', params.id] }),
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', params.id] }),
      queryClient.invalidateQueries({ queryKey: ['invoices-all'] }),
      queryClient.invalidateQueries({ queryKey: ['invoice-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    ])

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${params.id}/send`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Failed to send the invoice.')
      return body as { invoiceNumber: string; dueDate: string }
    },
    onSuccess: async (b) => {
      toast.success(`${b.invoiceNumber} emailed to ${customer?.contact_email ?? 'the customer'}`)
      await refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const markSentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', issue_date: today, due_date: dueDateFor(today, customer?.credit_terms), sent_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('status', 'draft')
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Marked as sent')
      await refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const voidMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', params.id)
      if (error) throw error
      // A voided invoice frees its quantities to be billed again.
      if (order?.status === 'invoiced') await supabase.from('orders').update({ status: 'fulfilled' }).eq('id', order.id)
    },
    onSuccess: async () => {
      toast.success('Invoice voided')
      await refresh()
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addPayment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('invoice_payments').insert({
        organization_id: invoice!.organization_id,
        invoice_id: params.id,
        amount: Number(amount),
        paid_on: paidOn,
        method,
        reference: reference.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Payment recorded')
      setAmount('')
      setReference('')
      await refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Payment removed')
      await refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!isValidId) return <p className="text-gray-500">Invoice not found.</p>
  if (!invoice || !balance) return <p className="text-gray-500">Loading…</p>

  const owed = Number(balance.balance)
  const shown = displayStatus({ status: invoice.status, due_date: invoice.due_date, balance: owed }, today)
  const skuFor = (orderLineId: string) => {
    const ol = orderLines?.find((x) => x.id === orderLineId)
    return products?.find((p) => p.id === ol?.product_id)?.sku_code ?? '—'
  }
  const amountCents = toCents(Number(amount))
  const amountOk = amount !== '' && amountCents > 0 && amountCents <= toCents(owed)
  const canPay = isOrgAdmin && invoice.status === 'sent' && owed > 0
  const canSend = isOrgAdmin && (invoice.status === 'draft' || invoice.status === 'sent')
  const hasPayments = (payments?.length ?? 0) > 0
  const canVoid = isOrgAdmin && (invoice.status === 'draft' || invoice.status === 'sent') && !hasPayments

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[shown])}>{STATUS_LABEL[shown]}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {customer?.name ?? '—'}
            {order && (
              <>
                {' · '}
                <Link href={`/dashboard/orders/${order.id}`} className="text-brand-600 hover:underline">View order</Link>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {invoice.issue_date ? `Issued ${invoice.issue_date}` : 'Not sent yet'}
            {invoice.due_date && ` · Due ${invoice.due_date}`}
            {shown === 'overdue' && invoice.due_date && <span className="font-medium text-red-600"> · {daysOverdue(invoice.due_date, today)} days overdue</span>}
            {customer?.credit_terms && ` · Terms: ${customer.credit_terms}`}
          </p>
        </div>
        <Link href="/dashboard/invoices" className="text-sm font-medium text-brand-600 hover:underline">← All invoices</Link>
      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit price</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines?.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{skuFor(l.order_line_id)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{l.qty_invoiced}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatUnitPrice(l.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(l.qty_invoiced * l.unit_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50 text-gray-900">
            <tr>
              <td className="px-4 py-2" colSpan={3}>Total</td>
              <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(invoice.total_amount))}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600" colSpan={3}>Paid</td>
              <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(Number(balance.amount_paid))}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-semibold" colSpan={3}>Balance due</td>
              <td className="px-4 py-2 text-right text-base font-bold">{formatCurrency(owed)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        {invoice.status !== 'void' && isOrgAdmin && (
          <a
            href={`/api/invoices/${params.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Download PDF
          </a>
        )}
        {canSend && (
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
            {sendMutation.isPending ? 'Sending…' : invoice.status === 'draft' ? 'Email invoice to customer' : 'Email it again'}
          </Button>
        )}
        {isOrgAdmin && invoice.status === 'draft' && (
          <Button variant="secondary" onClick={() => markSentMutation.mutate()} disabled={markSentMutation.isPending}>
            Mark as sent (without emailing)
          </Button>
        )}
        {canVoid && (
          <button
            type="button"
            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            disabled={voidMutation.isPending}
            onClick={() => {
              if (window.confirm(`Void ${invoice.invoice_number}? This cannot be undone.`)) voidMutation.mutate()
            }}
          >
            Void invoice
          </button>
        )}
      </div>
      {customer && !customer.contact_email && invoice.status !== 'void' && (
        <p className="-mt-5 mb-6 text-sm text-amber-600">This customer has no contact email, so add one on the customer page before emailing.</p>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Payments</h2>
        {invoice.status === 'draft' && <p className="mt-2 text-sm text-gray-500">Send the invoice first. Payments can be recorded once it has been sent.</p>}

        {hasPayments && (
          <table className="mt-3 min-w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments?.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 text-gray-700">{p.paid_on}</td>
                  <td className="py-2 pr-4 text-gray-600">{methodLabel(p.method)}</td>
                  <td className="py-2 pr-4 text-gray-600">{p.reference ?? '—'}</td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-900">{formatCurrency(Number(p.amount))}</td>
                  <td className="py-2 text-right">
                    {isOrgAdmin && (
                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        disabled={removePayment.isPending}
                        onClick={() => {
                          if (window.confirm('Remove this payment? Use this to fix a mistake.')) removePayment.mutate(p.id)
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!hasPayments && invoice.status !== 'draft' && invoice.status !== 'void' && (
          <p className="mt-2 text-sm text-gray-500">No payments recorded yet.</p>
        )}

        {canPay && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addPayment.mutate()
            }}
            className="mt-5 grid grid-cols-2 items-end gap-3 border-t border-gray-100 pt-5 sm:grid-cols-6"
          >
            <div className="col-span-1 sm:col-span-2">
              <Label>Amount received</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={owed.toFixed(2)} />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label>Date</Label>
              <Input type="date" required max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Method</Label>
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <Label>Reference (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque number, transfer reference…" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={!amountOk || addPayment.isPending}>
                {addPayment.isPending ? 'Saving…' : 'Record payment'}
              </Button>
              <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setAmount(owed.toFixed(2))}>
                Full balance
              </button>
            </div>
            {amount !== '' && amountCents > toCents(owed) && (
              <p className="col-span-2 text-sm text-red-600 sm:col-span-6">That is more than the {formatCurrency(owed)} still owed.</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
