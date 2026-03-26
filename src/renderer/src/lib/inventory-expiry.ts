import { lotTrackingSeed } from './lot-tracking-seed'
import { InventoryItem, InventoryLot } from '../types/inventory'

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

  return [...matchedEntry.lots].sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate)
    return a.lotNumber.localeCompare(b.lotNumber)
  })
}

export function enrichInventoryItem(item: InventoryItem, today = new Date()): InventoryItem {
  const lotTracking = findLotTracking(item)
  if (lotTracking.length === 0) {
    return {
      ...item,
      expiryDate: null,
      fifoLotNumber: null,
      lotTracking: [],
      lotCount: 0,
      trackedQuantity: 0,
      expiredQuantity: 0,
      expiredLotCount: 0,
      hasExpiredStock: false,
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
  if (!expiryDate) return 'Not tracked'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateFromIso(expiryDate))
}
