/**
 * Tipos comunes compartidos en el frontend
 */

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

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export enum EstadoUsuario {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
}

export enum EstadoSocio {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  RETIRADO = 'RETIRADO',
}

export enum Moneda {
  USD = 'USD',
  BS = 'BS',
}

export enum EstadoPrestamo {
  SOLICITADO = 'SOLICITADO',
  APROBADO = 'APROBADO',
  DESEMBOLSADO = 'DESEMBOLSADO',
  EN_PAGO = 'EN_PAGO',
  PAGADO = 'PAGADO',
  VENCIDO = 'VENCIDO',
  CANCELADO = 'CANCELADO',
}

export enum EstadoServicio {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  CANCELADO = 'CANCELADO',
}
