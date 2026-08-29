/**
 * ============================================
 * SERVICE: COLECTA
 * ============================================
 * Cobro unificado: una busqueda por socio devuelve todo lo cobrable
 * (ahorro, funeraria, salud) y el cobro se registra en una sola transaccion.
 */

import apiClient from './api'

export type ServicioColecta = 'ahorro' | 'funeraria' | 'salud' | 'prestamo'

export interface Cobrable {
  tipo: ServicioColecta
  referencia_id: number
  titulo: string
  detalle: string
  saldo_usd: number | null
  saldo_bs: number | null
  semanas_sin_pago: number | null
  monto_sugerido_usd: number | null
  monto_semanal_usd?: number
  estado: string
}

export interface AsambleaOpcion {
  id: number
  titulo: string
  fecha: string
  tipo: string
}

export interface SocioColecta {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  estado: string
  telefono: string | null
  ubicacion: { id: number; codigo: string; direccion: string | null } | null
  cobrables: Cobrable[]
  /** Multiplicadores del subtotal: nu_fun y nu_sal del sistema viejo */
  cantidad_funeraria: number
  cantidad_salud: number
  cuota_funeraria_usd: number
  cuota_salud_usd: number
  /** Mayor atraso entre sus acuerdos: sugiere cuantas semanas cobrar */
  mayor_atraso: number
  asambleas_asistidas: number[]
  alertas: { socio_retirado: boolean; acuerdos_suspendidos: number }
}

export interface ResultadoBusqueda {
  encontrados: SocioColecta[]
  tasa: number
  asambleas: AsambleaOpcion[]
}

export interface DetalleColectaEnvio {
  servicio: 'ahorro' | 'funeraria' | 'salud' | 'prestamo'
  referencia_id: number
  monto_usd: number
  semanas?: number
  /** Cargo por reactivar un acuerdo suspendido: no cubre semanas */
  es_reintegro?: boolean
  concepto?: string | null
}

export interface DetalleColecta {
  id: number
  servicio: ServicioColecta
  referencia_id: number | null
  monto_usd: string | number
  monto_bs: string | number
  concepto: string | null
}

export interface FilaReporte {
  colecta_id: number
  fecha: string
  servicio: ServicioColecta
  codigo_socio: string
  cedula: string
  socio: string
  concepto: string | null
  monto_usd: number
  monto_bs: number
  cajero: string
}

export interface ReportePorServicio {
  desde: string
  hasta: string
  filas: FilaReporte[]
  resumen: {
    por_servicio: Record<string, { cantidad: number; usd: number; bs: number }>
    cantidad: number
    total_usd: number
    total_bs: number
  }
}

export interface LineaAsiento {
  cuenta: string
  nombre: string
  debe: number
  haber: number
}

export interface AsientoContable {
  desde: string
  hasta: string
  lineas: LineaAsiento[]
  totales: { debe: number; haber: number }
  cuadra: boolean
  cantidad_colectas: number
}

export interface Colecta {
  id: number
  socio_id: number
  fecha_colecta: string
  monto_total_usd: string | number
  monto_total_bs: string | number
  tasa_cambio: string | number
  observaciones: string | null
  reversada?: boolean
  fecha_reverso?: string | null
  motivo_reverso?: string | null
  detalles: DetalleColecta[]
  socio?: { codigo_socio: string; cedula: string; nombre: string; apellido: string }
  usuario?: { username: string; nombre_completo: string }
  semana_colecta?: { semana: number; ano: number }
}

export interface ResumenDia {
  cantidad: number
  total_usd: number
  total_bs: number
}

export interface TotalesCierre {
  ahorro_usd: number
  funeraria_usd: number
  salud_usd: number
  prestamos_usd: number
  ahorro_bs: number
  funeraria_bs: number
  salud_bs: number
  prestamos_bs: number
  total_usd: number
  total_bs: number
}

export interface PrevioCierre {
  desde: string
  hasta: string
  cantidad_transacciones: number
  totales: TotalesCierre
}

export interface CierreCaja {
  id: number
  fecha_cierre: string
  cantidad_transacciones: number
  total_general_usd: string | number
  total_general_bs: string | number
  total_ahorro_usd: string | number
  total_funeraria_usd: string | number
  total_salud_usd: string | number
  observaciones: string | null
  usuario?: { username: string; nombre_completo: string }
}

interface Respuesta<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

// ============================================
// COBRO
// ============================================

export const buscarSocio = async (termino: string): Promise<Respuesta<ResultadoBusqueda>> => {
  const response = await apiClient.get('/colecta/buscar', { params: { termino } })
  return response.data
}

export const registrarColecta = async (datos: {
  socio_id: number
  /** Semanas a cobrar: multiplica por igual los tres servicios */
  semanas: number
  semana_cobro?: number
  ano_cobro?: number
  referencia?: string | null
  asamblea_id?: number | null
  detalles: DetalleColectaEnvio[]
  observaciones?: string | null
}): Promise<Respuesta<Colecta>> => {
  const response = await apiClient.post('/colecta', datos)
  return response.data
}

export const obtenerColecta = async (id: number): Promise<Respuesta<Colecta>> => {
  const response = await apiClient.get(`/colecta/${id}`)
  return response.data
}

export const listarColectas = async (params?: {
  fecha?: string
  solo_mias?: boolean
}): Promise<Respuesta<{ colectas: Colecta[]; resumen: ResumenDia }>> => {
  const response = await apiClient.get('/colecta', { params })
  return response.data
}

// ============================================
// CIERRE DE CAJA
// ============================================

export const obtenerPrevioCierre = async (): Promise<Respuesta<PrevioCierre>> => {
  const response = await apiClient.get('/colecta/cierre/previo')
  return response.data
}

export const cerrarCaja = async (observaciones?: string | null): Promise<Respuesta<CierreCaja>> => {
  const response = await apiClient.post('/colecta/cierre', { observaciones: observaciones ?? null })
  return response.data
}

export const listarCierres = async (): Promise<Respuesta<CierreCaja[]>> => {
  const response = await apiClient.get('/colecta/cierres')
  return response.data
}

// ============================================
// REVERSO
// ============================================

export const reversarColecta = async (
  id: number,
  motivo: string
): Promise<Respuesta<{ id: number; reversada: boolean }>> => {
  const response = await apiClient.post(`/colecta/${id}/reversar`, { motivo })
  return response.data
}

// ============================================
// REPORTES
// ============================================

export const obtenerReportePorServicio = async (params: {
  desde: string
  hasta: string
  servicio?: string
  solo_mias?: boolean
}): Promise<Respuesta<ReportePorServicio>> => {
  const response = await apiClient.get('/colecta/reportes/por-servicio', { params })
  return response.data
}

export const obtenerAsientoContable = async (params: {
  desde: string
  hasta: string
}): Promise<Respuesta<AsientoContable>> => {
  const response = await apiClient.get('/colecta/reportes/asiento-contable', { params })
  return response.data
}
