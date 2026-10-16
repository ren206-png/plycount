import { describe, it, expect } from 'vitest'
import { rollUp, summarizeBucket } from './rollup'

describe('rollUp', () => {
  it('groups rows by label and sums revenue/cost', () => {
    const result = rollUp([
      { label: 'SKU-A', revenue: 100, cost: 60 },
      { label: 'SKU-A', revenue: 50, cost: 30 },
      { label: 'SKU-B', revenue: 200, cost: 150 },
    ])

    expect(result).toHaveLength(2)
    const skuA = result.find((r) => r.label === 'SKU-A')
    const skuB = result.find((r) => r.label === 'SKU-B')
    expect(skuA).toMatchObject({ revenue: 150, costedRevenue: 150, cost: 90 })
    expect(skuB).toMatchObject({ revenue: 200, costedRevenue: 200, cost: 150 })
  })

  it('sorts descending by revenue', () => {
    const result = rollUp([
      { label: 'small', revenue: 10, cost: 5 },
      { label: 'big', revenue: 1000, cost: 500 },
      { label: 'medium', revenue: 100, cost: 50 },
    ])

    expect(result.map((r) => r.label)).toEqual(['big', 'medium', 'small'])
  })

  it('returns an empty array for no rows', () => {
    expect(rollUp([])).toEqual([])
  })

  it('handles a single row without grouping', () => {
    const result = rollUp([{ label: 'only-one', revenue: 42, cost: 10 }])
    expect(result).toEqual([{ key: 'only-one', label: 'only-one', revenue: 42, costedRevenue: 42, cost: 10 }])
  })

  it('keeps revenue that has no cost out of the costed totals', () => {
    const [b] = rollUp([
      { label: 'X', revenue: 100, cost: 60 },
      { label: 'X', revenue: 900, cost: 0, costed: false },
    ])
    expect(b).toMatchObject({ revenue: 1000, costedRevenue: 100, cost: 60 })
  })
})

describe('summarizeBucket', () => {
  it('works out margin on the costed revenue only', () => {
    const s = summarizeBucket({ revenue: 1000, costedRevenue: 100, cost: 60 })
    expect(s.margin).toBe(40)
    expect(s.uncostedRevenue).toBe(900)
  })

  it('has no margin at all when nothing has a cost, instead of a fake 100%', () => {
    const s = summarizeBucket({ revenue: 140.02, costedRevenue: 0, cost: 0 })
    expect(s.margin).toBeNull()
    expect(s.uncostedRevenue).toBe(140.02)
  })

  it('reports nothing uncosted when every line has a cost', () => {
    expect(summarizeBucket({ revenue: 50, costedRevenue: 50, cost: 40 })).toEqual({ margin: 20, uncostedRevenue: 0 })
  })
})
