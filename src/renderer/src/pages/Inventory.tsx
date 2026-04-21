import { useState, useCallback } from 'react'
import { Search, Filter, RefreshCw, Package, Plus, Trash2, Download } from 'lucide-react'
import { useInventory, InventoryFilters } from '../hooks/useInventory'
import { InventoryTable } from '../components/inventory/InventoryTable'
import { ItemSheet } from '../components/inventory/ItemSheet'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Button } from '../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { InventoryItem } from '../types/inventory'
import { exportInventoryCSV, exportInventoryPDF } from '../lib/inventory-export'
import {
  ExportPreviewModal, buildExportFileName, type ExportFormat,
} from '../components/ExportPreviewModal'

export default function Inventory(): JSX.Element {
  const [filters, setFilters] = useState<InventoryFilters>({
    search: '',
    vendor: 'all',
    category: 'all',
    stockStatus: 'all',
    expiryStatus: 'all',
    binLocation: 'all',
    palletNumber: 'all',
  })

  const {
    items,
    loading,
    vendors,
    categories,
    binLocations,
    palletNumbers,
    total,
    addItem,
    updateItem,
    deleteItem,
    deleteItems,
  } =
    useInventory(filters)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false)
  const exportFilters = {
    vendor: filters.vendor,
    category: filters.category,
    status: filters.stockStatus,
    expiry: filters.expiryStatus,
    binLocation: filters.binLocation,
    palletNumber: filters.palletNumber,
  }
  const exportFileName = buildExportFileName('Inventory', exportFilters)
  const handleExport = useCallback((fileName: string, format: ExportFormat) => {
    if (format === 'csv') exportInventoryCSV(items, fileName)
    else exportInventoryPDF(items, fileName)
  }, [items])

  function openAdd(): void {
    setEditTarget(null)
    setSheetOpen(true)
  }

  function openEdit(item: InventoryItem): void {
    setEditTarget(item)
    setSheetOpen(true)
  }

  async function handleSheetSubmit(data: Omit<InventoryItem, 'id'>): Promise<void> {
    if (editTarget) {
      await updateItem(editTarget.id, data)
    } else {
      await addItem(data)
    }
    setSelectedIds(prev => prev.filter(id => id !== editTarget?.id))
  }

  async function handleDelete(id: string): Promise<void> {
    await deleteItem(id)
    setSelectedIds(prev => prev.filter(sid => sid !== id))
  }

  async function handleBulkDelete(): Promise<void> {
    await deleteItems(selectedIds)
    setSelectedIds([])
    setBulkDeleteOpen(false)
  }

  function resetFilters(): void {
    setFilters({
      search: '',
      vendor: 'all',
      category: 'all',
      stockStatus: 'all',
      expiryStatus: 'all',
      binLocation: 'all',
      palletNumber: 'all',
    })
  }

  const hasActiveFilters =
    filters.search !== '' || filters.vendor !== 'all' ||
    filters.category !== 'all' || filters.stockStatus !== 'all' || filters.expiryStatus !== 'all' ||
    filters.binLocation !== 'all' || filters.palletNumber !== 'all'

  return (
    <>
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-4 py-3 space-y-3 transition-colors duration-200">
        {/* Title + actions row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Inventory Items</span>
            <Badge variant="info" className="text-[10px] font-mono">
              {items.length} / {total}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3 w-3" />
                Delete {selectedIds.length} selected
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1.5"
              onClick={() => setExportOpen(true)}
              disabled={items.length === 0}
            >
              <Download className="h-3 w-3" /> Export
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 px-2 text-xs text-muted-foreground gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </Button>
            )}
            <Button size="sm" className="h-7 px-3 text-xs gap-1.5" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add New Item
            </Button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search code, description, bin, or pallet…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-8 h-8 text-xs bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700"
            />
          </div>
          <Select value={filters.vendor} onValueChange={v => setFilters(f => ({ ...f, vendor: v }))}>
            <SelectTrigger className="h-8 text-xs w-[170px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
            <SelectTrigger className="h-8 text-xs w-[170px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filters.stockStatus}
            onValueChange={v => setFilters(f => ({ ...f, stockStatus: v as InventoryFilters['stockStatus'] }))}
          >
            <SelectTrigger className="h-8 text-xs w-[140px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="low-stock">Low Stock</SelectItem>
              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.expiryStatus}
            onValueChange={v => setFilters(f => ({ ...f, expiryStatus: v as InventoryFilters['expiryStatus'] }))}
          >
            <SelectTrigger className="h-8 text-xs w-[180px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="Expiry tracking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All expiry</SelectItem>
              <SelectItem value="untracked">Untracked</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="expiring-3m">Less than 3 months</SelectItem>
              <SelectItem value="expiring-1y">Less than 1 year</SelectItem>
              <SelectItem value="expiring-over-1y">More than 1 year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.binLocation} onValueChange={v => setFilters(f => ({ ...f, binLocation: v }))}>
            <SelectTrigger className="h-8 text-xs w-[190px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="All bins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bins</SelectItem>
              {binLocations.map((bin) => <SelectItem key={bin} value={bin}>{bin}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.palletNumber} onValueChange={v => setFilters(f => ({ ...f, palletNumber: v }))}>
            <SelectTrigger className="h-8 text-xs w-[170px] bg-gray-50 dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="All pallets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pallets</SelectItem>
              {palletNumbers.map((pallet) => <SelectItem key={pallet} value={pallet}>{pallet}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <InventoryTable
        items={items}
        loading={loading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onEdit={openEdit}
        onDelete={handleDelete}
        paginate={hasActiveFilters}
      />
    </div>

      {/* Add / Edit sheet */}
      <ItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        item={editTarget}
        vendors={vendors}
        categories={categories}
        binLocations={binLocations}
        palletNumbers={palletNumbers}
        onSubmit={handleSheetSubmit}
      />

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedIds.length} selected items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>
              Delete {selectedIds.length} items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export preview */}
      <ExportPreviewModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        source="Inventory"
        filters={exportFilters}
        itemCount={items.length}
        defaultFileName={exportFileName}
        onExport={handleExport}
      />
    </>
  )
}
