import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export type ExportFormat = 'csv' | 'pdf'

export interface ExportFilters {
  vendor?: string
  category?: string
  status?: string
}

interface ExportPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** e.g. "Forecast" or "Inventory" */
  source: string
  filters: ExportFilters
  itemCount: number
  defaultFileName: string
  onExport: (fileName: string, format: ExportFormat) => void
}

export function buildExportFileName(
  source: 'Forecast' | 'Inventory',
  filters: ExportFilters,
): string {
  const parts = ['PT']
  parts.push(source)
  if (filters.vendor && filters.vendor !== 'all') parts.push(filters.vendor)
  if (filters.category && filters.category !== 'all') parts.push(filters.category)
  if (filters.status && filters.status !== 'all') parts.push(filters.status)
  const date = new Date().toISOString().slice(0, 10)
  parts.push(date)
  return parts.join('_').replace(/\s+/g, '-')
}

export function ExportPreviewModal({
  open,
  onOpenChange,
  source,
  filters,
  itemCount,
  defaultFileName,
  onExport,
}: ExportPreviewModalProps): JSX.Element {
  const [fileName, setFileName] = useState(defaultFileName)
  const [format, setFormat] = useState<ExportFormat>('csv')

  // Reset state when modal opens with new defaults
  const handleOpenChange = (next: boolean): void => {
    if (next) {
      setFileName(defaultFileName)
      setFormat('csv')
    }
    onOpenChange(next)
  }

  const handleExport = (): void => {
    onExport(fileName, format)
    onOpenChange(false)
  }

  const activeFilterEntries = Object.entries(filters).filter(
    ([, v]) => v && v !== 'all',
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md dark:bg-gray-900 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-base text-charcoal-800 dark:text-gray-100">
            Export {source}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {itemCount} item{itemCount !== 1 ? 's' : ''} will be exported.
          </DialogDescription>
        </DialogHeader>

        {/* Active filters summary */}
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Active Filters
            </p>
            {activeFilterEntries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeFilterEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-md bg-brand/10 dark:bg-brand/20 px-2 py-0.5 text-[11px] font-medium text-brand dark:text-blue-300"
                  >
                    <span className="text-muted-foreground capitalize">{key}:</span> {value}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No filters — exporting all data.</p>
            )}
          </div>

          {/* Format selection */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Format
            </p>
            <div className="flex gap-2">
              <Button
                variant={format === 'csv' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 flex-1"
                onClick={() => setFormat('csv')}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button
                variant={format === 'pdf' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 flex-1"
                onClick={() => setFormat('pdf')}
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </div>

          {/* Editable file name */}
          <div>
            <Label htmlFor="export-filename" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              File Name
            </Label>
            <div className="flex items-center gap-1.5 mt-1">
              <Input
                id="export-filename"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className="h-8 text-xs font-mono dark:bg-gray-800 dark:border-gray-700"
              />
              <span className="text-xs text-muted-foreground shrink-0">.{format}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={fileName.trim().length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
