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
}

export const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const location = useLocation()

  const toggleSidebar = () => setIsCollapsed(!isCollapsed)

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-neutral-200 bg-white/90 text-neutral-800 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-xl transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo Header */}
      <div className="relative flex h-16 items-center justify-center border-b border-neutral-200">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 px-4">
            <img src={logo} alt="Cooperativa el Triunfo" className="h-9 w-auto object-contain" />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
            <img src={logo} alt="CT" className="h-8 w-auto object-contain" />
          </div>
        )}
        
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-primary-50 hover:text-primary-700"
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
                  
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 font-medium text-sm truncate">
                        {item.name}
                      </span>
                      {item.badge && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-error-600 text-on-accent">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-3 py-1.5 bg-neutral-800 text-neutral-50 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-lg z-50">
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
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 font-semibold text-sm text-on-accent shadow-sm">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium text-neutral-900">Admin</div>
              <div className="truncate text-xs text-neutral-500">Administrador</div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 font-semibold text-sm text-on-accent shadow-sm">
              AD
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
