import axios from 'axios'
import type { AxiosInstance, AxiosError } from 'axios'

// Configuración base del cliente API
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Importante para enviar cookies (httpOnly)
  timeout: 30000, // 30 segundos
})

// Interceptor de requests
apiClient.interceptors.request.use(
  (config) => {
    // Agregar token desde localStorage si existe (backup)
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor de responses
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    // Manejo global de errores
    if (error.response?.status === 401) {
      // Token inválido o expirado - limpiar autenticación
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // Redirigir a login si no estamos ya ahí
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// Helper para extraer errores de respuestas
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: { message?: string } }>
    return axiosError.response?.data?.error?.message || axiosError.message || 'Error desconocido'
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'Error desconocido'
}

export default apiClient
