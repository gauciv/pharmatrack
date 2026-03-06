import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  ChevronRight, ChevronDown as ChevronDownIcon,
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
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { cn } from '../../lib/utils'

interface InventoryTableProps {
  items: InventoryItem[]
  loading: boolean
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
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
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-xs text-charcoal-800 text-right">{value ?? '—'}</span>
    </div>
  )
}

export function InventoryTable({
  items,
  loading,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
}: InventoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [viewTarget, setViewTarget] = useState<InventoryItem | null>(null)

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
    onSelectionChange(allSelected ? [] : ids)
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
      cell: info => <span className="font-mono text-[11px] text-charcoal-700">{info.getValue()}</span>,
      size: 130,
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: info => (
        <button
          className="text-xs font-medium text-charcoal-800 hover:text-brand hover:underline text-left leading-tight transition-colors"
          onClick={() => setViewTarget(info.row.original)}
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
    columnHelper.accessor('onHand', {
      header: 'On Hand',
      cell: info => {
        const v = info.getValue()
        return (
          <span className={cn(
            'font-mono text-xs font-semibold',
            v < 0 ? 'text-destructive' : v === 0 ? 'text-muted-foreground' : 'text-charcoal-800'
          )}>
            {v.toLocaleString()}
          </span>
        )
      },
      size: 90,
    }),
    columnHelper.accessor('salesPerWeek', {
      header: 'Sales/Wk',
      cell: info => <span className="font-mono text-xs text-charcoal-700">{info.getValue().toLocaleString()}</span>,
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

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const sortedRows = table.getRowModel().rows
  const COL_COUNT = 8

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
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b-2 border-silver-300">
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
                  <>
                    <tr key={`vendor-${vendor}`}
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
                        className={cn(
                          'group border-b border-silver-200 hover:bg-brand-50 transition-colors',
                          selectedSet.has(row.original.id) ? 'bg-blue-50/60'
                            : rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        )}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-3 py-2 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm pr-4">{viewTarget?.description}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="mt-1">
              <DetailRow label="Item Code" value={<span className="font-mono">{viewTarget.itemCode}</span>} />
              <DetailRow label="Vendor" value={viewTarget.vendor} />
              <DetailRow label="Category" value={viewTarget.category || '—'} />
              <DetailRow label="Pref. Vendor" value={viewTarget.prefVendor || '—'} />
              <div className="my-2 border-t" />
              <DetailRow label="On Hand" value={
                <span className={cn('font-mono font-semibold', viewTarget.onHand < 0 && 'text-destructive')}>
                  {viewTarget.onHand.toLocaleString()}
                </span>
              } />
              <DetailRow label="On PO" value={<span className="font-mono">{viewTarget.onPO.toLocaleString()}</span>} />
              <DetailRow label="Reorder Pt" value={viewTarget.reorderPt != null ? viewTarget.reorderPt.toLocaleString() : '—'} />
              <DetailRow label="Order Qty" value={viewTarget.order != null ? viewTarget.order.toLocaleString() : '—'} />
              <DetailRow label="Next Delivery" value={viewTarget.nextDeliv || '—'} />
              <DetailRow label="Sales / Week" value={<span className="font-mono">{viewTarget.salesPerWeek.toLocaleString()}</span>} />
              {viewTarget.salesPerWeek > 0 && (
                <DetailRow label="Weeks of Stock" value={
                  <span className={cn(
                    'font-mono font-semibold',
                    (viewTarget.onHand / viewTarget.salesPerWeek) < 2 ? 'text-destructive'
                      : (viewTarget.onHand / viewTarget.salesPerWeek) < 4 ? 'text-amber-600'
                      : 'text-emerald-600'
                  )}>
                    {(viewTarget.onHand / viewTarget.salesPerWeek).toFixed(1)} wks
                  </span>
                } />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button size="sm" variant="outline" onClick={() => { setViewTarget(null); onEdit(viewTarget!) }}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
