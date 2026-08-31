/**
 * ============================================
 * SERVICE: PARAMETROS DEL SISTEMA
 * ============================================
 * Incluye la tasa de cambio BCV, que se sincroniza sola desde el backend
 * pero puede forzarse desde la pantalla.
 */

import apiClient from './api'

export interface Parametro {
  id: number
  clave: string
  valor: string
  descripcion: string | null
  tipo_dato: string
  updated_at: string
}

export interface TasaEnVivo {
  tasa: number
  fuente: string
  fecha_valor: string | null
}

export interface EstadoTasa {
  vigente: number | null
  actualizada_el: string | null
  en_vivo: TasaEnVivo | null
  /** true si la fuente reporta un valor distinto al guardado */
  desactualizada: boolean
  diferencia_porcentaje: number | null
  historico: { tasa: string | number; fecha_vigencia: string; created_at: string }[]
}

export interface ResultadoSincronizacion {
  aplicada: boolean
  tasa_anterior: number | null
  tasa_nueva: number | null
  fuente: string | null
  motivo: string
}

interface Respuesta<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

export const obtenerParametros = async (): Promise<Respuesta<Parametro[]>> => {
  const response = await apiClient.get('/parametros')
  return response.data
}

export const actualizarParametro = async (
  id: number,
  data: { valor?: string; descripcion?: string }
): Promise<Respuesta<Parametro>> => {
  const response = await apiClient.put(`/parametros/${id}`, data)
  return response.data
}

// ============================================
// TASA DE CAMBIO
// ============================================

export const obtenerEstadoTasa = async (): Promise<Respuesta<EstadoTasa>> => {
  const response = await apiClient.get('/parametros/tasa')
  return response.data
}

/** `forzar` salta la salvaguarda de variacion maxima del 15%. */
export const sincronizarTasa = async (forzar = false): Promise<Respuesta<ResultadoSincronizacion>> => {
  const response = await apiClient.post('/parametros/tasa/sincronizar', { forzar })
  return response.data
}
