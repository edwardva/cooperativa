/**
 * Ventanita con los últimos movimientos de un préstamo, cuenta de ahorro o
 * acuerdo, abierta desde la colecta (pedido del 09/11). Es de solo lectura:
 * sirve para contestarle al socio sin salir de la caja.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import * as colectaService from '../../services/colectaService'
import type { HistorialRapido as Historial, ServicioHistorial } from '../../services/colectaService'
import { getErrorMessage } from '../../services/api'
import { fechaCorta } from './presentacion'

const money = (valor: number): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface ConsultaHistorial {
  servicio: ServicioHistorial
  id: number
}

interface Props {
  consulta: ConsultaHistorial | null
  onClose: () => void
}

export const HistorialRapidoModal = ({ consulta, onClose }: Props) => {
  const [historial, setHistorial] = useState<Historial | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!consulta) return
    let vigente = true
    setHistorial(null)
    setError('')
    setCargando(true)
    colectaService
      .obtenerHistorialRapido(consulta.servicio, consulta.id)
      .then((r) => {
        if (vigente && r.success) setHistorial(r.data)
      })
      .catch((err) => {
        if (vigente) setError(getErrorMessage(err) || 'No se pudo cargar el historial')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [consulta])

  const conSaldo = historial?.servicio === 'ahorro'
  // Cuenta en divisas: el saldo que importa es el de $ (10/11)
  const enDivisas = historial?.moneda === 'usd'
  const conCobertura = historial?.servicio === 'funeraria' || historial?.servicio === 'salud'

  return (
    <Modal
      open={consulta !== null}
      onClose={onClose}
      size="md"
      title={historial?.titulo ?? 'Historial'}
      description={historial ? `${historial.resumen} · últimos ${historial.movimientos.length} movimientos` : undefined}
    >
      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : historial && historial.movimientos.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">Todavía no tiene movimientos.</p>
      ) : (
        historial && (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Detalle</th>
                  {conCobertura && <th className="px-3 py-2 text-left">Cubre hasta</th>}
                  {conCobertura && <th className="px-3 py-2 text-left">Suspensión</th>}
                  <th className="px-3 py-2 text-right">Bs</th>
                  <th className="px-3 py-2 text-right">$</th>
                  {conSaldo && <th className="px-3 py-2 text-right">{enDivisas ? 'Saldo $' : 'Saldo Bs'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {historial.movimientos.map((m, i) => (
                  <tr key={i} className={m.reversado ? 'text-neutral-400 line-through' : m.tipo === 'Suspensión' ? 'bg-red-50/60 text-neutral-800' : 'text-neutral-800'}>
                    <td className="whitespace-nowrap px-3 py-2">{fechaCorta(m.fecha, true)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {m.tipo}
                      {m.reversado && <span className="ml-1 no-underline">(reversado)</span>}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{m.detalle ?? ''}</td>
                    {conCobertura && <td className="whitespace-nowrap px-3 py-2">{m.cubre_hasta ?? ''}</td>}
                    {/* En blanco si quedó activo (10/11) */}
                    {conCobertura && (
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-red-700">
                        {m.suspension ? fechaCorta(m.suspension, true) : ''}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{money(m.monto_bs)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{money(m.monto_usd)}</td>
                    {conSaldo && (
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {enDivisas
                          ? m.saldo_usd === null ? '' : money(m.saldo_usd)
                          : m.saldo_bs === null ? '' : money(m.saldo_bs)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Modal>
  )
}

/** Texto con aspecto de enlace que abre el historial */
export const EnlaceHistorial = ({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    title="Ver los últimos movimientos"
    className="font-medium text-primary-700 underline decoration-dotted underline-offset-2 hover:decoration-solid"
  >
    {children}
  </button>
)
