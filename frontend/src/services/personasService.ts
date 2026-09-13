/**
 * ============================================
 * SERVICE: PERSONAS
 * ============================================
 * La identidad que comparten el expediente de ahorrista y el de trabajador.
 */

import apiClient from './api'
import type { AsociacionFeria, EstadoTrabajador, FeriaActual, PruebaTrabajador, SaludTrabajador } from './trabajadoresService'

export type TipoIdentificacion = 'V' | 'E' | 'J' | 'P'

export const TIPOS_IDENTIFICACION: { value: TipoIdentificacion; label: string }[] = [
  { value: 'V', label: 'V - Venezolano' },
  { value: 'E', label: 'E - Extranjero' },
  { value: 'J', label: 'J - RIF' },
  { value: 'P', label: 'P - Pasaporte' },
]

export interface DatosPersona {
  tipo_identificacion: TipoIdentificacion
  numero_identificacion: string
  nombres: string
  apellidos: string
  sexo?: 'M' | 'F' | null
  fecha_nacimiento?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
}

export interface Persona extends DatosPersona {
  id: number
  estado: 'activo' | 'inactivo' | 'fallecido'
  created_at: string
}

export interface ExpedienteAhorrista {
  id: number
  codigo_socio: string
  estado: 'activo' | 'retirado' | 'invalido'
  fecha_inscripcion: string
  ubicacion?: { codigo: string; nombre: string } | null
}

export interface ExpedienteTrabajador {
  id: number
  codigo_trabajador: string
  estado: EstadoTrabajador
  fecha_ingreso: string
  ferias: AsociacionFeria[]
  feria_actual: FeriaActual | null
  salud: SaludTrabajador
  prueba: PruebaTrabajador
}

export interface PersonaConExpedientes extends Persona {
  socios: ExpedienteAhorrista[]
  trabajadores: ExpedienteTrabajador[]
}

/** Socio anterior a la fase 2 que todavia no tiene persona */
export interface SocioSinPersona {
  id: number
  codigo_socio: string
  nombre: string
  apellido: string
  sexo: 'M' | 'F' | null
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  estado: string
  fecha_inscripcion: string
}

export interface ResultadoIdentificacion {
  numero_identificacion: string
  persona: PersonaConExpedientes | null
  socios_sin_persona: SocioSinPersona[]
  /** Trabajador que todavia no cumple la prueba, si se lo quiere inscribir como ahorrista */
  advertencias_ahorrista: string[]
}

interface Respuesta<T> {
  success: boolean
  data: T
  message?: string
}

export interface PersonaListada extends Persona {
  _count: { socios: number; trabajadores: number }
}

export interface ServicioFicha {
  servicio: 'funeraria' | 'salud'
  acuerdo_id: number
  plan: string
  numero_acuerdo: string | null
  beneficiario: string
  parentesco: string
  estado: string
  estado_calculado: 'vigente' | 'atrasado' | 'suspendido'
  pagado_hasta: string
  semanas_pendientes: number
  semanas_adelantadas: number
  fecha_ultimo_pago: string | null
  fecha_suspension: string | null
  fecha_retiro: string | null
  motivo_retiro: string | null
}

export interface PrestamoFicha {
  id: number
  numero_prestamo: string
  tipo: string
  estado: string
  moneda: string
  monto_original_usd: number
  deuda_total_usd: number
  saldo_mora_usd: number
  cuota_semanal_usd: number
  cuotas_totales: number
  cuotas_pagadas: number
  cuotas_pendientes: number
  cuotas_vencidas: number
  fecha_desembolso: string
  fecha_vencimiento: string
  fecha_ultimo_abono: string | null
}

export interface ExpedienteAhorristaFicha {
  socio: {
    id: number
    codigo_socio: string
    estado: string
    fecha_inscripcion: string
    es_delegado: boolean
    ubicacion: { codigo: string; nombre: string } | null
  }
  cuentas: {
    id: number
    numero_cuenta: string
    tipo: string
    estado: boolean
    saldo_usd: number
    saldo_bs: number
    bloqueado_usd: number
    disponible_usd: number
  }[]
  saldo_ahorro_usd: number
  servicios: ServicioFicha[]
  semanas: {
    ultima_semana_pagada: string
    semanas_pendientes: number
    semanas_adelantadas: number
    semana_actual: string
  } | null
  prestamos: {
    actuales: PrestamoFicha[]
    anteriores: PrestamoFicha[]
    saldo_total_usd: number
    cuotas_pagadas: number
    cuotas_pendientes: number
  }
  colectas_recientes: {
    id: number
    fecha_colecta: string
    monto_total_usd: number
    semanas_cobradas: number
    reversada: boolean
    motivo_reverso: string | null
  }[]
}

export interface ExpedienteTrabajadorFicha extends ExpedienteTrabajador {
  fecha_salida: string | null
  motivo_salida: string | null
  observaciones: string | null
  pagos_salud: {
    id: number
    periodo: string
    feria: { codigo: string; nombre: string }
    monto_usd: number
    estado: 'vigente' | 'anulado'
    pago: { id: number; fecha_pago: string; referencia: string | null }
  }[]
}

export interface FichaPersona {
  persona: Persona & { updated_at: string }
  trabajadores: ExpedienteTrabajadorFicha[]
  ahorristas: ExpedienteAhorristaFicha[]
  suspensiones: {
    expediente: string
    servicio: string
    plan: string
    beneficiario: string
    estado: string
    fecha_suspension: string | null
    fecha_retiro: string | null
    motivo_retiro: string | null
  }[]
  historial: {
    id: number
    accion: string
    modulo: string
    registro_id: number | null
    created_at: string
    usuario: { nombre_completo: string; username: string } | null
  }[]
}

export const listarPersonas = async (params: {
  busqueda?: string
  page?: number
  limit?: number
}): Promise<Respuesta<PersonaListada[]> & { meta?: { total: number; page: number; totalPages: number } }> => {
  const response = await apiClient.get('/personas', { params })
  return response.data
}

/** Ficha integral (HU-20) */
export const obtenerFicha = async (id: number): Promise<Respuesta<FichaPersona>> => {
  const response = await apiClient.get(`/personas/${id}/resumen`)
  return response.data
}

/** ¿Ya existe? Lo consulta todo formulario de alta antes de crear a nadie */
export const buscarPorIdentificacion = async (
  numero: string,
  tipo: TipoIdentificacion = 'V'
): Promise<Respuesta<ResultadoIdentificacion>> => {
  const response = await apiClient.get(`/personas/identificacion/${encodeURIComponent(numero)}`, {
    params: { tipo },
  })
  return response.data
}

export const obtenerPersona = async (id: number): Promise<Respuesta<PersonaConExpedientes>> => {
  const response = await apiClient.get(`/personas/${id}`)
  return response.data
}

export const actualizarPersona = async (
  id: number,
  datos: Partial<DatosPersona>
): Promise<Respuesta<Persona>> => {
  const response = await apiClient.put(`/personas/${id}`, datos)
  return response.data
}
