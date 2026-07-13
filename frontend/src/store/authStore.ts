import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import authService from '@/services/authService'
import type { User, LoginCredentials } from '@/services/authService'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  clearError: () => void
  initialize: () => Promise<void>
}

/**
 * Store de autenticación con Zustand
 */
export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /**
       * Login de usuario
       */
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login(credentials)
          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Error al iniciar sesión'
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          })
          throw error
        }
      },

      /**
       * Logout de usuario
       */
      logout: async () => {
        set({ isLoading: true })
        try {
          await authService.logout()
        } catch (error) {
          console.error('Error durante logout:', error)
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      },

      /**
       * Establecer usuario (útil para actualizaciones)
       */
      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        })
      },

      /**
       * Limpiar error
       */
      clearError: () => {
        set({ error: null })
      },

      /**
       * Inicializar autenticación desde localStorage
       */
      initialize: async () => {
        const user = authService.getUserFromStorage()
        const hasToken = authService.hasToken()

        if (user && hasToken) {
          // Verificar que el token siga siendo válido
          try {
            const isValid = await authService.verifyToken()
            if (isValid) {
              set({
                user,
                isAuthenticated: true,
              })
            } else {
              // Token inválido, limpiar
              localStorage.removeItem('token')
              localStorage.removeItem('user')
            }
          } catch (error) {
            console.error('Error verificando token:', error)
            localStorage.removeItem('token')
            localStorage.removeItem('user')
          }
        }
      },
    }),
    { name: 'auth-store' }
  )
)

/**
 * Hook conveniente para verificar permisos
 */
export const usePermissions = () => {
  const user = useAuthStore((state) => state.user)

  const hasPermission = (module: string, action: string): boolean => {
    if (!user || !user.rol || !user.rol.permisos) return false
    
    const modulePerms = user.rol.permisos[module]
    if (!modulePerms) return false
    
    return modulePerms.includes(action)
  }

  const hasAnyPermission = (permissions: Array<{ module: string; action: string }>): boolean => {
    return permissions.some(({ module, action }) => hasPermission(module, action))
  }

  const hasAllPermissions = (permissions: Array<{ module: string; action: string }>): boolean => {
    return permissions.every(({ module, action }) => hasPermission(module, action))
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}
