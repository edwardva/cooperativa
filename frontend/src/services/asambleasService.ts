/**
 * ============================================
 * SERVICE: ASAMBLEAS
 * ============================================
 * Regla de negocio: cada socio debe asistir al menos a UNA asamblea por año.
 * Este servicio cubre el registro de asambleas, el pase de lista y el
 * reporte anual de inasistentes.
 */

import apiClient from './api'

// ============================================
// TIPOS
// ============================================

export type TipoAsamblea = 'ordinaria' | 'extraordinaria' | 'sectorial'

export const TIPOS_ASAMBLEA: { value: TipoAsamblea; label: string; descripcion: string }[] = [
  { value: 'ordinaria', label: 'Ordinaria', descripcion: 'Asamblea general convocada segun el calendario habitual.' },
  { value: 'extraordinaria', label: 'Extraordinaria', descripcion: 'Asamblea general convocada fuera del calendario.' },
  { value: 'sectorial', label: 'Sectorial', descripcion: 'Reunion de una feria o sector especifico. Requiere indicar la feria.' },
]

export interface UbicacionAsamblea {
  id: number
  codigo: string
  nombre?: string
  direccion: string | null
}

export interface Asamblea {
  id: number
  titulo: string
  tipo: TipoAsamblea
  fecha: string
  ano: number
  ubicacion_id: number | null
  descripcion: string | null
  estado: boolean
  created_at: string
  ubicacion: UbicacionAsamblea | null
  _count?: { asistencias: number }
}

export interface SocioAsistencia {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  estado: string
  ubicacion?: UbicacionAsamblea | null
}

export interface Asistencia {
  id: number
  asamblea_id: number
  socio_id: number
  observacion: string | null
  created_at: string
  socio: SocioAsistencia
}

export interface AsambleaDetalle extends Asamblea {
  asistencias: Asistencia[]
}

export interface AsambleaFormData {
  titulo: string
  tipo: TipoAsamblea
  fecha: string
  ubicacion_id: number | null
  descripcion: string | null
}

export interface SocioInasistente {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  telefono: string | null
  estado: string
  fecha_inscripcion: string
  ubicacion: UbicacionAsamblea | null
}

export interface ResumenParticipacion {
  total_socios_activos: number
  asistieron: number
  no_asistieron: number
  porcentaje_participacion: number
}

export interface ReporteInasistentes {
  ano: number
  sin_asambleas: boolean
  asambleas: { id: number; titulo: string; fecha: string; tipo: TipoAsamblea }[]
  filtros?: { ubicacion_id: number | null; excluir_nuevos: boolean }
  resumen: ResumenParticipacion
  inasistentes: SocioInasistente[]
}

export interface ResumenAnual extends ResumenParticipacion {
  ano: number
  total_asambleas: number
}

export interface AsistenciaAnualSocio {
  ano: number
  total_asambleas: number
  total_asistencias: number
  /** true = el socio cumple la regla de asistir al menos a una asamblea del año */
  cumple: boolean
  asambleas_asistidas: { id: number; titulo: string; fecha: string; tipo: TipoAsamblea }[]
}

interface Respuesta<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

// ============================================
// ASAMBLEAS
// ============================================

export const obtenerAsambleas = async (params?: {
  ano?: number
  tipo?: string
  ubicacion_id?: number
}): Promise<Respuesta<Asamblea[]>> => {
  const response = await apiClient.get('/asambleas', { params })
  return response.data
}

export const obtenerAnosConAsambleas = async (): Promise<Respuesta<number[]>> => {
  const response = await apiClient.get('/asambleas/anos')
  return response.data
}

export const obtenerAsambleaPorId = async (id: number): Promise<Respuesta<AsambleaDetalle>> => {
  const response = await apiClient.get(`/asambleas/${id}`)
  return response.data
}

export const crearAsamblea = async (data: AsambleaFormData): Promise<Respuesta<Asamblea>> => {
  const response = await apiClient.post('/asambleas', data)
  return response.data
}

export const actualizarAsamblea = async (
  id: number,
  data: Partial<AsambleaFormData> & { estado?: boolean }
): Promise<Respuesta<Asamblea>> => {
  const response = await apiClient.put(`/asambleas/${id}`, data)
  return response.data
}

export const eliminarAsamblea = async (id: number): Promise<Respuesta<{ id: number }>> => {
  const response = await apiClient.delete(`/asambleas/${id}`)
  return response.data
}

// ============================================
// ASISTENCIA
// ============================================

export const registrarAsistencia = async (
  asambleaId: number,
  socioId: number,
  observacion?: string | null
): Promise<Respuesta<Asistencia>> => {
  const response = await apiClient.post(`/asambleas/${asambleaId}/asistencias`, {
    socio_id: socioId,
    observacion: observacion ?? null,
  })
  return response.data
}

export const eliminarAsistencia = async (
  asambleaId: number,
  socioId: number
): Promise<Respuesta<{ asamblea_id: number; socio_id: number }>> => {
  const response = await apiClient.delete(`/asambleas/${asambleaId}/asistencias/${socioId}`)
  return response.data
}

// ============================================
// REGLA DE NEGOCIO
// ============================================

export const obtenerResumenAnual = async (ano: number): Promise<Respuesta<ResumenAnual>> => {
  const response = await apiClient.get('/asambleas/resumen', { params: { ano } })
  return response.data
}

export const obtenerReporteInasistentes = async (params: {
  ano: number
  ubicacion_id?: number
  excluir_nuevos?: boolean
}): Promise<Respuesta<ReporteInasistentes>> => {
  const response = await apiClient.get('/asambleas/reportes/inasistentes', { params })
  return response.data
}

export const obtenerAsistenciaAnualDeSocio = async (
  socioId: number,
  ano: number
): Promise<Respuesta<AsistenciaAnualSocio>> => {
  const response = await apiClient.get(`/asambleas/socios/${socioId}/asistencia`, { params: { ano } })
  return response.data
}
