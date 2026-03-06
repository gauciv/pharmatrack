import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  writeBatch
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import { InventoryItem } from '../types/inventory'
import { inventorySeed } from './inventory-seed'

const COLLECTION = 'inventory'

function requireFirebase(fnName: string): void {
  if (!isFirebaseConfigured) throw new Error(`Firebase not configured — cannot call ${fnName}`)
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  requireFirebase('getInventoryItems')
  const snapshot = await getDocs(collection(db, COLLECTION))
  if (snapshot.empty) return []
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))
}

export async function addInventoryItem(
  data: Omit<InventoryItem, 'id'>
): Promise<InventoryItem> {
  requireFirebase('addInventoryItem')
  const ref = await addDoc(collection(db, COLLECTION), data)
  return { id: ref.id, ...data }
}

export async function seedInventory(): Promise<void> {
  requireFirebase('seedInventory')
  const existing = await getDocs(collection(db, COLLECTION))
  if (!existing.empty) return
  const batch = writeBatch(db)
  inventorySeed.forEach(item => {
    const ref = doc(collection(db, COLLECTION))
    batch.set(ref, item)
  })
  await batch.commit()
}

export async function updateInventoryItem(
  id: string,
  data: Partial<InventoryItem>
): Promise<void> {
  requireFirebase('updateInventoryItem')
  await updateDoc(doc(db, COLLECTION, id), data)
}

export async function deleteInventoryItem(id: string): Promise<void> {
  requireFirebase('deleteInventoryItem')
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function deleteInventoryItems(ids: string[]): Promise<void> {
  requireFirebase('deleteInventoryItems')
  const batch = writeBatch(db)
  ids.forEach(id => batch.delete(doc(db, COLLECTION, id)))
  await batch.commit()
}

export function subscribeToInventory(
  callback: (items: InventoryItem[]) => void
): () => void {
  requireFirebase('subscribeToInventory')
  return onSnapshot(collection(db, COLLECTION), (snapshot: QuerySnapshot<DocumentData>) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))
    callback(items)
  })
}
