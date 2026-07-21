import apiClient from './api'

export interface Ubicacion {
  id: number
  codigo: string
  nombre: string
  direccion: string | null
  descripcion?: string | null
}

export interface Socio {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  sexo: string | null
  fecha_nacimiento: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  fecha_inscripcion: string
  estado: 'activo' | 'retirado' | 'invalido'
  es_delegado: boolean
  ubicacion_id: number | null
  autorizado_nombre: string | null
  autorizado_cedula: string | null
  notas: string | null
  foto_url: string | null
  ubicacion?: Ubicacion
  _count?: {
    beneficiarios: number
    cuentas_ahorro: number
    prestamos: number
  }
}

export interface SocioFormData {
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  sexo: string
  fecha_nacimiento: string
  direccion: string
  telefono: string
  email: string
  fecha_inscripcion: string
  ubicacion_id: number | null
  autorizado_nombre: string
  autorizado_cedula: string
  notas: string
}

export interface RetiroSocioData {
  fecha_retiro: string
  motivo_retiro: 'Socio' | 'Voluntario' | 'Art. 5'
}

export interface EstadisticasSocios {
  totalSocios: number
  sociosActivos: number
  sociosSuspendidos: number
  sociosInactivos: number
  sociosRetirados: number
  totalBeneficiarios: number
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

interface SingleResponse<T> {
  success: boolean
  data: T
}

/**
 * Obtener todos los socios con paginación y búsqueda
 */
export const obtenerSocios = async (params?: {
  page?: number
  limit?: number
  search?: string
  estado?: string
  ubicacion_id?: number
}): Promise<PaginatedResponse<Socio>> => {
  const response = await apiClient.get('/socios', { params })
  return response.data
}

/**
 * Obtener un socio por ID
 */
export const obtenerSocioPorId = async (id: number): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.get(`/socios/${id}`)
  return response.data
}

/**
 * Buscar socio por cédula
 */
export const buscarSocioPorCedula = async (cedula: string): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.get(`/socios/buscar/${cedula}`)
  return response.data
}

/**
 * Crear un nuevo socio
 */
export const crearSocio = async (data: SocioFormData): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.post('/socios', data)
  return response.data
}

/**
 * Actualizar un socio existente
 */
export const actualizarSocio = async (id: number, data: Partial<SocioFormData>): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.put(`/socios/${id}`, data)
  return response.data
}

/**
 * Eliminar un socio si no tiene asociaciones previas
 */
export const eliminarSocio = async (id: number): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.delete(`/socios/${id}`)
  return response.data
}

/**
 * Retirar un socio con fecha y motivo
 */
export const retirarSocio = async (id: number, data: RetiroSocioData): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.post(`/socios/${id}/retiro`, data)
  return response.data
}

/**
 * Obtener estadísticas generales de socios
 */
export const obtenerEstadisticasSocios = async (): Promise<SingleResponse<EstadisticasSocios>> => {
  const response = await apiClient.get('/socios/estadisticas')
  return response.data
}

/**
 * Obtener ubicaciones (para el select de ubicación)
 */
export const obtenerUbicaciones = async (): Promise<SingleResponse<Ubicacion[]>> => {
  const response = await apiClient.get('/ubicaciones')
  return response.data
}
