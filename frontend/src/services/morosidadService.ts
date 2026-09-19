/**
 * ============================================
 * SERVICE: MOROSIDAD
 * ============================================
 * Revisión del atraso de los socios: suspensiones, reactivaciones y el retiro
 * de la semana 41. Por defecto SIMULA; aplicar es una decisión explícita.
 */

import apiClient from './api'

export type AccionMorosidad = 'suspender' | 'extender' | 'reactivar' | 'retirar'

export interface CambioMorosidad {
  socio_id: number
  codigo_socio: string
  socio: string
  semanas_atraso: number
  accion: AccionMorosidad
  estado_anterior: string
  estado_nuevo: string
  suspendido_desde: string | null
  suspendido_hasta: string | null
  motivo: string
  ahorro_usd?: number
  prestamos_abiertos?: number
}

export interface ResultadoMorosidad {
  hasta: string
  aplicado: boolean
  cambios: CambioMorosidad[]
  totales: { revisados: number; suspender: number; extender: number; reactivar: number; retirar: number }
}

export interface FilaHistorial {
  id: number
  fecha: string
  socio_id: number
  codigo_socio: string
  socio: string
  feria: string | null
  estado_anterior: string
  estado_nuevo: string
  motivo: string
  origen: string
  semanas_atraso: number | null
  suspendido_hasta: string | null
  usuario: string
}

interface Respuesta<T> {
  success: boolean
  data: T
  message?: string
}

export const revisarMorosidad = async (aplicar: boolean): Promise<Respuesta<ResultadoMorosidad>> => {
  const { data } = await apiClient.post('/morosidad/revisar', { aplicar })
  return data
}

export const historialMorosidad = async (socioId?: number): Promise<Respuesta<FilaHistorial[]>> => {
  const { data } = await apiClient.get('/morosidad/historial', {
    params: socioId ? { socio_id: socioId } : undefined,
  })
  return data
}

export const reactivarSocio = async (
  socioId: number,
  motivo: string,
  forzar = false
): Promise<Respuesta<{ codigo_socio: string }>> => {
  const { data } = await apiClient.post('/morosidad/reactivar', { socio_id: socioId, motivo, forzar })
  return data
}
