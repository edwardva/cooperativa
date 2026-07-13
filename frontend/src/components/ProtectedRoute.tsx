import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Componente para proteger rutas que requieren autenticación
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // Redirigir a login, guardando la ubicación de donde venía
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
