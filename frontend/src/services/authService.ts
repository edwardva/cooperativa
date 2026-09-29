import apiClient from './api'

export interface User {
  id: number
  username: string
  email: string
  nombre: string
  rol: {
    id: number
    nombre: string
    permisos: Record<string, string[]>
  }
}

/** Una caja desde la que se atiende */
export interface Caja {
  id: number
  codigo: string
  nombre: string
}

export interface LoginCredentials {
  username: string
  password: string
  /** Caja desde la que entra. El backend la valida: aqui solo se propone */
  caja_id?: number | null
}

export interface LoginResponse {
  success: boolean
  data: {
    token: string
    user: User
    /** La caja con la que quedo abierta la sesion, ya validada */
    caja: Caja | null
  }
}

export interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

/**
 * Servicio de autenticación - Cliente
 */
class AuthService {
  /** Cajas activas, para elegir al entrar. No necesita sesion. */
  async cajas(): Promise<Caja[]> {
    const response = await apiClient.get<{ success: boolean; data: Caja[] }>('/auth/cajas')
    return response.data.data
  }

  /**
   * Login de usuario
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    
    // Guardar token y usuario en localStorage (además de la cookie httpOnly)
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.data.user))
    }
    
    return response.data
  }

  /**
   * Logout de usuario
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      // Limpiar localStorage incluso si el request falla
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  /**
   * Obtener información del usuario actual
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ success: boolean; data: User }>('/auth/me')
    return response.data.data
  }

  /**
   * Verificar si el token es válido
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ success: boolean; data: { valid: boolean } }>(
        '/auth/verify'
      )
      return response.data.data.valid
    } catch (error) {
      return false
    }
  }

  /**
   * Cambiar password del usuario actual
   */
  async changePassword(data: ChangePasswordData): Promise<void> {
    await apiClient.post('/auth/change-password', data)
  }

  /**
   * Obtener usuario desde localStorage
   */
  getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null

    try {
      return JSON.parse(userStr) as User
    } catch (error) {
      console.error('Error parsing user from localStorage:', error)
      return null
    }
  }

  /**
   * Verificar si hay un token en localStorage
   */
  hasToken(): boolean {
    return !!localStorage.getItem('token')
  }
}

export default new AuthService()
