/**
 * ============================================
 * SERVICE: COLECTA
 * ============================================
 * Cobro unificado: una busqueda por socio devuelve todo lo cobrable
 * (ahorro, funeraria, salud) y el cobro se registra en una sola transaccion.
 */

import apiClient from './api'

export type ServicioColecta = 'ahorro' | 'funeraria' | 'salud' | 'prestamo'

/** El par (anio, semana) con el que se mide la cobertura de un servicio */
export interface Periodo {
  ano: number
  semana: number
}

export interface MovimientoAhorroReciente {
  /** Correlativo dentro de la libreta */
  item: number
  id: number
  tipo: string
  monto_usd: number
  monto_bs: number
  /** Saldo con el que quedo la cuenta despues del movimiento */
  saldo_usd: number
  saldo_bs: number
  moneda: string
  canal: string
  /** CAJ_DIG cuando vino del cajero digital, como en el sistema actual */
  documento: string
  concepto: string | null
  referencia: string | null
  fecha: string
}

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
  /** Hasta que (anio, semana) esta pagado el servicio */
  pagado_hasta?: Periodo | null
  pagado_hasta_texto?: string
  /** Cuando se cobro, que es OTRO dato distinto de hasta cuando cubre */
  fecha_ultimo_pago?: string | null
  semanas_adelantadas?: number
  /** Solo en cuentas de ahorro */
  codigo_tipo?: string
  bloqueado_usd?: number
  disponible_usd?: number
  movimientos_recientes?: MovimientoAhorroReciente[]
  /** Solo en prestamos: se muestran las dos monedas a la vez */
  categoria?: string
  numero_pagare?: string
  /** Moneda de otorgamiento (BS o USD), aparte de la categoria */
  moneda?: string
  fecha_desembolso?: string
  fecha_ultimo_abono?: string | null
  monto_original_usd?: number
  monto_original_bs?: number
  abonado_usd?: number
  abonado_bs?: number
  saldo_capital_usd?: number
  saldo_interes_usd?: number
  saldo_mora_usd?: number
  cuota_semanal_usd?: number
  cuota_semanal_bs?: number
}

/** Resumen POR SERVICIO para la cabecera: una fila por servicio, no por semana */
export interface ResumenServicio {
  servicio: 'funeraria' | 'salud'
  referencia_id: number
  titulo: string
  detalle: string
  numero_acuerdo: string | null
  tarifa_semanal_usd: number
  fecha_ultimo_pago: string | null
  pagado_hasta: Periodo | null
  pagado_hasta_texto: string
  /** Fecha (domingo) hasta la que cubre esa semana */
  pagado_hasta_fecha: string | null
  semanas_pendientes: number
  semanas_adelantadas: number
  estado: string
  estado_calculado: 'vigente' | 'atrasado' | 'suspendido'
  /** El estado guardado no coincide con lo que dice la cobertura */
  requiere_revision: boolean
  monto_al_dia_usd: number
}

/** Tarifas de SOLO LECTURA: la pantalla las muestra, no las edita */
export interface TarifasColecta {
  ahorro_usd: number
  funeraria_usd: number
  salud_usd: number
  max_semanas_adelanto: number
  bloquear_adelanto_excedido: boolean
  semanas_suspension_funeraria: number
  semanas_suspension_salud: number
}

export interface RenglonPaquete {
  servicio: 'ahorro' | 'funeraria' | 'salud'
  referencia_id: number
  titulo: string
  semanas: number
  tarifa_unitaria_usd: number
  monto_usd: number
  monto_bs: number
  cobertura_antes: Periodo | null
  cobertura_despues: Periodo | null
}

/** Desglose del cobro semanal: ahorro + servicios contratados */
export interface PaqueteSemanal {
  semanas: number
  tasa: number
  renglones: RenglonPaquete[]
  totales: {
    ahorro_usd: number
    funeraria_usd: number
    salud_usd: number
    total_usd: number
    ahorro_bs: number
    funeraria_bs: number
    salud_bs: number
    total_bs: number
  }
  /** Avisos que el cajero debe ver pero que no impiden cobrar */
  advertencias: string[]
  tarifas?: TarifasColecta
  semana_actual?: Periodo
  semana_actual_texto?: string
  semanas_pendientes?: number
  semanas_adelantadas?: number
  acuerdos_suspendidos?: number
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
  es_trabajador?: boolean
  cobrables: Cobrable[]

  /** Vistas ya resueltas por el backend para la pantalla principal */
  cuentas_ahorro: Cobrable[]
  cuenta_ahorro_obligatorio_id: number | null
  servicios: ResumenServicio[]
  prestamos: Cobrable[]
  semanas_para_ponerse_al_dia: number
  paquete_sugerido: PaqueteSemanal

  /** Indicadores de cabecera: ult_sem, atraso y suspendido */
  ultima_semana_pagada: Periodo | null
  ultima_semana_pagada_texto: string
  atraso: number
  suspendido: number

  /** Multiplicadores del subtotal: nu_fun y nu_sal del sistema viejo */
  cantidad_funeraria: number
  cantidad_salud: number
  cuota_funeraria_usd: number
  cuota_salud_usd: number
  /** Mayor atraso entre sus acuerdos: sugiere cuantas semanas cobrar */
  mayor_atraso: number
  asambleas_asistidas: number[]
  alertas: {
    socio_retirado: boolean
    acuerdos_suspendidos: number
    servicios_a_revisar: number
    ahorro_bloqueado_usd: number
  }
}

export interface ResultadoBusqueda {
  encontrados: SocioColecta[]
  tasa: number
  asambleas: AsambleaOpcion[]
  tarifas: TarifasColecta
  semana_actual: Periodo
  semana_actual_texto: string
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
  /** Numero de acuerdo del servicio, que el cliente pidio ver en el listado */
  numero_acuerdo: string | null
  semanas: number | null
  /** Hasta que ano y semana quedo pagado con este cobro */
  pagado_hasta: Periodo | null
  pagado_hasta_texto: string
  es_reintegro: boolean
  concepto: string | null
  monto_usd: number
  monto_bs: number
  cajero: string
  cajero_nombre: string
  oficina: string | null
  canal: string
}

export interface ReportePorServicio {
  desde: string
  hasta: string
  filas: FilaReporte[]
  resumen: {
    por_servicio: Record<string, { cantidad: number; personas: number; usd: number; bs: number }>
    cantidad: number
    /** Socios distintos, no operaciones */
    personas: number
    total_usd: number
    total_bs: number
  }
}

/** Totales de un corte del cuadre (una oficina, un colector, un canal) */
export interface TotalesCuadre {
  ahorro_usd: number
  funeraria_usd: number
  salud_usd: number
  prestamos_usd: number
  total_usd: number
  ahorro_bs: number
  funeraria_bs: number
  salud_bs: number
  prestamos_bs: number
  total_bs: number
  operaciones: number
  personas: number
}

export interface CorteCuadre {
  clave: string
  nombre: string
  totales: TotalesCuadre
}

export interface FilaDetalleCaja {
  colecta_id: number
  fecha: string
  codigo_socio: string
  socio: string
  oficina: string | null
  colector: string
  canal: string
  semanas: number
  monto_usd: number
  monto_bs: number
}

/** Cuadre por oficina, colector y canal, mas el consolidado general */
export interface ReporteCaja {
  desde: string
  hasta: string
  por_oficina: CorteCuadre[]
  por_colector: CorteCuadre[]
  por_canal: CorteCuadre[]
  consolidado: TotalesCuadre
  detalle: FilaDetalleCaja[]
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
  ubicacion_id?: number | null
  canal?: 'presencial' | 'digital'
  detalles: DetalleColectaEnvio[]
  observaciones?: string | null
}): Promise<Respuesta<Colecta>> => {
  const response = await apiClient.post('/colecta', datos)
  return response.data
}

/**
 * Importe del paquete semanal.
 *
 * El cajero escribe cuantas semanas paga el socio y esto devuelve el desglose
 * de ahorro, funeraria y salud con el total en USD y en bolivares. Las tarifas
 * vienen de parametros: la pantalla las muestra, no las edita.
 */
export const calcularPaquete = async (params: {
  socio_id: number
  semanas: number
  ahorro_adicional_usd?: number
}): Promise<Respuesta<PaqueteSemanal>> => {
  const response = await apiClient.get('/colecta/calcular', { params })
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
  desde?: string
  hasta?: string
  /** AAAA-MM: el ingreso del mes sin tener que sumar los reportes diarios */
  mes?: string
  servicio?: string
  solo_mias?: boolean
  ubicacion_id?: number
  canal?: string
}): Promise<Respuesta<ReportePorServicio>> => {
  const response = await apiClient.get('/colecta/reportes/por-servicio', { params })
  return response.data
}

/** Una linea del archivo que se envia a la funeraria externa */
export interface FilaFuneraria {
  socio: string
  acuerdo: string
  nombre: string
  semana: number | null
  monto_bs: number
}

export interface ExportacionFuneraria {
  desde: string
  hasta: string
  filas: FilaFuneraria[]
  cantidad: number
  total_bs: number
  /** Primeros caracteres del archivo tal cual se va a enviar */
  vista_previa: string
}

/**
 * Vista previa del archivo de pagos de funeraria. El personal quiere ver que
 * va a enviar antes de descargarlo.
 */
export const obtenerExportacionFuneraria = async (params: {
  desde?: string
  hasta?: string
  mes?: string
}): Promise<Respuesta<ExportacionFuneraria>> => {
  const response = await apiClient.get('/colecta/reportes/funeraria', {
    params: { ...params, formato: 'json' },
  })
  return response.data
}

/** URL de descarga del archivo. Va por el mismo origen, con la sesion activa. */
export const urlExportacionFuneraria = (params: {
  desde?: string
  hasta?: string
  mes?: string
}): string => {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  )
  return `/api/colecta/reportes/funeraria?${q.toString()}`
}

/**
 * Cuadre de caja: detalle por oficina, por colector y por canal, mas el
 * consolidado general. Evita sumar a mano los reportes diarios de cada oficina.
 */
export const obtenerReporteCaja = async (params: {
  desde?: string
  hasta?: string
  mes?: string
  ubicacion_id?: number
  usuario_id?: number
  canal?: string
}): Promise<Respuesta<ReporteCaja>> => {
  const response = await apiClient.get('/colecta/reportes/caja', { params })
  return response.data
}

export const obtenerAsientoContable = async (params: {
  desde: string
  hasta: string
}): Promise<Respuesta<AsientoContable>> => {
  const response = await apiClient.get('/colecta/reportes/asiento-contable', { params })
  return response.data
}
