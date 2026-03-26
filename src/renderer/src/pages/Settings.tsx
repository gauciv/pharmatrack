import { useState } from 'react'
import {
  Download, Trash2, AlertTriangle, ChevronDown, ChevronRight,
  FileSpreadsheet, Loader2, FileText, Settings as SettingsIcon,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useInventory } from '../hooks/useInventory'
import { InventoryItem } from '../types/inventory'
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
import { cn } from '../lib/utils'
import { formatExpiryDate } from '../lib/inventory-expiry'
import { downloadPdf, downloadTextFile } from '../lib/export-download'

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportToCSV(items: InventoryItem[]): void {
  const headers = ['Item Code', 'Description', 'Vendor', 'Category', 'Pref Vendor',
    'On Hand', 'Expiry', 'FIFO Lot', 'Expired Qty', 'Reorder Pt', 'Order Qty', 'On PO', 'Next Delivery', 'Sales/Week']
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = items.map(i => [
    escape(i.itemCode), escape(i.description), escape(i.vendor),
    escape(i.category), escape(i.prefVendor), i.onHand,
    escape(formatExpiryDate(i.expiryDate)), escape(i.fifoLotNumber), i.expiredQuantity ?? 0,
    i.reorderPt ?? '', i.order ?? '', i.onPO, escape(i.nextDeliv), i.salesPerWeek,
  ].join(','))
  const content = [headers.join(','), ...rows].join('\n')
  downloadTextFile(
    content,
    `pharma-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;'
  )
}

function exportToPDF(items: InventoryItem[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(13, 43, 82)
  doc.text('PharmaTrack — Inventory Report', 14, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${new Date().toLocaleString()} · ${items.length} items`, 14, 21)
  doc.setFontSize(8)
  doc.text('Columns: item, vendor, stock, expiry/FIFO, expired quantity, purchasing metrics', 14, 26)

  autoTable(doc, {
    startY: 30,
    theme: 'grid',
    head: [['Item Code', 'Description', 'Vendor', 'Category', 'On Hand', 'Expiry', 'FIFO Lot', 'Expired Qty', 'On PO', 'Sales/Wk']],
    body: items.map(i => [
      i.itemCode,
      i.description,
      i.vendor,
      i.category ?? '—',
      i.onHand.toLocaleString(),
      formatExpiryDate(i.expiryDate),
      i.fifoLotNumber || '—',
      (i.expiredQuantity ?? 0).toLocaleString(),
      i.onPO.toLocaleString(),
      i.salesPerWeek.toLocaleString(),
    ]),
    styles: {
      fontSize: 6.5,
      cellPadding: 1.8,
      lineColor: [220, 226, 232],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [16, 96, 192],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [235, 243, 255] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 58 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  downloadPdf(doc, `pharma-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, description, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-silver-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-colors duration-200">
      <div className="px-5 py-4 border-b border-silver-200 dark:border-gray-800 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 dark:bg-blue-900/30">
          <Icon className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings(): JSX.Element {
  const emptyFilters = {
    search: '',
    vendor: 'all',
    category: 'all',
    stockStatus: 'all' as const,
    expiryStatus: 'all' as const,
  }
  const { allItems, deleteItems } = useInventory(emptyFilters)
  const existingItems = allItems.filter(i => i.rowType === 'item')
  const existingCount = existingItems.length

  // ── Export state ──
  const [exportingCSV, setExportingCSV] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  // ── Danger zone ──
  const [dangerOpen, setDangerOpen] = useState(false)
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false)
  const [wiping, setWiping] = useState(false)

  // ── Export handlers ──

  async function handleExportCSV(): Promise<void> {
    setExportingCSV(true)
    try {
      exportToCSV(existingItems)
    } finally {
      setExportingCSV(false)
    }
  }

  async function handleExportPDF(): Promise<void> {
    setExportingPDF(true)
    try {
      exportToPDF(existingItems)
    } finally {
      setExportingPDF(false)
    }
  }

  // ── Wipe handler ──

  async function handleWipeAll(): Promise<void> {
    setWiping(true)
    try {
      await deleteItems(existingItems.map(i => i.id))
      setWipeConfirmOpen(false)
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Page title */}
        <div className="flex items-center gap-2.5">
          <SettingsIcon className="h-5 w-5 text-brand" />
          <div>
            <h2 className="text-base font-bold text-charcoal-800 dark:text-gray-100">Settings</h2>
            <p className="text-xs text-muted-foreground">Manage data export and system configuration</p>
          </div>
        </div>

        {/* ── Data Export ── */}
        <Section
          icon={Download}
          title="Data Export"
          description={`Export current inventory data (${existingCount} items) to CSV or PDF.`}
        >
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportCSV}
              disabled={exportingCSV || existingCount === 0}
            >
              {exportingCSV
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
              Export as CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportPDF}
              disabled={exportingPDF || existingCount === 0}
            >
              {exportingPDF
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileText className="h-3.5 w-3.5 text-red-500" />}
              Export as PDF
            </Button>
          </div>
          {existingCount === 0 && (
            <p className="text-xs text-muted-foreground mt-3">No inventory data to export.</p>
          )}
        </Section>

        {/* ── Danger Zone ── */}
        <div className={cn(
          'rounded-lg border-2 overflow-hidden transition-all duration-200',
          dangerOpen
            ? 'border-destructive/50 dark:border-destructive/40'
            : 'border-destructive/30 dark:border-destructive/30'
        )}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            onClick={() => setDangerOpen(prev => !prev)}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">Danger Zone</span>
            </div>
            {dangerOpen
              ? <ChevronDown className="h-4 w-4 text-destructive/60" />
              : <ChevronRight className="h-4 w-4 text-destructive/60" />
            }
          </button>

          {dangerOpen && (
            <div className="px-5 py-4 bg-white dark:bg-gray-900 border-t border-destructive/20 dark:border-destructive/20 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Wipe All Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently delete all {existingCount} inventory items. This cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={existingCount === 0}
                  onClick={() => setWipeConfirmOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Wipe All Data
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Confirm wipe all ── */}
      <AlertDialog open={wipeConfirmOpen} onOpenChange={open => !open && setWipeConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Wipe all inventory data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all <strong>{existingCount} inventory items</strong>.
              There is no way to recover this data after deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWipeAll} disabled={wiping}>
              {wiping ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </span>
              ) : (
                `Delete all ${existingCount} items`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
