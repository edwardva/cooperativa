import apiClient from './api'

export type FormaPagoMulta = 'efectivo' | 'transferencia' | 'pago_movil' | 'punto' | 'ahorro'

export const FORMAS_PAGO: { valor: FormaPagoMulta; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'pago_movil', texto: 'Pago móvil' },
  { valor: 'punto', texto: 'Punto de venta' },
  { valor: 'ahorro', texto: 'Descontar del ahorro' },
]

export interface SocioMulta {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  telefono?: string | null
  estado: string
  ubicacion?: { codigo: string; nombre: string; direccion: string | null } | null
}

export interface MultaPagada {
  id: number
  socio_id: number
  ano: number
  monto_usd: string | number
  monto_bs: string | number
  tasa_cambio: string | number
  forma_pago: FormaPagoMulta
  referencia: string | null
  estado: 'pagada' | 'reversada'
  fecha_pago: string
  observacion: string | null
  motivo_reverso: string | null
  socio?: { codigo_socio: string; cedula: string; nombre: string; apellido: string }
}

export interface Parametros {
  monto_usd: number
  monto_bs: number
  tasa: number
}

export const obtenerParametros = async (): Promise<Parametros> =>
  (await apiClient.get('/multas/parametros')).data.data

export const cambiarMonto = async (monto_usd: number): Promise<void> => {
  await apiClient.put('/multas/parametros', { monto_usd })
}

export const obtenerAnos = async (): Promise<{ ano: number; ultima_asamblea: string }[]> =>
  (await apiClient.get('/multas/anos')).data.data

export const obtenerDeudores = async (params: { ano: number; q?: string; feria_id?: number }) =>
  (await apiClient.get('/multas/deudores', { params })).data.data as {
    ano: number
    monto_usd: number
    monto_bs: number
    tasa: number
    deudores: SocioMulta[]
    total_usd: number
    total_bs: number
  }

export const obtenerDeSocio = async (socioId: number) =>
  (await apiClient.get(`/multas/socio/${socioId}`)).data.data as {
    socio: SocioMulta & {
      cuentas_ahorro: {
        id: number
        numero_cuenta: string
        saldo_usd: string | number
        saldo_bs: string | number
        tipo_cuenta: { nombre: string; moneda: string }
      }[]
      multas_asamblea: MultaPagada[]
    }
    anos_adeudados: number[]
    monto_usd: number
    monto_bs: number
    tasa: number
  }

export const obtenerPagos = async (params: { desde?: string; hasta?: string }) =>
  (await apiClient.get('/multas/pagos', { params })).data.data as {
    pagos: MultaPagada[]
    total_usd: number
    total_bs: number
    cantidad: number
  }

export const cobrar = async (datos: {
  socio_id: number
  ano: number
  forma_pago: FormaPagoMulta
  referencia?: string | null
  cuenta_ahorro_id?: number | null
  observacion?: string | null
}): Promise<MultaPagada> => (await apiClient.post('/multas/cobrar', datos)).data.data

export const reversar = async (id: number, motivo: string): Promise<void> => {
  await apiClient.post(`/multas/${id}/reversar`, { motivo })
}
