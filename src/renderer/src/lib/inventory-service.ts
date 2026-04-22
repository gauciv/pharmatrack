import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
  writeBatch
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import { InventoryItem, InventoryTransaction } from '../types/inventory'
import { inventorySeed } from './inventory-seed'

const COLLECTION = 'inventory'
const TRANSACTIONS_COLLECTION = 'inventory_transactions'

function requireFirebase(fnName: string): void {
  if (!isFirebaseConfigured) throw new Error(`Firebase not configured — cannot call ${fnName}`)
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  requireFirebase('getInventoryItems')
  const snapshot = await getDocs(collection(db, COLLECTION))
  if (snapshot.empty) return []
  return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem))
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
    const { id: _id, ...data } = item
    const ref = doc(collection(db, COLLECTION))
    batch.set(ref, data)
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

export async function replaceAllInventoryItems(
  items: Omit<InventoryItem, 'id'>[]
): Promise<void> {
  requireFirebase('replaceAllInventoryItems')
  const CHUNK = 499
  // Delete all existing
  const existing = await getDocs(collection(db, COLLECTION))
  for (let i = 0; i < existing.docs.length; i += CHUNK) {
    const delBatch = writeBatch(db)
    existing.docs.slice(i, i + CHUNK).forEach(d => delBatch.delete(d.ref))
    await delBatch.commit()
  }
  // Add new items
  for (let i = 0; i < items.length; i += CHUNK) {
    const addBatch = writeBatch(db)
    items.slice(i, i + CHUNK).forEach(item => {
      const ref = doc(collection(db, COLLECTION))
      addBatch.set(ref, item)
    })
    await addBatch.commit()
  }
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

export async function addInventoryTransaction(
  data: Omit<InventoryTransaction, 'id'>
): Promise<InventoryTransaction> {
  requireFirebase('addInventoryTransaction')
  const ref = await addDoc(collection(db, TRANSACTIONS_COLLECTION), data)
  return { id: ref.id, ...data }
}

export function subscribeToInventoryTransactions(
  callback: (transactions: InventoryTransaction[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  requireFirebase('subscribeToInventoryTransactions')
  const transactionQuery = query(
    collection(db, TRANSACTIONS_COLLECTION),
    orderBy('recordedAt', 'desc')
  )

  return onSnapshot(
    transactionQuery,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const transactions = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      } as InventoryTransaction))
      callback(transactions)
    },
    (error) => {
      onError?.(error)
    }
  )
}
