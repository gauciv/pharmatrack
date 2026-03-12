import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  TrendingDown,
  Building2,
  Settings,
  X
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Separator } from '../ui/separator'
import logo from '../../assets/logo.png'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', to: '/dashboard' },
  { icon: Package, label: 'Inventory', to: '/dashboard/inventory' },
  { icon: TrendingDown, label: 'Forecast', to: '/dashboard/forecast' },
  { icon: Building2, label: 'Vendors', to: '/dashboard/vendors' },
  { icon: Settings, label: 'Settings', to: '/dashboard/settings' },
]

export function Sidebar({ open, onClose }: SidebarProps): JSX.Element {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-52 flex-col transition-transform duration-200 md:relative md:translate-x-0 md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'linear-gradient(180deg, #0A2040 0%, #0D2B52 100%)' }}
      >
        {/* Brand */}
        <div className="shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="h-6 w-6 object-contain" />
              <span className="text-sm font-semibold text-white tracking-tight">PharmaTracker</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Separator className="bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-300/50 mb-1">
            Main
          </p>
          {navItems.map(({ icon: Icon, label, to }) => {
            const isActive =
              to === '/dashboard'
                ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
                : location.pathname.startsWith(to)

            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-150',
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-blue-200/70 hover:bg-white/8 hover:text-white'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-blue-300/60 group-hover:text-white')} />
                <span className="font-medium">{label}</span>
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                )}
              </NavLink>
            )
          })}
        </nav>

        <Separator className="bg-white/10" />

        {/* Version */}
        <div className="px-4 py-3 shrink-0">
          <p className="text-[10px] text-blue-300/40">v1.0.0 · 2025</p>
        </div>
      </aside>
    </>
  )
}
