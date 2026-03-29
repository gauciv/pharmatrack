import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Users, TrendingUp, AlertTriangle, Zap, ArrowUpRight, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useInventory, InventoryFilters } from '../hooks/useInventory'
import { cn } from '../lib/utils'
import {
  formatExpiryDate,
  getDaysUntilExpiry,
  getExpiryStatus,
  getNextNonExpiredLot,
} from '../lib/inventory-expiry'

const CHART_COLORS = ['#1060C0', '#0D2B52', '#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#7C3AED', '#6B7280']

interface StatCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  valueColor?: string
  badge?: { label: string; color: string }
}

function StatCard({ title, value, sub, icon: Icon, iconColor, iconBg, valueColor, badge }: StatCardProps) {
  return (
    <Card className="border-silver-200 dark:border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className={cn('text-2xl font-semibold leading-none', valueColor ?? 'text-charcoal-800 dark:text-gray-100')}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          {badge && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const emptyFilters: InventoryFilters = {
  search: '', vendor: 'all', category: 'all', stockStatus: 'all', expiryStatus: 'all',
}

const HIGH_VOLUME_THRESHOLD = 1000

function getExpiryBadgeVariant(status: 'expiring-30' | 'expiring-60' | 'expiring-90'): 'destructive' | 'warning' | 'info' {
  if (status === 'expiring-30') return 'destructive'
  if (status === 'expiring-60') return 'warning'
  return 'info'
}

export default function DashboardHome(): JSX.Element {
  const { allItems, loading } = useInventory(emptyFilters)

  const items = useMemo(() => allItems.filter(i => i.rowType === 'item'), [allItems])
  const activeSKUs = items.length
  const activeVendors = useMemo(() => [...new Set(items.map(i => i.vendor))].length, [items])
  const highVolumeMovers = useMemo(() => items.filter(i => i.salesPerWeek >= HIGH_VOLUME_THRESHOLD), [items])
  const stockAnomalies = useMemo(() => items.filter(i => i.onHand < 0), [items])
  const totalOnHand = useMemo(() => items.reduce((s, i) => s + i.onHand, 0), [items])
  const expiredProducts = useMemo(
    () => items
      .filter(i => (i.expiredQuantity ?? 0) > 0)
      .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '') || a.description.localeCompare(b.description)),
    [items]
  )
  const expiryWatchlist = useMemo(() => (
    items
      .map(item => {
        const status = getExpiryStatus(item)
        if (status !== 'expiring-30' && status !== 'expiring-60' && status !== 'expiring-90') return null

        const nextLot = getNextNonExpiredLot(item)
        if (!nextLot) return null

        return {
          item,
          status,
          nextLot,
          daysUntil: getDaysUntilExpiry(nextLot.expiryDate) ?? 0,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((a, b) => (
        a.nextLot.expiryDate.localeCompare(b.nextLot.expiryDate) ||
        a.item.description.localeCompare(b.item.description)
      ))
  ), [items])
  const expiring30 = useMemo(
    () => expiryWatchlist.filter(entry => entry.status === 'expiring-30'),
    [expiryWatchlist]
  )
  const expiring60 = useMemo(
    () => expiryWatchlist.filter(entry => entry.status === 'expiring-60'),
    [expiryWatchlist]
  )
  const expiring90 = useMemo(
    () => expiryWatchlist.filter(entry => entry.status === 'expiring-90'),
    [expiryWatchlist]
  )
  const vendorSummary = useMemo(() => {
    const map = new Map<string, { skus: number; onHand: number; salesPerWeek: number }>()
    items.forEach(i => {
      const v = map.get(i.vendor) ?? { skus: 0, onHand: 0, salesPerWeek: 0 }
      map.set(i.vendor, { skus: v.skus + 1, onHand: v.onHand + i.onHand, salesPerWeek: v.salesPerWeek + i.salesPerWeek })
    })
    return [...map.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, 6)
  }, [items])

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach(i => {
      const cat = i.category || 'Uncategorized'
      map.set(cat, (map.get(cat) ?? 0) + 1)
    })
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [items])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="p-4 xl:p-6 space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            title="Active SKUs"
            value={activeSKUs}
            sub="Unique inventory items"
            icon={Package}
            iconColor="text-brand"
            iconBg="bg-brand-50 dark:bg-blue-900/30"
          />
          <StatCard
            title="Active Vendors"
            value={activeVendors}
            sub="Primary suppliers"
            icon={Users}
            iconColor="text-navy-900 dark:text-blue-300"
            iconBg="bg-blue-50 dark:bg-blue-900/30"
          />
          <StatCard
            title="High-Volume Movers"
            value={highVolumeMovers.length}
            sub={`\u2265 ${HIGH_VOLUME_THRESHOLD.toLocaleString()} units/wk`}
            icon={Zap}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-900/30"
            badge={{ label: 'Alert', color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' }}
          />
          <StatCard
            title="Stock Anomalies"
            value={stockAnomalies.length}
            sub="Negative on-hand qty"
            icon={AlertTriangle}
            iconColor="text-destructive"
            iconBg="bg-red-50 dark:bg-red-900/30"
            valueColor={stockAnomalies.length > 0 ? 'text-destructive' : 'text-charcoal-800 dark:text-gray-100'}
            badge={stockAnomalies.length > 0 ? { label: 'Critical', color: 'bg-red-50 dark:bg-red-900/30 text-destructive' } : undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            title="Expiring in 30 Days"
            value={expiring30.length}
            sub={expiring30[0] ? `Soonest ${formatExpiryDate(expiring30[0].nextLot.expiryDate)}` : 'No items due in the next 30 days'}
            icon={AlertTriangle}
            iconColor="text-destructive"
            iconBg="bg-red-50 dark:bg-red-900/30"
            valueColor={expiring30.length > 0 ? 'text-destructive' : undefined}
            badge={expiring30.length > 0 ? { label: 'Urgent', color: 'bg-red-50 dark:bg-red-900/30 text-destructive' } : undefined}
          />
          <StatCard
            title="Expiring in 31-60 Days"
            value={expiring60.length}
            sub={expiring60[0] ? `Soonest ${formatExpiryDate(expiring60[0].nextLot.expiryDate)}` : 'Nothing currently queued in this bucket'}
            icon={AlertTriangle}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-900/30"
            valueColor={expiring60.length > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}
            badge={expiring60.length > 0 ? { label: 'Watch', color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' } : undefined}
          />
          <StatCard
            title="Expiring in 61-90 Days"
            value={expiring90.length}
            sub={expiring90[0] ? `Soonest ${formatExpiryDate(expiring90[0].nextLot.expiryDate)}` : 'No upcoming items within 90 days'}
            icon={AlertTriangle}
            iconColor="text-brand"
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            valueColor={expiring90.length > 0 ? 'text-brand' : undefined}
            badge={expiring90.length > 0 ? { label: 'Plan', color: 'bg-blue-50 dark:bg-blue-900/30 text-brand dark:text-blue-300' } : undefined}
          />
        </div>

        {/* Total on-hand banner */}
        <div className="rounded-lg border border-silver-200 dark:border-gray-700 bg-gradient-to-r from-navy-900/5 to-brand/5 dark:from-brand/10 dark:to-navy-900/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Total On Hand</span>
          </div>
          <div className="flex items-center gap-1.5 text-lg font-semibold text-charcoal-800 dark:text-gray-100">
            {totalOnHand.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground">units across all vendors</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Category distribution chart */}
          <Card className="border-silver-200 dark:border-gray-800 xl:col-span-2">
            <CardHeader className="pb-2 border-b dark:border-gray-800">
              <CardTitle className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">By Category</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                    formatter={(v, name) => [v ?? 0, name ?? '']}
                  />
                  <Legend
                    iconSize={8}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vendor summary */}
          <Card className="border-silver-200 dark:border-gray-800 xl:col-span-3">
            <CardHeader className="pb-2 border-b dark:border-gray-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Vendor Summary</CardTitle>
                <Badge variant="info" className="text-[10px]">Top 6</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60">
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Vendor</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">SKUs</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">On Hand</th>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Sales/Wk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vendorSummary.map((v, i) => (
                    <tr key={v.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-5 w-5 rounded shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          >
                            {v.name[0]}
                          </div>
                          <span className="font-medium text-charcoal-700 dark:text-gray-200 truncate max-w-[140px]">{v.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-charcoal-700 dark:text-gray-300">{v.skus}</td>
                      <td className="px-3 py-2 text-right font-mono text-charcoal-700 dark:text-gray-300">{v.onHand.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-charcoal-700 dark:text-gray-300">
                        <span className="flex items-center justify-end gap-0.5">
                          {v.salesPerWeek >= 1000 && <ArrowUpRight className="h-3 w-3 text-amber-500" />}
                          {v.salesPerWeek.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card className="border-silver-200 dark:border-gray-800">
          <CardHeader className="pb-2 border-b dark:border-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-charcoal-800 dark:text-gray-100">Expiry Watchlist</CardTitle>
              <Badge variant={expiryWatchlist.length > 0 ? 'warning' : 'secondary'} className="text-[10px]">
                {expiryWatchlist.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {expiryWatchlist.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tracked products are scheduled to expire within the next 90 days.
              </p>
            ) : (
              <div className="space-y-2">
                {expiryWatchlist.slice(0, 8).map(({ item, status, nextLot, daysUntil }) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-charcoal-800 dark:text-gray-100 truncate">{item.description}</p>
                        <Badge variant={getExpiryBadgeVariant(status)} className="text-[10px]">
                          {status === 'expiring-30' ? '0-30d' : status === 'expiring-60' ? '31-60d' : '61-90d'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {formatExpiryDate(nextLot.expiryDate)} · Lot <span className="font-mono">{nextLot.lotNumber || '—'}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold text-charcoal-800 dark:text-gray-100">
                        {nextLot.quantity.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {daysUntil === 0 ? 'today' : `${daysUntil} days`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(
          'border-silver-200 dark:border-gray-800',
          expiredProducts.length > 0 && 'border-destructive/30 bg-red-50/20 dark:bg-red-950/10'
        )}>
          <CardHeader className={cn(
            'pb-2 border-b dark:border-gray-800',
            expiredProducts.length > 0 && 'border-destructive/20'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn('h-4 w-4', expiredProducts.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                <CardTitle className={cn(
                  'text-sm font-semibold',
                  expiredProducts.length > 0 ? 'text-destructive' : 'text-charcoal-800 dark:text-gray-100'
                )}>
                  Expired Products
                </CardTitle>
              </div>
              <Badge variant={expiredProducts.length > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
                {expiredProducts.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {expiredProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tracked products are expired as of {new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date())}.
              </p>
            ) : (
              <div className="space-y-2">
                {expiredProducts.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal-800 dark:text-gray-100 truncate">{item.description}</p>
                      <p className="text-muted-foreground">
                        Expired {formatExpiryDate(item.expiryDate)} · FIFO <span className="font-mono">{item.fifoLotNumber ?? '—'}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold text-destructive">
                        {(item.expiredQuantity ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">expired qty</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock anomaly detail */}
        {stockAnomalies.length > 0 && (
          <Card className="border-destructive/30 bg-red-50/30 dark:bg-red-950/20">
            <CardHeader className="pb-2 border-b border-destructive/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <CardTitle className="text-sm font-semibold text-destructive">Negative Stock — Data Anomalies</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-1.5">
                {stockAnomalies.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-charcoal-700 dark:text-gray-300 font-medium">{item.description}</span>
                    <span className="font-mono font-bold text-destructive">{item.onHand.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
