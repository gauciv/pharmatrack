import { useState, useEffect, useMemo, useCallback } from 'react'
import { localStore } from '../lib/local-inventory-store'
import { InventoryItem } from '../types/inventory'

export interface InventoryFilters {
  search: string
  vendor: string
  category: string
  stockStatus: 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'
}

/**
 * Inventory is managed entirely through the module-level localStore
 * (initialised from inventorySeed). Firebase is used for auth only.
 * This guarantees that CRUD operations never wipe existing items and
 * that all useInventory() instances (Inventory page, Settings, etc.)
 * stay in sync without a global state library.
 */
export function useInventory(filters: InventoryFilters) {
  const [allItems, setAllItems] = useState<InventoryItem[]>(() => localStore.getItems())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setAllItems(localStore.getItems())
    setLoading(false)
    return localStore.subscribe(() => setAllItems(localStore.getItems()))
  }, [])

  // --- CRUD ---

  const addItem = useCallback(async (data: Omit<InventoryItem, 'id'>): Promise<void> => {
    const newItem: InventoryItem = { ...data, id: `LOCAL-${Date.now()}` }
    localStore.addItem(newItem)
  }, [])

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>): Promise<void> => {
    localStore.updateItem(id, data)
  }, [])

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    localStore.removeItem(id)
  }, [])

  const deleteItems = useCallback(async (ids: string[]): Promise<void> => {
    localStore.removeItems(ids)
  }, [])

  const replaceAll = useCallback(async (items: Omit<InventoryItem, 'id'>[]): Promise<void> => {
    const newItems: InventoryItem[] = items.map((item, idx) => ({
      ...item,
      id: `LOCAL-${Date.now()}-${idx}`,
    }))
    localStore.setItems(newItems)
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
    error: null,
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
