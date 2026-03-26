import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { InventoryItem, getStockStatus } from '../types/inventory'
import { formatExpiryDate } from './inventory-expiry'
import { downloadPdf, downloadTextFile } from './export-download'

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportInventoryCSV(items: InventoryItem[], fileName?: string): void {
  const headers = [
    'Item Code', 'Description', 'Vendor', 'Category', 'Pref. Vendor',
    'Reorder Pt', 'On Hand', 'Expiry', 'FIFO Lot', 'Expired Qty', 'Order', 'On PO', 'Next Delivery',
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
    escape(formatExpiryDate(i.expiryDate)),
    escape(i.fifoLotNumber || ''),
    i.expiredQuantity ?? 0,
    i.order ?? '',
    i.onPO,
    escape(i.nextDeliv || ''),
    i.salesPerWeek,
    getStockStatus(i),
  ].join(','))

  const content = [headers.join(','), ...csvRows].join('\n')
  downloadTextFile(
    content,
    `${fileName || `pharma-inventory-${new Date().toISOString().slice(0, 10)}`}.csv`,
    'text/csv;charset=utf-8;'
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportInventoryPDF(items: InventoryItem[], fileName?: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(13, 43, 82)
  doc.text('PharmaTrack \u2014 Inventory Report', 14, 14)

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

  const expiredTracked = items.filter(i => (i.expiredQuantity ?? 0) > 0).length
  doc.setFontSize(8)
  doc.text(
    `Columns: Code, description, vendor, quantity, expiry/FIFO, stock status \u00b7 ${expiredTracked} tracked products with expired quantity`,
    14,
    26
  )

  autoTable(doc, {
    startY: 30,
    theme: 'grid',
    head: [['Item Code', 'Description', 'Vendor', 'Category', 'On Hand', 'Expiry', 'FIFO Lot', 'Expired Qty', 'On PO', 'Sales/Wk', 'Status']],
    body: items.map(i => [
      i.itemCode,
      i.description,
      i.vendor,
      i.category || '\u2014',
      i.onHand.toLocaleString(),
      formatExpiryDate(i.expiryDate),
      i.fifoLotNumber || '\u2014',
      (i.expiredQuantity ?? 0).toLocaleString(),
      i.onPO.toLocaleString(),
      i.salesPerWeek.toLocaleString(),
      getStockStatus(i).replace('-', ' '),
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
      1: { cellWidth: 48 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { cellWidth: 14, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < items.length) {
        const item = items[data.row.index]
        const status = getStockStatus(item)
        if (item.hasExpiredStock) data.cell.styles.fillColor = [255, 236, 236]
        else if (status === 'out-of-stock') data.cell.styles.fillColor = [254, 226, 226]
        else if (status === 'low-stock') data.cell.styles.fillColor = [254, 243, 199]
      }
    },
  })

  downloadPdf(doc, `${fileName || `pharma-inventory-${new Date().toISOString().slice(0, 10)}`}.pdf`)
}
