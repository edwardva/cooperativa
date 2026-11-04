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
/** Código de error de la API (p. ej. 'LIMITE_BENEFICIARIOS'), si lo hay */
export const getErrorCode = (error: unknown): string | undefined => {
  if (axios.isAxiosError(error)) {
    return (error as AxiosError<{ error?: { code?: string } }>).response?.data?.error?.code
  }
  return undefined
}

/** Datos extra que algunos errores de la API traen en error.detalles (p. ej. cupos y sobrantes) */
export const getErrorDetalles = <T,>(error: unknown): T | undefined => {
  if (axios.isAxiosError(error)) {
    return (error as AxiosError<{ error?: { detalles?: T } }>).response?.data?.error?.detalles
  }
  return undefined
}

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

// Nombre en pantalla de los campos que valida el backend
const ETIQUETAS_CAMPOS: Record<string, string> = {
  cedula: 'Cédula',
  nombre: 'Nombre',
  apellido: 'Apellido',
  fecha_nacimiento: 'Fecha de nacimiento',
  fecha_ingreso: 'Fecha de ingreso',
  parentesco: 'Parentesco',
  telefono: 'Teléfono',
}

/**
 * Igual que getErrorMessage, pero si la API rechazó los datos ("Datos
 * inválidos") agrega qué campo falló y por qué, p. ej. "Parentesco: Selecciona
 * un parentesco válido". Para formularios donde el mensaje genérico no
 * alcanza para saber qué corregir.
 */
export const getErrorMessageDetallado = (error: unknown): string => {
  const mensaje = getErrorMessage(error)
  if (!axios.isAxiosError(error)) return mensaje

  const detalles = (error as AxiosError<{ error?: { details?: Array<{ path?: (string | number)[]; message?: string }> } }>)
    .response?.data?.error?.details
  if (!Array.isArray(detalles) || detalles.length === 0) return mensaje

  const lineas = detalles.map((d) => {
    // En listas el path trae el índice (beneficiarios.0.cedula): se nombra el campo final
    const campo = [...(d.path ?? [])].reverse().find((p) => typeof p === 'string') as string | undefined
    const etiqueta = campo ? ETIQUETAS_CAMPOS[campo] ?? campo : null
    return etiqueta ? `${etiqueta}: ${d.message}` : d.message
  })
  return `${mensaje}. ${lineas.join('. ')}`
}

export default apiClient
