import { useMemo, useState } from 'react'
import {
  TrendingDown, AlertTriangle, ChevronRight, List, Building2,
  FileSpreadsheet, FileText, Filter,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { useInventory, InventoryFilters } from '../hooks/useInventory'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '../components/ui/select'
import { cn } from '../lib/utils'
import {
  ForecastRow, buildForecastRows, buildRunwayBuckets, buildVendorPriority,
  RESTOCK_LEAD_WEEKS,
} from '../lib/forecast-utils'
import { exportForecastCSV, exportForecastPDF } from '../lib/forecast-export'

// ─── Sub-components ───────────────────────────────────────────────────────────

function RunwayBadge({ weeks }: { weeks: number | null }): JSX.Element {
  if (weeks === null) return <span className="text-[11px] text-silver-400">N/A</span>
  if (weeks <= 0) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Out</Badge>
  if (weeks < RESTOCK_LEAD_WEEKS)
    return <span className="font-mono text-xs font-bold text-destructive">{weeks.toFixed(1)} wks</span>
  if (weeks < 4)
    return <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">{weeks.toFixed(1)} wks</span>
  return <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{weeks.toFixed(1)} wks</span>
}

const TOOLTIP_STYLE = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 6,
  border: 'none',
  boxShadow: '0 2px 8px rgba(0,0,0,.15)',
}

// ─── Forecast table (shared between flat & grouped views) ─────────────────────

function ForecastTable({
  rows,
  showVendor = true,
}: {
  rows: ForecastRow[]
  showVendor?: boolean
}): JSX.Element {
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 dark:bg-gray-800 border-b-2 border-silver-300 dark:border-gray-700 sticky top-0">
        <tr>
          <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Description</th>
          {showVendor && (
            <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Vendor</th>
          )}
          <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Category</th>
          <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">On Hand</th>
          <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Sales/Wk</th>
          <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Runway</th>
          <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Sugg. Order</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-silver-200 dark:divide-gray-700">
        {rows.map(({ item, runwayWeeks, status, suggestedOrder }) => (
          <tr
            key={item.id}
            className={cn(
              'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
              status === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
              status === 'low' && 'bg-amber-50/30 dark:bg-amber-950/10',
            )}
          >
            <td className="px-3 py-2">
              <p className="font-medium text-charcoal-800 dark:text-gray-200">{item.description}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{item.itemCode}</p>
            </td>
            {showVendor && (
              <td className="px-3 py-2 text-muted-foreground text-[11px]">{item.vendor}</td>
            )}
            <td className="px-3 py-2 text-muted-foreground text-[11px]">{item.category || '\u2014'}</td>
            <td className="px-3 py-2 text-right font-mono font-semibold">
              <span className={cn(item.onHand < 0 && 'text-destructive', 'dark:text-gray-200')}>
                {item.onHand.toLocaleString()}
              </span>
            </td>
            <td className="px-3 py-2 text-right font-mono dark:text-gray-300">{item.salesPerWeek.toLocaleString()}</td>
            <td className="px-3 py-2 text-right"><RunwayBadge weeks={runwayWeeks} /></td>
            <td className="px-3 py-2 text-right">
              {(status === 'critical' || status === 'low') && suggestedOrder > 0 ? (
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{suggestedOrder.toLocaleString()}</span>
              ) : (
                <span className="text-muted-foreground text-[11px]">{'\u2014'}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Vendor-grouped view ──────────────────────────────────────────────────────

function VendorGroupedView({ rows }: { rows: ForecastRow[] }): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, ForecastRow[]>()
    for (const r of rows) {
      const v = r.item.vendor
      if (!map.has(v)) map.set(v, [])
      map.get(v)!.push(r)
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => {
        const ac = a.filter(r => r.status === 'critical' || r.status === 'low').length
        const bc = b.filter(r => r.status === 'critical' || r.status === 'low').length
        return bc - ac
      })
  }, [rows])

  const toggle = (vendor: string): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(vendor)) next.delete(vendor)
      else next.add(vendor)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {groups.map(([vendor, vendorRows]) => {
        const isOpen = expanded.has(vendor)
        const criticalCount = vendorRows.filter(r => r.status === 'critical').length
        const lowCount = vendorRows.filter(r => r.status === 'low').length
        const totalOnHand = vendorRows.reduce((s, r) => s + r.item.onHand, 0)

        return (
          <div key={vendor} className="rounded-lg border border-silver-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggle(vendor)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
            >
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-90')} />
              <span className="text-sm font-semibold text-charcoal-800 dark:text-gray-100 flex-1">{vendor}</span>
              {criticalCount > 0 && <Badge variant="destructive" className="text-[10px]">{criticalCount} critical</Badge>}
              {lowCount > 0 && <Badge variant="warning" className="text-[10px]">{lowCount} low</Badge>}
              <span className="text-xs text-muted-foreground">{vendorRows.length} items</span>
              <span className="text-xs font-mono text-muted-foreground">{totalOnHand.toLocaleString()} on hand</span>
            </button>
            {isOpen && (
              <div className="border-t border-silver-200 dark:border-gray-700">
                <ForecastTable rows={vendorRows} showVendor={false} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const emptyFilters: InventoryFilters = {
  search: '', vendor: 'all', category: 'all', stockStatus: 'all',
}

export default function Forecast(): JSX.Element {
  const { allItems, vendors, categories } = useInventory(emptyFilters)

  // Filter state
  const [vendorFilter, setVendorFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'low' | 'healthy'>('all')
  const [viewMode, setViewMode] = useState<'flat' | 'vendor'>('flat')

  // Compute forecast rows with filters
  const forecastRows = useMemo(() => {
    let items = allItems
    if (vendorFilter !== 'all') items = items.filter(i => i.vendor === vendorFilter)
    if (categoryFilter !== 'all') items = items.filter(i => i.category === categoryFilter)
    let rows = buildForecastRows(items)
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter)
    return rows
  }, [allItems, vendorFilter, categoryFilter, statusFilter])

  // Chart data
  const runwayBuckets = useMemo(() => buildRunwayBuckets(forecastRows), [forecastRows])
  const vendorPriority = useMemo(() => buildVendorPriority(forecastRows), [forecastRows])

  // KPI counts
  const criticalCount = forecastRows.filter(r => r.status === 'critical').length
  const lowCount = forecastRows.filter(r => r.status === 'low').length
  const healthyCount = forecastRows.filter(r => r.status === 'healthy').length
  const noDataCount = forecastRows.filter(r => r.status === 'no-data').length

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* ── Header ── */}
      <div className="shrink-0 border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Forecast & Restock</span>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{criticalCount} critical</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1.5"
              onClick={() => exportForecastCSV(forecastRows)}
              disabled={forecastRows.length === 0}
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1.5"
              onClick={() => exportForecastPDF(forecastRows)}
              disabled={forecastRows.length === 0}
            >
              <FileText className="h-3 w-3 text-red-500" /> PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="h-7 text-[11px] w-[160px] bg-white dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-7 text-[11px] w-[160px] bg-white dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-7 text-[11px] w-[130px] bg-white dark:bg-gray-800 border-silver-300 dark:border-gray-700">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
            </SelectContent>
          </Select>

          <p className="text-[10px] text-muted-foreground ml-auto">
            Runway = On Hand &divide; Sales/Week &middot; 8-week restock target
          </p>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Card className="border-silver-200 dark:border-gray-800">
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Critical (&lt;2 wks)</p>
              <p className="text-xl font-bold text-destructive mt-0.5">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card className="border-silver-200 dark:border-gray-800">
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Low (2–4 wks)</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lowCount}</p>
            </CardContent>
          </Card>
          <Card className="border-silver-200 dark:border-gray-800">
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Healthy (4+ wks)</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{healthyCount}</p>
            </CardContent>
          </Card>
          <Card className="border-silver-200 dark:border-gray-800">
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">No Forecast</p>
              <p className="text-xl font-bold text-muted-foreground mt-0.5">{noDataCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Runway Distribution */}
          <Card className="border-silver-200 dark:border-gray-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-charcoal-800 dark:text-gray-100">Runway Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              {runwayBuckets.some(b => b.count > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={runwayBuckets} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border, #e5e7eb)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [value, 'Items']} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {runwayBuckets.map((b, i) => (
                        <Cell key={i} fill={b.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                  No items with sales data to chart.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Reorder Priority */}
          <Card className="border-silver-200 dark:border-gray-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-charcoal-800 dark:text-gray-100">Vendor Reorder Priority</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              {vendorPriority.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={vendorPriority} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border, #e5e7eb)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="vendor" tick={{ fontSize: 9 }} width={110} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="critical" stackId="a" fill="#EF4444" name="Critical" />
                    <Bar dataKey="low" stackId="a" fill="#F59E0B" name="Low" />
                    <Bar dataKey="healthy" stackId="a" fill="#10B981" name="Healthy" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                  No vendor data to chart.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* View toggle + Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
              <Button
                size="sm"
                variant={viewMode === 'flat' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setViewMode('flat')}
              >
                <List className="h-3.5 w-3.5" /> Flat View
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'vendor' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setViewMode('vendor')}
              >
                <Building2 className="h-3.5 w-3.5" /> By Vendor
              </Button>
            </div>
            <span className="text-[11px] text-muted-foreground">{forecastRows.length} items</span>
          </div>

          {forecastRows.length === 0 ? (
            <div className="rounded-lg border border-silver-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-12 text-center">
              <AlertTriangle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No items match the current filters.</p>
            </div>
          ) : viewMode === 'flat' ? (
            <div className="rounded-lg border border-silver-200 dark:border-gray-700 overflow-hidden">
              <ForecastTable rows={forecastRows} />
            </div>
          ) : (
            <VendorGroupedView rows={forecastRows} />
          )}
        </div>
      </div>
    </div>
  )
}
