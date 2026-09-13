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
