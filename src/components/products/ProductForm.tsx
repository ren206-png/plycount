'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import type { Product, UnitOfMeasure } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { toast } from 'sonner'
import { PRODUCT_TYPES, generateSku, inferProductType, type ProductType } from '@/lib/sku'

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const supabase = createClient()

  const [name, setName] = useState(product?.name ?? '')
  const [skuCode, setSkuCode] = useState(product?.sku_code ?? '')
  const [ply, setPly] = useState(product?.ply?.toString() ?? '')
  const [gsm, setGsm] = useState(product?.gsm?.toString() ?? '')
  const [rollLength, setRollLength] = useState(product?.roll_length_ft?.toString() ?? '')
  const [sheetCount, setSheetCount] = useState(product?.sheet_count?.toString() ?? '')
  const [casePack, setCasePack] = useState(product?.case_pack_qty?.toString() ?? '')
  const [uom, setUom] = useState<UnitOfMeasure>(product?.unit_of_measure ?? 'case')

  // New products get their SKU code made for them from the type, ply and case
  // pack, until someone types their own. An existing product's code is never
  // changed automatically.
  const [productType, setProductType] = useState<ProductType>('bath_tissue')
  const [skuEdited, setSkuEdited] = useState(!!product)
  const [typeChosen, setTypeChosen] = useState(false)
  const { data: takenSkus } = useQuery({
    queryKey: ['product-skus'],
    enabled: !product,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('sku_code, organization_id')
      if (error) throw error
      return data as { sku_code: string; organization_id: string }[]
    },
  })
  const autoSku = useMemo(
    () =>
      generateSku(
        { type: productType, ply: ply ? Number(ply) : null, packQty: casePack ? Number(casePack) : null },
        (takenSkus ?? []).filter((p) => p.organization_id === organization?.id).map((p) => p.sku_code)
      ),
    [productType, ply, casePack, takenSkus, organization?.id]
  )
  const effectiveSku = skuEdited ? skuCode : autoSku

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sku_code: effectiveSku.trim(),
        ply: ply ? Number(ply) : null,
        gsm: gsm ? Number(gsm) : null,
        roll_length_ft: rollLength ? Number(rollLength) : null,
        sheet_count: sheetCount ? Number(sheetCount) : null,
        case_pack_qty: casePack ? Number(casePack) : null,
        unit_of_measure: uom,
      }

      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert({ ...payload, organization_id: organization?.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(product ? 'SKU updated' : 'SKU created')
      router.push('/dashboard/products')
      router.refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
      className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>SKU code</Label>
          <Input
            required
            value={effectiveSku}
            onChange={(e) => {
              setSkuCode(e.target.value)
              setSkuEdited(true)
            }}
            placeholder="e.g. BT2-96-001"
          />
          {!product && (
            <p className="mt-1 text-xs text-gray-500">
              {skuEdited ? (
                <>
                  Using your own code.{' '}
                  <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => setSkuEdited(false)}>
                    Use the automatic code
                  </button>
                </>
              ) : (
                'Made for you from the type, ply and case pack. Type over it to use your own.'
              )}
            </p>
          )}
        </div>
        <div>
          <Label>Name</Label>
          <Input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              // A guess from the name, until the type is chosen by hand.
              if (!product && !typeChosen) setProductType(inferProductType(e.target.value))
            }}
            placeholder="e.g. 2-Ply Standard Bath Tissue"
          />
        </div>
      </div>

      {!product && (
        <div>
          <Label>Product type</Label>
          <Select
            value={productType}
            onChange={(e) => {
              setProductType(e.target.value as ProductType)
              setTypeChosen(true)
            }}
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label} ({t.prefix})</option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Ply</Label>
          <Input type="number" min={1} value={ply} onChange={(e) => setPly(e.target.value)} />
        </div>
        <div>
          <Label>GSM</Label>
          <Input type="number" step="0.1" value={gsm} onChange={(e) => setGsm(e.target.value)} />
        </div>
        <div>
          <Label>Roll length (ft)</Label>
          <Input type="number" step="0.1" value={rollLength} onChange={(e) => setRollLength(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Sheet count</Label>
          <Input type="number" value={sheetCount} onChange={(e) => setSheetCount(e.target.value)} />
        </div>
        <div>
          <Label>Case pack qty</Label>
          <Input type="number" value={casePack} onChange={(e) => setCasePack(e.target.value)} />
        </div>
        <div>
          <Label>Unit of measure</Label>
          <Select value={uom} onChange={(e) => setUom(e.target.value as UnitOfMeasure)}>
            <option value="each">Each</option>
            <option value="roll">Roll</option>
            <option value="case">Case</option>
            <option value="pallet">Pallet</option>
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : product ? 'Save changes' : 'Create SKU'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
