/**
 * ============================================
 * SERVICE: SEMANAS DE COLECTA
 * ============================================
 * La tasa semanal USD/Bs vive aca. Sin una semana ACTIVA no se puede cobrar:
 * el modulo de Colecta toma la tasa de la semana activa mas reciente.
 */

import apiClient from './api'

export interface SemanaColecta {
  id: number
  semana: number
  ano: number
  tasa_usd_bs: string | number
  meta_ahorro: string | number | null
  meta_funeraria: string | number | null
  meta_salud: string | number | null
  fecha_inicio: string
  fecha_fin: string
  estado: boolean
  _count?: { colectas: number }
}

export interface SemanaColectaFormData {
  semana: number
  ano: number
  tasa_usd_bs: number
  meta_ahorro?: number
  meta_funeraria?: number
  meta_salud?: number
  fecha_inicio: string
  fecha_fin: string
  estado?: boolean
}

interface Respuesta<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

export const obtenerSemanas = async (): Promise<Respuesta<SemanaColecta[]>> => {
  const response = await apiClient.get('/semanas-colecta')
  return response.data
}

export const obtenerSemanaActual = async (): Promise<Respuesta<SemanaColecta | null>> => {
  const response = await apiClient.get('/semanas-colecta/actual')
  return response.data
}

export const crearSemana = async (data: SemanaColectaFormData): Promise<Respuesta<SemanaColecta>> => {
  const response = await apiClient.post('/semanas-colecta', data)
  return response.data
}

export const actualizarSemana = async (
  id: number,
  data: Partial<SemanaColectaFormData>
): Promise<Respuesta<SemanaColecta>> => {
  const response = await apiClient.put(`/semanas-colecta/${id}`, data)
  return response.data
}

export const eliminarSemana = async (id: number): Promise<Respuesta<{ id: number }>> => {
  const response = await apiClient.delete(`/semanas-colecta/${id}`)
  return response.data
}

// ============================================
// AYUDAS DE CALENDARIO
// ============================================

/** Numero de semana ISO-8601 de una fecha (lunes como primer dia). */
export const numeroDeSemana = (fecha: Date): number => {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dia = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dia)
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7)
}

/**
 * Lunes y domingo de una semana ISO. Evita que el operador tenga que calcular
 * las fechas a mano, que es donde se cometen los errores.
 */
export const rangoDeSemana = (semana: number, ano: number): { inicio: string; fin: string } => {
  const cuatroEnero = new Date(Date.UTC(ano, 0, 4))
  const diaSemana = cuatroEnero.getUTCDay() || 7
  const lunesSemana1 = new Date(cuatroEnero)
  lunesSemana1.setUTCDate(cuatroEnero.getUTCDate() - diaSemana + 1)

  const lunes = new Date(lunesSemana1)
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (semana - 1) * 7)

  const domingo = new Date(lunes)
  domingo.setUTCDate(lunes.getUTCDate() + 6)

  return {
    inicio: lunes.toISOString().slice(0, 10),
    fin: domingo.toISOString().slice(0, 10),
  }
}
