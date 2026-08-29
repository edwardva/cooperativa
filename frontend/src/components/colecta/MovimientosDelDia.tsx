/**
 * Movimientos de colecta del dia, con reverso.
 *
 * En el sistema viejo el reverso era una pantalla aparte del menu
 * (`colecta/rev_prestamos`). Aca vive junto al listado del dia: el cajero ve lo
 * que cobro y deshace desde la misma fila, sin buscar de nuevo.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Undo2, AlertTriangle, X } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import * as colectaService from '../../services/colectaService'
import type { Colecta } from '../../services/colectaService'
import { getErrorMessage } from '../../services/api'
import { usePermissions } from '../../store/authStore'

const money = (valor: number): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const hora = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

const etiquetaServicio: Record<string, string> = {
  ahorro: 'Ahorro',
  funeraria: 'Funeraria',
  salud: 'Salud',
  prestamo: 'Prestamo',
}

interface Props {
  /** Se dispara tras un reverso para que la pantalla padre refresque sus totales */
  onCambio?: () => void
}

export const MovimientosDelDia = ({ onCambio }: Props) => {
  const { hasPermission } = usePermissions()
  const puedeReversar = hasPermission('colecta', 'delete')

  const [colectas, setColectas] = useState<Colecta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [aReversar, setAReversar] = useState<Colecta | null>(null)
  const [motivo, setMotivo] = useState('')
  const [reversando, setReversando] = useState(false)
  const [errorReverso, setErrorReverso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const respuesta = await colectaService.listarColectas({ solo_mias: true })
      if (respuesta.success) setColectas(respuesta.data.colectas)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar los movimientos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const confirmarReverso = async () => {
    if (!aReversar) return
    if (motivo.trim().length < 5) {
      setErrorReverso('Explique el motivo del reverso (minimo 5 caracteres)')
      return
    }

    setReversando(true)
    setErrorReverso('')
    try {
      const respuesta = await colectaService.reversarColecta(aReversar.id, motivo.trim())
      if (!respuesta.success) throw new Error('No fue posible reversar')
      setAReversar(null)
      setMotivo('')
      await cargar()
      onCambio?.()
    } catch (err) {
      setErrorReverso(getErrorMessage(err) || 'Error al reversar la colecta')
    } finally {
      setReversando(false)
    }
  }

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 text-left">Hora</th>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Socio</th>
                <th className="px-4 py-3 text-left">Conceptos</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-neutral-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Cargando...</span>
                    </div>
                  </td>
                </tr>
              ) : colectas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    Todavia no hay cobros registrados hoy
                  </td>
                </tr>
              ) : (
                colectas.map((colecta) => (
                  <tr key={colecta.id} className="transition-colors hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                      {hora(colecta.fecha_colecta)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold text-neutral-900">
                      #{colecta.id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-900">
                        {colecta.socio?.apellido}, {colecta.socio?.nombre}
                      </p>
                      <p className="text-xs text-neutral-500">{colecta.socio?.codigo_socio}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {colecta.detalles.map((d) => (
                          <span
                            key={d.id}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                          >
                            {etiquetaServicio[d.servicio] ?? d.servicio} ${money(Number(d.monto_usd))}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <p className="text-sm font-semibold text-neutral-900">
                        ${money(Number(colecta.monto_total_usd))}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {money(Number(colecta.monto_total_bs))} Bs
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {colecta.reversada ? (
                        <Badge variant="neutral">Reversada</Badge>
                      ) : (
                        puedeReversar && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAReversar(colecta)
                              setMotivo('')
                              setErrorReverso('')
                            }}
                          >
                            <Undo2 className="h-4 w-4" />
                            Reversar
                          </Button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* MODAL DE REVERSO */}
      {aReversar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card padding="none" className="w-full max-w-lg overflow-hidden border-neutral-200">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  Reversar colecta #{aReversar.id}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {aReversar.socio?.apellido}, {aReversar.socio?.nombre} · $
                  {money(Number(aReversar.monto_total_usd))}
                </p>
              </div>
              <button
                onClick={() => setAReversar(null)}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Se va a deshacer
                </p>
                {aReversar.detalles.map((d) => (
                  <div
                    key={d.id}
                    className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                  >
                    <span className="text-neutral-700">
                      {etiquetaServicio[d.servicio] ?? d.servicio}
                    </span>
                    <span className="font-medium text-neutral-900">
                      ${money(Number(d.monto_usd))}
                    </span>
                  </div>
                ))}
              </div>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Motivo del reverso *</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  placeholder="Monto equivocado, socio equivocado, cobro duplicado..."
                />
              </label>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  El cobro no se borra: queda marcado como reversado y se registran los movimientos
                  espejo en el historial del socio. Si la colecta ya entro en un cierre de caja, el
                  sistema la va a rechazar.
                </p>
              </div>

              {errorReverso && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorReverso}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setAReversar(null)} disabled={reversando}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void confirmarReverso()} disabled={reversando}>
                {reversando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Confirmar reverso
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
