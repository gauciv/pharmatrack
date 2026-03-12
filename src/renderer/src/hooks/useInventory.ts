import { useState, useEffect, useMemo, useCallback } from 'react'
import { isFirebaseConfigured } from '../lib/firebase'
import {
  subscribeToInventory,
  seedInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  deleteInventoryItems,
  replaceAllInventoryItems,
} from '../lib/inventory-service'
import { localStore } from '../lib/local-inventory-store'
import { InventoryItem } from '../types/inventory'

export interface InventoryFilters {
  search: string
  vendor: string
  category: string
  stockStatus: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'
}

/**
 * Primary data source is Firestore with real-time sync via onSnapshot.
 * seedInventory() populates the collection on first launch if empty.
 * Falls back to the in-memory localStore when Firebase is not configured.
 */
export function useInventory(filters: InventoryFilters) {
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAllItems(localStore.getItems())
      setLoading(false)
      return localStore.subscribe(() => setAllItems(localStore.getItems()))
    }

    let unsubscribe: (() => void) | undefined

    seedInventory()
      .then(() => {
        unsubscribe = subscribeToInventory((items) => {
          setAllItems(items)
          setLoading(false)
        })
      })
      .catch((err) => {
        setError((err as Error).message)
        setLoading(false)
      })

    return () => unsubscribe?.()
  }, [])

  // --- CRUD ---

  const addItem = useCallback(async (data: Omit<InventoryItem, 'id'>): Promise<void> => {
    if (!isFirebaseConfigured) {
      localStore.addItem({ ...data, id: `LOCAL-${Date.now()}` })
      return
    }
    await addInventoryItem(data)
  }, [])

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>): Promise<void> => {
    if (!isFirebaseConfigured) {
      localStore.updateItem(id, data)
      return
    }
    await updateInventoryItem(id, data)
  }, [])

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
    if (s) {
      result = result.filter(i =>
        i.description.toLowerCase().includes(s) ||
        i.itemCode.toLowerCase().includes(s) ||
        (i.prefVendor?.toLowerCase().includes(s) ?? false)
      )
    }
    if (filters.vendor !== 'all') result = result.filter(i => i.vendor === filters.vendor)
    if (filters.category !== 'all') result = result.filter(i => i.category === filters.category)
    if (filters.stockStatus !== 'all') {
      result = result.filter(i => {
        if (filters.stockStatus === 'out-of-stock') return i.onHand <= 0
        if (filters.stockStatus === 'low-stock')
          return i.onHand > 0 && i.reorderPt !== null && i.onHand <= i.reorderPt
        return i.onHand > 0 && (i.reorderPt === null || i.onHand > i.reorderPt)
      })
    }
    return result
  }, [allItems, filters])

  const vendors = useMemo(() => [...new Set(allItems.map(i => i.vendor))].sort(), [allItems])
  const categories = useMemo(
    () => [...new Set(allItems.map(i => i.category).filter(Boolean))].sort(),
    [allItems]
  )

  return {
    items: filtered,
    allItems,
    loading,
    error,
    vendors,
    categories,
    total: allItems.filter(i => i.rowType === 'item').length,
    addItem,
    updateItem,
    deleteItem,
    deleteItems,
    replaceAll,
  }
}
