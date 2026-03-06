/**
 * Module-level reactive store for local (non-Firebase) mode.
 * All useInventory() instances subscribe here so CRUD ops
 * (including CSV import in Settings) are immediately visible
 * everywhere without needing global state management.
 * inventorySeed is used as the initial value but is never mutated.
 */
import { inventorySeed } from './inventory-seed'
import { InventoryItem } from '../types/inventory'

let _items: InventoryItem[] = [...inventorySeed]
const _listeners = new Set<() => void>()

function notify(): void {
  _listeners.forEach(l => l())
}

export const localStore = {
  getItems(): InventoryItem[] {
    return _items
  },

  setItems(items: InventoryItem[]): void {
    _items = items
    notify()
  },

  addItem(item: InventoryItem): void {
    _items = [..._items, item]
    notify()
  },

  updateItem(id: string, patch: Partial<InventoryItem>): void {
    _items = _items.map(i => (i.id === id ? { ...i, ...patch } : i))
    notify()
  },

  removeItem(id: string): void {
    _items = _items.filter(i => i.id !== id)
    notify()
  },

  removeItems(ids: string[]): void {
    const set = new Set(ids)
    _items = _items.filter(i => !set.has(i.id))
    notify()
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener)
    return () => _listeners.delete(listener)
  },
}
