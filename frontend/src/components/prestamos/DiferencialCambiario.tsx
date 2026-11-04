/**
 * ============================================
 * COMPONENTE: diferencial cambiario del prestamo
 * ============================================
 *
 * Pedido por la cooperativa al probar:
 *
 *   "Mostrar calculo del diferencial, es decir cuanto se presto y cuanto se
 *    esta cobrando: es una suma de lo que se esta cobrando demas por los
 *    cambios de la tasa monetaria. Mostrar un campo donde se vea el monto que
 *    va sumando respecto a lo que se esta cobrando."
 *
 * El numero grande es ese "monto que va sumando". Debajo, el desglose abono por
 * abono, porque el total sin ver de donde sale no se puede defender ante nadie.
 *
 * Puede ser NEGATIVO: si la tasa bajo entre un abono y otro, se cobro de menos.
 * No se esconde ese caso — el dato es el que es.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '../ui/Card'
import type { DiferencialCambiario as Datos } from '../../services/prestamosService'

interface Props {
  datos: Datos | null
}

const bs = (v: number): string =>
  v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const usd = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fecha = (v: string): string =>
  new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })

export const DiferencialCambiario = ({ datos }: Props) => {
  const [abierto, setAbierto] = useState(false)

  if (!datos) return null

  // Sin abonos no hay nada que comparar todavia
  if (datos.abonos.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-neutral-800">Diferencial cambiario</h3>
        <p className="mt-1 text-sm text-neutral-500">
          El préstamo todavía no tiene abonos: no hay diferencia que calcular.
        </p>
      </Card>
    )
  }

  const aFavor = datos.diferencial_bs >= 0

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Diferencial cambiario</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Lo cobrado de más por el cambio de la tasa desde que se otorgó
          </p>
        </div>
        {aFavor ? (
          <TrendingUp className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <TrendingDown className="h-5 w-5 shrink-0 text-amber-600" />
        )}
      </div>

      <p
        className={`mt-3 text-3xl font-bold tabular-nums ${
          aFavor ? 'text-emerald-700' : 'text-amber-700'
        }`}
      >
        {bs(datos.diferencial_bs)} Bs
      </p>
      <p className="text-sm text-neutral-500">≈ ${usd(datos.diferencial_usd)}</p>
      {!aFavor && (
        <p className="mt-1 text-xs text-amber-700">
          La tasa bajó respecto al otorgamiento: se ha cobrado de menos.
        </p>
      )}

      {/* De donde sale: lo prestado, lo cobrado, y lo que se habria cobrado */}
      <dl className="mt-4 space-y-1.5 border-t border-neutral-200 pt-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-600">Se prestó</dt>
          <dd className="tabular-nums text-neutral-900">
            ${usd(datos.prestado_usd)} · {bs(datos.prestado_bs)} Bs
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-600">Se ha cobrado</dt>
          <dd className="tabular-nums text-neutral-900">
            ${usd(datos.abonado_usd)} · {bs(datos.abonado_bs)} Bs
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-600">A la tasa de otorgamiento habría sido</dt>
          <dd className="tabular-nums text-neutral-900">
            {bs(datos.abonado_a_tasa_inicial_bs)} Bs
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-600">Tasa de otorgamiento</dt>
          <dd className="tabular-nums text-neutral-900">
            {bs(datos.tasa_inicial)}
            <span className="ml-2 text-neutral-500">
              ({datos.variacion_tasa_pct >= 0 ? '+' : ''}
              {datos.variacion_tasa_pct}% hasta hoy)
            </span>
          </dd>
        </div>
      </dl>

      <button
        onClick={() => setAbierto((v) => !v)}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
      >
        {abierto ? 'Ocultar el detalle' : 'Ver de dónde sale, abono por abono'}
        {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {abierto && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-600">
                <th className="py-1 text-left font-semibold">Fecha</th>
                <th className="py-1 text-right font-semibold">Monto</th>
                <th className="py-1 text-right font-semibold">Tasa</th>
                <th className="py-1 text-right font-semibold">Cobrado</th>
                <th className="py-1 text-right font-semibold">A tasa inicial</th>
                <th className="py-1 text-right font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {datos.abonos.map((a) => (
                <tr key={a.abono_id} className="border-b border-neutral-100">
                  <td className="py-1">{fecha(a.fecha)}</td>
                  <td className="py-1 text-right tabular-nums">${usd(a.monto_usd)}</td>
                  <td className="py-1 text-right tabular-nums">{bs(a.tasa_cambio)}</td>
                  <td className="py-1 text-right tabular-nums">{bs(a.monto_bs)}</td>
                  <td className="py-1 text-right tabular-nums text-neutral-500">
                    {bs(a.equivalente_inicial_bs)}
                  </td>
                  <td
                    className={`py-1 text-right font-medium tabular-nums ${
                      a.diferencial_bs > 0
                        ? 'text-emerald-700'
                        : a.diferencial_bs < 0
                          ? 'text-amber-700'
                          : 'text-neutral-400'
                    }`}
                  >
                    {bs(a.diferencial_bs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
