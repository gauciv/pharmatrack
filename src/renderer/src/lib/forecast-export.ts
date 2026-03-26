import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ForecastRow } from './forecast-utils'
import { downloadPdf, downloadTextFile } from './export-download'

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportForecastCSV(rows: ForecastRow[], fileName?: string): void {
  const headers = [
    'Item Code', 'Description', 'Vendor', 'Category',
    'On Hand', 'Sales/Wk', 'Runway (wks)', 'Status', 'Suggested Order',
  ]

  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const csvRows = rows.map(r => [
    escape(r.item.itemCode),
    escape(r.item.description),
    escape(r.item.vendor),
    escape(r.item.category || ''),
    r.item.onHand,
    r.item.salesPerWeek,
    r.runwayWeeks !== null ? r.runwayWeeks.toFixed(1) : 'N/A',
    r.status,
    r.suggestedOrder > 0 ? r.suggestedOrder : '',
  ].join(','))

  const content = [headers.join(','), ...csvRows].join('\n')
  downloadTextFile(
    content,
    `${fileName || `pharma-forecast-${new Date().toISOString().slice(0, 10)}`}.csv`,
    'text/csv;charset=utf-8;'
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportForecastPDF(rows: ForecastRow[], fileName?: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(13, 43, 82)
  doc.text('PharmaTrack \u2014 Forecast Report', 14, 14)

  // Subtitle
  const criticalCount = rows.filter(r => r.status === 'critical').length
  const lowCount = rows.filter(r => r.status === 'low').length
  const healthyCount = rows.filter(r => r.status === 'healthy').length
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Generated: ${new Date().toLocaleString()} \u00b7 ${rows.length} items \u00b7 ${criticalCount} critical, ${lowCount} low, ${healthyCount} healthy`,
    14, 21
  )
  doc.setFontSize(8)
  doc.text('Columns: stock on hand, weekly demand, runway, priority, and suggested reorder quantity', 14, 26)

  autoTable(doc, {
    startY: 30,
    theme: 'grid',
    head: [['Item Code', 'Description', 'Vendor', 'Category', 'On Hand', 'Sales/Wk', 'Runway', 'Status', 'Sugg. Order']],
    body: rows.map(r => [
      r.item.itemCode,
      r.item.description,
      r.item.vendor,
      r.item.category || '\u2014',
      r.item.onHand.toLocaleString(),
      r.item.salesPerWeek.toLocaleString(),
      r.runwayWeeks !== null ? `${r.runwayWeeks.toFixed(1)} wks` : 'N/A',
      r.status,
      r.suggestedOrder > 0 ? r.suggestedOrder.toLocaleString() : '\u2014',
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
      1: { cellWidth: 54 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { cellWidth: 16, halign: 'center' },
      8: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < rows.length) {
        const status = rows[data.row.index]?.status
        if (status === 'critical') data.cell.styles.fillColor = [254, 226, 226]
        else if (status === 'low') data.cell.styles.fillColor = [254, 243, 199]
      }
    },
  })

  downloadPdf(doc, `${fileName || `pharma-forecast-${new Date().toISOString().slice(0, 10)}`}.pdf`)
}
