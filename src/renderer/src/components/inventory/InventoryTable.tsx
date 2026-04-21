import { Fragment, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  PaginationState,
} from '@tanstack/react-table'
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  ChevronRight, ChevronDown as ChevronDownIcon,
  ChevronLeft, ChevronsLeft, ChevronsRight,
  MoreHorizontal, Pencil, Trash2, Eye,
} from 'lucide-react'
import { InventoryItem, getStockStatus } from '../../types/inventory'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { cn } from '../../lib/utils'
import {
  formatExpiryDate,
  getDaysUntilExpiry,
  getExpiryStatus,
  getNextNonExpiredLot,
  getTrackedCoverage,
} from '../../lib/inventory-expiry'

interface InventoryTableProps {
  items: InventoryItem[]
  loading: boolean
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
  paginate?: boolean
}

const columnHelper = createColumnHelper<InventoryItem>()

function StatusBadge({ item }: { item: InventoryItem }) {
  const status = getStockStatus(item)
  if (status === 'out-of-stock') return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Out</Badge>
  if (status === 'low-stock') return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Low</Badge>
  return <Badge variant="success" className="text-[10px] px-1.5 py-0">OK</Badge>
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (!sorted) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
  if (sorted === 'asc') return <ArrowUp className="h-3 w-3 ml-1 text-brand" />
  return <ArrowDown className="h-3 w-3 ml-1 text-brand" />
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-xs text-charcoal-800 dark:text-gray-200 text-right">{value ?? '—'}</span>
    </div>
  )
}

function ExpiryStatusBadge({ item }: { item: InventoryItem }): JSX.Element | null {
  const status = getExpiryStatus(item)
  if (status === 'untracked') return null
  if (status === 'expired') return <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Expired</Badge>
  if (status === 'expiring-3m') return <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">&lt; 3m</Badge>
  if (status === 'expiring-1y') return <Badge variant="warning" className="px-1.5 py-0 text-[10px]">&lt; 1y</Badge>
  return <Badge variant="success" className="px-1.5 py-0 text-[10px]">&gt; 1y</Badge>
}

function LotStatusBadge({ expiryDate }: { expiryDate: string }): JSX.Element {
  const daysUntil = getDaysUntilExpiry(expiryDate)
  if (daysUntil === null) return <Badge variant="secondary" className="text-[10px]">Unknown</Badge>
  if (daysUntil < 0) return <Badge variant="destructive" className="text-[10px]">Expired</Badge>
  if (daysUntil <= 90) return <Badge variant="destructive" className="text-[10px]">&lt; 3m</Badge>
  if (daysUntil < 365) return <Badge variant="warning" className="text-[10px]">&lt; 1y</Badge>
  return <Badge variant="success" className="text-[10px]">&gt; 1y</Badge>
}

export function InventoryTable({
  items,
  loading,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  paginate = false,
}: InventoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [viewTarget, setViewTarget] = useState<InventoryItem | null>(null)
  const viewTargetCoverage = useMemo(
    () => viewTarget ? getTrackedCoverage(viewTarget) : null,
    [viewTarget]
  )
  const viewTargetNextLot = useMemo(
    () => viewTarget ? getNextNonExpiredLot(viewTarget) : null,
    [viewTarget]
  )

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggleVendor(vendor: string) {
    setCollapsedVendors(prev => {
      const next = new Set(prev)
      if (next.has(vendor)) next.delete(vendor)
      else next.add(vendor)
      return next
    })
  }

  function toggleRow(id: string) {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange([...next])
  }

  function toggleVendorRows(vendorItems: InventoryItem[]) {
    const ids = vendorItems.map(i => i.id)
    const allSelected = ids.every(id => selectedSet.has(id))
    const next = new Set(selectedSet)
    if (allSelected) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    onSelectionChange([...next])
  }

  function toggleAll(allVisible: InventoryItem[]) {
    const ids = allVisible.map(i => i.id)
    const allSelected = ids.every(id => selectedSet.has(id))
    const next = new Set(selectedSet)
    if (allSelected) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    onSelectionChange([...next])
  }

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      size: 36,
      header: () => null,
      cell: info => (
        <Checkbox
          checked={selectedSet.has(info.row.original.id)}
          onCheckedChange={() => toggleRow(info.row.original.id)}
          onClick={e => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
    }),
    columnHelper.accessor('itemCode', {
      header: 'Item Code',
      cell: info => <span className="font-mono text-[11px] text-charcoal-700 dark:text-gray-300">{info.getValue()}</span>,
      size: 130,
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: info => (
        <button
          className="text-xs font-medium text-charcoal-800 dark:text-gray-200 hover:text-brand hover:underline text-left leading-tight transition-colors"
          onClick={e => { e.stopPropagation(); setViewTarget(info.row.original) }}
        >
          {info.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: info => info.getValue()
        ? <span className="text-[11px] text-muted-foreground">{info.getValue()}</span>
        : <span className="text-[11px] text-silver-400">—</span>,
      size: 140,
    }),
    columnHelper.accessor('binLocation', {
      header: 'Bin',
      cell: info => info.getValue()
        ? <span className="text-[11px] text-charcoal-700 dark:text-gray-300">{info.getValue()}</span>
        : <span className="text-[11px] text-silver-400">—</span>,
      size: 145,
    }),
    columnHelper.accessor('palletNumber', {
      header: 'Pallet',
      cell: info => info.getValue()
        ? <span className="font-mono text-[11px] text-charcoal-700 dark:text-gray-300">{info.getValue()}</span>
        : <span className="text-[11px] text-silver-400">—</span>,
      size: 110,
    }),
    columnHelper.accessor('onHand', {
      header: 'On Hand',
      cell: info => {
        const v = info.getValue()
        return (
          <span className={cn(
            'font-mono text-xs font-semibold',
            v < 0 ? 'text-destructive' : v === 0 ? 'text-muted-foreground' : 'text-charcoal-800 dark:text-gray-200'
          )}>
            {v.toLocaleString()}
          </span>
        )
      },
      size: 90,
    }),
    columnHelper.display({
      id: 'expiry',
      header: 'Expiry / FIFO',
      cell: info => {
        const item = info.row.original
        if (!item.lotTracking?.length) {
          return <span className="text-[11px] text-silver-400">Not tracked</span>
        }

        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              {(() => {
                const status = getExpiryStatus(item)
                const textClass =
                  status === 'expired' || status === 'expiring-3m'
                    ? 'text-destructive'
                    : status === 'expiring-1y'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                return (
                  <span className={cn('text-[11px] font-medium', textClass)}>
                    {formatExpiryDate(item.expiryDate)}
                  </span>
                )
              })()}
              <ExpiryStatusBadge item={item} />
            </div>
            <div className="text-[10px] text-muted-foreground">
              FIFO: <span className="font-mono">{item.fifoLotNumber || '—'}</span> · {item.lotCount ?? 0} lot{item.lotCount === 1 ? '' : 's'}
            </div>
          </div>
        )
      },
      size: 170,
    }),
    columnHelper.accessor('salesPerWeek', {
      header: 'Sales/Wk',
      cell: info => <span className="font-mono text-xs text-charcoal-700 dark:text-gray-300">{info.getValue().toLocaleString()}</span>,
      size: 80,
    }),
    columnHelper.display({
      id: 'status',
      header: 'Status',
      cell: info => <StatusBadge item={info.row.original} />,
      size: 68,
    }),
    columnHelper.display({
      id: 'actions',
      size: 44,
      header: () => null,
      cell: info => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={() => setViewTarget(info.row.original)}>
              <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View details
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs cursor-pointer" onClick={() => onEdit(info.row.original)}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
              onClick={() => setDeleteTarget(info.row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedSet])

  const effectivePagination = paginate ? pagination : { pageIndex: 0, pageSize: items.length || 1 }

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, pagination: effectivePagination },
    onSortingChange: setSorting,
    onPaginationChange: paginate ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  })

  const sortedRows = table.getRowModel().rows
  const COL_COUNT = 11

  const groupedByVendor = useMemo(() => {
    const groups: { vendor: string; rows: typeof sortedRows }[] = []
    const map = new Map<string, typeof sortedRows>()
    sortedRows.forEach(row => {
      const v = row.original.vendor
      if (!map.has(v)) map.set(v, [])
      map.get(v)!.push(row)
    })
    map.forEach((rows, vendor) => groups.push({ vendor, rows }))
    return groups
  }, [sortedRows])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">Loading inventory…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-800 border-b-2 border-silver-300 dark:border-gray-700">
              <th className="px-3 py-2.5 w-9">
                <Checkbox
                  checked={sortedRows.length > 0 && sortedRows.every(r => selectedSet.has(r.original.id))}
                  onCheckedChange={() => toggleAll(sortedRows.map(r => r.original))}
                  aria-label="Select all"
                />
              </th>
              {table.getHeaderGroups()[0].headers.slice(1).map(header => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className={cn(
                    'px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground select-none whitespace-nowrap',
                    header.column.getCanSort() && 'cursor-pointer hover:text-foreground'
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && <SortIcon sorted={header.column.getIsSorted()} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedByVendor.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No items match your filters.
                </td>
              </tr>
            ) : (
              groupedByVendor.map(({ vendor, rows }) => {
                const isCollapsed = collapsedVendors.has(vendor)
                const vendorItems = rows.map(r => r.original)
                const allVendorSelected = vendorItems.length > 0 && vendorItems.every(i => selectedSet.has(i.id))
                const someVendorSelected = vendorItems.some(i => selectedSet.has(i.id))
                const vendorOnHand = vendorItems.reduce((s, i) => s + i.onHand, 0)
                const vendorSales = vendorItems.reduce((s, i) => s + i.salesPerWeek, 0)
                return (
                  <Fragment key={vendor}>
                    <tr
                      className="cursor-pointer select-none"
                      onClick={() => toggleVendor(vendor)}
                      style={{ background: '#0D2B52' }}
                    >
                      <td className="px-3 py-2 w-9" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={allVendorSelected}
                          data-state={someVendorSelected && !allVendorSelected ? 'indeterminate' : undefined}
                          onCheckedChange={() => toggleVendorRows(vendorItems)}
                          aria-label={`Select all ${vendor}`}
                        />
                      </td>
                      <td colSpan={COL_COUNT - 1} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed
                              ? <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                              : <ChevronDownIcon className="h-3.5 w-3.5 text-white/60" />
                            }
                            <span className="text-[11px] font-bold text-white uppercase tracking-widest">{vendor}</span>
                            <span className="text-[10px] text-blue-300/70 ml-1">({rows.length} items)</span>
                          </div>
                          <div className="flex items-center gap-5 text-[10px] text-blue-200/70">
                            <span>On Hand: <span className="font-mono font-semibold text-white/90">{vendorOnHand.toLocaleString()}</span></span>
                            <span>Sales/Wk: <span className="font-mono font-semibold text-white/90">{vendorSales.toLocaleString()}</span></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && rows.map((row, rowIdx) => (
                      <tr
                        key={row.id}
                        onClick={() => setViewTarget(row.original)}
                        className={cn(
                          'group border-b border-silver-200 dark:border-gray-700 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors cursor-pointer',
                          selectedSet.has(row.original.id)
                            ? 'bg-blue-50/60 dark:bg-blue-900/20'
                            : rowIdx % 2 === 0
                              ? 'bg-white dark:bg-gray-900'
                              : 'bg-gray-50/50 dark:bg-gray-800/30'
                        )}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-3 py-2 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — only when filtered */}
      {paginate && (
        <div className="shrink-0 flex items-center justify-between border-t bg-white dark:bg-gray-900 dark:border-gray-800 px-4 py-2">
          <span className="text-[11px] text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)} ({items.length} items)
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Item count footer — when not paginated */}
      {!paginate && (
        <div className="shrink-0 border-t bg-white dark:bg-gray-900 dark:border-gray-800 px-4 py-2">
          <span className="text-[11px] text-muted-foreground">{items.length} items</span>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget != null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove <strong>{deleteTarget?.description}</strong> ({deleteTarget?.itemCode})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) onDelete(deleteTarget.id); setDeleteTarget(null) }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Item detail dialog */}
      <Dialog open={viewTarget != null} onOpenChange={open => !open && setViewTarget(null)}>
        <DialogContent className="max-w-4xl border-silver-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-sm pr-4 text-charcoal-900 dark:text-gray-100">{viewTarget?.description}</DialogTitle>
            {viewTarget && (
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{viewTarget.itemCode}</span>
                <span>{viewTarget.vendor}</span>
                <ExpiryStatusBadge item={viewTarget} />
              </DialogDescription>
            )}
          </DialogHeader>
          {viewTarget && (
            <div className="mt-1 max-h-[72vh] overflow-y-auto pr-1 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-silver-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Earliest lot</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-charcoal-800 dark:text-gray-100">
                    {viewTarget.lotTracking?.length ? (viewTarget.fifoLotNumber || '—') : 'N/A'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatExpiryDate(viewTarget.expiryDate)}</p>
                </div>

                <div className="rounded-lg border border-silver-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next active lot</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-charcoal-800 dark:text-gray-100">
                    {viewTargetNextLot ? (viewTargetNextLot.lotNumber || '—') : 'N/A'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {viewTargetNextLot
                      ? `${formatExpiryDate(viewTargetNextLot.expiryDate)} · ${getDaysUntilExpiry(viewTargetNextLot.expiryDate)} days`
                      : 'No upcoming non-expired lot'}
                  </p>
                </div>

                <div className="rounded-lg border border-silver-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expired lots</p>
                  <p className={cn(
                    'mt-1 text-sm font-semibold',
                    (viewTarget.expiredLotCount ?? 0) > 0 ? 'text-destructive' : 'text-charcoal-800 dark:text-gray-100'
                  )}>
                    {(viewTarget.expiredLotCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(viewTarget.expiredQuantity ?? 0).toLocaleString()} expired qty
                  </p>
                </div>

                <div className="rounded-lg border border-silver-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracked coverage</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal-800 dark:text-gray-100">
                    {viewTargetCoverage?.coveragePercent != null ? `${viewTargetCoverage.coveragePercent}%` : 'N/A'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {viewTargetCoverage?.status === 'matched' && 'Lot tracking fully matches on hand.'}
                    {viewTargetCoverage?.status === 'partial' && `${Math.abs(viewTargetCoverage.delta).toLocaleString()} units are not covered by lots.`}
                    {viewTargetCoverage?.status === 'over' && `${viewTargetCoverage.delta.toLocaleString()} tracked units exceed on hand.`}
                    {viewTargetCoverage?.status === 'no-on-hand' && 'Coverage is not available for zero or negative on hand.'}
                    {viewTargetCoverage?.status === 'untracked' && 'Expiry tracking is not enabled for this item.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="rounded-lg border border-silver-200 p-4 dark:border-gray-700">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Item Snapshot</p>
                  <DetailRow label="Item Code" value={<span className="font-mono">{viewTarget.itemCode}</span>} />
                  <DetailRow label="Vendor" value={viewTarget.vendor} />
                  <DetailRow label="Category" value={viewTarget.category || '—'} />
                  <DetailRow label="Pref. Vendor" value={viewTarget.prefVendor || '—'} />
                  <DetailRow label="Bin Location" value={viewTarget.binLocation || '—'} />
                  <DetailRow label="Pallet Number" value={viewTarget.palletNumber || '—'} />
                  <div className="my-2 border-t dark:border-gray-700" />
                  <DetailRow label="On Hand" value={
                    <span className={cn('font-mono font-semibold', viewTarget.onHand < 0 && 'text-destructive')}>
                      {viewTarget.onHand.toLocaleString()}
                    </span>
                  } />
                  <DetailRow label="Tracked Qty" value={
                    viewTarget.lotTracking?.length
                      ? <span className="font-mono">{(viewTarget.trackedQuantity ?? 0).toLocaleString()}</span>
                      : 'N/A'
                  } />
                  <DetailRow label="On PO" value={<span className="font-mono">{viewTarget.onPO.toLocaleString()}</span>} />
                  <DetailRow label="Reorder Pt" value={viewTarget.reorderPt != null ? viewTarget.reorderPt.toLocaleString() : '—'} />
                  <DetailRow label="Order Qty" value={viewTarget.order != null ? viewTarget.order.toLocaleString() : '—'} />
                  <DetailRow label="Next Delivery" value={viewTarget.nextDeliv || '—'} />
                  <DetailRow label="Expiry" value={formatExpiryDate(viewTarget.expiryDate)} />
                  <DetailRow label="Tracked Lots" value={viewTarget.lotTracking?.length ? viewTarget.lotCount?.toLocaleString() : 'N/A'} />
                  <DetailRow label="Sales / Week" value={<span className="font-mono">{viewTarget.salesPerWeek.toLocaleString()}</span>} />
                  {viewTarget.salesPerWeek > 0 && (
                    <DetailRow label="Weeks of Stock" value={
                      <span className={cn(
                        'font-mono font-semibold',
                        (viewTarget.onHand / viewTarget.salesPerWeek) < 2 ? 'text-destructive'
                          : (viewTarget.onHand / viewTarget.salesPerWeek) < 4 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}>
                        {(viewTarget.onHand / viewTarget.salesPerWeek).toFixed(1)} wks
                      </span>
                    } />
                  )}
                </div>

                <div className="rounded-lg border border-silver-200 overflow-hidden dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-silver-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lot Breakdown</p>
                        <p className="text-xs text-muted-foreground mt-1">All tracked lots, sorted by earliest expiry.</p>
                      </div>
                      {viewTargetCoverage?.coveragePercent != null && (
                        <Badge variant={viewTargetCoverage.status === 'matched' ? 'success' : viewTargetCoverage.status === 'partial' ? 'warning' : 'info'}>
                          {viewTargetCoverage.coveragePercent}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  {viewTarget.lotTracking?.length ? (
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-silver-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Lot</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Expiry</th>
                            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Qty</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-silver-200 dark:divide-gray-700">
                          {viewTarget.lotTracking.map((lot, lotIndex) => (
                            <tr key={`${lot.lotNumber}-${lot.expiryDate}-${lot.quantity}-${lotIndex}`}>
                              <td className="px-4 py-2">
                                <span className="font-mono text-charcoal-800 dark:text-gray-100">{lot.lotNumber || '—'}</span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{formatExpiryDate(lot.expiryDate)}</td>
                              <td className="px-3 py-2 text-right font-mono text-charcoal-800 dark:text-gray-100">{lot.quantity.toLocaleString()}</td>
                              <td className="px-4 py-2">
                                <div className="flex justify-end">
                                  <LotStatusBadge expiryDate={lot.expiryDate} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-xs text-muted-foreground">
                      No lot-level expiry data is currently tracked for this item.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700 mt-2">
            <Button size="sm" variant="outline" className="dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" onClick={() => { setViewTarget(null); onEdit(viewTarget!) }}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
