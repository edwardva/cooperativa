import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { 
  Home, 
  Users, 
  Wallet, 
  DollarSign, 
  ClipboardList, 
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  HeartPulse,
  Briefcase,
  MapPin,
  CreditCard,
  FileText,
  FileDown,
  Calendar,
  CalendarCheck,
  Calculator,
  Printer,
  Shield
} from 'lucide-react'
import logo from '@/logoR.png'

interface NavItem {
  name: string
  path: string
  icon: React.ElementType
  badge?: number
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: Home },
  { name: 'Socios', path: '/socios', icon: Users },
  { name: 'Ahorro', path: '/ahorro', icon: Wallet },
  { name: 'Préstamos', path: '/prestamos', icon: DollarSign },
  { name: 'Colecta', path: '/colecta', icon: ClipboardList },
  { name: 'Reportes Colecta', path: '/colecta/reportes', icon: Calculator },
  { name: 'Funeraria', path: '/funeraria', icon: Shield },
  { name: 'Salud', path: '/salud', icon: HeartPulse },
  { name: 'Bóveda', path: '/boveda', icon: Briefcase },
  { name: 'Asambleas', path: '/asambleas', icon: CalendarCheck },
  { name: 'Reportes', path: '/reportes', icon: FileDown },
  { name: 'Impresión', path: '/impresion', icon: Printer },
  { name: 'Semanas Colecta', path: '/semanas-colecta', icon: Calendar },
  { name: 'Ferias', path: '/ferias', icon: MapPin },
  { name: 'Tipos de Cuenta', path: '/tipos-cuenta', icon: CreditCard },
  { name: 'Tipos de Préstamo', path: '/tipos-prestamo', icon: FileText },
  { name: 'Parámetros', path: '/parametros', icon: Settings },
]

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  isMobileOpen: boolean
  onMobileClose: () => void
}

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, onMobileClose }: SidebarProps) => {
  const location = useLocation()

  const toggleSidebar = () => setIsCollapsed(!isCollapsed)

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-neutral-200 bg-white/95 text-neutral-800 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-xl transition-all duration-300 lg:z-40 lg:bg-white/90',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'w-64 lg:w-16' : 'w-64'
        )}
      >
      {/* Logo Header */}
      <div className="relative flex h-16 items-center justify-center border-b border-neutral-200">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 px-4">
            <img src={logo} alt="Cooperativa el Triunfo" className="h-9 w-auto object-contain" />
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 lg:hidden">
              <img src={logo} alt="CT" className="h-8 w-auto object-contain" />
            </div>
            <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 lg:flex">
              <img src={logo} alt="CT" className="h-8 w-auto object-contain" />
            </div>
          </>
        )}

        {/* Close button (mobile) */}
        <button
          onClick={onMobileClose}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-primary-50 hover:text-primary-700 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Toggle Button (desktop collapse) */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-primary-50 hover:text-primary-700 lg:flex"
          aria-label={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onMobileClose}
                  className={clsx(
                    'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200',
                    isActive
                      ? 'bg-[linear-gradient(135deg,_rgba(255,107,28,0.12),_rgba(58,122,44,0.10))] text-neutral-900 shadow-sm ring-1 ring-primary-100'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon 
                    className={clsx(
                      'flex-shrink-0 transition-transform duration-200',
                      isActive ? 'h-5 w-5 text-primary-700' : 'h-5 w-5 group-hover:scale-110'
                    )} 
                  />
                  
                  <span className={clsx('flex-1 font-medium text-sm truncate', isCollapsed && 'lg:hidden')}>
                    {item.name}
                  </span>
                  {item.badge && (
                    <span className={clsx('px-2 py-0.5 text-xs font-semibold rounded-full bg-error-600 text-on-accent', isCollapsed && 'lg:hidden')}>
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip for collapsed state (desktop only) */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 hidden px-3 py-1.5 bg-neutral-800 text-neutral-50 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-lg z-50 lg:block">
                      {item.name}
                      {item.badge && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold rounded bg-error-600">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Info at Bottom */}
      <div className="border-t border-neutral-200 p-4">
        <div className={clsx('flex items-center gap-3', isCollapsed && 'lg:justify-center')}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 font-semibold text-sm text-on-accent shadow-sm">
            AD
          </div>
          <div className={clsx('min-w-0 flex-1', isCollapsed && 'lg:hidden')}>
            <div className="truncate text-sm font-medium text-neutral-900">Admin</div>
            <div className="truncate text-xs text-neutral-500">Administrador</div>
          </div>
        </div>
      </div>
      </aside>
    </>
  )
}
