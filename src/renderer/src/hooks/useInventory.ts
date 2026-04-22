import { useState, useEffect, useMemo, useCallback } from 'react'
import { isFirebaseConfigured } from '../lib/firebase'
import {
  subscribeToInventory,
  seedInventory,
  addInventoryItem,
  updateInventoryItem,
  addInventoryTransaction,
  deleteInventoryItem,
  deleteInventoryItems,
  replaceAllInventoryItems,
} from '../lib/inventory-service'
import { localStore } from '../lib/local-inventory-store'
import { InventoryItem } from '../types/inventory'
import { enrichInventoryItem, getExpiryStatus, type InventoryExpiryStatus } from '../lib/inventory-expiry'
import { splitMultiValue } from '../lib/inventory-location'

export interface InventoryFilters {
  search: string
  vendor: string
  category: string
  stockStatus: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'
  expiryStatus: 'all' | InventoryExpiryStatus
  binLocation?: string
  palletNumber?: string
}

function getTransactionType(delta: number): 'stock-in' | 'stock-out' | 'stock-adjustment' {
  if (delta > 0) return 'stock-in'
  if (delta < 0) return 'stock-out'
  return 'stock-adjustment'
}

/**
 * Primary data source is Firestore with real-time sync via onSnapshot.
 * seedInventory() populates the collection on first launch if empty.
 * Falls back to the in-memory localStore when Firebase is not configured.
 */
export function useInventory(filters: InventoryFilters) {
  const [sourceItems, setSourceItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSourceItems(localStore.getItems())
      setLoading(false)
      return localStore.subscribe(() => setSourceItems(localStore.getItems()))
    }

    let unsubscribe: (() => void) | undefined

    seedInventory()
      .then(() => {
        unsubscribe = subscribeToInventory((items) => {
          setSourceItems(items)
          setLoading(false)
        })
      })
      .catch((err) => {
        setError((err as Error).message)
        setLoading(false)
      })

    return () => unsubscribe?.()
  }, [])

  const allItems = useMemo(() => sourceItems.map(item => enrichInventoryItem(item)), [sourceItems])

  // --- CRUD ---

  const addItem = useCallback(async (data: Omit<InventoryItem, 'id'>): Promise<void> => {
    if (!isFirebaseConfigured) {
      localStore.addItem({ ...data, id: `LOCAL-${Date.now()}` })
      return
    }
    await addInventoryItem(data)
  }, [])

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>): Promise<void> => {
    const currentItem = sourceItems.find((item) => item.id === id)
    const hasOnHandUpdate =
      currentItem != null && typeof data.onHand === 'number' && data.onHand !== currentItem.onHand

    if (!isFirebaseConfigured) {
      localStore.updateItem(id, data)

      if (hasOnHandUpdate && currentItem) {
        const newOnHand = data.onHand as number
        const delta = newOnHand - currentItem.onHand
        localStore.addTransaction({
          itemId: currentItem.id,
          itemCode: data.itemCode ?? currentItem.itemCode,
          description: data.description ?? currentItem.description,
          vendor: data.vendor ?? currentItem.vendor,
          previousOnHand: currentItem.onHand,
          newOnHand,
          delta,
          type: getTransactionType(delta),
          recordedAt: new Date().toISOString(),
          binLocation: data.binLocation ?? currentItem.binLocation ?? null,
          palletNumber: data.palletNumber ?? currentItem.palletNumber ?? null,
        })
      }

      return
    }

    await updateInventoryItem(id, data)

    if (hasOnHandUpdate && currentItem) {
      const newOnHand = data.onHand as number
      const delta = newOnHand - currentItem.onHand
      await addInventoryTransaction({
        itemId: currentItem.id,
        itemCode: data.itemCode ?? currentItem.itemCode,
        description: data.description ?? currentItem.description,
        vendor: data.vendor ?? currentItem.vendor,
        previousOnHand: currentItem.onHand,
        newOnHand,
        delta,
        type: getTransactionType(delta),
        recordedAt: new Date().toISOString(),
        binLocation: data.binLocation ?? currentItem.binLocation ?? null,
        palletNumber: data.palletNumber ?? currentItem.palletNumber ?? null,
      })
    }
  }, [sourceItems])

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
      localStore.removeItem(id)
      return
    }
    await deleteInventoryItem(id)
  }, [])

  const deleteItems = useCallback(async (ids: string[]): Promise<void> => {
    if (!isFirebaseConfigured) {
      localStore.removeItems(ids)
      return
    }
    await deleteInventoryItems(ids)
  }, [])

  const replaceAll = useCallback(async (items: Omit<InventoryItem, 'id'>[]): Promise<void> => {
    if (!isFirebaseConfigured) {
      localStore.setItems(items.map((item, idx) => ({ ...item, id: `LOCAL-${Date.now()}-${idx}` })))
      return
    }
    await replaceAllInventoryItems(items)
  }, [])

  // --- Filtering ---

  const filtered = useMemo(() => {
    let result = allItems.filter(i => i.rowType === 'item')
    const s = filters.search.toLowerCase()
    const binLocationFilter = filters.binLocation ?? 'all'
    const palletNumberFilter = filters.palletNumber ?? 'all'

    if (s) {
      result = result.filter(i =>
        i.description.toLowerCase().includes(s) ||
        i.itemCode.toLowerCase().includes(s) ||
        (i.prefVendor?.toLowerCase().includes(s) ?? false) ||
        (i.binLocation?.toLowerCase().includes(s) ?? false) ||
        (i.palletNumber?.toLowerCase().includes(s) ?? false)
      )
    }
    if (filters.vendor !== 'all') result = result.filter(i => i.vendor === filters.vendor)
    if (filters.category !== 'all') result = result.filter(i => i.category === filters.category)
    if (binLocationFilter !== 'all') {
      result = result.filter((i) => splitMultiValue(i.binLocation).includes(binLocationFilter))
    }
    if (palletNumberFilter !== 'all') {
      result = result.filter((i) => splitMultiValue(i.palletNumber).includes(palletNumberFilter))
    }
    if (filters.stockStatus !== 'all') {
      result = result.filter(i => {
        if (filters.stockStatus === 'out-of-stock') return i.onHand <= 0
        if (filters.stockStatus === 'low-stock')
          return i.onHand > 0 && i.reorderPt !== null && i.onHand <= i.reorderPt
        return i.onHand > 0 && (i.reorderPt === null || i.onHand > i.reorderPt)
      })
    }
    if (filters.expiryStatus !== 'all') {
      result = result.filter(i => getExpiryStatus(i) === filters.expiryStatus)
    }
    return result
  }, [allItems, filters])

  const vendors = useMemo(() => [...new Set(allItems.map(i => i.vendor))].sort(), [allItems])
  const categories = useMemo(
    () => [...new Set(allItems.map(i => i.category).filter(Boolean))].sort(),
    [allItems]
  )
  const binLocations = useMemo(
    () => [...new Set(allItems
      .filter((item) => item.rowType === 'item')
      .flatMap((item) => splitMultiValue(item.binLocation)))
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    [allItems]
  )
  const palletNumbers = useMemo(
    () => [...new Set(allItems
      .filter((item) => item.rowType === 'item')
      .flatMap((item) => splitMultiValue(item.palletNumber)))
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    [allItems]
  )

  return {
    items: filtered,
    allItems,
    loading,
    error,
    vendors,
    categories,
    binLocations,
    palletNumbers,
    total: allItems.filter(i => i.rowType === 'item').length,
    addItem,
    updateItem,
    deleteItem,
    deleteItems,
    replaceAll,
  }
}
