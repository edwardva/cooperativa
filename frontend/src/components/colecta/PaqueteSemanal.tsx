/**
 * ============================================
 * COMPONENTE: desglose del cobro semanal
 * ============================================
 *
 * Requisitos 1 y 2 de la reunion.
 *
 * El cajero escribe cuantas semanas paga el socio y aqui aparece el importe de
 * todo lo que tiene contratado, con su desglose:
 *
 *   "Cuando tenga ambos servicios, el pago semanal debe incluir los dos mas el
 *    ahorro obligatorio. No permitir seleccionar unicamente uno de los
 *    servicios contratados para pagar esa semana."
 *
 * Por eso NO hay casillas para marcar servicios: van juntos, siempre. Las
 * tarifas se muestran, no se editan — vienen de Parametros.
 */

import { AlertTriangle, HeartPulse, Lock, Shield, Wallet } from 'lucide-react'
import { Card } from '../ui/Card'
import type { PaqueteSemanal as Paquete, RenglonPaquete } from '../../services/colectaService'

interface Props {
  paquete: Paquete | null
  cargando: boolean
  semanas: number
}

const money = (valor: number, decimales = 2): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

const icono = (servicio: RenglonPaquete['servicio']) => {
  if (servicio === 'ahorro') return <Wallet className="h-4 w-4 text-primary-600" />
  if (servicio === 'funeraria') return <Shield className="h-4 w-4 text-indigo-600" />
  return <HeartPulse className="h-4 w-4 text-rose-600" />
}

const etiqueta = (servicio: RenglonPaquete['servicio']): string =>
  ({ ahorro: 'Ahorro obligatorio', funeraria: 'Funeraria', salud: 'Salud' })[servicio]

const periodo = (p: { ano: number; semana: number } | null): string =>
  p ? `S${String(p.semana).padStart(2, '0')}/${p.ano}` : '—'

export function PaqueteSemanalCard({ paquete, cargando, semanas }: Props) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-800">
            Cobro semanal · {semanas} semana{semanas === 1 ? '' : 's'}
          </h3>
        </div>
        <span className="text-xs text-neutral-500">
          Los servicios contratados se cobran juntos
        </span>
      </div>

      {cargando && <div className="px-5 py-6 text-sm text-neutral-500">Calculando…</div>}

      {!cargando && paquete && paquete.renglones.length === 0 && (
        <div className="px-5 py-6 text-sm text-neutral-500">
          No hay nada que cobrar automaticamente: el socio no tiene ahorro ni servicios activos.
        </div>
      )}

      {!cargando && paquete && paquete.renglones.length > 0 && (
        <>
          <div className="divide-y divide-neutral-100">
            {paquete.renglones.map((renglon) => (
              <div
                key={`${renglon.servicio}-${renglon.referencia_id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-[180px]">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                    {icono(renglon.servicio)}
                    {etiqueta(renglon.servicio)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {/*
                      La tarifa se muestra para que el cajero pueda explicarla al
                      socio, pero es de solo lectura: se cambia en Parametros.
                    */}
                    ${money(renglon.tarifa_unitaria_usd, 2)} × {renglon.semanas} semana
                    {renglon.semanas === 1 ? '' : 's'}
                    {renglon.cobertura_despues && (
                      <> · queda cubierto hasta {periodo(renglon.cobertura_despues)}</>
                    )}
                  </p>
                </div>

                {/* Importes alineados a la derecha y con sus dos decimales
                    completos: el cliente reporto cifras cortadas (req. 12) */}
                <div className="text-right tabular-nums">
                  <p className="text-sm font-semibold text-neutral-900">${money(renglon.monto_usd)}</p>
                  <p className="text-xs text-neutral-500">{money(renglon.monto_bs)} Bs</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            <span className="text-sm font-semibold text-neutral-700">Subtotal del cobro semanal</span>
            <div className="text-right tabular-nums">
              <p className="text-lg font-bold text-neutral-900">${money(paquete.totales.total_usd)}</p>
              <p className="text-xs text-neutral-600">{money(paquete.totales.total_bs)} Bs</p>
            </div>
          </div>
        </>
      )}

      {/* Advertencias: se avisa, no se bloquea. La decision es del personal. */}
      {!cargando &&
        paquete?.advertencias.map((aviso) => (
          <p
            key={aviso}
            className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{aviso}</span>
          </p>
        ))}
    </Card>
  )
}
