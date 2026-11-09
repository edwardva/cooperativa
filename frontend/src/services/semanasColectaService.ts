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

// Misma regla que el backend (utils/calendarioSemanal.ts): semanas de lunes a
// domingo y la semana 1 es la que CONTIENE EL 1 DE ENERO, salvo los años que
// la funeraria pidió cerrar en 53 (confirmados en Semanas de colecta, 10/11).
// Los años confirmados se traen con `cargarAnosConfirmados`.

const MS_DIA = 86400000
const MS_SEMANA = 7 * MS_DIA

let largos = new Map<number, number>()

/** Trae los años confirmados (52 o 53). Llamarlo antes de calcular semanas */
export const cargarAnosConfirmados = async (): Promise<void> => {
  try {
    const response = await apiClient.get('/semanas-colecta/anos')
    const anos = (response.data?.data ?? []) as { ano: number; semanas: number }[]
    largos = new Map(anos.map((a) => [a.ano, a.semanas]))
  } catch {
    // Sin respuesta se sigue la regla sola, que es lo que rige casi siempre
  }
}

const lunesQueContieneElPrimero = (ano: number): number => {
  const primeroEnero = new Date(Date.UTC(ano, 0, 1))
  const dia = primeroEnero.getUTCDay() || 7
  return primeroEnero.getTime() - (dia - 1) * MS_DIA
}

/** Lunes (UTC, ms) de la semana 1 del año, con los años confirmados */
const inicioDeAno = (ano: number): number => {
  const menor = largos.size ? Math.min(...largos.keys()) : Infinity
  if (ano <= menor) return lunesQueContieneElPrimero(ano)
  const previo = inicioDeAno(ano - 1)
  const semanas =
    largos.get(ano - 1) ??
    Math.min(53, Math.max(52, Math.round((lunesQueContieneElPrimero(ano) - previo) / MS_SEMANA)))
  return previo + semanas * MS_SEMANA
}

/**
 * Semana y AÑO del calendario de colecta para una fecha. El año puede no ser el
 * de la fecha: del 28 al 31/12/2026 ya es la semana 1 de 2027.
 */
export const periodoDeFecha = (fecha: Date): { semana: number; ano: number } => {
  const utc = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dia = new Date(utc).getUTCDay() || 7
  const lunes = utc - (dia - 1) * MS_DIA
  let ano = new Date(lunes + 6 * MS_DIA).getUTCFullYear()
  while (lunes < inicioDeAno(ano)) ano--
  while (lunes >= inicioDeAno(ano + 1)) ano++
  const semana = Math.round((lunes - inicioDeAno(ano)) / MS_SEMANA) + 1
  return { semana, ano }
}

/** Número de semana de una fecha. Para el año, usar `periodoDeFecha`. */
export const numeroDeSemana = (fecha: Date): number => periodoDeFecha(fecha).semana

/**
 * Lunes y domingo de una semana. Evita que el operador tenga que calcular
 * las fechas a mano, que es donde se cometen los errores.
 */
export const rangoDeSemana = (semana: number, ano: number): { inicio: string; fin: string } => {
  const lunes = new Date(inicioDeAno(ano) + (semana - 1) * MS_SEMANA)
  const domingo = new Date(lunes.getTime() + 6 * MS_DIA)

  return {
    inicio: lunes.toISOString().slice(0, 10),
    fin: domingo.toISOString().slice(0, 10),
  }
}

// ============================================
// CIERRE DEL AÑO: 52 o 53 semanas (10/11)
// ============================================

export interface EstadoCierreAno {
  ano: number
  semanas: number
  semanas_por_regla: number
  confirmado: boolean
  confirmado_por: string | null
  fecha_confirmacion: string | null
  cierra_el: string
  siguiente_arranca_el: string
  semana_en_disputa: { inicio: string; fin: string }
  puede_cambiar: boolean
  mostrar_aviso: boolean
}

/** Sin año: el del calendario en curso */
export const obtenerCierreAno = async (ano?: number): Promise<Respuesta<EstadoCierreAno>> => {
  const response = await apiClient.get(`/semanas-colecta/cierre-ano${ano ? `/${ano}` : ''}`)
  return response.data
}

export const confirmarCierreAno = async (
  ano: number,
  semanas: 52 | 53,
  observaciones?: string
): Promise<Respuesta<{ estado: EstadoCierreAno; filas_rerotuladas: number }>> => {
  const response = await apiClient.put(`/semanas-colecta/cierre-ano/${ano}`, { semanas, observaciones })
  if (response.data?.success) await cargarAnosConfirmados()
  return response.data
}
