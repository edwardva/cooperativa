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

// Misma regla que el backend (utils/calendarioSemanal.ts), confirmada por la
// cooperativa el 23/10: semanas de lunes a domingo, y la semana 1 es la que
// CONTIENE EL 1 DE ENERO ("la semana 53 es la semana 1 del próximo año").

const MS_DIA = 86400000

/** Lunes (UTC) de la semana 1 del año: el de la semana que contiene el 1 de enero */
const lunesSemana1 = (ano: number): Date => {
  const primeroEnero = new Date(Date.UTC(ano, 0, 1))
  const dia = primeroEnero.getUTCDay() || 7
  return new Date(primeroEnero.getTime() - (dia - 1) * MS_DIA)
}

/**
 * Semana y AÑO del calendario de colecta para una fecha. El año puede no ser el
 * de la fecha: del 28 al 31/12/2026 ya es la semana 1 de 2027.
 */
export const periodoDeFecha = (fecha: Date): { semana: number; ano: number } => {
  const utc = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dia = new Date(utc).getUTCDay() || 7
  const lunes = utc - (dia - 1) * MS_DIA
  const ano = new Date(lunes + 6 * MS_DIA).getUTCFullYear()
  const semana = Math.round((lunes - lunesSemana1(ano).getTime()) / (7 * MS_DIA)) + 1
  return { semana, ano }
}

/** Número de semana de una fecha. Para el año, usar `periodoDeFecha`. */
export const numeroDeSemana = (fecha: Date): number => periodoDeFecha(fecha).semana

/**
 * Lunes y domingo de una semana. Evita que el operador tenga que calcular
 * las fechas a mano, que es donde se cometen los errores.
 */
export const rangoDeSemana = (semana: number, ano: number): { inicio: string; fin: string } => {
  const primerLunes = lunesSemana1(ano)

  const lunes = new Date(primerLunes)
  lunes.setUTCDate(primerLunes.getUTCDate() + (semana - 1) * 7)

  const domingo = new Date(lunes)
  domingo.setUTCDate(lunes.getUTCDate() + 6)

  return {
    inicio: lunes.toISOString().slice(0, 10),
    fin: domingo.toISOString().slice(0, 10),
  }
}
