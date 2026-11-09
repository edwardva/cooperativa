/**
 * Movimientos de colecta del dia, con reverso.
 *
 * En el sistema viejo el reverso era una pantalla aparte del menu
 * (`colecta/rev_prestamos`). Aca vive junto al listado del dia.
 *
 * Para no reversar el cobro de otra persona por error (09/11): arriba va solo
 * el ultimo cobro registrado, y el resto del dia aparece al buscarlo por
 * nombre, cedula, expediente o N°, o al pedir la lista completa a proposito.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Undo2, AlertTriangle, X, Search, Clock } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import * as colectaService from '../../services/colectaService'
import type { Colecta } from '../../services/colectaService'
import { getErrorMessage } from '../../services/api'
import { usePermissions } from '../../store/authStore'

const money = (valor: number): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const hora = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

/** Texto sin acentos ni mayusculas, para buscar "Peña" escribiendo "pena" */
const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const coincide = (colecta: Colecta, consulta: string): boolean => {
  const q = normalizar(consulta).replace(/^#/, '')
  if (!q) return true
  const socio = colecta.socio
  const campos = [
    String(colecta.id),
    socio?.codigo_socio ?? '',
    socio?.cedula ?? '',
    `${socio?.apellido ?? ''} ${socio?.nombre ?? ''}`,
    `${socio?.nombre ?? ''} ${socio?.apellido ?? ''}`,
    colecta.referencia ?? '',
  ].map(normalizar)
  return campos.some((c) => c.includes(q))
}

const etiquetaServicio: Record<string, string> = {
  ahorro: 'Ahorro',
  funeraria: 'Funeraria',
  salud: 'Salud',
  prestamo: 'Prestamo',
}

interface Props {
  /** Se dispara tras un reverso para que la pantalla padre refresque sus totales */
  onCambio?: () => void
  /**
   * Socio que se esta atendiendo. Con el, el listado muestra solo sus cobros
   * de hoy: la cooperativa pidio que el reverso por error no muestre a todos
   * los socios cobrados en el dia (07/11).
   */
  socio?: { id: number; nombre: string; apellido: string } | null
  /** Quitar el filtro del socio y ver todo lo cobrado hoy */
  onVerTodos?: () => void
}

export const MovimientosDelDia = ({ onCambio, socio, onVerTodos }: Props) => {
  const { hasPermission } = usePermissions()
  const puedeReversar = hasPermission('colecta', 'delete')

  const [colectas, setColectas] = useState<Colecta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  // La lista completa del dia solo se ve si el cajero la pide
  const [verTodos, setVerTodos] = useState(false)

  const [aReversar, setAReversar] = useState<Colecta | null>(null)
  const [motivo, setMotivo] = useState('')
  const [reversando, setReversando] = useState(false)
  const [errorReverso, setErrorReverso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const respuesta = await colectaService.listarColectas({
        solo_mias: true,
        ...(socio ? { socio_id: socio.id } : {}),
      })
      if (respuesta.success) setColectas(respuesta.data.colectas)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar los movimientos')
    } finally {
      setCargando(false)
    }
  }, [socio])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    setBusqueda('')
    setVerTodos(false)
  }, [socio])

  // El backend los devuelve del mas reciente al mas viejo
  const ultimo = colectas[0] ?? null
  const resto = colectas.slice(1)
  // Con un socio en pantalla sus cobros del dia son pocos: se muestran todos
  const mostrarLista = Boolean(socio) || verTodos || busqueda.trim() !== ''
  const filtradas = useMemo(() => resto.filter((c) => coincide(c, busqueda)), [resto, busqueda])

  const abrirReverso = (colecta: Colecta) => {
    setAReversar(colecta)
    setMotivo('')
    setErrorReverso('')
  }

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
      {socio && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-800">
          <span>
            Cobros de hoy de <strong>{socio.apellido}, {socio.nombre}</strong>
          </span>
          {onVerTodos && (
            <button onClick={onVerTodos} className="text-xs font-medium underline hover:no-underline">
              Ver todos los cobros de hoy
            </button>
          )}
        </div>
      )}
      {/* ULTIMO COBRO: el caso comun, reversar lo que se acaba de cobrar */}
      {!cargando && ultimo && (
        <Card className="mb-4 border-primary-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
                <Clock className="h-3.5 w-3.5" />
                Último cobro registrado · {hora(ultimo.fecha_colecta)}
              </p>
              <p className="mt-1 text-base font-semibold text-neutral-900">
                {ultimo.socio?.apellido}, {ultimo.socio?.nombre}
              </p>
              <p className="text-xs text-neutral-500">
                Exp. {ultimo.socio?.codigo_socio} · C.I. {ultimo.socio?.cedula} · N° #{ultimo.id}
                {ultimo.numero_del_dia != null && <> · Mov. {ultimo.numero_del_dia} del socio hoy</>}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ultimo.detalles.map((d) => (
                  <span
                    key={d.id}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                  >
                    {etiquetaServicio[d.servicio] ?? d.servicio} ${money(Number(d.monto_usd))}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-neutral-900">
                ${money(Number(ultimo.monto_total_usd))}
              </p>
              <p className="text-xs tabular-nums text-neutral-500">
                {money(Number(ultimo.monto_total_bs))} Bs
              </p>
              {puedeReversar && (
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-2"
                  onClick={() => abrirReverso(ultimo)}
                >
                  <Undo2 className="h-4 w-4" />
                  Reversar último cobro
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* OTROS COBROS DEL DIA: se buscan, no se listan de entrada */}
      {!cargando && resto.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar otro cobro de hoy: nombre, cédula, expediente o N°"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          {!socio && (
            <button
              onClick={() => setVerTodos((v) => !v)}
              className="text-xs font-medium text-primary-700 underline hover:no-underline"
            >
              {verTodos ? 'Ocultar la lista' : `Ver los ${resto.length} cobros anteriores de hoy`}
            </button>
          )}
        </div>
      )}

      {(cargando || colectas.length === 0 || (mostrarLista && resto.length > 0)) && (
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
                    {socio
                      ? 'No hay cobros de este socio registrados hoy en su caja'
                      : 'Todavia no hay cobros registrados hoy'}
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-neutral-500">
                    Ningún otro cobro de hoy coincide con «{busqueda}»
                  </td>
                </tr>
              ) : (
                filtradas.map((colecta) => (
                  <tr key={colecta.id} className="transition-colors hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                      {hora(colecta.fecha_colecta)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold text-neutral-900">
                      #{colecta.id}
                      {colecta.numero_del_dia != null && (
                        <span className="block text-xs font-normal text-neutral-500">
                          Mov. {colecta.numero_del_dia} del socio
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-900">
                        {colecta.socio?.apellido}, {colecta.socio?.nombre}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Exp. {colecta.socio?.codigo_socio} · C.I. {colecta.socio?.cedula}
                      </p>
                      {(colecta.referencia || colecta.observaciones) && (
                        <p className="mt-0.5 max-w-xs text-xs text-neutral-600">
                          {colecta.referencia && <>Ref.: {colecta.referencia}</>}
                          {colecta.referencia && colecta.observaciones && ' · '}
                          {colecta.observaciones && <>Notas: {colecta.observaciones}</>}
                        </p>
                      )}
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
                      {puedeReversar && (
                        <Button variant="ghost" size="sm" onClick={() => abrirReverso(colecta)}>
                          <Undo2 className="h-4 w-4" />
                          Reversar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

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
                  {aReversar.socio?.apellido}, {aReversar.socio?.nombre} · C.I.{' '}
                  {aReversar.socio?.cedula} · {hora(aReversar.fecha_colecta)} · $
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
