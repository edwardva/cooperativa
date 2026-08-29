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
  codigo_social: string | null
  notas: string | null
  foto_url: string | null
  foto: string | null // Base64 de la foto
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
  es_delegado: boolean
  notas: string
  foto?: string // Base64 de la foto
}

export interface RetiroSocioData {
  fecha_retiro: string
  motivo_retiro: 'Fallecimiento' | 'Renuncia' | 'Pasividad'
}

// Parentescos aceptados para traspasar la titularidad de un socio: solo familiar directo
export const PARENTESCOS_TRASPASO_DIRECTO = [
  'Esposo',
  'Esposa',
  'Hijo',
  'Hija',
  'Padre',
  'Madre',
  'Hermano',
  'Hermana',
] as const

export const EDAD_MINIMA_TRASPASO = 60

export interface TraspasoSocioData {
  nueva_cedula: string
  nuevo_nombre: string
  nuevo_apellido: string
  nueva_fecha_nacimiento: string
  parentesco: (typeof PARENTESCOS_TRASPASO_DIRECTO)[number]
  nuevo_telefono?: string
  nuevo_email?: string
  nueva_direccion?: string
  motivo: string
  confirma_acuerdo_titular: boolean
  confirma_problemas_medicos: boolean
}

export const PARENTESCOS_BENEFICIARIO = [
  'No tiene',
  'Esposo',
  'Esposa',
  'Hijo',
  'Hija',
  'Padre',
  'Madre',
  'Abuelo',
  'Abuela',
  'Hermano',
  'Hermana',
  'Nieto',
  'Nieta',
  'Bisnieto',
  'Cuñado',
  'Cuñada',
  'Suegro',
  'Suegra',
  'Sobrino',
  'Tio',
  'Tia',
  'Primo',
  'Prima',
  'Yerno',
  'Yerna',
  'Ahijado',
  'Otro',
] as const

export interface Beneficiario {
  id: number
  socio_id: number
  cedula: string
  nombre: string
  apellido: string
  fecha_nacimiento: string | null
  fecha_ingreso: string | null
  parentesco: string
  telefono: string | null
  estado: 'activo' | 'inactivo' | 'retirado' | 'fallecido'
  fecha_fallecimiento: string | null
  created_at: string
  updated_at: string
}

export interface BeneficiarioFormData {
  cedula: string
  nombre: string
  apellido: string
  fecha_nacimiento: string
  fecha_ingreso: string
  parentesco: string
  telefono?: string | null
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
 * Buscar socio por cédula (retorna TODOS los socios con esa cédula)
 */
export const buscarSocioPorCedula = async (cedula: string): Promise<SingleResponse<Socio[]>> => {
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
 * Retirar un socio con fecha y motivo
 */
export const retirarSocio = async (id: number, data: RetiroSocioData): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.post(`/socios/${id}/retiro`, data)
  return response.data
}

/**
 * Actualizar únicamente el código de programas sociales de un socio
 */
export const actualizarCodigoSocial = async (
  id: number,
  codigo_social: string
): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.patch(`/socios/${id}/codigo-social`, { codigo_social })
  return response.data
}

/**
 * Buscar socio por número de expediente (código de socio) exacto
 */
export const buscarSocioPorExpediente = async (codigo: string): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.get(`/socios/expediente/${codigo}`)
  return response.data
}

/**
 * Traspasar la titularidad de un socio a un familiar directo
 */
export const traspasarSocio = async (id: number, data: TraspasoSocioData): Promise<SingleResponse<Socio>> => {
  const response = await apiClient.post(`/socios/${id}/traspaso`, data)
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

/**
 * Obtener beneficiarios de un socio
 * @param incluirRetirados Si es true, incluye beneficiarios retirados/fallecidos
 */
export const obtenerBeneficiarios = async (
  socioId: number,
  incluirRetirados = false
): Promise<SingleResponse<Beneficiario[]>> => {
  const response = await apiClient.get(`/socios/${socioId}/beneficiarios`, {
    params: incluirRetirados ? { incluirRetirados: 'true' } : undefined,
  })
  return response.data
}

/**
 * Agregar un beneficiario a un socio
 */
export const crearBeneficiario = async (
  socioId: number,
  data: BeneficiarioFormData
): Promise<SingleResponse<Beneficiario>> => {
  const response = await apiClient.post(`/socios/${socioId}/beneficiarios`, data)
  return response.data
}

/**
 * Actualizar un beneficiario (datos, estado, fecha de fallecimiento)
 */
export const actualizarBeneficiario = async (
  socioId: number,
  beneficiarioId: number,
  data: Partial<BeneficiarioFormData> & { estado?: Beneficiario['estado']; fecha_fallecimiento?: string | null }
): Promise<SingleResponse<Beneficiario>> => {
  const response = await apiClient.put(`/socios/${socioId}/beneficiarios/${beneficiarioId}`, data)
  return response.data
}

/**
 * Eliminar (retirar) un beneficiario
 */
export const eliminarBeneficiario = async (
  socioId: number,
  beneficiarioId: number
): Promise<SingleResponse<Beneficiario>> => {
  const response = await apiClient.delete(`/socios/${socioId}/beneficiarios/${beneficiarioId}`)
  return response.data
}
