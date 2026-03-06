import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  subscribeToInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  deleteInventoryItems,
  replaceAllInventoryItems,
} from '../lib/inventory-service'
import { isFirebaseConfigured } from '../lib/firebase'
import { inventorySeed } from '../lib/inventory-seed'
import { localStore } from '../lib/local-inventory-store'
import { InventoryItem } from '../types/inventory'

export interface InventoryFilters {
  search: string
  vendor: string
  category: string
  stockStatus: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'
}

export function useInventory(filters: InventoryFilters) {
  const [allItems, setAllItems] = useState<InventoryItem[]>(() =>
    isFirebaseConfigured ? inventorySeed : localStore.getItems()
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tracks whether Firestore has ever returned data in this session.
  // Prevents showing an empty list when Firestore is configured but
  // the collection is genuinely empty vs. still loading.
  const hasSeenFirestoreData = useRef(false)

  useEffect(() => {
    setLoading(true)

    if (!isFirebaseConfigured) {
      // Subscribe to the shared module-level store so all useInventory()
      // instances stay in sync (e.g. importing CSV in Settings updates
      // the Inventory page without any global state library).
      setAllItems(localStore.getItems())
      setLoading(false)
      return localStore.subscribe(() => setAllItems(localStore.getItems()))
    }

    try {
      const unsubscribe = subscribeToInventory((firestoreItems) => {
        if (firestoreItems.length > 0) {
          hasSeenFirestoreData.current = true
        }
        // Show seed data only while Firestore hasn't returned any docs yet.
        setAllItems(hasSeenFirestoreData.current ? firestoreItems : inventorySeed)
        setLoading(false)
      })
      return unsubscribe
    } catch {
      setAllItems(inventorySeed)
      setLoading(false)
    }
  }, [])

  // --- CRUD ---

  const addItem = useCallback(async (data: Omit<InventoryItem, 'id'>): Promise<void> => {
    if (isFirebaseConfigured) {
      await addInventoryItem(data)
      // onSnapshot handles the state update
    } else {
      const newItem: InventoryItem = { ...data, id: `LOCAL-${Date.now()}` }
      localStore.addItem(newItem)
    }
  }, [])

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>): Promise<void> => {
    if (isFirebaseConfigured) {
      await updateInventoryItem(id, data)
    } else {
      localStore.updateItem(id, data)
    }
  }, [])

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    if (isFirebaseConfigured) {
      await deleteInventoryItem(id)
    } else {
      localStore.removeItem(id)
    }
  }, [])

  const deleteItems = useCallback(async (ids: string[]): Promise<void> => {
    if (isFirebaseConfigured) {
      await deleteInventoryItems(ids)
    } else {
      localStore.removeItems(ids)
    }
  }, [])

  const replaceAll = useCallback(async (items: Omit<InventoryItem, 'id'>[]): Promise<void> => {
    if (isFirebaseConfigured) {
      await replaceAllInventoryItems(items)
      // onSnapshot handles the state update
    } else {
      const newItems: InventoryItem[] = items.map((item, idx) => ({
        ...item,
        id: `LOCAL-${Date.now()}-${idx}`,
      }))
      localStore.setItems(newItems)
    }
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
