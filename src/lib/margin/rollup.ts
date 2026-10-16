// ============================================================
// Pure aggregation helper for the Margin Dashboard, pulled out of the page
// component so it can be unit tested without mounting React or hitting
// Supabase.
//
// A line with no cost on file must not count as free: that would make an
// unknown cost look like a 100% margin. Each bucket therefore tracks how much
// of its revenue has a known cost, and margin is worked out on that part only.
// ============================================================
import { marginPct } from '@/lib/pricing/resolve'

export interface RollupInput {
  label: string
  revenue: number
  cost: number
  /** False when no cost is on file for this line. Defaults to true. */
  costed?: boolean
}

export interface RollupBucket {
  key: string
  label: string
  /** All revenue in the bucket. */
  revenue: number
  /** Revenue from lines that have a cost on file. */
  costedRevenue: number
  /** Cost of those lines. */
  cost: number
}

export function rollUp(rows: RollupInput[]): RollupBucket[] {
  const map = new Map<string, RollupBucket>()
  for (const row of rows) {
    const costed = row.costed !== false
    const existing = map.get(row.label)
    if (existing) {
      existing.revenue += row.revenue
      if (costed) {
        existing.costedRevenue += row.revenue
        existing.cost += row.cost
      }
    } else {
      map.set(row.label, {
        key: row.label,
        label: row.label,
        revenue: row.revenue,
        costedRevenue: costed ? row.revenue : 0,
        cost: costed ? row.cost : 0,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

export interface MarginSummary {
  /** Margin on the costed part of the revenue, or null when none of it has a cost. */
  margin: number | null
  /** Revenue that has no cost on file and so is left out of the margin. */
  uncostedRevenue: number
}

export function summarizeBucket(b: { revenue: number; costedRevenue: number; cost: number }): MarginSummary {
  return {
    margin: b.costedRevenue > 0 ? marginPct(b.costedRevenue, b.cost) : null,
    uncostedRevenue: Math.round((b.revenue - b.costedRevenue) * 100) / 100,
  }
}
