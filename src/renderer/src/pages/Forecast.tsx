import { useMemo, useState } from 'react'
import { TrendingDown, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { inventorySeed } from '../lib/inventory-seed'
import { InventoryItem } from '../types/inventory'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'

const RESTOCK_LEAD_WEEKS = 2 // flag items with < 2 weeks runway

function runway(item: InventoryItem): number | null {
  if (item.salesPerWeek <= 0) return null
  return item.onHand / item.salesPerWeek
}

function suggestedOrder(item: InventoryItem): number {
  // order enough to cover 8 weeks of sales
  const target = item.salesPerWeek * 8
  return Math.max(0, Math.ceil(target - item.onHand))
}

function RunwayBadge({ weeks }: { weeks: number | null }) {
  if (weeks === null) return <span className="text-[11px] text-silver-400">N/A</span>
  if (weeks <= 0) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Out</Badge>
  if (weeks < RESTOCK_LEAD_WEEKS) return (
    <span className="font-mono text-xs font-bold text-destructive">{weeks.toFixed(1)} wks</span>
  )
  if (weeks < 4) return (
    <span className="font-mono text-xs font-semibold text-amber-600">{weeks.toFixed(1)} wks</span>
  )
  return <span className="font-mono text-xs text-emerald-600">{weeks.toFixed(1)} wks</span>
}

function MockPODialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const qty = suggestedOrder(item)
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const poNumber = `PO-${Date.now().toString().slice(-6)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 overflow-hidden">
        {/* PO Header */}
        <div style={{ background: '#0D2B52' }} className="px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Purchase Order</p>
              <p className="text-base font-bold">{poNumber}</p>
            </div>
            <FileText className="h-6 w-6 text-white/40" />
          </div>
          <p className="text-[11px] text-white/60 mt-1">{today}</p>
        </div>
        <div className="px-5 py-4 space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vendor</span>
            <span className="font-medium text-charcoal-800">{item.prefVendor || item.vendor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item Code</span>
            <span className="font-mono">{item.itemCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span className="font-medium text-charcoal-800 text-right max-w-[180px]">{item.description}</span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="text-muted-foreground">Current On Hand</span>
            <span className={cn('font-mono font-semibold', item.onHand < 0 && 'text-destructive')}>{item.onHand.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sales / Week</span>
            <span className="font-mono">{item.salesPerWeek.toLocaleString()}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex justify-between">
            <span className="font-semibold text-amber-800">Suggested Order Qty</span>
            <span className="font-mono font-bold text-amber-800 text-sm">{qty.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            * Based on 8-week coverage target from {today}.
              This is a mock document for demonstration purposes.
          </p>
        </div>
        <div className="px-5 pb-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={onClose} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Confirm PO
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Forecast(): JSX.Element {
  const [poItem, setPoItem] = useState<InventoryItem | null>(null)

  const forecastItems = useMemo(() => {
    return inventorySeed
      .filter(i => i.rowType === 'item')
      .map(i => ({ item: i, weeks: runway(i), order: suggestedOrder(i) }))
      .sort((a, b) => {
        // nulls last, then ascending by weeks (critical first)
        if (a.weeks === null) return 1
        if (b.weeks === null) return -1
        return a.weeks - b.weeks
      })
  }, [])

  const criticalCount = forecastItems.filter(r => r.weeks !== null && r.weeks < RESTOCK_LEAD_WEEKS).length

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-charcoal-800">Forecast & Restock</span>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {criticalCount} critical
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Runway = On Hand ÷ Sales/Week · 8-week restock target</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="shrink-0 px-4 py-3 grid grid-cols-3 gap-3">
        <Card className="border-silver-200">
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Critical (&lt;2 wks)</p>
            <p className="text-xl font-bold text-destructive mt-0.5">{forecastItems.filter(r => r.weeks !== null && r.weeks < 2).length}</p>
          </CardContent>
        </Card>
        <Card className="border-silver-200">
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Low (2–4 wks)</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{forecastItems.filter(r => r.weeks !== null && r.weeks >= 2 && r.weeks < 4).length}</p>
          </CardContent>
        </Card>
        <Card className="border-silver-200">
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Healthy (4+ wks)</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{forecastItems.filter(r => r.weeks !== null && r.weeks >= 4).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="rounded-lg border border-silver-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b-2 border-silver-300 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Vendor</th>
                <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">On Hand</th>
                <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Sales/Wk</th>
                <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Runway</th>
                <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Suggested Order</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver-200">
              {forecastItems.map(({ item, weeks, order }) => {
                const isCritical = weeks !== null && weeks < RESTOCK_LEAD_WEEKS
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'hover:bg-gray-50 transition-colors',
                      isCritical && 'bg-red-50/40'
                    )}
                  >
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium text-charcoal-800">{item.description}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.itemCode}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[11px]">{item.vendor}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      <span className={cn(item.onHand < 0 && 'text-destructive')}>
                        {item.onHand.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{item.salesPerWeek.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right"><RunwayBadge weeks={weeks} /></td>
                    <td className="px-3 py-2 text-right">
                      {isCritical ? (
                        <span className="font-mono font-semibold text-amber-700">{order.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isCritical && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => setPoItem(item)}
                        >
                          <FileText className="h-3 w-3" />
                          Mock PO
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {poItem && <MockPODialog item={poItem} onClose={() => setPoItem(null)} />}
    </div>
  )
}
