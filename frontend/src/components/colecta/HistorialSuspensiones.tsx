/**
 * ============================================
 * COMPONENTE: historial de suspensiones del socio
 * ============================================
 *
 * Pedido por la cooperativa: "muestra el historial del socio si ha sido
 * suspendido o no, con motivo de suspension y fecha, esto se requiere para
 * evaluar a la hora de dar prestamos y saber que decision tomar viendo el
 * historial".
 *
 * Va en la colecta porque es donde el cajero ya tiene al socio delante, sin
 * abrir otra pantalla.
 *
 * El numero que encabeza el bloque es `veces_suspendido`, contado sobre TODO
 * el historial. La lista de abajo muestra solo los ultimos diez movimientos:
 * son dos datos distintos a proposito, porque un socio con doce suspensiones
 * no puede parecer que tiene diez.
 */

import { useState } from 'react'
import { History, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import type { HistorialEstado } from '../../services/colectaService'

interface Props {
  historial: HistorialEstado[]
  /** Veces suspendido en todo su historial, no solo en lo que se lista */
  vecesSuspendido: number
}

const fecha = (valor: string): string =>
  new Date(valor).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** El color dice de un vistazo si el movimiento fue a peor o a mejor */
const insignia = (h: HistorialEstado) => {
  if (h.estado_nuevo === 'suspendido') return <Badge variant="error">Suspendido</Badge>
  if (h.estado_nuevo === 'retirado') return <Badge variant="neutral">Retirado</Badge>
  if (h.estado_anterior === 'suspendido' && h.estado_nuevo === 'activo')
    return <Badge variant="success">Reactivado</Badge>
  return <Badge variant="info">{h.estado_nuevo}</Badge>
}

export const HistorialSuspensiones = ({ historial, vecesSuspendido }: Props) => {
  const [abierto, setAbierto] = useState(false)

  // Un socio sin ningun cambio de estado no necesita ocupar sitio en la pantalla
  if (historial.length === 0 && vecesSuspendido === 0) {
    return null
  }

  return (
    <Card className="p-4">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-800">Historial del socio</span>
          {vecesSuspendido > 0 ? (
            <Badge variant="error" icon={<ShieldAlert className="h-3 w-3" />}>
              {vecesSuspendido === 1
                ? 'Suspendido 1 vez'
                : `Suspendido ${vecesSuspendido} veces`}
            </Badge>
          ) : (
            <Badge variant="success">Nunca suspendido</Badge>
          )}
        </div>
        {abierto ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
        )}
      </button>

      {abierto && (
        <div className="mt-4 space-y-3">
          {historial.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin cambios de estado registrados.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {historial.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {insignia(h)}
                      <span className="text-neutral-500">{fecha(h.fecha)}</span>
                      {h.semanas_atraso !== null && (
                        <span className="text-neutral-500">
                          · {h.semanas_atraso} {h.semanas_atraso === 1 ? 'semana' : 'semanas'} de
                          atraso
                        </span>
                      )}
                      {h.origen === 'manual' && (
                        <span className="text-neutral-400">· a mano</span>
                      )}
                    </div>
                    <p className="mt-1 text-neutral-700">{h.motivo}</p>
                    {h.suspendido_hasta && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Suspendido hasta el {fecha(h.suspendido_hasta)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {historial.length === 10 && (
                <p className="text-xs text-neutral-500">
                  Se muestran los 10 movimientos más recientes.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
