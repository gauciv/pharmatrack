export type RowType = 'item' | 'vendor' | 'category' | 'subcategory' | 'total' | 'other'

export interface InventoryLot {
  lotNumber: string
  expiryDate: string
  quantity: number
}

export interface InventoryItem {
  id: string
  itemCode: string
  description: string
  vendor: string
  category: string
  prefVendor: string
  reorderPt: number | null
  onHand: number
  order: number | null
  onPO: number
  nextDeliv: string
  salesPerWeek: number
  rowType: RowType
  expiryDate?: string | null
  fifoLotNumber?: string | null
  lotTracking?: InventoryLot[]
  lotCount?: number
  trackedQuantity?: number
  expiredQuantity?: number
  expiredLotCount?: number
  hasExpiredStock?: boolean
}

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock'

export function getStockStatus(item: InventoryItem): StockStatus {
  if (item.onHand <= 0) return 'out-of-stock'
  if (item.reorderPt !== null && item.onHand <= item.reorderPt) return 'low-stock'
  return 'in-stock'
}
