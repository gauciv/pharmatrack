import { useMemo, useState } from 'react'
import { Building2, Package, TrendingUp, ChevronRight, Loader2 } from 'lucide-react'
import { useInventory, InventoryFilters } from '../hooks/useInventory'
import { InventoryItem } from '../types/inventory'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet'

interface VendorStat {
  name: string
  skus: number
  onHand: number
  salesPerWeek: number
  categories: string[]
  items: InventoryItem[]
}

const VENDOR_COLORS = ['#1060C0', '#0D2B52', '#3B82F6', '#2563EB', '#7C3AED', '#6B7280', '#0891B2', '#059669']

const emptyFilters: InventoryFilters = {
  search: '', vendor: 'all', category: 'all', stockStatus: 'all',
}

export default function Vendors(): JSX.Element {
  const { allItems, loading } = useInventory(emptyFilters)
  const [selectedVendor, setSelectedVendor] = useState<VendorStat | null>(null)

  const vendors = useMemo<VendorStat[]>(() => {
    const map = new Map<string, VendorStat>()
    allItems.filter(i => i.rowType === 'item').forEach(item => {
      const v = map.get(item.vendor) ?? {
        name: item.vendor,
        skus: 0,
        onHand: 0,
        salesPerWeek: 0,
        categories: [],
        items: [],
      }
      v.skus += 1
      v.onHand += item.onHand
      v.salesPerWeek += item.salesPerWeek
      if (item.category && !v.categories.includes(item.category)) v.categories.push(item.category)
      v.items.push(item)
      map.set(item.vendor, v)
    })
    return [...map.values()].sort((a, b) => b.onHand - a.onHand)
  }, [allItems])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="shrink-0 border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-4 py-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brand" />
        <span className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Vendor Directory</span>
        <Badge variant="info" className="text-[10px]">{vendors.length} suppliers</Badge>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-3">
          {vendors.map((v, i) => (
            <button
              key={v.name}
              className="w-full text-left rounded-lg border border-silver-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand/40 hover:shadow-sm dark:hover:border-brand/50 transition-all group"
              onClick={() => setSelectedVendor(v)}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: VENDOR_COLORS[i % VENDOR_COLORS.length] }}
                >
                  {v.name.slice(0, 2).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-charcoal-800 dark:text-gray-100 truncate">{v.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3" />{v.skus} SKUs
                    </span>
                    {v.categories.length > 0 && (
                      <span className="text-[10px] text-silver-400">
                        {v.categories.slice(0, 2).join(', ')}{v.categories.length > 2 ? ` +${v.categories.length - 2}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                {/* Stats */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs font-mono font-semibold text-charcoal-800 dark:text-gray-100">{v.onHand.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">on hand</p>
                </div>
                <div className="shrink-0 text-right hidden md:block ml-4">
                  <p className="text-xs font-mono font-semibold text-charcoal-700 dark:text-gray-200 flex items-center gap-0.5">
                    {v.salesPerWeek >= 5000 && <TrendingUp className="h-3 w-3 text-amber-500" />}
                    {v.salesPerWeek.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">sales/wk</p>
                </div>
                <ChevronRight className="h-4 w-4 text-silver-400 group-hover:text-brand transition-colors ml-2 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Vendor detail sheet */}
      <Sheet open={selectedVendor != null} onOpenChange={open => !open && setSelectedVendor(null)}>
        <SheetContent side="right" className="w-full max-w-md flex flex-col p-0">
          <SheetHeader>
            {selectedVendor && (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: VENDOR_COLORS[vendors.findIndex(v => v.name === selectedVendor.name) % VENDOR_COLORS.length] }}
                  >
                    {selectedVendor.name.slice(0, 2).toUpperCase()}
                  </div>
                  <SheetTitle>{selectedVendor.name}</SheetTitle>
                </div>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SKUs</p>
                    <p className="text-lg font-bold text-charcoal-800 dark:text-gray-100">{selectedVendor.skus}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">On Hand</p>
                    <p className="text-lg font-bold text-charcoal-800 dark:text-gray-100">{selectedVendor.onHand.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sales/Wk</p>
                    <p className="text-lg font-bold text-charcoal-800 dark:text-gray-100">{selectedVendor.salesPerWeek.toLocaleString()}</p>
                  </div>
                </div>
                {selectedVendor.categories.length > 0 && (
                  <SheetDescription className="flex flex-wrap gap-1 mt-1">
                    {selectedVendor.categories.map(c => (
                      <span key={c} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-900/30 text-brand border border-blue-100 dark:border-blue-800">{c}</span>
                    ))}
                  </SheetDescription>
                )}
              </>
            )}
          </SheetHeader>

          {selectedVendor && (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">On Hand</th>
                    <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Sales/Wk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silver-200 dark:divide-gray-700">
                  {selectedVendor.items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <p className="font-medium text-charcoal-800 dark:text-gray-200 leading-tight">{item.description}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.itemCode}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={cn('font-semibold dark:text-gray-200', item.onHand < 0 && 'text-destructive')}>
                          {item.onHand.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono dark:text-gray-300">{item.salesPerWeek.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
