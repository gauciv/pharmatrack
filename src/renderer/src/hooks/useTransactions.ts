import { useEffect, useMemo, useState } from 'react'
import { isFirebaseConfigured } from '../lib/firebase'
import { localStore } from '../lib/local-inventory-store'
import { subscribeToInventoryTransactions } from '../lib/inventory-service'
import type { InventoryTransaction } from '../types/inventory'

function sortTransactions(transactions: InventoryTransaction[]): InventoryTransaction[] {
  return [...transactions].sort((a, b) => {
    const timeA = Date.parse(a.recordedAt)
    const timeB = Date.parse(b.recordedAt)
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) return timeB - timeA
    return b.recordedAt.localeCompare(a.recordedAt)
  })
}

export function useTransactions() {
  const [sourceTransactions, setSourceTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSourceTransactions(localStore.getTransactions())
      setLoading(false)
      return localStore.subscribeTransactions(() => {
        setSourceTransactions(localStore.getTransactions())
      })
    }

    let unsubscribe: (() => void) | undefined

    try {
      unsubscribe = subscribeToInventoryTransactions((transactions) => {
        setSourceTransactions(transactions)
        setLoading(false)
      })
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }

    return () => unsubscribe?.()
  }, [])

  const transactions = useMemo(() => sortTransactions(sourceTransactions), [sourceTransactions])

  return {
    transactions,
    loading,
    error,
  }
}
