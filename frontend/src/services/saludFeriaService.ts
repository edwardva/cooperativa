/**
 * ============================================
 * SERVICE: PAGO DE SALUD POR FERIA
 * ============================================
 * La feria paga la salud de sus trabajadores por semana, y puede pagar varias
 * semanas juntas. Quien debe, cuanto y si cuadra lo calcula el backend.
 */

import apiClient from './api'

export type TipoPeriodo = 'mensual' | 'semanal'

export interface Periodo {
  tipo: TipoPeriodo
  anio: number
  numero: number
  inicio: string
  fin: string
  etiqueta: string
}

export interface PeriodoGuardado {
  id: number
  tipo: TipoPeriodo
  anio: number
  numero: number
  fecha_inicio: string
  fecha_fin: string
  etiqueta: string
}

export interface Configuracion {
  periodicidad: TipoPeriodo
  tarifa_usd: number
  tarifa_configurada: boolean
  tasa: number
  periodo_actual: Periodo
  /** Tope de periodos en un solo pago */
  max_periodos: number
  metodos_pago: string[]
}

export interface FilaDeuda {
  trabajador_id: number
  codigo_trabajador: string
  identificacion: string
  nombre: string
  estado_trabajador: string
  estado: 'pendiente' | 'pagado'
  monto_usd: number
  pago_id: number | null
}

export interface ResumenDeuda {
  total: number
  pagados: number
  pendientes: number
  monto_individual_usd: number
  monto_pagado_usd: number
  monto_pendiente_usd: number
}

export interface PeriodoDeTrabajador {
  anio: number
  numero: number
  etiqueta: string
  estado: 'pendiente' | 'pagado'
  monto_usd: number
  pago_id: number | null
}

/** Un trabajador con sus periodos del rango: solo aquellos en que su salud le toca a esta feria */
export interface FilaDeudaRango {
  trabajador_id: number
  codigo_trabajador: string
  identificacion: string
  nombre: string
  estado_trabajador: string
  periodos: PeriodoDeTrabajador[]
  pendientes: number
  pagados: number
  monto_pendiente_usd: number
  estado: 'pendiente' | 'parcial' | 'pagado'
}

export interface Deuda {
  feria: { id: number; codigo: string; nombre: string; direccion: string | null; responsable: string | null; estado: boolean }
  desde: Periodo
  hasta: Periodo
  etiqueta: string
  cantidad_periodos: number
  periodos: (Periodo & { id: number | null; trabajadores: number; pendientes: number })[]
  tarifa_usd: number
  filas: FilaDeudaRango[]
  resumen: {
    trabajadores: number
    trabajadores_con_pendiente: number
    periodos: number
    renglones_pagados: number
    /** Movimientos individuales que genera el pago: trabajador × periodo pendiente */
    renglones_pendientes: number
    monto_individual_usd: number
    monto_pagado_usd: number
    monto_pendiente_usd: number
  }
  tasa: number
  monto_pendiente_bs: number
  tarifa_configurada: boolean
  /** Algun periodo del rango todavia no empieza */
  periodo_futuro: boolean
}

export interface FeriaPendiente extends ResumenDeuda {
  feria: { id: number; codigo: string; nombre: string; direccion: string | null; responsable: string | null; telefono: string | null; estado: boolean }
  monto_pendiente_bs: number
  estado: 'sin_trabajadores' | 'pagada' | 'parcial' | 'pendiente'
}

export interface FeriasPendientes {
  periodo: Periodo
  tarifa_usd: number
  tasa: number
  ferias: FeriaPendiente[]
  totales: { ferias_con_deuda: number; trabajadores_pendientes: number; monto_pendiente_usd: number }
}

export interface PagoResumen {
  id: number
  feria_id: number
  fecha_pago: string
  cantidad_periodos: number
  cantidad_trabajadores: number
  tarifa_usd: string
  monto_esperado_usd: string
  tasa_cambio: string
  monto_esperado_bs: string
  moneda: 'BS' | 'USD'
  monto_recibido: string
  metodo_pago: string
  referencia: string | null
  observaciones: string | null
  estado: 'vigente' | 'anulado'
  created_at: string
  fecha_anulacion: string | null
  motivo_anulacion: string | null
  feria: { id: number; codigo: string; nombre: string; direccion: string | null }
  /** Primer y ultimo periodo que cubre el pago */
  periodo: PeriodoGuardado
  periodo_hasta: PeriodoGuardado
  etiqueta_periodos: string
}

export interface PagoDetalle extends PagoResumen {
  /** Un renglon por trabajador y periodo */
  detalles: {
    id: number
    trabajador_id: number
    monto_usd: string
    estado: 'vigente' | 'anulado'
    periodo: PeriodoGuardado
    trabajador: {
      id: number
      codigo_trabajador: string
      persona: { tipo_identificacion: string; numero_identificacion: string; nombres: string; apellidos: string }
    }
  }[]
  registrado_por: { id: number; nombre_completo: string; username: string } | null
  anulado_por_usuario: { id: number; nombre_completo: string; username: string } | null
  suma_detalles_usd: number
  cuadra: boolean
}

export interface PagoDeTrabajador {
  id: number
  pago_id: number
  monto_usd: string
  estado: 'vigente' | 'anulado'
  periodo: PeriodoGuardado
  feria: { id: number; codigo: string; nombre: string; direccion: string | null }
  pago: { id: number; fecha_pago: string; referencia: string | null; estado: 'vigente' | 'anulado' }
}

export interface NuevoPago {
  feria_id: number
  tipo: TipoPeriodo
  anio: number
  numero: number
  /** Periodos seguidos desde anio/numero */
  cantidad: number
  fecha_pago: string
  moneda: 'BS' | 'USD'
  monto_recibido: number
  metodo_pago: string
  referencia?: string | null
  observaciones?: string | null
  esperado: { cantidad_trabajadores: number; cantidad_renglones: number; monto_usd: number }
  aceptar_diferencia?: boolean
}

interface Respuesta<T> {
  success: boolean
  data: T
  message?: string
  meta?: { total: number; page: number; totalPages: number }
}

type ParamsPeriodo = { tipo: TipoPeriodo; anio: number; numero: number }

export const obtenerConfiguracion = async (): Promise<Respuesta<Configuracion>> =>
  (await apiClient.get('/salud-feria/configuracion')).data

export const obtenerDeuda = async (feriaId: number, periodo: ParamsPeriodo & { cantidad: number }): Promise<Respuesta<Deuda>> =>
  (await apiClient.get(`/salud-feria/ferias/${feriaId}/deuda`, { params: periodo })).data

export const obtenerFeriasPendientes = async (periodo: ParamsPeriodo): Promise<Respuesta<FeriasPendientes>> =>
  (await apiClient.get('/salud-feria/ferias-pendientes', { params: periodo })).data

export const listarPagos = async (params: {
  feria_id?: number
  estado?: string
  referencia?: string
  trabajador?: string
  page?: number
  limit?: number
}): Promise<Respuesta<PagoResumen[]>> => (await apiClient.get('/salud-feria/pagos', { params })).data

export const obtenerPago = async (id: number): Promise<Respuesta<PagoDetalle>> =>
  (await apiClient.get(`/salud-feria/pagos/${id}`)).data

export const registrarPago = async (datos: NuevoPago): Promise<Respuesta<PagoDetalle>> =>
  (await apiClient.post('/salud-feria/pagos', datos)).data

export const anularPago = async (id: number, motivo: string): Promise<Respuesta<PagoDetalle>> =>
  (await apiClient.post(`/salud-feria/pagos/${id}/anular`, { motivo })).data

export const historialTrabajador = async (trabajadorId: number): Promise<Respuesta<PagoDeTrabajador[]>> =>
  (await apiClient.get(`/salud-feria/trabajadores/${trabajadorId}/pagos`)).data
