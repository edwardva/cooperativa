/**
 * ============================================
 * TIPOS: TRASPASO DE ACUERDO A OTRO SOCIO
 * ============================================
 * Compartidos por Funeraria y Salud. Cada módulo tiene sus propias llamadas
 * (funerariaService / saludService); las reglas están en el backend
 * (utils/traspasoAcuerdo.ts).
 */

export const MOTIVOS_TRASPASO = ['Fallecimiento', 'Migración', 'Otro'] as const
export type MotivoTraspaso = (typeof MOTIVOS_TRASPASO)[number]

export type AccionPersonaTraspaso = 'pasa' | 'reutiliza' | 'otro_expediente' | 'es_nuevo_titular' | 'excluida'

export interface PersonaTraspaso {
  clave: number
  cedula: string
  nombre: string
  apellido: string
  estado: string
  parentesco_actual: string
  accion: AccionPersonaTraspaso
  nota: string | null
  requiere_parentesco: boolean
}

export interface SocioTraspaso {
  id: number
  expediente: string
  nombre: string
  apellido: string
  cedula: string
  telefono?: string | null
}

export interface VistaPreviaTraspaso {
  acuerdo: { id?: number; numero_acuerdo: string | null; estado: string; fecha_inicio: string }
  titular_anterior: SocioTraspaso
  nuevo_titular: SocioTraspaso
  otros_acuerdos: number
  numero_final: string | null
  personas: PersonaTraspaso[]
}

export interface ConfirmarTraspasoData {
  expediente: string
  motivo: MotivoTraspaso
  detalle?: string
  parentescos: Array<{ clave: number; parentesco: string }>
}

export interface ResultadoTraspaso {
  numero_anterior: string | null
  numero_acuerdo: string | null
  nuevo_titular: SocioTraspaso
  pasan: number
  excluidas: string[]
}
