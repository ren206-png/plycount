// ============================================================
// Damaged / scrapped product log: labels and the money maths.
//
// The loss value is never stored. It is qty x the unit cost that applied on
// the day of the loss (the newest cost dated on or before it), so it stays
// right when costs are corrected, and only admins, who can read costs, ever
// see it.
// ============================================================
import type { CostInput, LossReason, LossStage, ProductionLoss } from '@/types'

export const LOSS_STAGES: { value: LossStage; label: string }[] = [
  { value: 'converting', label: 'Converting / production' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'warehouse', label: 'Warehouse / storage' },
  { value: 'shipping', label: 'Shipping / loading' },
  { value: 'other', label: 'Other' },
]

export const LOSS_REASONS: { value: LossReason; label: string }[] = [
  { value: 'machine_jam', label: 'Machine jam / breakdown' },
  { value: 'material_defect', label: 'Defective raw material' },
  { value: 'operator_error', label: 'Operator error' },
  { value: 'moisture_damage', label: 'Moisture / water damage' },
  { value: 'handling_damage', label: 'Handling damage' },
  { value: 'quality_reject', label: 'Failed quality check' },
  { value: 'other', label: 'Other' },
]

export const stageLabel = (v: string) => LOSS_STAGES.find((s) => s.value === v)?.label ?? v
export const reasonLabel = (v: string) => LOSS_REASONS.find((r) => r.value === v)?.label ?? v

export const costPerUnit = (c: CostInput) =>
  c.raw_material_cost + c.packaging_cost + c.labor_cost + c.freight_cost_per_unit

/** Unit cost in force on `date`: the newest entry for the product dated on or before it, or null. */
export function unitCostAsOf(costs: CostInput[], productId: string, date: string): number | null {
  let best: CostInput | null = null
  for (const c of costs) {
    if (c.product_id !== productId || c.effective_date > date) continue
    if (!best || c.effective_date > best.effective_date) best = c
  }
  return best ? costPerUnit(best) : null
}

export function lossValue(loss: ProductionLoss, costs: CostInput[]): number | null {
  const unit = unitCostAsOf(costs, loss.product_id, loss.occurred_on)
  return unit === null ? null : unit * loss.qty
}

export interface LossSummary {
  units: number
  value: number
  /** Losses whose product had no cost on file that day, so their value is not in `value`. */
  unpriced: number
  topReason: LossReason | null
}

/** Totals for losses on or after `since` (a YYYY-MM-DD date). */
export function summarizeLosses(losses: ProductionLoss[], costs: CostInput[], since: string): LossSummary {
  const recent = losses.filter((l) => l.occurred_on >= since)
  const byReason = new Map<LossReason, number>()
  let units = 0
  let value = 0
  let unpriced = 0
  for (const l of recent) {
    units += l.qty
    byReason.set(l.reason, (byReason.get(l.reason) ?? 0) + l.qty)
    const v = lossValue(l, costs)
    if (v === null) unpriced += 1
    else value += v
  }
  let topReason: LossReason | null = null
  let topQty = 0
  for (const [reason, qty] of byReason) {
    if (qty > topQty) {
      topReason = reason
      topQty = qty
    }
  }
  return { units, value, unpriced, topReason }
}

/** YYYY-MM-DD for `days` days before `today` (also YYYY-MM-DD). */
export function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
