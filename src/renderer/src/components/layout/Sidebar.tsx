import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  History,
  TrendingDown,
  Building2,
  Settings,
  X,
  PanelLeftClose,
  PanelLeft,
  MousePointerClick,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Separator } from '../ui/separator'

export type SidebarMode = 'hover' | 'expanded' | 'collapsed'

interface SidebarProps {
  open: boolean
  onClose: () => void
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
}

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', to: '/dashboard' },
  { icon: Package, label: 'Inventory', to: '/dashboard/inventory' },
  { icon: History, label: 'Transactions', to: '/dashboard/transactions' },
  { icon: TrendingDown, label: 'Forecast', to: '/dashboard/forecast' },
  { icon: Building2, label: 'Vendors', to: '/dashboard/vendors' },
  { icon: Settings, label: 'Settings', to: '/dashboard/settings' },
]

const modeOptions: { value: SidebarMode; icon: typeof PanelLeft; tip: string }[] = [
  { value: 'hover', icon: MousePointerClick, tip: 'Expand on hover' },
  { value: 'expanded', icon: PanelLeft, tip: 'Always expanded' },
  { value: 'collapsed', icon: PanelLeftClose, tip: 'Always collapsed' },
]

const COLLAPSED_W = 'w-14'
const EXPANDED_W = 'w-52'

export function Sidebar({ open, onClose, mode, onModeChange }: SidebarProps): JSX.Element {
  const location = useLocation()
  const [hovered, setHovered] = useState(false)

  // Effective visual state: is the sidebar showing labels right now?
  const showLabels = mode === 'expanded' || (mode === 'hover' && hovered)

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
        onMouseEnter={() => mode === 'hover' && setHovered(true)}
        onMouseLeave={() => mode === 'hover' && setHovered(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden transition-all duration-200 md:relative md:translate-x-0 md:z-auto',
          // Mobile: full translate
          open ? 'translate-x-0' : '-translate-x-full',
          // Width based on mode
          mode === 'expanded'
            ? EXPANDED_W
            : mode === 'collapsed'
              ? COLLAPSED_W
              // hover mode: collapsed by default, expanded on hover
              : hovered ? EXPANDED_W : COLLAPSED_W,
          // Mobile always full
          'max-md:w-56',
        )}
        style={{ background: 'linear-gradient(180deg, #0A2040 0%, #0D2B52 100%)' }}
      >
        {/* Mobile close */}
        <div className="shrink-0 flex items-center justify-end px-3 pt-3 md:hidden">
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
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
                title={!showLabels ? label : undefined}
                className={cn(
                  'group flex items-center rounded-md py-2 text-sm transition-all duration-150',
                  showLabels ? 'gap-2.5 px-3' : 'justify-center px-0',
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-blue-200/70 hover:bg-white/8 hover:text-white'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-blue-300/60 group-hover:text-white')} />
                {showLabels && (
                  <>
                    <span className="font-medium whitespace-nowrap">{label}</span>
                    {isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <Separator className="bg-white/10" />

        {/* Mode selector */}
        <div className={cn('shrink-0 py-2', showLabels ? 'px-2' : 'px-1')}>
          <div className={cn(
            'flex rounded-md bg-white/5 p-0.5',
            showLabels ? 'gap-0.5' : 'flex-col gap-0.5',
          )}>
            {modeOptions.map(({ value, icon: MIcon, tip }) => (
              <button
                key={value}
                onClick={() => onModeChange(value)}
                title={tip}
                className={cn(
                  'flex items-center justify-center rounded-md py-1.5 transition-colors flex-1',
                  mode === value
                    ? 'bg-white/15 text-white'
                    : 'text-blue-300/40 hover:text-white/70 hover:bg-white/5',
                )}
              >
                <MIcon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}
