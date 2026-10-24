import apiClient from './api'

export type TipoMovimientoFondo = 'ingreso' | 'egreso'
export type ParentescoFondo = 'padre' | 'madre' | 'conyuge' | 'hijo'

export const PARENTESCOS: { valor: ParentescoFondo; texto: string }[] = [
  { valor: 'padre', texto: 'Padre' },
  { valor: 'madre', texto: 'Madre' },
  { valor: 'conyuge', texto: 'Cónyuge' },
  { valor: 'hijo', texto: 'Hijo(a)' },
]

export interface ConceptoFondo {
  id: number
  tipo: TipoMovimientoFondo
  nombre: string
  porcentaje: string | number | null
  activo: boolean
}

export interface BeneficiarioFondo {
  id: number
  socio_id: number
  cedula: string | null
  nombre: string
  apellido: string
  parentesco: ParentescoFondo
  fecha_nacimiento: string | null
  telefono: string | null
  activo: boolean
}

export interface MovimientoFondo {
  id: number
  tipo: TipoMovimientoFondo
  fecha: string
  descripcion: string | null
  monto_bs: string | number
  monto_usd: string | number
  tasa_cambio: string | number
  entregado_por: string | null
  referencia: string | null
  gasto_total_bs: string | number | null
  porcentaje: string | number | null
  a_cargo_socio_bs: string | number | null
  reversado: boolean
  motivo_reverso: string | null
  concepto: { nombre: string; tipo: TipoMovimientoFondo }
  socio: { id: number; codigo_socio: string; cedula: string; nombre: string; apellido: string } | null
  beneficiario: { nombre: string; apellido: string; parentesco: ParentescoFondo; cedula: string | null } | null
}

export interface ResumenFondo {
  ingresos_bs: number
  egresos_bs: number
  saldo_bs: number
  saldo_usd: number
  tasa: number
  sectores_trabajadores: string[]
}

const datos = <T>(r: { data: { data: T } }) => r.data.data

export const obtenerResumen = async (): Promise<ResumenFondo> => datos(await apiClient.get('/fondo/resumen'))

export const obtenerConceptos = async (): Promise<ConceptoFondo[]> => datos(await apiClient.get('/fondo/conceptos'))
export const crearConcepto = async (c: { tipo: TipoMovimientoFondo; nombre: string; porcentaje?: number | null }) =>
  datos<ConceptoFondo>(await apiClient.post('/fondo/conceptos', c))
export const actualizarConcepto = async (id: number, c: { nombre?: string; porcentaje?: number | null; activo?: boolean }) =>
  datos<ConceptoFondo>(await apiClient.put(`/fondo/conceptos/${id}`, c))

export const obtenerBeneficiarios = async (socioId: number): Promise<BeneficiarioFondo[]> =>
  datos(await apiClient.get('/fondo/beneficiarios', { params: { socio_id: socioId } }))
export const crearBeneficiario = async (b: Omit<BeneficiarioFondo, 'id' | 'activo'>) =>
  datos<BeneficiarioFondo>(await apiClient.post('/fondo/beneficiarios', b))
export const actualizarBeneficiario = async (id: number, b: Partial<Omit<BeneficiarioFondo, 'id' | 'socio_id' | 'activo'>>) =>
  datos<BeneficiarioFondo>(await apiClient.put(`/fondo/beneficiarios/${id}`, b))
export const darDeBajaBeneficiario = async (id: number) => {
  await apiClient.delete(`/fondo/beneficiarios/${id}`)
}

export const obtenerMovimientos = async (params: { desde?: string; hasta?: string; tipo?: string; socio_id?: number }) =>
  datos<{ movimientos: MovimientoFondo[]; desde: string; hasta: string; ingresos_bs: number; egresos_bs: number }>(
    await apiClient.get('/fondo/movimientos', { params })
  )

export const registrarIngreso = async (d: {
  concepto_id: number
  monto_bs: number
  descripcion?: string | null
  entregado_por?: string | null
  referencia?: string | null
}) => datos<MovimientoFondo>(await apiClient.post('/fondo/ingresos', d))

export const registrarEgreso = async (d: {
  concepto_id: number
  socio_id: number
  beneficiario_id?: number | null
  gasto_total_bs: number
  porcentaje?: number | null
  descripcion: string
}) => datos<MovimientoFondo>(await apiClient.post('/fondo/egresos', d))

export const reversar = async (id: number, motivo: string) => {
  await apiClient.post(`/fondo/movimientos/${id}/reversar`, { motivo })
}
