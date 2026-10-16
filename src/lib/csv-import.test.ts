import { describe, expect, it } from 'vitest'
import {
  COST_TEMPLATE,
  MAX_IMPORT_ROWS,
  PRODUCT_TEMPLATE,
  parseCosts,
  parseIsoDate,
  parseNumber,
  parseProducts,
  parseTable,
  summarize,
} from './csv-import'

describe('parseTable', () => {
  it('reads comma separated text with quotes, escaped quotes and a blank line', () => {
    const t = parseTable('a,b,c\r\n"x, y","say ""hi""",3\r\n\r\n')
    expect(t).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', '3'],
    ])
  })

  it('reads cells pasted from a spreadsheet (tab separated)', () => {
    expect(parseTable('sku\tname\nA1\tRoll, soft')).toEqual([
      ['sku', 'name'],
      ['A1', 'Roll, soft'],
    ])
  })

  it('ignores a byte order mark and a newline inside quotes stays in the cell', () => {
    expect(parseTable('﻿a,b\n"line1\nline2",2')).toEqual([
      ['a', 'b'],
      ['line1\nline2', '2'],
    ])
  })
})

describe('parseNumber', () => {
  it('understands how people type numbers', () => {
    expect(parseNumber('7')).toBe(7)
    expect(parseNumber(' $7.50 ')).toBe(7.5)
    expect(parseNumber('1,200')).toBe(1200)
    expect(parseNumber('1,200.25')).toBe(1200.25)
  })

  it('treats empty as missing and junk as NaN', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1,2')).toBeNaN()
    expect(parseNumber('12abc')).toBeNaN()
  })
})

describe('parseIsoDate', () => {
  it('accepts real YYYY-MM-DD dates and pads', () => {
    expect(parseIsoDate('2026-10-15')).toBe('2026-10-15')
    expect(parseIsoDate('2026/1/5')).toBe('2026-01-05')
  })

  it('refuses ambiguous or impossible dates', () => {
    expect(parseIsoDate('10/15/2026')).toBeNull()
    expect(parseIsoDate('03-04-2026')).toBeNull()
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
  })
})

describe('parseProducts', () => {
  it('reads the template without errors', () => {
    const r = parseProducts(PRODUCT_TEMPLATE, [])
    expect(r.fatal).toBeUndefined()
    expect(r.rows.map((x) => x.status)).toEqual(['ok', 'ok'])
    expect(r.rows[0].data).toEqual({
      sku_code: 'TT2-96-STD',
      name: '2-Ply Standard Bath Tissue',
      ply: 2,
      gsm: 18,
      roll_length_ft: null,
      sheet_count: 400,
      case_pack_qty: 96,
      unit_of_measure: 'case',
    })
  })

  it('recognises common column names and unit words', () => {
    const r = parseProducts('SKU,Product Name,Plies,Rolls per case,UOM\nA1,Soft,3,48,Cartons', [])
    expect(r.rows[0].status).toBe('ok')
    expect(r.rows[0].data).toMatchObject({ sku_code: 'A1', name: 'Soft', ply: 3, case_pack_qty: 48, unit_of_measure: 'case' })
  })

  it('defaults the unit of measure to case and reports columns it does not use', () => {
    const r = parseProducts('sku_code,name,colour\nA1,Soft,white', [])
    expect(r.rows[0].data?.unit_of_measure).toBe('case')
    expect(r.ignoredColumns).toEqual(['colour'])
  })

  it('flags every problem on a row, with its line number', () => {
    const r = parseProducts('sku_code,name,ply,gsm,sheet_count,unit_of_measure\n,Soft,0,abc,1.5,bucket', [])
    expect(r.rows[0]).toMatchObject({ line: 2, status: 'error' })
    const msg = r.rows[0].message ?? ''
    for (const part of ['ply must be at least 1', 'gsm must be a number', 'sheet_count must be a whole number', 'unit_of_measure']) {
      expect(msg).toContain(part)
    }
  })

  it('skips SKUs that already exist (any capitalisation) instead of overwriting them', () => {
    const r = parseProducts('sku_code,name\nTT2-96-STD,New name\nNEW-1,Fresh', ['tt2-96-std '])
    expect(r.rows[0]).toMatchObject({ status: 'skip' })
    expect(r.rows[1]).toMatchObject({ status: 'ok' })
  })

  it('rejects a SKU repeated inside the file', () => {
    const r = parseProducts('sku_code,name\nA1,One\na1,Two', [])
    expect(r.rows[1]).toMatchObject({ status: 'error', message: 'duplicate of line 2' })
  })

  it('refuses a file without the required columns or with too many rows', () => {
    expect(parseProducts('sku_code\nA1', []).fatal).toMatch(/include name/)
    expect(parseProducts('', []).fatal).toMatch(/Nothing to import/)
    const big = 'sku_code,name\n' + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `S${i},N${i}`).join('\n')
    expect(parseProducts(big, []).fatal).toMatch(/more than/)
  })
})

describe('parseProducts: automatic SKU codes', () => {
  it('makes a code for a blank one, from the name, ply and case pack', () => {
    const r = parseProducts('sku_code,name,ply,case_pack_qty\n,2-Ply Standard Bath Tissue,2,96\n,Hardwound Paper Towel,1,6', [])
    expect(r.rows.map((x) => x.data?.sku_code)).toEqual(['BT2-96-001', 'PT1-6-001'])
    expect(r.rows[0].note).toMatch(/made up/)
    expect(summarize(r).canImport).toBe(true)
  })

  it('works when there is no sku_code column at all', () => {
    const r = parseProducts('name,ply,case_pack_qty\nBath tissue,2,96\nBath tissue premium,2,96', [])
    expect(r.fatal).toBeUndefined()
    expect(r.rows.map((x) => x.data?.sku_code)).toEqual(['BT2-96-001', 'BT2-96-002'])
  })

  it('keeps clear of existing products and of codes typed elsewhere in the file', () => {
    const r = parseProducts('sku_code,name,ply,case_pack_qty\n,Bath tissue,2,96\nBT2-96-002,Bath tissue deluxe,2,96', ['BT2-96-001'])
    expect(r.rows[0].data?.sku_code).toBe('BT2-96-003')
    expect(r.rows[1].data?.sku_code).toBe('BT2-96-002')
  })

  it('leaves a code the person typed alone, and does not make one for a row with problems', () => {
    const r = parseProducts('sku_code,name,ply\nMY-CODE,Soft,2\n,Rough,abc', [])
    expect(r.rows[0].data?.sku_code).toBe('MY-CODE')
    expect(r.rows[0].note).toBeUndefined()
    expect(r.rows[1].status).toBe('error')
  })
})

describe('parseCosts', () => {
  const skus = new Map([
    ['TT2-96-STD', 'id-1'],
    ['PT-HWT-6', 'id-2'],
  ])
  const today = '2026-10-15'

  it('reads the template against existing products', () => {
    const r = parseCosts(COST_TEMPLATE, skus, today)
    expect(r.rows.map((x) => x.status)).toEqual(['ok', 'ok'])
    expect(r.rows[0].data).toEqual({
      product_id: 'id-1',
      raw_material_cost: 7,
      packaging_cost: 0.3,
      labor_cost: 1,
      freight_cost_per_unit: 2,
      effective_date: '2026-10-15',
    })
  })

  it('uses today when a row has no date and treats blank costs as zero', () => {
    const r = parseCosts('sku,pulp,freight\nTT2-96-STD,$6.50,', skus, today)
    expect(r.rows[0].data).toMatchObject({ raw_material_cost: 6.5, freight_cost_per_unit: 0, effective_date: today })
  })

  it('refuses an unknown SKU, a bad number, a negative cost, an ambiguous date and an empty row', () => {
    const r = parseCosts(
      'sku_code,raw_material_cost,packaging_cost,effective_date\nNOPE,1,,\nTT2-96-STD,abc,,\nTT2-96-STD,-1,,\nTT2-96-STD,1,,10/15/2026\nTT2-96-STD,,,',
      skus,
      today
    )
    expect(r.rows.map((x) => x.status)).toEqual(['error', 'error', 'error', 'error', 'error'])
    expect(r.rows[0].message).toMatch(/no product with this SKU/)
    expect(r.rows[1].message).toMatch(/must be a number/)
    expect(r.rows[2].message).toMatch(/cannot be negative/)
    expect(r.rows[3].message).toMatch(/YYYY-MM-DD/)
    expect(r.rows[4].message).toMatch(/no cost values/)
  })

  it('warns, but allows, a date in the future', () => {
    const r = parseCosts('sku_code,raw_material_cost,effective_date\nTT2-96-STD,5,2026-12-01', skus, today)
    expect(r.rows[0].status).toBe('ok')
    expect(r.rows[0].warning).toMatch(/in the future/)
  })

  it('needs a sku column and at least one cost column', () => {
    expect(parseCosts('sku_code\nA', skus, today).fatal).toMatch(/at least one cost column/)
    expect(parseCosts('raw_material_cost\n5', skus, today).fatal).toMatch(/sku_code/)
  })
})

describe('summarize', () => {
  it('only allows an import when there is something to add and nothing wrong', () => {
    const clean = summarize(parseProducts('sku_code,name\nA1,One\nB2,Two', ['B2']))
    expect(clean).toMatchObject({ ok: 1, skipped: 1, errors: 0, canImport: true })

    const bad = summarize(parseProducts('sku_code,name\nA1,One\nA2,', []))
    expect(bad).toMatchObject({ ok: 1, errors: 1, canImport: false })

    const nothingNew = summarize(parseProducts('sku_code,name\nA1,One', ['A1']))
    expect(nothingNew).toMatchObject({ ok: 0, skipped: 1, canImport: false })

    expect(summarize(parseProducts('', [])).canImport).toBe(false)
  })
})
