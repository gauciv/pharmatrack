import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ForecastRow } from './forecast-utils'

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportForecastCSV(rows: ForecastRow[]): void {
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
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pharma-forecast-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportForecastPDF(rows: ForecastRow[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(13, 43, 82)
  doc.text('PharmaTracker \u2014 Forecast Report', 14, 14)

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

  autoTable(doc, {
    startY: 26,
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
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [16, 96, 192], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [235, 243, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
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

  doc.save(`pharma-forecast-${new Date().toISOString().slice(0, 10)}.pdf`)
}
