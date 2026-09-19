import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, PlayCircle, RotateCcw, ShieldAlert } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import * as morosidadService from '../services/morosidadService'
import type { AccionMorosidad, CambioMorosidad, FilaHistorial, ResultadoMorosidad } from '../services/morosidadService'
import * as sociosService from '../services/sociosService'
import type { Socio } from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { formatearFecha } from '../utils/formatters'

const ETIQUETA: Record<AccionMorosidad, { texto: string; variant: 'warning' | 'error' | 'success' | 'info' }> = {
  suspender: { texto: 'Suspender', variant: 'warning' },
  extender: { texto: 'Pasa a un mes', variant: 'warning' },
  reactivar: { texto: 'Reactivar', variant: 'success' },
  retirar: { texto: 'Retirar (semana 41)', variant: 'error' },
}

const dia = (v: string | null) => (v ? formatearFecha(v) : '—')

/**
 * Morosidad: correr la revisión, ver qué haría antes de aplicarla, reactivar a
 * mano y consultar el historial. La revisión SIMULA por defecto; aplicar
 * suspende, extiende, reactiva y retira por el artículo 5.
 */
export const MorosidadPage = () => {
  const { hasPermission } = usePermissions()
  const puedeAplicar = hasPermission('socios', 'update')
  const puedeReactivar = hasPermission('socios', 'reactivar')

  const [pestana, setPestana] = useState<'revision' | 'suspendidos' | 'historial'>('revision')
  const [resultado, setResultado] = useState<ResultadoMorosidad | null>(null)
  const [corriendo, setCorriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<AccionMorosidad | 'todos'>('todos')

  const [suspendidos, setSuspendidos] = useState<Socio[]>([])
  const [historial, setHistorial] = useState<FilaHistorial[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)

  const [aReactivar, setAReactivar] = useState<Socio | null>(null)
  const [motivo, setMotivo] = useState('')
  const [forzar, setForzar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargarSuspendidos = async () => {
    setCargandoLista(true)
    try {
      const r = await sociosService.obtenerSocios({ estado: 'suspendido', limit: 100 })
      setSuspendidos(r.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCargandoLista(false)
    }
  }

  const cargarHistorial = async () => {
    setCargandoLista(true)
    try {
      const r = await morosidadService.historialMorosidad()
      if (r.success) setHistorial(r.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => {
    if (pestana === 'suspendidos') void cargarSuspendidos()
    if (pestana === 'historial') void cargarHistorial()
  }, [pestana])

  const revisar = async (aplicar: boolean) => {
    if (aplicar) {
      const r = resultado?.totales
      const detalle = r ? `${r.suspender} suspensión(es), ${r.extender} a un mes, ${r.reactivar} reactivación(es) y ${r.retirar} retiro(s)` : ''
      if (!window.confirm(`Se va a aplicar: ${detalle}.\n\nLos retiros de la semana 41 no se pueden deshacer. ¿Continuar?`)) return
    }
    setCorriendo(true)
    setError(null)
    setAviso(null)
    try {
      const r = await morosidadService.revisarMorosidad(aplicar)
      if (r.success) {
        setResultado(r.data)
        setAviso(r.message ?? null)
      }
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCorriendo(false)
    }
  }

  const reactivar = async () => {
    if (!aReactivar) return
    setGuardando(true)
    setError(null)
    try {
      const r = await morosidadService.reactivarSocio(aReactivar.id, motivo.trim(), forzar)
      if (r.success) setAviso(r.message ?? `${aReactivar.codigo_socio} quedó activo`)
      setAReactivar(null)
      setMotivo('')
      setForzar(false)
      await cargarSuspendidos()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  const cambios = useMemo(() => {
    if (!resultado) return [] as CambioMorosidad[]
    return filtro === 'todos' ? resultado.cambios : resultado.cambios.filter((c) => c.accion === filtro)
  }, [resultado, filtro])

  const totales = resultado?.totales

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-neutral-900">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
              Morosidad
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              En la semana 6 son 3 días de suspensión; en la 11, un mes en funeraria y 7 días en salud; en la 41
              el socio queda retirado por el artículo 5. La revisión primero simula: no cambia nada hasta que se
              aplica.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void revisar(false)} disabled={corriendo}>
              {corriendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Revisar (simulación)
            </Button>
            {puedeAplicar && (
              <Button
                onClick={() => void revisar(true)}
                disabled={corriendo || !resultado || resultado.cambios.length === 0}
              >
                <ShieldAlert className="h-4 w-4" />
                Aplicar
              </Button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {aviso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {aviso}
        </div>
      )}

      <div className="flex gap-2 border-b border-neutral-200">
        {([
          ['revision', 'Revisión'],
          ['suspendidos', 'Suspendidos'],
          ['historial', 'Historial'],
        ] as const).map(([clave, texto]) => (
          <button
            key={clave}
            onClick={() => setPestana(clave)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              pestana === clave
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'revision' && (
        <>
          {totales && (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['Revisados', totales.revisados],
                ['Suspender', totales.suspender],
                ['Pasan a un mes', totales.extender],
                ['Reactivar', totales.reactivar],
                ['Retirar', totales.retirar],
              ].map(([etiqueta, valor]) => (
                <Card key={etiqueta as string} className="text-center">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">{etiqueta}</p>
                  <p className="mt-1 text-2xl font-semibold text-neutral-900">{valor as number}</p>
                </Card>
              ))}
            </div>
          )}

          <Card>
            {!resultado ? (
              <p className="py-10 text-center text-neutral-500">
                Corra la revisión para ver qué haría el sistema. No cambia nada hasta que se aplica.
              </p>
            ) : resultado.cambios.length === 0 ? (
              <p className="py-10 text-center text-neutral-600">
                Al {dia(resultado.hasta)} no hay nada que cambiar: ningún socio llega a la semana 6.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-neutral-600">Mostrar:</span>
                  {(['todos', 'suspender', 'extender', 'reactivar', 'retirar'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltro(f)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        filtro === f
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-neutral-200 text-neutral-600'
                      }`}
                    >
                      {f === 'todos' ? 'Todos' : ETIQUETA[f].texto}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-3">Expediente</th>
                        <th className="px-4 py-3">Socio</th>
                        <th className="px-4 py-3">Semanas</th>
                        <th className="px-4 py-3">Acción</th>
                        <th className="px-4 py-3">Hasta</th>
                        <th className="px-4 py-3">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {cambios.slice(0, 500).map((c) => (
                        <tr key={`${c.socio_id}-${c.accion}`} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-medium text-neutral-900">{c.codigo_socio}</td>
                          <td className="px-4 py-3 text-neutral-700">
                            {c.socio}
                            {c.accion === 'retirar' && c.prestamos_abiertos ? (
                              <div className="text-xs text-red-600">
                                Debe {c.prestamos_abiertos} préstamo(s): va a la reunión de delegados
                              </div>
                            ) : null}
                            {c.accion === 'retirar' && c.ahorro_usd ? (
                              <div className="text-xs text-neutral-500">
                                Ahorro por devolver: ${c.ahorro_usd}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">{c.semanas_atraso}</td>
                          <td className="px-4 py-3">
                            <Badge variant={ETIQUETA[c.accion].variant}>{ETIQUETA[c.accion].texto}</Badge>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{dia(c.suspendido_hasta)}</td>
                          <td className="px-4 py-3 text-neutral-600">{c.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cambios.length > 500 && (
                    <p className="mt-3 text-xs text-neutral-500">
                      Se muestran los primeros 500 de {cambios.length}.
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {pestana === 'suspendidos' && (
        <Card>
          {cargandoLista ? (
            <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
            </div>
          ) : suspendidos.length === 0 ? (
            <p className="py-10 text-center text-neutral-600">No hay socios suspendidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Expediente</th>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3">Desde</th>
                    <th className="px-4 py-3">Hasta</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {suspendidos.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{s.codigo_socio}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {s.apellido}, {s.nombre}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{dia(s.suspendido_desde ?? null)}</td>
                      <td className="px-4 py-3 text-neutral-600">{dia(s.suspendido_hasta ?? null)}</td>
                      <td className="px-4 py-3 text-right">
                        {puedeReactivar && (
                          <Button variant="outline" size="sm" onClick={() => setAReactivar(s)}>
                            <RotateCcw className="h-4 w-4" />
                            Reactivar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {pestana === 'historial' && (
        <Card>
          {cargandoLista ? (
            <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
            </div>
          ) : historial.length === 0 ? (
            <p className="py-10 text-center text-neutral-600">Todavía no hay movimientos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Expediente</th>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3">Cambio</th>
                    <th className="px-4 py-3">Semanas</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Quién</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {historial.map((h) => (
                    <tr key={h.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-neutral-600">{formatearFecha(h.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{h.codigo_socio}</td>
                      <td className="px-4 py-3 text-neutral-700">{h.socio}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {h.estado_anterior} → {h.estado_nuevo}
                        <span className="ml-2 text-xs text-neutral-400">
                          {h.origen === 'manual' ? 'a mano' : 'automático'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{h.semanas_atraso ?? '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{h.motivo}</td>
                      <td className="px-4 py-3 text-neutral-600">{h.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={aReactivar !== null}
        onClose={() => setAReactivar(null)}
        title={`Reactivar a ${aReactivar?.codigo_socio ?? ''}`}
        description="Queda registrado quién lo hizo y por qué."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAReactivar(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void reactivar()} disabled={motivo.trim().length < 5 || guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reactivar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Motivo"
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Pagó las semanas que debía"
          />
          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={forzar}
              onChange={(e) => setForzar(e.target.checked)}
            />
            <span>
              Adelantar el fin de la suspensión. Los días se cumplen aunque el socio pague, así que esto es una
              excepción y sólo la puede hacer la caja 99.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  )
}

export default MorosidadPage
