/**
 * ============================================
 * SERVICE: TRABAJADORES DE FERIA
 * ============================================
 * Expediente de trabajador: separado del de ahorrista, con historial de ferias.
 * Feria actual, salud y periodo de prueba los calcula el backend.
 */

import apiClient from './api'
import type { DatosPersona, ExpedienteAhorrista, TipoIdentificacion } from './personasService'

export type EstadoTrabajador = 'activo' | 'suspendido' | 'retirado' | 'inactivo'

export interface FeriaResumen {
  id: number
  codigo: string
  nombre: string
  direccion: string | null
}

export interface FeriaActual extends FeriaResumen {
  desde: string
}

export interface AsociacionFeria {
  id: number
  feria_id: number
  fecha_inicio: string
  fecha_fin: string | null
  motivo_cambio: string | null
  feria: FeriaResumen
}

export interface SaludTrabajador {
  asignada: boolean
  detalle: string
}

export interface PruebaTrabajador {
  fin_prueba: string
  cumplida: boolean
  dias_trabajados: number
  dias_restantes: number
  meses: number
}

export interface Trabajador {
  id: number
  persona_id: number
  codigo_trabajador: string
  fecha_ingreso: string
  estado: EstadoTrabajador
  fecha_salida: string | null
  motivo_salida: string | null
  observaciones: string | null
  persona: {
    id: number
    tipo_identificacion: TipoIdentificacion
    numero_identificacion: string
    nombres: string
    apellidos: string
    telefono: string | null
  }
  ferias: AsociacionFeria[]
  feria_actual: FeriaActual | null
  salud: SaludTrabajador
  prueba: PruebaTrabajador
}

export interface TrabajadorDetalle extends Trabajador {
  ahorrista: {
    expedientes: ExpedienteAhorrista[]
    tiene_expediente_activo: boolean
    puede_inscribirse: boolean
  }
}

export interface NuevoTrabajador {
  persona_id?: number
  persona?: DatosPersona
  codigo_trabajador?: string | null
  feria_id: number
  fecha_ingreso: string
  observaciones?: string | null
}

interface Respuesta<T> {
  success: boolean
  data: T
  message?: string
  meta?: { total: number; page: number; totalPages: number }
}

export const listarTrabajadores = async (params: {
  busqueda?: string
  feria_id?: number
  estado?: string
  ingreso_desde?: string
  ingreso_hasta?: string
  page?: number
  limit?: number
}): Promise<Respuesta<Trabajador[]>> => {
  const response = await apiClient.get('/trabajadores', { params })
  return response.data
}

export const obtenerTrabajador = async (id: number): Promise<Respuesta<TrabajadorDetalle>> => {
  const response = await apiClient.get(`/trabajadores/${id}`)
  return response.data
}

export const crearTrabajador = async (datos: NuevoTrabajador): Promise<Respuesta<TrabajadorDetalle>> => {
  const response = await apiClient.post('/trabajadores', datos)
  return response.data
}

export const trasladarTrabajador = async (
  id: number,
  datos: { feria_id: number; fecha: string; motivo: string }
): Promise<Respuesta<TrabajadorDetalle>> => {
  const response = await apiClient.post(`/trabajadores/${id}/traslado-feria`, datos)
  return response.data
}

export const retirarTrabajador = async (
  id: number,
  datos: { fecha_salida: string; motivo: string }
): Promise<Respuesta<TrabajadorDetalle>> => {
  const response = await apiClient.post(`/trabajadores/${id}/retiro`, datos)
  return response.data
}
