import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  subscribeToInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  deleteInventoryItems,
} from '../lib/inventory-service'
import { isFirebaseConfigured } from '../lib/firebase'
import { inventorySeed } from '../lib/inventory-seed'
import { InventoryItem } from '../types/inventory'

export interface InventoryFilters {
  search: string
  vendor: string
  category: string
  stockStatus: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'
}

export function useInventory(filters: InventoryFilters) {
  const [allItems, setAllItems] = useState<InventoryItem[]>(inventorySeed)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    if (!isFirebaseConfigured) {
      setAllItems(inventorySeed)
      setLoading(false)
      return
    }
    try {
      const unsubscribe = subscribeToInventory((firestoreItems) => {
        setAllItems(firestoreItems.length > 0 ? firestoreItems : inventorySeed)
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
      setAllItems(prev => [...prev, newItem])
    }
  }, [])

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>): Promise<void> => {
    if (isFirebaseConfigured) {
      await updateInventoryItem(id, data)
    } else {
      setAllItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
    }
  }, [])

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    if (isFirebaseConfigured) {
      await deleteInventoryItem(id)
    } else {
      setAllItems(prev => prev.filter(i => i.id !== id))
    }
  }, [])

  const deleteItems = useCallback(async (ids: string[]): Promise<void> => {
    if (isFirebaseConfigured) {
      await deleteInventoryItems(ids)
    } else {
      const set = new Set(ids)
      setAllItems(prev => prev.filter(i => !set.has(i.id)))
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
  }
}
