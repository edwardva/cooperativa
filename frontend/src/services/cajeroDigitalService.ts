/**
 * Cliente del cajero digital, lado de la CAJA.
 *
 * El socio declara desde su celular lo que pagó; aquí se coteja contra el banco
 * y se concilia o se rechaza. Un pago declarado no mueve ningún saldo: es un
 * aviso hasta que alguien lo verifica.
 */

import apiClient from './api'

export type EstadoPagoWeb = 'pendiente' | 'conciliado' | 'rechazado'
export type DestinoPagoWeb = 'semanas' | 'prestamo' | 'ahorro'

export interface PagoWeb {
  id: number
  destino: DestinoPagoWeb
  monto_usd: string | number
  monto_bs: string | number
  banco: string
  referencia_bancaria: string
  fecha_pago: string
  estado: EstadoPagoWeb
  semanas: number
  observaciones: string | null
  motivo_rechazo: string | null
  fecha_conciliacion: string | null
  created_at: string
  usuario_digital: {
    socio: {
      id: number
      codigo_socio: string
      nombre: string
      apellido: string
      telefono: string | null
    }
  }
  prestamo: { id: number; numero_prestamo: string } | null
}

export const listarPagos = async (estado?: EstadoPagoWeb): Promise<PagoWeb[]> => {
  const r = await apiClient.get<{ success: boolean; data: PagoWeb[] }>('/cajero-digital/pagos', {
    params: estado ? { estado } : {},
  })
  return r.data.data
}

export const revisarPago = async (
  id: number,
  decision: { conciliar: boolean; motivo?: string; observaciones?: string }
): Promise<PagoWeb> => {
  const r = await apiClient.post<{ success: boolean; data: PagoWeb }>(
    `/cajero-digital/pagos/${id}/revisar`,
    decision
  )
  return r.data.data
}
