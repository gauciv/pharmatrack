import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, History, Loader2, Search } from 'lucide-react'
import { useTransactions } from '../hooks/useTransactions'
import type { InventoryTransaction, InventoryTransactionType } from '../types/inventory'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { cn } from '../lib/utils'

type TransactionFilter = 'all' | 'stock-in' | 'stock-out'

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getTransactionBadge(transactionType: InventoryTransactionType): JSX.Element {
  if (transactionType === 'stock-in') return <Badge variant="success" className="text-[10px]">Stock In</Badge>
  if (transactionType === 'stock-out') return <Badge variant="warning" className="text-[10px]">Stock Out</Badge>
  return <Badge variant="info" className="text-[10px]">Adjustment</Badge>
}

export default function Transactions(): JSX.Element {
  const { transactions, loading, error } = useTransactions()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TransactionFilter>('all')
  const [selected, setSelected] = useState<InventoryTransaction | null>(null)

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      if (filter !== 'all' && transaction.type !== filter) return false
      if (!query) return true

      return (
        transaction.itemCode.toLowerCase().includes(query) ||
        transaction.description.toLowerCase().includes(query) ||
        transaction.vendor.toLowerCase().includes(query) ||
        (transaction.binLocation?.toLowerCase().includes(query) ?? false) ||
        (transaction.palletNumber?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [transactions, search, filter])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <div className="shrink-0 border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Transactions</span>
            <Badge variant="info" className="text-[10px] font-mono">{filteredTransactions.length} logs</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-[340px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product, vendor, bin, or pallet..."
                className="pl-8 h-8 text-xs bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700"
              />
            </div>
            <Select value={filter} onValueChange={(value) => setFilter(value as TransactionFilter)}>
              <SelectTrigger className="h-8 text-xs w-[160px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
                <SelectValue placeholder="All changes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All changes</SelectItem>
                <SelectItem value="stock-in">Stock In</SelectItem>
                <SelectItem value="stock-out">Stock Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="px-4 py-8 text-sm text-destructive">{error}</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-silver-300 dark:border-gray-700">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Date & Time</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Item Code</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Description</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Former → New</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Delta</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Bin</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Pallet</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction, index) => (
                    <tr
                      key={transaction.id}
                      onClick={() => setSelected(transaction)}
                      className={cn(
                        'cursor-pointer border-b border-silver-200 dark:border-gray-700 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors',
                        index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/40'
                      )}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{formatDateTime(transaction.recordedAt)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-charcoal-700 dark:text-gray-300">{transaction.itemCode}</td>
                      <td className="px-3 py-2 text-charcoal-800 dark:text-gray-100">{transaction.description}</td>
                      <td className="px-3 py-2">{getTransactionBadge(transaction.type)}</td>
                      <td className="px-3 py-2 text-right font-mono text-charcoal-700 dark:text-gray-300">
                        {transaction.previousOnHand.toLocaleString()} → {transaction.newOnHand.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn(
                          'font-mono font-semibold inline-flex items-center gap-1',
                          transaction.delta > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : transaction.delta < 0
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        )}>
                          {transaction.delta > 0 && <ArrowUpRight className="h-3.5 w-3.5" />}
                          {transaction.delta < 0 && <ArrowDownRight className="h-3.5 w-3.5" />}
                          {transaction.delta > 0 ? '+' : ''}{transaction.delta.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-charcoal-700 dark:text-gray-300">{transaction.binLocation || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-charcoal-700 dark:text-gray-300">{transaction.palletNumber || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xl border-silver-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm text-charcoal-900 dark:text-gray-100">Transaction Details</DialogTitle>
                <DialogDescription className="text-xs">
                  <span className="font-mono">{selected.itemCode}</span> · {selected.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-silver-200 dark:border-gray-700 p-3 bg-gray-50/70 dark:bg-gray-800/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date and Time</p>
                    <p className="mt-1 text-charcoal-800 dark:text-gray-100 font-medium">{formatDateTime(selected.recordedAt)}</p>
                  </div>
                  <div className="rounded-md border border-silver-200 dark:border-gray-700 p-3 bg-gray-50/70 dark:bg-gray-800/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Transaction Type</p>
                    <div className="mt-1">{getTransactionBadge(selected.type)}</div>
                  </div>
                </div>

                <div className="rounded-md border border-silver-200 dark:border-gray-700 p-3 bg-gray-50/70 dark:bg-gray-800/40">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock Level Change</p>
                  <p className="mt-1 text-sm font-mono font-semibold text-charcoal-800 dark:text-gray-100">
                    {selected.previousOnHand.toLocaleString()} → {selected.newOnHand.toLocaleString()}
                  </p>
                  <p className={cn(
                    'text-[11px] mt-1 font-semibold',
                    selected.delta > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : selected.delta < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  )}>
                    Delta: {selected.delta > 0 ? '+' : ''}{selected.delta.toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-silver-200 dark:border-gray-700 p-3 bg-gray-50/70 dark:bg-gray-800/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bin Location</p>
                    <p className="mt-1 text-charcoal-800 dark:text-gray-100">{selected.binLocation || '—'}</p>
                  </div>
                  <div className="rounded-md border border-silver-200 dark:border-gray-700 p-3 bg-gray-50/70 dark:bg-gray-800/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pallet Number</p>
                    <p className="mt-1 font-mono text-charcoal-800 dark:text-gray-100">{selected.palletNumber || '—'}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
