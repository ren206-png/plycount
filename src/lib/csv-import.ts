// ============================================================
// Bulk import of products (SKUs) and cost entries from a spreadsheet.
//
// Accepts what Excel, Google Sheets and Numbers actually produce: comma
// separated files, or cells copied and pasted straight from a sheet (tab
// separated). Everything here is plain functions, so the checks that decide
// what gets written are tested, and the page only shows the result.
//
// Rules that keep a bad file from writing bad data:
//   * nothing is saved unless every row is valid (or an existing SKU, which is
//     skipped, never overwritten)
//   * dates must be YYYY-MM-DD; day/month order is ambiguous, so it is refused
//   * a cost row must name a SKU that already exists in your company
// ============================================================
import type { UnitOfMeasure } from '@/types'
import { generateSku, inferProductType } from '@/lib/sku'

export const MAX_IMPORT_ROWS = 1000

export type RowStatus = 'ok' | 'skip' | 'error'

export interface RowResult<T> {
  /** Line number in the pasted data (the header is line 1). */
  line: number
  /** What the row is, for the preview ("TT2-96-STD"). */
  label: string
  status: RowStatus
  message?: string
  warning?: string
  /** Something worth knowing about an accepted row, e.g. that its SKU was made up for it. */
  note?: string
  data?: T
}

export interface ImportResult<T> {
  rows: RowResult<T>[]
  /** Columns in the file that PlyCount does not use. */
  ignoredColumns: string[]
  /** Set when the file cannot be read at all (no header, too many rows). */
  fatal?: string
}

// ---------- reading the table ----------

/** Split pasted/uploaded text into rows of cells. Handles quotes, "" escapes, CRLF and a BOM. */
export function parseTable(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  const delimiter = tabs > commas ? '\t' : ','

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else if (c === '"' && cell === '') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
    } else {
      cell += c
    }
  }
  row.push(cell)
  rows.push(row)

  // Drop rows that are entirely empty (blank lines, trailing newline).
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const key = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '')

function mapHeaders(header: string[], aliases: Record<string, string>) {
  const columns = new Map<string, number>() // canonical field -> column index
  const ignored: string[] = []
  header.forEach((h, i) => {
    const field = aliases[key(h)]
    if (field && !columns.has(field)) columns.set(field, i)
    else if (h.trim() !== '') ignored.push(h.trim())
  })
  return { columns, ignored }
}

/** Parse a number a person typed: "$7.00", "1,200", " 18 ". Empty is null; junk is NaN. */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/^\$/, '').replace(/\s+/g, '')
  if (s === '') return null
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

const cellAt = (row: string[], columns: Map<string, number>, field: string) => {
  const i = columns.get(field)
  return i === undefined ? '' : (row[i] ?? '').trim()
}

// ---------- products ----------

const PRODUCT_ALIASES: Record<string, string> = {
  skucode: 'sku_code', sku: 'sku_code', skunumber: 'sku_code', itemcode: 'sku_code', item: 'sku_code', code: 'sku_code',
  name: 'name', productname: 'name', product: 'name', description: 'name', itemname: 'name',
  ply: 'ply', plies: 'ply',
  gsm: 'gsm',
  rolllengthft: 'roll_length_ft', rolllength: 'roll_length_ft', length: 'roll_length_ft', lengthft: 'roll_length_ft',
  sheetcount: 'sheet_count', sheets: 'sheet_count', sheetsperroll: 'sheet_count',
  casepackqty: 'case_pack_qty', casepack: 'case_pack_qty', rollspercase: 'case_pack_qty', unitspercase: 'case_pack_qty', packsize: 'case_pack_qty',
  unitofmeasure: 'unit_of_measure', uom: 'unit_of_measure', unit: 'unit_of_measure', sellby: 'unit_of_measure',
}

const UOM_WORDS: Record<string, UnitOfMeasure> = {
  each: 'each', ea: 'each', unit: 'each', units: 'each',
  roll: 'roll', rolls: 'roll', rl: 'roll',
  case: 'case', cases: 'case', cs: 'case', carton: 'case', cartons: 'case',
  pallet: 'pallet', pallets: 'pallet', plt: 'pallet', skid: 'pallet',
}

export interface ProductImportRow {
  sku_code: string
  name: string
  ply: number | null
  gsm: number | null
  roll_length_ft: number | null
  sheet_count: number | null
  case_pack_qty: number | null
  unit_of_measure: UnitOfMeasure
}

const skuKey = (s: string) => s.trim().toUpperCase()

export function parseProducts(text: string, existingSkus: Iterable<string>): ImportResult<ProductImportRow> {
  const table = parseTable(text)
  if (table.length === 0) return { rows: [], ignoredColumns: [], fatal: 'Nothing to import yet. Paste your rows or choose a file.' }

  const { columns, ignored } = mapHeaders(table[0], PRODUCT_ALIASES)
  if (!columns.has('name')) {
    return {
      rows: [],
      ignoredColumns: ignored,
      fatal: 'The first row must be column headings that include name (sku_code is optional: PlyCount makes one when it is blank). Download the template to see the layout.',
    }
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], ignoredColumns: ignored, fatal: `That is more than ${MAX_IMPORT_ROWS} rows. Import them in smaller batches.` }
  }

  const existing = new Set([...existingSkus].map(skuKey))
  const seen = new Map<string, number>() // sku -> first line
  const rows: RowResult<ProductImportRow>[] = []

  // Codes made up for blank rows must not collide with an existing product, a code
  // typed anywhere in this file (even further down), or each other.
  const taken = new Set(existing)
  for (const cells of table.slice(1)) {
    const typed = cellAt(cells, columns, 'sku_code')
    if (typed) taken.add(skuKey(typed))
  }

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2
    let sku = cellAt(cells, columns, 'sku_code')
    const name = cellAt(cells, columns, 'name')
    const problems: string[] = []
    let generated = false

    if (sku.length > 64) problems.push('sku_code is longer than 64 characters')
    if (!name) problems.push('name is empty')
    else if (name.length > 200) problems.push('name is longer than 200 characters')

    const num = (field: string, label: string, opts: { integer?: boolean; min?: number; max?: number }) => {
      const v = parseNumber(cellAt(cells, columns, field))
      if (v === null) return null
      if (Number.isNaN(v)) {
        problems.push(`${label} must be a number`)
        return null
      }
      if (opts.integer && !Number.isInteger(v)) problems.push(`${label} must be a whole number`)
      if (opts.min !== undefined && v < opts.min) problems.push(`${label} must be at least ${opts.min}`)
      if (opts.max !== undefined && v > opts.max) problems.push(`${label} must be at most ${opts.max}`)
      return v
    }

    const ply = num('ply', 'ply', { integer: true, min: 1, max: 10 })
    const gsm = num('gsm', 'gsm', { min: 1, max: 1000 })
    const roll = num('roll_length_ft', 'roll_length_ft', { min: 0.1, max: 100000 })
    const sheets = num('sheet_count', 'sheet_count', { integer: true, min: 1, max: 100000 })
    const casePack = num('case_pack_qty', 'case_pack_qty', { integer: true, min: 1, max: 100000 })

    const uomRaw = cellAt(cells, columns, 'unit_of_measure').toLowerCase()
    let uom: UnitOfMeasure = 'case'
    if (uomRaw) {
      const mapped = UOM_WORDS[uomRaw]
      if (mapped) uom = mapped
      else problems.push(`unit_of_measure "${uomRaw}" is not each, roll, case or pallet`)
    }

    // A blank code is made up, once the rest of the row is known to be usable.
    if (!sku && name && problems.length === 0) {
      sku = generateSku({ type: inferProductType(name), ply, packQty: casePack }, taken)
      taken.add(skuKey(sku))
      generated = true
    }

    const label = sku || `line ${line}`
    if (sku) {
      const k = skuKey(sku)
      const first = seen.get(k)
      if (first !== undefined) problems.push(`duplicate of line ${first}`)
      else seen.set(k, line)
    }

    if (problems.length > 0) {
      rows.push({ line, label, status: 'error', message: problems.join('; ') })
      return
    }
    if (existing.has(skuKey(sku))) {
      rows.push({ line, label, status: 'skip', message: 'already exists, left unchanged' })
      return
    }
    rows.push({
      line,
      label,
      status: 'ok',
      note: generated ? 'SKU code made up for this row' : undefined,
      data: { sku_code: sku, name, ply, gsm, roll_length_ft: roll, sheet_count: sheets, case_pack_qty: casePack, unit_of_measure: uom },
    })
  })

  return { rows, ignoredColumns: ignored }
}

// ---------- costs ----------

const COST_ALIASES: Record<string, string> = {
  skucode: 'sku_code', sku: 'sku_code', skunumber: 'sku_code', itemcode: 'sku_code', item: 'sku_code', code: 'sku_code',
  rawmaterialcost: 'raw_material_cost', rawmaterial: 'raw_material_cost', material: 'raw_material_cost', pulp: 'raw_material_cost',
  packagingcost: 'packaging_cost', packaging: 'packaging_cost',
  laborcost: 'labor_cost', labor: 'labor_cost', labour: 'labor_cost',
  freightcostperunit: 'freight_cost_per_unit', freightperunit: 'freight_cost_per_unit', freight: 'freight_cost_per_unit', freightcost: 'freight_cost_per_unit',
  effectivedate: 'effective_date', date: 'effective_date', asof: 'effective_date', effective: 'effective_date',
}

export interface CostImportRow {
  product_id: string
  raw_material_cost: number
  packaging_cost: number
  labor_cost: number
  freight_cost_per_unit: number
  effective_date: string
}

const COST_FIELDS = [
  ['raw_material_cost', 'raw_material_cost'],
  ['packaging_cost', 'packaging_cost'],
  ['labor_cost', 'labor_cost'],
  ['freight_cost_per_unit', 'freight_cost_per_unit'],
] as const

/** YYYY-MM-DD (or YYYY/MM/DD) that is a real calendar date, else null. */
export function parseIsoDate(raw: string): string | null {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * @param skuToProductId  the company's existing products, keyed by sku code
 * @param today           YYYY-MM-DD used when a row has no date, and to flag future dates
 */
export function parseCosts(
  text: string,
  skuToProductId: ReadonlyMap<string, string>,
  today: string
): ImportResult<CostImportRow> {
  const table = parseTable(text)
  if (table.length === 0) return { rows: [], ignoredColumns: [], fatal: 'Nothing to import yet. Paste your rows or choose a file.' }

  const { columns, ignored } = mapHeaders(table[0], COST_ALIASES)
  if (!columns.has('sku_code') || !COST_FIELDS.some(([f]) => columns.has(f))) {
    return {
      rows: [],
      ignoredColumns: ignored,
      fatal: 'The first row must be column headings that include sku_code and at least one cost column. Download the template to see the layout.',
    }
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], ignoredColumns: ignored, fatal: `That is more than ${MAX_IMPORT_ROWS} rows. Import them in smaller batches.` }
  }

  const lookup = new Map([...skuToProductId].map(([sku, id]) => [skuKey(sku), id]))
  const rows: RowResult<CostImportRow>[] = []

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2
    const sku = cellAt(cells, columns, 'sku_code')
    const label = sku || `line ${line}`
    const problems: string[] = []

    let productId: string | undefined
    if (!sku) problems.push('sku_code is empty')
    else {
      productId = lookup.get(skuKey(sku))
      if (!productId) problems.push('no product with this SKU; import or add the product first')
    }

    const values: Record<string, number> = {}
    let anyCost = false
    for (const [field, label2] of COST_FIELDS) {
      const v = parseNumber(cellAt(cells, columns, field))
      if (v === null) {
        values[field] = 0
        continue
      }
      if (Number.isNaN(v)) {
        problems.push(`${label2} must be a number`)
        continue
      }
      if (v < 0) problems.push(`${label2} cannot be negative`)
      else if (v > 1_000_000) problems.push(`${label2} is unrealistically large`)
      values[field] = v
      anyCost = true
    }
    if (!anyCost && problems.length === 0) problems.push('no cost values on this row')

    const dateRaw = cellAt(cells, columns, 'effective_date')
    let date = today
    if (dateRaw) {
      const parsed = parseIsoDate(dateRaw)
      if (!parsed) problems.push(`effective_date "${dateRaw}" must be YYYY-MM-DD (for example ${today})`)
      else date = parsed
    }

    if (problems.length > 0 || !productId) {
      rows.push({ line, label, status: 'error', message: problems.join('; ') })
      return
    }
    rows.push({
      line,
      label,
      status: 'ok',
      warning: date > today ? `dated ${date}, in the future, so quotes will not use it until then` : undefined,
      data: {
        product_id: productId,
        raw_material_cost: values.raw_material_cost,
        packaging_cost: values.packaging_cost,
        labor_cost: values.labor_cost,
        freight_cost_per_unit: values.freight_cost_per_unit,
        effective_date: date,
      },
    })
  })

  return { rows, ignoredColumns: ignored }
}

// ---------- summary and templates ----------

export interface ImportSummary {
  ok: number
  skipped: number
  errors: number
  warnings: number
  /** True when there is something to write and nothing wrong with the file. */
  canImport: boolean
}

export function summarize<T>(result: ImportResult<T>): ImportSummary {
  let ok = 0
  let skipped = 0
  let errors = 0
  let warnings = 0
  for (const r of result.rows) {
    if (r.status === 'ok') ok++
    else if (r.status === 'skip') skipped++
    else errors++
    if (r.warning) warnings++
  }
  return { ok, skipped, errors, warnings, canImport: !result.fatal && errors === 0 && ok > 0 }
}

export const PRODUCT_TEMPLATE =
  'sku_code,name,ply,gsm,roll_length_ft,sheet_count,case_pack_qty,unit_of_measure\n' +
  'TT2-96-STD,2-Ply Standard Bath Tissue,2,18,,400,96,case\n' +
  'PT-HWT-6,Hardwound Paper Towel,1,38,350,,6,case\n'

export const COST_TEMPLATE =
  'sku_code,raw_material_cost,packaging_cost,labor_cost,freight_cost_per_unit,effective_date\n' +
  'TT2-96-STD,7.00,0.30,1.00,2.00,2026-10-15\n' +
  'PT-HWT-6,17.60,0.80,2.40,1.10,2026-10-15\n'
