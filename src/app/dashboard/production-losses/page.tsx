'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import type { CostInput, LossReason, LossStage, Product, ProductionLoss } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import {
  LOSS_REASONS,
  LOSS_STAGES,
  daysBefore,
  lossValue,
  reasonLabel,
  stageLabel,
  summarizeLosses,
} from '@/lib/production-losses'
import { toast } from 'sonner'

export default function ProductionLossesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { organization } = useAuth()

  // Captured once, like the other pages, so render stays pure.
  const today = useState(() => new Date().toISOString().slice(0, 10))[0]

  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [stage, setStage] = useState<LossStage>('converting')
  const [reason, setReason] = useState<LossReason>('machine_jam')
  const [occurredOn, setOccurredOn] = useState(today)
  const [notes, setNotes] = useState('')

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('sku_code')
      if (error) throw error
      return data as Product[]
    },
  })

  const { data: costs } = useQuery({
    queryKey: ['cost-inputs-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_inputs').select('*')
      if (error) throw error
      return data as CostInput[]
    },
  })

  const { data: losses, isLoading } = useQuery({
    queryKey: ['production-losses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_losses')
        .select('*')
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as ProductionLoss[]
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('production_losses').insert({
        organization_id: organization?.id,
        product_id: productId,
        qty: Number(qty),
        stage,
        reason,
        occurred_on: occurredOn,
        notes: notes.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-losses'] })
      toast.success('Loss logged')
      setQty('')
      setNotes('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('production_losses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-losses'] })
      toast.success('Entry deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const skuFor = (id: string) => products?.find((p) => p.id === id)?.sku_code ?? id
  const summary = summarizeLosses(losses ?? [], costs ?? [], daysBefore(today, 30))
  const qtyNumber = Number(qty)
  const canSubmit = !!productId && Number.isInteger(qtyNumber) && qtyNumber > 0 && !addMutation.isPending

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Damaged goods</h1>
      <p className="mb-6 text-sm text-gray-500">
        Product damaged or scrapped during manufacturing and production. The money lost is the quantity times
        the unit cost that applied on the day.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Units lost (last 30 days)</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{summary.units.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Value lost (last 30 days)</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(summary.value)}</p>
          {summary.unpriced > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              {summary.unpriced} {summary.unpriced === 1 ? 'entry has' : 'entries have'} no cost on file and{' '}
              {summary.unpriced === 1 ? 'is' : 'are'} not included. Add the cost under Cost Inputs.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Top reason (last 30 days)</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {summary.topReason ? reasonLabel(summary.topReason) : '—'}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          addMutation.mutate()
        }}
        className="mb-8 grid max-w-4xl grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-6"
      >
        <div className="sm:col-span-2">
          <Label>Product</Label>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select SKU…</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>{p.sku_code} — {p.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Quantity</Label>
          <Input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <Label>Date</Label>
          <Input type="date" required max={today} value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Where it happened</Label>
          <Select value={stage} onChange={(e) => setStage(e.target.value as LossStage)}>
            {LOSS_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Reason</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as LossReason)}>
            {LOSS_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Line, shift, roll number…" />
        </div>
        <div className="sm:col-span-6">
          <Button type="submit" disabled={!canSubmit}>
            {addMutation.isPending ? 'Saving…' : 'Log loss'}
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Where</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Value lost</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td className="px-4 py-6 text-gray-500" colSpan={8}>Loading…</td></tr>}
            {!isLoading && losses?.length === 0 && (
              <tr><td className="px-4 py-6 text-gray-500" colSpan={8}>No damaged goods logged yet.</td></tr>
            )}
            {losses?.map((l) => {
              const value = lossValue(l, costs ?? [])
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{l.occurred_on}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{skuFor(l.product_id)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{l.qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{stageLabel(l.stage)}</td>
                  <td className="px-4 py-3 text-gray-600">{reasonLabel(l.reason)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {value === null ? <span className="text-gray-400">no cost on file</span> : formatCurrency(value)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Delete this entry?')) deleteMutation.mutate(l.id)
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
