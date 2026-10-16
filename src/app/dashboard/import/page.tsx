'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import type { Product } from '@/types'
import { Button } from '@/components/ui/Button'
import { cn, formatCurrency } from '@/lib/utils'
import {
  COST_TEMPLATE,
  MAX_IMPORT_ROWS,
  PRODUCT_TEMPLATE,
  parseCosts,
  parseProducts,
  summarize,
  type CostImportRow,
  type ImportResult,
  type ProductImportRow,
} from '@/lib/csv-import'
import { toast } from 'sonner'

type Kind = 'products' | 'costs'

const PREVIEW_LIMIT = 100
const MAX_FILE_BYTES = 1_000_000

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-green-100 text-green-700',
  skip: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = { ok: 'Will add', skip: 'Skipped', error: 'Fix this' }

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportForm />
    </Suspense>
  )
}

function ImportForm() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const searchParams = useSearchParams()

  const [kind, setKind] = useState<Kind>(searchParams.get('type') === 'costs' ? 'costs' : 'products')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  // Captured once so render stays pure.
  const today = useState(() => new Date().toISOString().slice(0, 10))[0]

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('sku_code')
      if (error) throw error
      return data as Product[]
    },
  })

  // A platform admin can read every company's products; only this company's count.
  const ownProducts = useMemo(
    () => (products ?? []).filter((p) => p.organization_id === organization?.id),
    [products, organization?.id]
  )

  const productResult = useMemo<ImportResult<ProductImportRow> | null>(
    () => (kind === 'products' && text.trim() ? parseProducts(text, ownProducts.map((p) => p.sku_code)) : null),
    [kind, text, ownProducts]
  )
  const costResult = useMemo<ImportResult<CostImportRow> | null>(
    () =>
      kind === 'costs' && text.trim()
        ? parseCosts(text, new Map(ownProducts.map((p) => [p.sku_code, p.id])), today)
        : null,
    [kind, text, ownProducts, today]
  )
  const result = (kind === 'products' ? productResult : costResult) as ImportResult<ProductImportRow | CostImportRow> | null
  const summary = result ? summarize(result) : null

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No company is selected.')
      if (kind === 'products' && productResult) {
        const rows = productResult.rows.filter((r) => r.status === 'ok').map((r) => ({ ...r.data!, organization_id: organization.id }))
        const { error } = await supabase.from('products').insert(rows)
        if (error) throw error
        return rows.length
      }
      if (kind === 'costs' && costResult) {
        const rows = costResult.rows
          .filter((r) => r.status === 'ok')
          .map((r) => ({ ...r.data!, organization_id: organization.id, source: 'import' as const }))
        const { error } = await supabase.from('cost_inputs').insert(rows)
        if (error) throw error
        return rows.length
      }
      return 0
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['cost-inputs'] })
      queryClient.invalidateQueries({ queryKey: ['cost-inputs-all'] })
      toast.success(`${n} ${kind === 'products' ? (n === 1 ? 'product' : 'products') : n === 1 ? 'cost entry' : 'cost entries'} imported`)
      setText('')
      setFileName(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error('That file is too large. Import up to 1,000 rows at a time.')
      return
    }
    setText(await file.text())
    setFileName(file.name)
  }

  function switchKind(next: Kind) {
    setKind(next)
    setText('')
    setFileName(null)
  }

  const template = kind === 'products' ? PRODUCT_TEMPLATE : COST_TEMPLATE
  const shown = result?.rows.slice(0, PREVIEW_LIMIT) ?? []

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Import from spreadsheet</h1>
      <p className="mb-6 text-sm text-gray-500">
        Add many products or costs at once. Nothing is saved until every row checks out, and SKUs that already exist
        are never changed.
      </p>

      <div className="mb-6 flex gap-2" role="tablist" aria-label="What to import">
        {(['products', 'costs'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => switchKind(k)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold',
              kind === k ? 'bg-brand-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            {k === 'products' ? 'Products (SKUs)' : 'Costs'}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">1. Get your spreadsheet ready</h2>
        <p className="mt-1 text-sm text-gray-600">
          {kind === 'products' ? (
            <>
              One row per SKU. Required column: <code className="rounded bg-gray-100 px-1">name</code>. Optional:{' '}
              <code className="rounded bg-gray-100 px-1">sku_code</code> (leave it blank and PlyCount makes one, like
              BT2-96-001), ply, gsm, roll_length_ft, sheet_count, case_pack_qty, unit_of_measure (each, roll, case or
              pallet; blank means case).
            </>
          ) : (
            <>
              One row per cost entry. Required: <code className="rounded bg-gray-100 px-1">sku_code</code> of a product
              that already exists, and at least one of raw_material_cost, packaging_cost, labor_cost,
              freight_cost_per_unit. Optional: effective_date as YYYY-MM-DD (blank means today). Import products first.
            </>
          )}
        </p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}
          download={`plycount-${kind}-template.csv`}
          className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          Download the template
        </a>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">2. Paste it or choose the file</h2>
        <p className="mt-1 text-sm text-gray-600">
          Copy the cells straight from Excel or Google Sheets (include the heading row), or choose a .csv file.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName(null)
          }}
          rows={8}
          spellCheck={false}
          placeholder={template}
          aria-label="Spreadsheet rows"
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Choose a file
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
          {text && (
            <button
              type="button"
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
              onClick={() => {
                setText('')
                setFileName(null)
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {result?.fatal && (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.fatal}</p>
      )}

      {result && !result.fatal && summary && (
        <div className="mb-6">
          <h2 className="mb-3 font-semibold text-gray-900">3. Check, then import</h2>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">{summary.ok} to add</span>
            {summary.skipped > 0 && (
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                {summary.skipped} already exist
              </span>
            )}
            {summary.errors > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
                {summary.errors} need fixing
              </span>
            )}
            {summary.warnings > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                {summary.warnings} with a warning
              </span>
            )}
          </div>
          {result.ignoredColumns.length > 0 && (
            <p className="mb-3 text-sm text-gray-500">Columns not used: {result.ignoredColumns.join(', ')}.</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Line</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((r) => (
                  <tr key={r.line}>
                    <td className="px-4 py-2 text-gray-500">{r.line}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-800">{r.label}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[r.status])}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {r.status === 'ok' && kind === 'products' && (r.data as ProductImportRow).name}
                      {r.status === 'ok' && kind === 'costs' && (() => {
                        const d = r.data as CostImportRow
                        return `${formatCurrency(d.raw_material_cost + d.packaging_cost + d.labor_cost + d.freight_cost_per_unit)} per unit from ${d.effective_date}`
                      })()}
                      {r.message}
                      {r.note && <span className="block text-gray-500">{r.note}</span>}
                      {r.warning && <span className="block text-amber-600">{r.warning}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > PREVIEW_LIMIT && (
            <p className="mt-2 text-sm text-gray-500">
              Showing the first {PREVIEW_LIMIT} of {result.rows.length} rows. All of them are checked.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => importMutation.mutate()} disabled={!summary.canImport || importMutation.isPending || !organization?.id}>
              {importMutation.isPending
                ? 'Importing…'
                : `Import ${summary.ok} ${kind === 'products' ? (summary.ok === 1 ? 'product' : 'products') : summary.ok === 1 ? 'cost entry' : 'cost entries'}`}
            </Button>
            {summary.errors > 0 && (
              <p className="text-sm text-red-600">Fix the rows marked above in your spreadsheet, then paste it again.</p>
            )}
            {summary.errors === 0 && summary.ok === 0 && summary.skipped > 0 && (
              <p className="text-sm text-gray-500">Everything in this file already exists, so there is nothing to add.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">Up to {MAX_IMPORT_ROWS.toLocaleString()} rows at a time.</p>
        </div>
      )}
    </div>
  )
}
