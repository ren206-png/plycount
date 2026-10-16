// ============================================================
// Automatic SKU codes.
//
// A code reads at a glance and never repeats within a company:
//   product-type prefix + ply + pack count + a running number
//   2-ply bath tissue, 96 rolls to a case  ->  BT2-96-001
//   the next variant of the same shape     ->  BT2-96-002
// Missing parts are left out (no ply entered: BT-96-001). The code is a
// suggestion: the product form lets a person overwrite it, and imports only
// generate one for rows that have none.
// ============================================================

export type ProductType = 'bath_tissue' | 'paper_towel' | 'napkin' | 'facial_tissue' | 'other'

export const PRODUCT_TYPES: { value: ProductType; label: string; prefix: string }[] = [
  { value: 'bath_tissue', label: 'Bath tissue', prefix: 'BT' },
  { value: 'paper_towel', label: 'Paper towel', prefix: 'PT' },
  { value: 'napkin', label: 'Napkin', prefix: 'NK' },
  { value: 'facial_tissue', label: 'Facial tissue', prefix: 'FT' },
  { value: 'other', label: 'Other', prefix: 'PR' },
]

const prefixFor = (type: ProductType) => PRODUCT_TYPES.find((t) => t.value === type)?.prefix ?? 'PR'

export interface SkuSpec {
  type: ProductType
  ply?: number | null
  /** Units in a case. */
  packQty?: number | null
}

const whole = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : ''

/** The meaningful part, before the running number: "BT2-96". */
export function skuBase(spec: SkuSpec): string {
  return `${prefixFor(spec.type)}${whole(spec.ply)}${whole(spec.packQty) ? `-${whole(spec.packQty)}` : ''}`
}

const key = (s: string) => s.trim().toUpperCase()

/** The first code for this spec that no existing product uses (case-insensitive). */
export function generateSku(spec: SkuSpec, taken: Iterable<string>): string {
  const used = new Set<string>()
  for (const t of taken) used.add(key(t))
  const base = skuBase(spec)
  for (let n = 1; n < 10_000; n++) {
    const code = `${base}-${String(n).padStart(3, '0')}`
    if (!used.has(key(code))) return code
  }
  throw new Error(`No free SKU number left for ${base}`)
}

/** Best guess of the product type from its name, for rows imported without a code. */
export function inferProductType(name: string): ProductType {
  const n = name.toLowerCase()
  if (/\b(napkin|napkins|serviette|serviettes)\b/.test(n)) return 'napkin'
  if (/\b(facial|kleenex|face\s*tissue)\b/.test(n)) return 'facial_tissue'
  if (/\b(towel|towels)\b/.test(n)) return 'paper_towel'
  if (/\b(bath|toilet|bathroom|tissue|tp)\b/.test(n)) return 'bath_tissue'
  return 'other'
}
