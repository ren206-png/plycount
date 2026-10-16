import { describe, expect, it } from 'vitest'
import type { CostInput, ProductionLoss } from '@/types'
import { daysBefore, lossValue, summarizeLosses, unitCostAsOf } from './production-losses'

const cost = (product_id: string, effective_date: string, total: number): CostInput => ({
  id: `${product_id}-${effective_date}`,
  organization_id: 'o',
  product_id,
  raw_material_cost: total - 3,
  packaging_cost: 1,
  labor_cost: 1,
  freight_cost_per_unit: 1,
  effective_date,
  source: 'manual',
  created_by: null,
  created_at: '',
})

const loss = (over: Partial<ProductionLoss>): ProductionLoss => ({
  id: 'l',
  organization_id: 'o',
  product_id: 'p1',
  qty: 10,
  stage: 'converting',
  reason: 'machine_jam',
  occurred_on: '2026-10-10',
  notes: null,
  recorded_by: null,
  created_at: '',
  ...over,
})

const costs = [cost('p1', '2026-09-01', 10), cost('p1', '2026-10-05', 12), cost('p1', '2026-10-20', 99), cost('p2', '2026-01-01', 4)]

describe('unitCostAsOf', () => {
  it('uses the newest cost dated on or before the day', () => {
    expect(unitCostAsOf(costs, 'p1', '2026-10-10')).toBe(12)
    expect(unitCostAsOf(costs, 'p1', '2026-10-05')).toBe(12)
    expect(unitCostAsOf(costs, 'p1', '2026-09-30')).toBe(10)
  })

  it('ignores costs dated after the day and other products', () => {
    expect(unitCostAsOf(costs, 'p1', '2026-10-19')).toBe(12)
    expect(unitCostAsOf(costs, 'p2', '2026-10-10')).toBe(4)
  })

  it('is null when nothing applies yet', () => {
    expect(unitCostAsOf(costs, 'p1', '2026-08-31')).toBeNull()
    expect(unitCostAsOf(costs, 'nope', '2026-10-10')).toBeNull()
  })
})

describe('lossValue', () => {
  it('is quantity times the unit cost of that day', () => {
    expect(lossValue(loss({ qty: 10, occurred_on: '2026-10-10' }), costs)).toBe(120)
  })

  it('is null when the product had no cost that day', () => {
    expect(lossValue(loss({ occurred_on: '2026-08-01' }), costs)).toBeNull()
  })
})

describe('summarizeLosses', () => {
  it('totals units and value since a date and finds the top reason', () => {
    const losses = [
      loss({ id: '1', qty: 10, occurred_on: '2026-10-10', reason: 'machine_jam' }),
      loss({ id: '2', qty: 4, occurred_on: '2026-10-12', reason: 'handling_damage' }),
      loss({ id: '3', qty: 3, occurred_on: '2026-10-13', reason: 'handling_damage' }),
      loss({ id: '4', qty: 100, occurred_on: '2026-09-01', reason: 'other' }),
    ]
    const s = summarizeLosses(losses, costs, '2026-10-01')
    expect(s.units).toBe(17)
    expect(s.value).toBe(17 * 12)
    expect(s.unpriced).toBe(0)
    expect(s.topReason).toBe('machine_jam')
  })

  it('counts losses with no cost separately instead of valuing them at zero', () => {
    const s = summarizeLosses([loss({ product_id: 'p3', qty: 5 })], costs, '2026-10-01')
    expect(s.units).toBe(5)
    expect(s.value).toBe(0)
    expect(s.unpriced).toBe(1)
  })

  it('handles an empty log', () => {
    expect(summarizeLosses([], costs, '2026-10-01')).toEqual({ units: 0, value: 0, unpriced: 0, topReason: null })
  })
})

describe('daysBefore', () => {
  it('steps back across month ends', () => {
    expect(daysBefore('2026-10-15', 30)).toBe('2026-09-15')
    expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28')
  })
})
