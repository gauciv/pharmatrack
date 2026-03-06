import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Database } from 'lucide-react'
import { InventoryItem } from '../types/inventory'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'

interface ParsedRow {
  itemCode: string
  description: string
  prefVendor: string
  reorderPt: number | null
  onHand: number
  order: number | null
  onPO: number
  nextDeliv: string
  salesPerWeek: number
}

const EXPECTED_HEADERS = ['item code', 'description', 'pref vendor', 'reorder pt', 'on hand', 'order', 'on po', 'next deliv', 'sales/week']

function parseNumber(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function parseCSV(text: string): { rows: ParsedRow[]; error: string | null; rawHeaders: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return { rows: [], error: 'File is empty.', rawHeaders: [] }

  // Find header row
  const headerIdx = lines.findIndex(l =>
    EXPECTED_HEADERS.some(h => l.toLowerCase().includes(h))
  )
  if (headerIdx === -1) return { rows: [], error: 'Could not find a header row with expected columns.', rawHeaders: [] }

  const rawHeaders = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const lower = rawHeaders.map(h => h.toLowerCase())

  function col(name: string): number {
    return lower.findIndex(h => h.includes(name))
  }

  const idxCode = col('item code')
  const idxDesc = col('description')
  const idxPrefV = col('pref vendor')
  const idxROP = col('reorder pt')
  const idxOnHand = col('on hand')
  const idxOrder = col('order')
  const idxOnPO = col('on po')
  const idxNextDeliv = col('next deliv')
  const idxSales = col('sales')

  if (idxCode === -1 || idxDesc === -1 || idxOnHand === -1) {
    return { rows: [], error: 'Missing required columns: Item Code, Description, On Hand.', rawHeaders }
  }

  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const code = cells[idxCode]
    const desc = cells[idxDesc]
    if (!code || !desc) continue  // skip blank / section-header rows
    rows.push({
      itemCode: code,
      description: desc,
      prefVendor: idxPrefV >= 0 ? cells[idxPrefV] ?? '' : '',
      reorderPt: idxROP >= 0 ? parseNumber(cells[idxROP] ?? '') : null,
      onHand: parseNumber(idxOnHand >= 0 ? cells[idxOnHand] ?? '0' : '0') ?? 0,
      order: idxOrder >= 0 ? parseNumber(cells[idxOrder] ?? '') : null,
      onPO: parseNumber(idxOnPO >= 0 ? cells[idxOnPO] ?? '0' : '0') ?? 0,
      nextDeliv: idxNextDeliv >= 0 ? cells[idxNextDeliv] ?? '' : '',
      salesPerWeek: parseNumber(idxSales >= 0 ? cells[idxSales] ?? '0' : '0') ?? 0,
    })
  }

  return { rows, error: null, rawHeaders }
}

type ImportState = 'idle' | 'preview' | 'importing' | 'done'

export default function DataSync(): JSX.Element {
  const [state, setState] = useState<ImportState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function processFile(file: File): void {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a .csv file.')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { rows: parsed, error } = parseCSV(text)
      setParseError(error)
      setRows(parsed)
      if (!error && parsed.length > 0) setState('preview')
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function handleImport(): Promise<void> {
    setState('importing')
    // Simulate async import (replace with actual service call when Firebase is configured)
    await new Promise(r => setTimeout(r, 1200))
    setImportResult({ imported: rows.length })
    setState('done')
  }

  function reset(): void {
    setState('idle')
    setRows([])
    setFileName('')
    setParseError(null)
    setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b bg-white px-4 py-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-brand" />
        <span className="text-sm font-semibold text-charcoal-800">Data Sync</span>
        <Badge variant="info" className="text-[10px]">CSV Importer</Badge>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* Drop zone */}
        {state === 'idle' && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'rounded-xl border-2 border-dashed transition-all cursor-pointer',
                'flex flex-col items-center justify-center gap-3 py-14 px-6',
                isDragging
                  ? 'border-brand bg-brand-50 scale-[1.01]'
                  : 'border-silver-300 bg-gray-50/50 hover:border-brand/50 hover:bg-brand-50/40'
              )}
            >
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center transition-colors',
                isDragging ? 'bg-brand text-white' : 'bg-silver-100 text-silver-400'
              )}>
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-charcoal-800">
                  {isDragging ? 'Drop to upload' : 'Drag & drop your CSV'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  or <span className="text-brand font-medium">click to browse</span> — accepts .csv files
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Expected columns: Item Code, Description, Pref Vendor, Reorder Pt, On Hand, Order, On PO, Next Deliv, Sales/Week
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </>
        )}

        {/* Parse error */}
        {parseError && (
          <div className="rounded-lg border border-destructive/30 bg-red-50 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Parse error</p>
              <p className="text-xs text-destructive/70 mt-0.5">{parseError}</p>
            </div>
            <button onClick={reset} className="ml-auto text-destructive/50 hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Preview */}
        {state === 'preview' && rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-charcoal-800">{fileName}</span>
                <Badge variant="success" className="text-[10px]">{rows.length} rows parsed</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={reset}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs px-3 gap-1.5" onClick={handleImport}>
                  <Database className="h-3.5 w-3.5" />
                  Import {rows.length} items
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-silver-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      {['Item Code', 'Description', 'On Hand', 'Sales/Wk', 'Pref Vendor'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver-200">
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono text-[11px] text-charcoal-700">{row.itemCode}</td>
                        <td className="px-3 py-1.5 text-charcoal-800 max-w-[220px] truncate">{row.description}</td>
                        <td className={cn('px-3 py-1.5 font-mono font-semibold text-right', row.onHand < 0 && 'text-destructive')}>{row.onHand.toLocaleString()}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{row.salesPerWeek.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.prefVendor || '—'}</td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-center text-xs text-muted-foreground italic">
                          … and {rows.length - 50} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Importing spinner */}
        {state === 'importing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-10 w-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-charcoal-800">Importing {rows.length} items…</p>
            <p className="text-xs text-muted-foreground">Writing to inventory collection</p>
          </div>
        )}

        {/* Done */}
        {state === 'done' && importResult && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-charcoal-800">Import complete</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {importResult.imported} items successfully added to inventory
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2">
              Import another file
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
