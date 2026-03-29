import { lotTrackingSeed } from './lot-tracking-seed'
import { InventoryItem, InventoryLot } from '../types/inventory'

export type InventoryExpiryStatus =
  | 'untracked'
  | 'expired'
  | 'expiring-30'
  | 'expiring-60'
  | 'expiring-90'
  | 'tracked-safe'

export interface TrackedCoverage {
  trackedQuantity: number
  onHand: number
  delta: number
  coveragePercent: number | null
  status: 'untracked' | 'matched' | 'partial' | 'over' | 'no-on-hand'
}

function normalizeItemCode(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (/^\d+$/.test(cleaned)) return cleaned.replace(/^0+/, '') || '0'
  return cleaned
}

function normalizeDescription(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(closed system\)/g, ' closed system ')
    .replace(/closed system/g, ' closed system ')
    .replace(/sol'n/g, 'solution')
    .replace(/soln/g, 'solution')
    .replace(/wwater/g, 'water')
    .replace(/ml\(/g, 'ml (')
    .replace(/[^a-z0-9]+/g, '')
}

function getTodayIso(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function sortLots(lots: InventoryLot[]): InventoryLot[] {
  return [...lots].sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate)
    return a.lotNumber.localeCompare(b.lotNumber)
  })
}

function normalizeLotTracking(lots: InventoryLot[]): InventoryLot[] {
  return sortLots(
    lots
      .filter((lot): lot is InventoryLot => Boolean(lot?.expiryDate))
      .map((lot) => ({
        lotNumber: String(lot.lotNumber ?? '').trim(),
        expiryDate: String(lot.expiryDate).trim(),
        quantity: Number(lot.quantity) || 0,
      }))
  )
}

function findLotTracking(item: Pick<InventoryItem, 'itemCode' | 'description'>): InventoryLot[] {
  const codeKey = normalizeItemCode(item.itemCode)
  const descriptionKey = normalizeDescription(item.description)

  const codeMatches = lotTrackingSeed.filter((entry) => normalizeItemCode(entry.itemCode) === codeKey)
  const descriptionMatches = lotTrackingSeed.filter(
    (entry) => normalizeDescription(entry.description) === descriptionKey
  )

  const exactCodeAndDescription = codeMatches.filter(
    (entry) => normalizeDescription(entry.description) === descriptionKey
  )

  const matchedEntry =
    exactCodeAndDescription[0] ??
    (codeMatches.length === 0 && descriptionMatches.length === 1 ? descriptionMatches[0] : undefined)

  if (!matchedEntry) return []

  return sortLots(matchedEntry.lots)
}

function getManualLotTracking(item: InventoryItem): InventoryLot[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(item, 'lotTracking')) return undefined
  return normalizeLotTracking(item.lotTracking ?? [])
}

function getLotTracking(item: InventoryItem): InventoryLot[] {
  return getManualLotTracking(item) ?? findLotTracking(item)
}

export function getDaysUntilExpiry(expiryDate?: string | null, today = new Date()): number | null {
  if (!expiryDate) return null
  const todayIso = getTodayIso(today)
  const diffMs = dateFromIso(expiryDate).getTime() - dateFromIso(todayIso).getTime()
  return Math.round(diffMs / 86400000)
}

export function getNextNonExpiredLot(
  item: Pick<InventoryItem, 'lotTracking'>,
  today = new Date()
): InventoryLot | null {
  const todayIso = getTodayIso(today)
  return item.lotTracking?.find((lot) => lot.expiryDate >= todayIso) ?? null
}

export function getExpiryStatus(
  item: Pick<InventoryItem, 'lotTracking' | 'expiredQuantity'>,
  today = new Date()
): InventoryExpiryStatus {
  if (!item.lotTracking?.length) return 'untracked'
  if ((item.expiredQuantity ?? 0) > 0) return 'expired'

  const nextLot = getNextNonExpiredLot(item, today)
  if (!nextLot) return 'tracked-safe'

  const daysUntil = getDaysUntilExpiry(nextLot.expiryDate, today)
  if (daysUntil === null) return 'tracked-safe'
  if (daysUntil <= 30) return 'expiring-30'
  if (daysUntil <= 60) return 'expiring-60'
  if (daysUntil <= 90) return 'expiring-90'
  return 'tracked-safe'
}

export function getExpiryStatusLabel(status: InventoryExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'Expired'
    case 'expiring-30':
      return '0-30 days'
    case 'expiring-60':
      return '31-60 days'
    case 'expiring-90':
      return '61-90 days'
    case 'tracked-safe':
      return 'Tracked'
    default:
      return 'Untracked'
  }
}

export function getTrackedCoverage(
  item: Pick<InventoryItem, 'onHand' | 'lotTracking' | 'trackedQuantity'>
): TrackedCoverage {
  const trackedQuantity =
    item.trackedQuantity ??
    item.lotTracking?.reduce((sum, lot) => sum + lot.quantity, 0) ??
    0

  if (!item.lotTracking?.length) {
    return {
      trackedQuantity,
      onHand: item.onHand,
      delta: trackedQuantity - item.onHand,
      coveragePercent: null,
      status: 'untracked',
    }
  }

  if (item.onHand <= 0) {
    return {
      trackedQuantity,
      onHand: item.onHand,
      delta: trackedQuantity - item.onHand,
      coveragePercent: null,
      status: 'no-on-hand',
    }
  }

  const delta = trackedQuantity - item.onHand
  const coveragePercent = Number(((trackedQuantity / item.onHand) * 100).toFixed(1))

  return {
    trackedQuantity,
    onHand: item.onHand,
    delta,
    coveragePercent,
    status: delta === 0 ? 'matched' : delta < 0 ? 'partial' : 'over',
  }
}

export function enrichInventoryItem(item: InventoryItem, today = new Date()): InventoryItem {
  const lotTracking = getLotTracking(item)
  if (lotTracking.length === 0) {
    return {
      ...item,
      expiryDate: null,
      fifoLotNumber: null,
      lotCount: 0,
      trackedQuantity: 0,
      expiredQuantity: 0,
      expiredLotCount: 0,
      hasExpiredStock: false,
      lotTracking: getManualLotTracking(item) ?? [],
    }
  }

  const todayIso = getTodayIso(today)
  const expiredLots = lotTracking.filter((lot) => lot.expiryDate < todayIso)

  return {
    ...item,
    expiryDate: lotTracking[0]?.expiryDate ?? null,
    fifoLotNumber: lotTracking[0]?.lotNumber ?? null,
    lotTracking,
    lotCount: lotTracking.length,
    trackedQuantity: lotTracking.reduce((sum, lot) => sum + lot.quantity, 0),
    expiredQuantity: expiredLots.reduce((sum, lot) => sum + lot.quantity, 0),
    expiredLotCount: expiredLots.length,
    hasExpiredStock: expiredLots.length > 0,
  }
}

export function formatExpiryDate(expiryDate?: string | null): string {
  if (!expiryDate) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateFromIso(expiryDate))
}
