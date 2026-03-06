import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Users, TrendingUp, AlertTriangle, Zap, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { inventorySeed } from '../lib/inventory-seed'
import { cn } from '../lib/utils'

const CHART_COLORS = ['#1060C0', '#0D2B52', '#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#7C3AED', '#6B7280']

// ---- Derived data (computed once from seed) ----
const allItems = inventorySeed.filter(i => i.rowType === 'item')
const activeSKUs = allItems.length
const highVolumeThreshold = 1000
const highVolumeMovers = allItems.filter(i => i.salesPerWeek >= highVolumeThreshold)
const stockAnomalies = allItems.filter(i => i.onHand < 0)
const totalOnHand = allItems.reduce((s, i) => s + i.onHand, 0)
const activeVendors = [...new Set(allItems.map(i => i.vendor))].length

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
    <Card className="border-silver-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className={cn('text-2xl font-bold leading-none', valueColor ?? 'text-charcoal-800')}>{value}</p>
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

const vendorSummary = (() => {
  const map = new Map<string, { skus: number; onHand: number; salesPerWeek: number }>()
  allItems.forEach(i => {
    const v = map.get(i.vendor) ?? { skus: 0, onHand: 0, salesPerWeek: 0 }
    map.set(i.vendor, { skus: v.skus + 1, onHand: v.onHand + i.onHand, salesPerWeek: v.salesPerWeek + i.salesPerWeek })
  })
  return [...map.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.onHand - a.onHand)
    .slice(0, 6)
})()

const categoryChartData = (() => {
  const map = new Map<string, number>()
  allItems.forEach(i => {
    const cat = i.category || 'Uncategorized'
    map.set(cat, (map.get(cat) ?? 0) + 1)
  })
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
})()

export default function DashboardHome(): JSX.Element {
  return (
    <div className="p-4 xl:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal-800">Inventory Overview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}Inventory Report 2025
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          title="Active SKUs"
          value={activeSKUs}
          sub="Unique inventory items"
          icon={Package}
          iconColor="text-brand"
          iconBg="bg-brand-50"
          badge={{ label: '2025 data', color: 'bg-blue-50 text-brand' }}
        />
        <StatCard
          title="Active Vendors"
          value={activeVendors}
          sub="Primary suppliers"
          icon={Users}
          iconColor="text-navy-900"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="High-Volume Movers"
          value={highVolumeMovers.length}
          sub={`≥ ${highVolumeThreshold.toLocaleString()} units/wk`}
          icon={Zap}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          badge={{ label: 'Alert', color: 'bg-amber-50 text-amber-700' }}
        />
        <StatCard
          title="Stock Anomalies"
          value={stockAnomalies.length}
          sub="Negative on-hand qty"
          icon={AlertTriangle}
          iconColor="text-destructive"
          iconBg="bg-red-50"
          valueColor={stockAnomalies.length > 0 ? 'text-destructive' : 'text-charcoal-800'}
          badge={stockAnomalies.length > 0 ? { label: 'Critical', color: 'bg-red-50 text-destructive' } : undefined}
        />
      </div>

      {/* Total on-hand banner */}
      <div className="rounded-lg border border-silver-200 bg-gradient-to-r from-navy-900/5 to-brand/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold text-charcoal-800">Total On Hand</span>
        </div>
        <div className="flex items-center gap-1.5 text-lg font-bold text-charcoal-800">
          {totalOnHand.toLocaleString()}
          <span className="text-xs font-normal text-muted-foreground">units across all vendors</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Category distribution chart */}
        <Card className="border-silver-200 xl:col-span-2">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold text-charcoal-800">By Category</CardTitle>
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
                  formatter={(v: number, name: string) => [v, name]}
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
        <Card className="border-silver-200 xl:col-span-3">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-charcoal-800">Vendor Summary</CardTitle>
              <Badge variant="info" className="text-[10px]">Top 6</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Vendor</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">SKUs</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">On Hand</th>
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Sales/Wk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendorSummary.map((v, i) => (
                  <tr key={v.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        >
                          {v.name[0]}
                        </div>
                        <span className="font-medium text-charcoal-700 truncate max-w-[140px]">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-charcoal-700">{v.skus}</td>
                    <td className="px-3 py-2 text-right font-mono text-charcoal-700">{v.onHand.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono text-charcoal-700">
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

      {/* Stock anomaly detail */}
      {stockAnomalies.length > 0 && (
        <Card className="border-destructive/30 bg-red-50/30">
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
                  <span className="text-charcoal-700 font-medium">{item.description}</span>
                  <span className="font-mono font-bold text-destructive">{item.onHand.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
