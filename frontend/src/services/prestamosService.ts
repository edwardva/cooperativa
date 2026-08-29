/**
 * ============================================
 * SERVICE: PRESTAMOS
 * ============================================
 * Amortizacion con cuota fija semanal. Los abonos se aplican en el orden
 * mora -> interes -> capital.
 */

import apiClient from './api'

export type EstadoPrestamo = 'activo' | 'saldado' | 'moroso' | 'refinanciado' | 'cancelado'
export type EstadoCuota = 'pendiente' | 'pagada' | 'vencida'

export interface TipoPrestamo {
  id: number
  codigo: string
  nombre: string
  descripcion?: string | null
  tasa_interes_anual: string | number
  tasa_mora_mensual: string | number
  plazo_maximo_semanas: number
  requiere_fiadores: boolean
  estado: boolean
}

export interface CuotaPlan {
  id?: number
  numero_cuota: number
  fecha_vencimiento: string
  monto_capital_usd: string | number
  monto_interes_usd: string | number
  monto_total_usd: string | number
  estado?: EstadoCuota
  fecha_pago?: string | null
}

export interface Simulacion {
  tipo_prestamo: { id: number; codigo: string; nombre: string }
  monto_usd: number
  plazo_semanas: number
  tasa_interes_anual: number
  tasa_cambio: number
  requiere_fiadores: boolean
  cuota_semanal_usd: number
  cuota_semanal_bs: number
  total_interes_usd: number
  total_a_pagar_usd: number
  total_a_pagar_bs: number
  plan: CuotaPlan[]
}

export interface SocioResumen {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  telefono?: string | null
}

export interface Fiador {
  id: number
  socio_id: number
  monto_garantizado_usd: string | number
  monto_bloqueado_usd: string | number
  estado: 'activo' | 'liberado'
  fecha_liberacion?: string | null
  socio: SocioResumen
}

export interface AbonoPrestamo {
  id: number
  monto_usd: string | number
  monto_bs: string | number
  aplicado_capital_usd: string | number
  aplicado_interes_usd: string | number
  aplicado_mora_usd: string | number
  concepto: string | null
  fecha_abono: string
}

export interface Prestamo {
  id: number
  numero_prestamo: string
  socio_id: number
  monto_original_usd: string | number
  cuota_semanal_usd: string | number
  saldo_capital_usd: string | number
  saldo_interes_usd: string | number
  saldo_mora_usd: string | number
  plazo_semanas: number
  tasa_interes: string | number
  estado: EstadoPrestamo
  fecha_desembolso: string
  fecha_vencimiento: string
  socio: SocioResumen
  tipo_prestamo: { codigo: string; nombre: string }
  _count?: { abonos: number; fiadores: number }
}

export interface PrestamoDetalle extends Prestamo {
  fiadores: Fiador[]
  plan_pagos: CuotaPlan[]
  abonos: AbonoPrestamo[]
  resumen: {
    cuotas_totales: number
    cuotas_pagadas: number
    cuotas_vencidas: number
    total_abonado_usd: number
    deuda_total_usd: number
    avance_porcentaje: number
  }
}

export interface FilaCartera {
  id: number
  numero_prestamo: string
  codigo_socio: string
  cedula: string
  socio: string
  telefono: string | null
  tipo: string
  monto_original_usd: number
  saldo_capital_usd: number
  saldo_mora_usd: number
  deuda_total_usd: number
  cuotas_pagadas: number
  cuotas_vencidas: number
  cuotas_totales: number
  estado: EstadoPrestamo
  fecha_desembolso: string
  fecha_vencimiento: string
}

export interface ReporteCartera {
  vista: string
  filas: FilaCartera[]
  resumen: { cantidad: number; otorgado_usd: number; por_cobrar_usd: number; mora_usd: number }
}

interface Respuesta<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
  meta?: {
    total: number
    page: number
    totalPages: number
    totales: { otorgado_usd: number; capital_usd: number; interes_usd: number; mora_usd: number }
  }
}

// ============================================
// CONSULTAS
// ============================================

export const listarPrestamos = async (params?: {
  estado?: string
  socio_id?: number
  busqueda?: string
  page?: number
  limit?: number
}): Promise<Respuesta<Prestamo[]>> => {
  const response = await apiClient.get('/prestamos', { params })
  return response.data
}

export const obtenerPrestamo = async (id: number): Promise<Respuesta<PrestamoDetalle>> => {
  const response = await apiClient.get(`/prestamos/${id}`)
  return response.data
}

export const prestamosPorSocio = async (socioId: number): Promise<Respuesta<Prestamo[]>> => {
  const response = await apiClient.get(`/prestamos/socio/${socioId}`)
  return response.data
}

export const obtenerCartera = async (vista: string): Promise<Respuesta<ReporteCartera>> => {
  const response = await apiClient.get('/prestamos/reportes/cartera', { params: { vista } })
  return response.data
}

// ============================================
// OPERACIONES
// ============================================

export const simular = async (params: {
  tipo_prestamo_id: number
  monto_usd: number
  plazo_semanas: number
  fecha_desembolso?: string
}): Promise<Respuesta<Simulacion>> => {
  const response = await apiClient.get('/prestamos/simular', { params })
  return response.data
}

export const crearPrestamo = async (datos: {
  socio_id: number
  tipo_prestamo_id: number
  monto_usd: number
  plazo_semanas: number
  fecha_desembolso: string
  fiadores: { socio_id: number; monto_garantizado_usd: number }[]
}): Promise<Respuesta<PrestamoDetalle>> => {
  const response = await apiClient.post('/prestamos', datos)
  return response.data
}

export const registrarAbono = async (
  id: number,
  monto_usd: number,
  concepto?: string | null
): Promise<Respuesta<{ reparto: { mora: number; interes: number; capital: number }; saldado: boolean }>> => {
  const response = await apiClient.post(`/prestamos/${id}/abonos`, { monto_usd, concepto: concepto ?? null })
  return response.data
}

export const obtenerTiposPrestamo = async (): Promise<Respuesta<TipoPrestamo[]>> => {
  const response = await apiClient.get('/tipos-prestamo')
  return response.data
}
