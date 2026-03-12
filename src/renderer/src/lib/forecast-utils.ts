import { InventoryItem } from '../types/inventory'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastRow {
  item: InventoryItem
  runwayWeeks: number | null
  status: 'critical' | 'low' | 'healthy' | 'no-data'
  suggestedOrder: number
}

export interface RunwayBucket {
  name: string
  count: number
  fill: string
}

export interface VendorPriority {
  vendor: string
  critical: number
  low: number
  healthy: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const RESTOCK_LEAD_WEEKS = 2
export const COVERAGE_TARGET_WEEKS = 8

// ─── Pure functions ───────────────────────────────────────────────────────────

export function computeRunway(item: InventoryItem): number | null {
  if (item.salesPerWeek <= 0) return null
  return item.onHand / item.salesPerWeek
}

export function computeSuggestedOrder(item: InventoryItem): number {
  if (item.salesPerWeek <= 0) return 0
  return Math.max(0, Math.ceil(item.salesPerWeek * COVERAGE_TARGET_WEEKS - item.onHand))
}

export function classifyStatus(weeks: number | null): ForecastRow['status'] {
  if (weeks === null) return 'no-data'
  if (weeks < RESTOCK_LEAD_WEEKS) return 'critical'
  if (weeks < 4) return 'low'
  return 'healthy'
}

export function buildForecastRows(items: InventoryItem[]): ForecastRow[] {
  return items
    .filter(i => i.rowType === 'item')
    .map(i => {
      const runwayWeeks = computeRunway(i)
      return {
        item: i,
        runwayWeeks,
        status: classifyStatus(runwayWeeks),
        suggestedOrder: computeSuggestedOrder(i),
      }
    })
    .sort((a, b) => {
      if (a.runwayWeeks === null && b.runwayWeeks === null) return 0
      if (a.runwayWeeks === null) return 1
      if (b.runwayWeeks === null) return -1
      return a.runwayWeeks - b.runwayWeeks
    })
}

export function buildRunwayBuckets(rows: ForecastRow[]): RunwayBucket[] {
  const buckets: RunwayBucket[] = [
    { name: 'Out',      count: 0, fill: '#DC2626' },
    { name: '<1 wk',    count: 0, fill: '#EF4444' },
    { name: '1–2 wks',  count: 0, fill: '#F59E0B' },
    { name: '2–4 wks',  count: 0, fill: '#F59E0B' },
    { name: '4–8 wks',  count: 0, fill: '#10B981' },
    { name: '8+ wks',   count: 0, fill: '#059669' },
  ]

  for (const r of rows) {
    if (r.runwayWeeks === null) continue
    if (r.item.onHand <= 0)       buckets[0].count++
    else if (r.runwayWeeks < 1)   buckets[1].count++
    else if (r.runwayWeeks < 2)   buckets[2].count++
    else if (r.runwayWeeks < 4)   buckets[3].count++
    else if (r.runwayWeeks < 8)   buckets[4].count++
    else                          buckets[5].count++
  }

  return buckets
}

export function buildVendorPriority(rows: ForecastRow[]): VendorPriority[] {
  const map = new Map<string, VendorPriority>()

  for (const r of rows) {
    const v = r.item.vendor
    if (!map.has(v)) map.set(v, { vendor: v, critical: 0, low: 0, healthy: 0 })
    const entry = map.get(v)!
    if (r.status === 'critical') entry.critical++
    else if (r.status === 'low') entry.low++
    else if (r.status === 'healthy') entry.healthy++
    // 'no-data' items are excluded from vendor priority chart
  }

  return Array.from(map.values())
    .sort((a, b) => (b.critical + b.low) - (a.critical + a.low))
    .slice(0, 8)
}
