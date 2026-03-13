import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { InventoryItem, getStockStatus } from '../types/inventory'

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportInventoryCSV(items: InventoryItem[], fileName?: string): void {
  const headers = [
    'Item Code', 'Description', 'Vendor', 'Category', 'Pref. Vendor',
    'Reorder Pt', 'On Hand', 'Order', 'On PO', 'Next Delivery',
    'Sales/Wk', 'Stock Status',
  ]

  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const csvRows = items.map(i => [
    escape(i.itemCode),
    escape(i.description),
    escape(i.vendor),
    escape(i.category || ''),
    escape(i.prefVendor || ''),
    i.reorderPt ?? '',
    i.onHand,
    i.order ?? '',
    i.onPO,
    escape(i.nextDeliv || ''),
    i.salesPerWeek,
    getStockStatus(i),
  ].join(','))

  const content = [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName || `pharma-inventory-${new Date().toISOString().slice(0, 10)}`}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportInventoryPDF(items: InventoryItem[], fileName?: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(13, 43, 82)
  doc.text('PharmaTracker \u2014 Inventory Report', 14, 14)

  // Subtitle
  const inStock = items.filter(i => getStockStatus(i) === 'in-stock').length
  const lowStock = items.filter(i => getStockStatus(i) === 'low-stock').length
  const outOfStock = items.filter(i => getStockStatus(i) === 'out-of-stock').length
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Generated: ${new Date().toLocaleString()} \u00b7 ${items.length} items \u00b7 ${inStock} in-stock, ${lowStock} low, ${outOfStock} out-of-stock`,
    14, 21
  )

  autoTable(doc, {
    startY: 26,
    head: [['Item Code', 'Description', 'Vendor', 'Category', 'On Hand', 'Reorder Pt', 'On PO', 'Sales/Wk', 'Status']],
    body: items.map(i => [
      i.itemCode,
      i.description,
      i.vendor,
      i.category || '\u2014',
      i.onHand.toLocaleString(),
      i.reorderPt !== null ? i.reorderPt.toLocaleString() : '\u2014',
      i.onPO.toLocaleString(),
      i.salesPerWeek.toLocaleString(),
      getStockStatus(i).replace('-', ' '),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [16, 96, 192], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [235, 243, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < items.length) {
        const status = getStockStatus(items[data.row.index])
        if (status === 'out-of-stock') data.cell.styles.fillColor = [254, 226, 226]
        else if (status === 'low-stock') data.cell.styles.fillColor = [254, 243, 199]
      }
    },
  })

  doc.save(`${fileName || `pharma-inventory-${new Date().toISOString().slice(0, 10)}`}.pdf`)
}
