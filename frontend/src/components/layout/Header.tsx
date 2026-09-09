import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, User, LogOut, Settings, ChevronDown, Moon, Sun, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTema } from '@/hooks/useTema'
import { clsx } from 'clsx'

interface HeaderProps {
  onOpenMobileMenu: () => void
}

export const Header = ({ onOpenMobileMenu }: HeaderProps) => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { tema, alternarTema } = useTema()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // TODO: Implementar búsqueda global
      console.log('Buscar:', searchQuery)
    }
  }

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-30">
      <div className="h-full px-3 flex items-center justify-between gap-2 sm:px-6 sm:gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileMenu}
          className="flex-shrink-0 p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="min-w-0 flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar socio, préstamo, acuerdo..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        </form>

        {/* Right Section */}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-4">
          {/* Tema diurno / nocturno */}
          <button
            onClick={alternarTema}
            className="hidden p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors sm:block"
            aria-label={tema === 'nocturno' ? 'Cambiar a tema diurno' : 'Cambiar a tema nocturno'}
            title={tema === 'nocturno' ? 'Tema diurno' : 'Tema nocturno'}
          >
            {tema === 'nocturno' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <button
            className="relative hidden p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors sm:block"
            aria-label="Notificaciones"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error-600 rounded-full ring-2 ring-white"></span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-1.5 py-2 hover:bg-neutral-100 rounded-lg transition-colors sm:gap-3 sm:px-3"
            >
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-on-accent font-semibold text-sm">
                {user?.nombre?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-sm font-medium text-neutral-900">
                  {user?.nombre || 'Usuario'}
                </div>
                <div className="text-xs text-neutral-500">
                  {user?.rol?.nombre || 'Sin rol'}
                </div>
              </div>
              <ChevronDown 
                className={clsx(
                  'w-4 h-4 text-neutral-400 transition-transform duration-200',
                  showUserMenu && 'rotate-180'
                )} 
              />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50 animate-fade-in">
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <p className="text-sm font-medium text-neutral-900">
                      {user?.nombre}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      navigate('/perfil')
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Mi Perfil
                  </button>
                  
                  <button
                    onClick={() => {
                      navigate('/configuracion')
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Configuración
                  </button>
                  
                  <hr className="my-2 border-neutral-100" />
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error-600 hover:bg-error-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
