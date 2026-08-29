/**
 * ============================================
 * PAGINA: PARAMETROS DEL SISTEMA
 * ============================================
 * Configuraciones operativas de la cooperativa.
 *
 * La tasa de cambio tiene panel propio porque no es un parametro cualquiera:
 * mueve todo el dinero del sistema (colecta, ahorro, prestamos) y se sincroniza
 * sola desde el BCV. Aca se ve si esta al dia y se puede forzar la actualizacion.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Edit2,
  Save,
  X,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Printer,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PrintableListado } from '../components/print/PrintableListado'
import * as parametrosService from '../services/parametrosService'
import type { EstadoTasa, Parametro } from '../services/parametrosService'
import { getErrorMessage } from '../services/api'
import { formatearFechaCorta } from '../utils/formatters'
import { usePermissions } from '../store/authStore'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

const money = (v: number | string | null | undefined, dec = 4): string =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const fechaHora = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const ParametrosPage = () => {
  const { hasPermission } = usePermissions()
  const puedeEditar = hasPermission('parametros', 'update')

  const [parametros, setParametros] = useState<Parametro[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [editando, setEditando] = useState<number | null>(null)
  const [valorEditado, setValorEditado] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [tasa, setTasa] = useState<EstadoTasa | null>(null)
  const [cargandoTasa, setCargandoTasa] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [avisoTasa, setAvisoTasa] = useState<{ tipo: 'ok' | 'aviso'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const r = await parametrosService.obtenerParametros()
      if (r.success) setParametros(r.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar los parametros')
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarTasa = useCallback(async () => {
    setCargandoTasa(true)
    try {
      const r = await parametrosService.obtenerEstadoTasa()
      if (r.success) setTasa(r.data)
    } catch {
      // El panel de tasa es informativo; su fallo no bloquea la pantalla
    } finally {
      setCargandoTasa(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
    void cargarTasa()
  }, [cargar, cargarTasa])

  const sincronizar = async (forzar = false) => {
    setSincronizando(true)
    setAvisoTasa(null)
    try {
      const r = await parametrosService.sincronizarTasa(forzar)
      if (r.success) {
        setAvisoTasa({ tipo: r.data.aplicada ? 'ok' : 'aviso', texto: r.data.motivo })
        await Promise.all([cargarTasa(), cargar()])
      }
    } catch (err) {
      setAvisoTasa({ tipo: 'aviso', texto: getErrorMessage(err) || 'Error al sincronizar' })
    } finally {
      setSincronizando(false)
    }
  }

  const guardar = async (id: number) => {
    setGuardando(true)
    try {
      const r = await parametrosService.actualizarParametro(id, { valor: valorEditado })
      if (!r.success) throw new Error('No fue posible guardar')
      setEditando(null)
      await cargar()
      await cargarTasa()
    } catch (err) {
      window.alert(getErrorMessage(err) || 'Error al guardar el parametro')
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return parametros
    return parametros.filter(
      (p) =>
        p.clave.toLowerCase().includes(q) ||
        p.valor.toLowerCase().includes(q) ||
        (p.descripcion ?? '').toLowerCase().includes(q)
    )
  }, [parametros, busqueda])

  const filasImpresion = filtrados.map((p) => [
    p.clave,
    p.valor,
    p.descripcion || '-',
    p.tipo_dato,
    formatearFechaCorta(p.updated_at),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Parametros del sistema</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Configuraciones operativas de la cooperativa.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* ================= TASA DE CAMBIO ================= */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
              <TrendingUp className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Tasa de cambio BCV
              </p>
              {cargandoTasa ? (
                <Loader2 className="mt-2 h-5 w-5 animate-spin text-neutral-400" />
              ) : (
                <>
                  <p className="mt-1 text-3xl font-bold text-neutral-900">
                    {money(tasa?.vigente)} <span className="text-lg font-normal text-neutral-500">Bs/USD</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Actualizada {fechaHora(tasa?.actualizada_el ?? null)}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {puedeEditar && (
              <Button onClick={() => void sincronizar(false)} disabled={sincronizando}>
                {sincronizando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sincronizar ahora
              </Button>
            )}
            <p className="text-xs text-neutral-500">Se sincroniza sola cada 6 horas</p>
          </div>
        </div>

        {/* Comparacion con la fuente en vivo */}
        {tasa?.en_vivo && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
              tasa.desactualizada
                ? 'border-amber-200 bg-amber-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="flex items-start gap-2">
              {tasa.desactualizada ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${
                    tasa.desactualizada ? 'text-amber-900' : 'text-emerald-900'
                  }`}
                >
                  {tasa.desactualizada
                    ? `La fuente reporta ${money(tasa.en_vivo.tasa)} — difiere ${tasa.diferencia_porcentaje}%`
                    : 'La tasa esta al dia con la fuente'}
                </p>
                <p
                  className={`text-xs ${tasa.desactualizada ? 'text-amber-800' : 'text-emerald-800'}`}
                >
                  {tasa.en_vivo.fuente}
                  {tasa.en_vivo.fecha_valor && ` · fecha valor ${tasa.en_vivo.fecha_valor}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {avisoTasa && (
          <div
            className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
              avisoTasa.tipo === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <p>{avisoTasa.texto}</p>
            {/* Si la salvaguarda del 15% freno el cambio, se ofrece forzarlo */}
            {avisoTasa.tipo === 'aviso' && avisoTasa.texto.includes('varia') && puedeEditar && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void sincronizar(true)}
                disabled={sincronizando}
              >
                Confirmar y aplicar de todos modos
              </Button>
            )}
          </div>
        )}

        {/* Ultimos cambios */}
        {tasa && tasa.historico.length > 0 && (
          <div className="mt-4 border-t border-neutral-200 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Ultimos cambios
            </p>
            <div className="flex flex-wrap gap-2">
              {tasa.historico.slice(0, 6).map((h, i) => (
                <span
                  key={i}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
                >
                  {money(h.tasa, 2)} · {formatearFechaCorta(h.created_at)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ================= BUSQUEDA ================= */}
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por clave, valor o descripcion..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================= TABLA ================= */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 text-left">Clave</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Descripcion</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-left">Actualizado</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-neutral-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Cargando parametros...</span>
                    </div>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    {parametros.length === 0
                      ? 'No hay parametros registrados'
                      : 'Ninguno coincide con la busqueda'}
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const enEdicion = editando === p.id
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-neutral-900">
                          {p.clave}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {enEdicion ? (
                          <input
                            value={valorEditado}
                            onChange={(e) => setValorEditado(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void guardar(p.id)}
                            autoFocus
                            className={controlClass}
                          />
                        ) : (
                          <span className="font-mono text-sm text-neutral-900">{p.valor}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{p.descripcion || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <Badge variant="neutral">{p.tipo_dato}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-500">
                        {formatearFechaCorta(p.updated_at)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right">
                        {puedeEditar &&
                          (enEdicion ? (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => void guardar(p.id)}
                                disabled={guardando}
                                className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50"
                                title="Guardar"
                              >
                                {guardando ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditando(null)}
                                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditando(p.id)
                                setValorEditado(p.valor)
                              }}
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-primary-600"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          ))}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PrintableListado
        titulo="Parametros del sistema"
        subtitulo="Configuraciones operativas"
        filtros={[{ label: 'Busqueda', value: busqueda || 'Sin busqueda' }]}
        resumenes={[
          { label: 'Parametros', value: String(filtrados.length) },
          { label: 'Tasa vigente', value: money(tasa?.vigente, 2) },
        ]}
        columnas={['Clave', 'Valor', 'Descripcion', 'Tipo', 'Actualizado']}
        filas={filasImpresion}
      />
    </div>
  )
}
