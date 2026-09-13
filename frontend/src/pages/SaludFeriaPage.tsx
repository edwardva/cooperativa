/**
 * ============================================
 * PAGE: PAGO DE SALUD POR FERIA
 * ============================================
 * RF-SAL-01 a 15, HU-07 a HU-10 y HU-19. La feria descuenta la salud a sus
 * trabajadores y la paga junta por periodo:
 *
 *   1. Se elige feria y periodo: aparece quien debe y cuanto (HU-07).
 *   2. Se cargan los datos del pago y se confirma viendo cuantos movimientos
 *      individuales se van a generar (RF-SAL-10).
 *   3. El backend recalcula todo en una transaccion: si la deuda cambio entre
 *      medio, rechaza y se vuelve a mostrar.
 *
 * Periodicidad y monto por trabajador vienen de Parametros: la cooperativa
 * todavia no los confirmo.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, FileSpreadsheet, FileText, HeartPulse, Loader2, Printer, Search, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Drawer } from '../components/ui/Drawer'
import { PrintableListado } from '../components/print/PrintableListado'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { useEnterNavigation } from '../hooks/useEnterNavigation'
import * as saludFeriaService from '../services/saludFeriaService'
import * as feriasService from '../services/feriasService'
import * as reportesService from '../services/reportesService'
import type {
  Configuracion,
  Deuda,
  FeriasPendientes,
  PagoDetalle,
  PagoResumen,
} from '../services/saludFeriaService'
import type { Ubicacion } from '../services/feriasService'

type Pestana = 'registrar' | 'pendientes' | 'historial'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100'
const labelClass = 'block text-sm font-medium text-neutral-700'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const METODOS: Record<string, string> = {
  transferencia: 'Transferencia',
  pago_movil: 'Pago movil',
  deposito: 'Deposito',
  efectivo: 'Efectivo',
  otro: 'Otro',
}

const pad = (n: number) => String(n).padStart(2, '0')
const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const money = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const redondear = (v: number) => Math.round(v * 100) / 100
const nombreFeria = (f: { codigo: string; nombre: string }) =>
  f.nombre && f.nombre !== f.codigo ? `${f.codigo} · ${f.nombre}` : f.codigo

const badgeEstadoFeria = (estado: string) => {
  if (estado === 'pagada') return <Badge variant="success">Pagada</Badge>
  if (estado === 'parcial') return <Badge variant="warning">Parcial</Badge>
  if (estado === 'pendiente') return <Badge variant="error">Pendiente</Badge>
  return <Badge variant="neutral">Sin trabajadores</Badge>
}

export default function SaludFeriaPage() {
  const { hasPermission } = usePermissions()
  const puedeRegistrar = hasPermission('salud_feria', 'create')
  const puedeAnular = hasPermission('salud_feria', 'delete')
  const puedeExportar = hasPermission('reportes', 'export')
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null)
  const alEnter = useEnterNavigation()

  const [pestana, setPestana] = useState<Pestana>('registrar')
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [ferias, setFerias] = useState<Ubicacion[]>([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  // Periodo compartido por las pestañas de registro y pendientes
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [numero, setNumero] = useState(new Date().getMonth() + 1)
  const tipo = config?.periodicidad ?? 'mensual'

  // --- Registrar ---
  const [feriaId, setFeriaId] = useState('')
  const [deuda, setDeuda] = useState<Deuda | null>(null)
  const [cargandoDeuda, setCargandoDeuda] = useState(false)
  const [pago, setPago] = useState({
    fecha_pago: hoyISO(),
    moneda: 'BS' as 'BS' | 'USD',
    monto_recibido: '',
    metodo_pago: 'transferencia',
    referencia: '',
    observaciones: '',
  })
  const [confirmando, setConfirmando] = useState(false)
  const [aceptarDiferencia, setAceptarDiferencia] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [errorPago, setErrorPago] = useState('')

  // --- Pendientes ---
  const [pendientes, setPendientes] = useState<FeriasPendientes | null>(null)
  const [cargandoPendientes, setCargandoPendientes] = useState(false)

  // --- Historial ---
  const [filtros, setFiltros] = useState({ feria_id: '', estado: '', referencia: '', trabajador: '' })
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros)
  const [pagos, setPagos] = useState<PagoResumen[]>([])
  const [totalPagos, setTotalPagos] = useState(0)
  const [paginaPagos, setPaginaPagos] = useState(1)
  const [paginasPagos, setPaginasPagos] = useState(1)
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [detallePago, setDetallePago] = useState<PagoDetalle | null>(null)
  const [anulacion, setAnulacion] = useState<string | null>(null)
  const [errorAnulacion, setErrorAnulacion] = useState('')
  const [anulando, setAnulando] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [c, f] = await Promise.all([saludFeriaService.obtenerConfiguracion(), feriasService.obtenerUbicaciones()])
        setConfig(c.data)
        setAnio(c.data.periodo_actual.anio)
        setNumero(c.data.periodo_actual.numero)
        if (f.success && f.data) setFerias(f.data)
      } catch (err) {
        setError(getErrorMessage(err) || 'No fue posible cargar la configuracion')
      }
    })()
  }, [])


  const cargarDeuda = useCallback(async () => {
    if (!feriaId || !config) {
      setDeuda(null)
      return
    }
    setCargandoDeuda(true)
    setErrorPago('')
    try {
      const r = await saludFeriaService.obtenerDeuda(Number(feriaId), { tipo, anio, numero })
      setDeuda(r.data)
    } catch (err) {
      setDeuda(null)
      setErrorPago(getErrorMessage(err) || 'No fue posible calcular la deuda')
    } finally {
      setCargandoDeuda(false)
    }
  }, [feriaId, config, tipo, anio, numero])

  useEffect(() => {
    void cargarDeuda()
  }, [cargarDeuda])

  const esperadoUsd = deuda?.resumen.monto_pendiente_usd ?? 0
  const esperadoEnMoneda = deuda ? (pago.moneda === 'USD' ? esperadoUsd : deuda.monto_pendiente_bs) : 0

  // El monto recibido arranca en el esperado de la moneda elegida
  useEffect(() => {
    setPago((p) => ({ ...p, monto_recibido: esperadoEnMoneda ? String(esperadoEnMoneda) : '' }))
  }, [esperadoEnMoneda])

  const diferencia = redondear(Number(pago.monto_recibido || 0) - esperadoEnMoneda)
  const hayDiferencia = Math.abs(diferencia) > 0.009

  const cargarPendientes = useCallback(async () => {
    if (!config) return
    setCargandoPendientes(true)
    try {
      const r = await saludFeriaService.obtenerFeriasPendientes({ tipo, anio, numero })
      setPendientes(r.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'No fue posible calcular las ferias pendientes')
    } finally {
      setCargandoPendientes(false)
    }
  }, [config, tipo, anio, numero])

  useEffect(() => {
    if (pestana === 'pendientes') void cargarPendientes()
  }, [pestana, cargarPendientes])

  const cargarPagos = useCallback(async () => {
    setCargandoPagos(true)
    try {
      const r = await saludFeriaService.listarPagos({
        feria_id: filtrosAplicados.feria_id ? Number(filtrosAplicados.feria_id) : undefined,
        estado: filtrosAplicados.estado || undefined,
        referencia: filtrosAplicados.referencia.trim() || undefined,
        trabajador: filtrosAplicados.trabajador.trim() || undefined,
        page: paginaPagos,
        limit: 20,
      })
      setPagos(r.data)
      setTotalPagos(r.meta?.total ?? r.data.length)
      setPaginasPagos(Math.max(1, r.meta?.totalPages ?? 1))
    } catch (err) {
      setError(getErrorMessage(err) || 'No fue posible cargar el historial')
    } finally {
      setCargandoPagos(false)
    }
  }, [filtrosAplicados, paginaPagos])

  useEffect(() => {
    if (pestana === 'historial') void cargarPagos()
  }, [pestana, cargarPagos])

  const abrirPago = async (id: number) => {
    try {
      const r = await saludFeriaService.obtenerPago(id)
      setDetallePago(r.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'No fue posible abrir el pago')
    }
  }

  // ================= REGISTRO =================

  const pedirConfirmacion = () => {
    if (!deuda) return
    if (!(Number(pago.monto_recibido) > 0)) return setErrorPago('Indique el monto recibido.')
    if (!pago.fecha_pago) return setErrorPago('Indique la fecha del pago.')
    setErrorPago('')
    setAceptarDiferencia(false)
    setConfirmando(true)
  }

  const confirmarPago = async () => {
    if (!deuda) return
    setRegistrando(true)
    setErrorPago('')
    try {
      const r = await saludFeriaService.registrarPago({
        feria_id: deuda.feria.id,
        tipo,
        anio,
        numero,
        fecha_pago: pago.fecha_pago,
        moneda: pago.moneda,
        monto_recibido: Number(pago.monto_recibido),
        metodo_pago: pago.metodo_pago,
        referencia: pago.referencia.trim() || null,
        observaciones: pago.observaciones.trim() || null,
        esperado: { cantidad_trabajadores: deuda.resumen.pendientes, monto_usd: esperadoUsd },
        aceptar_diferencia: aceptarDiferencia,
      })
      setConfirmando(false)
      setAviso(
        `Pago registrado: ${r.data.cantidad_trabajadores} trabajador(es) de ${r.data.feria.codigo} en ${r.data.periodo.etiqueta}.`
      )
      setPago((p) => ({ ...p, referencia: '', observaciones: '' }))
      await cargarDeuda()
      setDetallePago(r.data)
    } catch (err) {
      const mensaje = getErrorMessage(err) || 'No fue posible registrar el pago'
      setConfirmando(false)
      setErrorPago(mensaje)
      // Si otro usuario pago o cambio un trabajador, se muestra la deuda real
      if (/deuda cambió|no tiene trabajadores pendientes/.test(mensaje)) await cargarDeuda()
    } finally {
      setRegistrando(false)
    }
  }

  const confirmarAnulacion = async () => {
    if (!detallePago || anulacion === null) return
    if (anulacion.trim().length < 5) return setErrorAnulacion('Explique el motivo (minimo 5 caracteres).')
    setAnulando(true)
    setErrorAnulacion('')
    try {
      const r = await saludFeriaService.anularPago(detallePago.id, anulacion.trim())
      setDetallePago(r.data)
      setAnulacion(null)
      setAviso(`Pago #${r.data.id} anulado. Sus ${r.data.detalles.length} trabajadores vuelven a pendiente.`)
      if (pestana === 'historial') await cargarPagos()
      await cargarDeuda()
    } catch (err) {
      setErrorAnulacion(getErrorMessage(err) || 'No fue posible anular el pago')
    } finally {
      setAnulando(false)
    }
  }

  // ================= VISTA =================

  const selectorPeriodo = (
    <>
      <label className={labelClass}>
        <span className="mb-1.5 block">Año</span>
        <input type="number" min={2000} max={2100} value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={controlClass} />
      </label>
      {tipo === 'mensual' ? (
        <label className={labelClass}>
          <span className="mb-1.5 block">Mes</span>
          <select value={numero} onChange={(e) => setNumero(Number(e.target.value))} className={controlClass}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className={labelClass}>
          <span className="mb-1.5 block">Semana</span>
          <input type="number" min={1} max={53} value={numero} onChange={(e) => setNumero(Number(e.target.value))} className={controlClass} />
        </label>
      )}
    </>
  )

  const puedePagar =
    !!deuda && puedeRegistrar && deuda.resumen.pendientes > 0 && deuda.tarifa_configurada && !deuda.periodo_futuro

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
            <HeartPulse className="h-6 w-6 text-primary-600" />
            Pago de Salud por Feria
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            La feria paga la salud de sus trabajadores en un solo pago por periodo
            {config ? ` (${config.periodicidad}, $${money(config.tarifa_usd)} por trabajador)` : ''}.
          </p>
        </div>
      </div>

      {config && !config.tarifa_configurada && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>
            El monto de salud por trabajador no esta configurado. Hasta cargarlo en Parametros
            (TARIFA_SALUD_TRABAJADOR_USD) se puede consultar, pero no registrar pagos.
          </p>
        </div>
      )}
      {aviso && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="flex-1">{aviso}</p>
          <button onClick={() => setAviso('')} aria-label="Cerrar aviso"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError('')} aria-label="Cerrar error"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex gap-1 border-b border-neutral-200" role="tablist">
        {([['registrar', 'Registrar pago'], ['pendientes', 'Ferias pendientes'], ['historial', 'Historial de pagos']] as const).map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${pestana === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {/* ================= REGISTRAR ================= */}
      {pestana === 'registrar' && (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" onKeyDown={alEnter}>
              <label className={labelClass}>
                <span className="mb-1.5 block">Feria *</span>
                <select value={feriaId} onChange={(e) => setFeriaId(e.target.value)} className={controlClass} autoFocus>
                  <option value="">Seleccione la feria</option>
                  {ferias.map((f) => (
                    <option key={f.id} value={f.id}>{nombreFeria(f)}{f.estado ? '' : ' (inactiva)'}</option>
                  ))}
                </select>
              </label>
              {selectorPeriodo}
            </div>
          </Card>

          {cargandoDeuda && <Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" />}

          {deuda && !cargandoDeuda && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  ['Trabajadores', deuda.resumen.total],
                  ['Pagados', deuda.resumen.pagados],
                  ['Pendientes', deuda.resumen.pendientes],
                  ['Monto individual', `$${money(deuda.resumen.monto_individual_usd)}`],
                  ['Total pendiente', `$${money(deuda.resumen.monto_pendiente_usd)} · Bs ${money(deuda.monto_pendiente_bs)}`],
                ].map(([titulo, valor]) => (
                  <Card key={titulo} className="p-4">
                    <p className="text-xs uppercase tracking-wide text-neutral-500">{titulo}</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900">{valor}</p>
                  </Card>
                ))}
              </div>

              {deuda.periodo_futuro && (
                <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  {deuda.periodo.etiqueta} todavia no empieza: se puede consultar, pero no pagar.
                </p>
              )}

              <Card padding="none">
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <p className="text-sm font-medium text-neutral-800">
                    {nombreFeria(deuda.feria)} · {deuda.periodo.etiqueta} ({dia(deuda.periodo.inicio)} al {dia(deuda.periodo.fin)})
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-2">Identificacion</th>
                        <th className="px-4 py-2">Trabajador</th>
                        <th className="px-4 py-2">Codigo</th>
                        <th className="px-4 py-2">Feria</th>
                        <th className="px-4 py-2 text-right">Monto</th>
                        <th className="px-4 py-2">Periodo</th>
                        <th className="px-4 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {deuda.filas.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">La feria no tuvo trabajadores en este periodo</td></tr>
                      ) : (
                        deuda.filas.map((f) => (
                          <tr key={f.trabajador_id}>
                            <td className="px-4 py-2 text-neutral-700">{f.identificacion}</td>
                            <td className="px-4 py-2 font-medium text-neutral-900">
                              {f.nombre}
                              {f.estado_trabajador === 'retirado' && <span className="ml-2 text-xs text-neutral-500">(retirado)</span>}
                            </td>
                            <td className="px-4 py-2 font-mono">{f.codigo_trabajador}</td>
                            <td className="px-4 py-2">{deuda.feria.codigo}</td>
                            <td className="px-4 py-2 text-right">${money(f.monto_usd)}</td>
                            <td className="px-4 py-2">{deuda.periodo.etiqueta}</td>
                            <td className="px-4 py-2">
                              {f.estado === 'pagado' ? (
                                <button onClick={() => f.pago_id && void abrirPago(f.pago_id)} className="hover:underline">
                                  <Badge variant="success">Pagado</Badge>
                                </button>
                              ) : (
                                <Badge variant="warning">Pendiente</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {puedePagar && (
                <Card className="p-4">
                  <p className="mb-3 text-sm font-semibold text-neutral-800">Datos del pago recibido</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" onKeyDown={alEnter}>
                    <label className={labelClass}>
                      <span className="mb-1.5 block">Fecha del pago *</span>
                      <input type="date" max={hoyISO()} value={pago.fecha_pago} onChange={(e) => setPago({ ...pago, fecha_pago: e.target.value })} className={controlClass} />
                    </label>
                    <label className={labelClass}>
                      <span className="mb-1.5 block">Moneda</span>
                      <select value={pago.moneda} onChange={(e) => setPago({ ...pago, moneda: e.target.value as 'BS' | 'USD' })} className={controlClass}>
                        <option value="BS">Bolivares</option>
                        <option value="USD">Dolares</option>
                      </select>
                    </label>
                    <label className={labelClass}>
                      <span className="mb-1.5 block">Monto recibido * (esperado {money(esperadoEnMoneda)})</span>
                      <input type="number" step="0.01" min={0} value={pago.monto_recibido} onChange={(e) => setPago({ ...pago, monto_recibido: e.target.value })} className={controlClass} />
                    </label>
                    <label className={labelClass}>
                      <span className="mb-1.5 block">Metodo *</span>
                      <select value={pago.metodo_pago} onChange={(e) => setPago({ ...pago, metodo_pago: e.target.value })} className={controlClass}>
                        {(config?.metodos_pago ?? Object.keys(METODOS)).map((m) => (
                          <option key={m} value={m}>{METODOS[m] ?? m}</option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      <span className="mb-1.5 block">Referencia</span>
                      <input value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} maxLength={60} className={controlClass} />
                    </label>
                    <label className={labelClass}>
                      <span className="mb-1.5 block">Observaciones</span>
                      <textarea value={pago.observaciones} onChange={(e) => setPago({ ...pago, observaciones: e.target.value })} rows={1} className={controlClass} />
                    </label>
                  </div>
                  {hayDiferencia && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      El monto recibido difiere del esperado en {money(diferencia)} {pago.moneda}.
                    </p>
                  )}
                  {errorPago && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorPago}</p>}
                  <div className="mt-4 flex justify-end">
                    <Button onClick={pedirConfirmacion}>Registrar pago de {deuda.resumen.pendientes} trabajador(es)</Button>
                  </div>
                </Card>
              )}
              {!puedePagar && errorPago && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorPago}</p>}
            </>
          )}
        </div>
      )}

      {/* ================= FERIAS PENDIENTES (HU-19) ================= */}
      {pestana === 'pendientes' && (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
              {selectorPeriodo}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => window.print()} disabled={!pendientes}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                {puedeExportar &&
                  (['excel', 'pdf'] as const).map((formato) => (
                    <Button
                      key={formato}
                      variant="outline"
                      disabled={exportando !== null}
                      onClick={() => {
                        setExportando(formato)
                        reportesService
                          .exportarReporte('ferias-pendientes', formato, { tipo, anio: String(anio), numero: String(numero) })
                          .catch((err) => setError(getErrorMessage(err) || 'No fue posible exportar'))
                          .finally(() => setExportando(null))
                      }}
                    >
                      {exportando === formato ? <Loader2 className="h-4 w-4 animate-spin" /> : formato === 'excel' ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      {formato === 'excel' ? 'Excel' : 'PDF'}
                    </Button>
                  ))}
              </div>
            </div>
          </Card>

          {cargandoPendientes && <Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" />}

          {pendientes && !cargandoPendientes && (
            <>
              <PrintableListado
                titulo={`Ferias pendientes de pago de salud · ${pendientes.periodo.etiqueta}`}
                subtitulo={`$${money(pendientes.tarifa_usd)} por trabajador · tasa ${money(pendientes.tasa)}`}
                filtros={[{ label: 'Periodo', value: pendientes.periodo.etiqueta }]}
                columnas={['Feria', 'Responsable', 'Trabajadores', 'Pagados', 'Pendientes', 'Pendiente USD', 'Pendiente Bs', 'Estado']}
                filas={pendientes.ferias.map((f) => [
                  nombreFeria(f.feria),
                  f.feria.responsable ?? '-',
                  String(f.total),
                  String(f.pagados),
                  String(f.pendientes),
                  money(f.monto_pendiente_usd),
                  money(f.monto_pendiente_bs),
                  f.estado,
                ])}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="p-4"><p className="text-xs uppercase text-neutral-500">Ferias con deuda</p><p className="mt-1 text-lg font-semibold">{pendientes.totales.ferias_con_deuda}</p></Card>
                <Card className="p-4"><p className="text-xs uppercase text-neutral-500">Trabajadores pendientes</p><p className="mt-1 text-lg font-semibold">{pendientes.totales.trabajadores_pendientes}</p></Card>
                <Card className="p-4"><p className="text-xs uppercase text-neutral-500">Monto pendiente</p><p className="mt-1 text-lg font-semibold">${money(pendientes.totales.monto_pendiente_usd)}</p></Card>
              </div>
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-2">Feria</th>
                        <th className="px-4 py-2">Responsable</th>
                        <th className="px-4 py-2 text-right">Trabajadores</th>
                        <th className="px-4 py-2 text-right">Pagados</th>
                        <th className="px-4 py-2 text-right">Pendientes</th>
                        <th className="px-4 py-2 text-right">Pendiente</th>
                        <th className="px-4 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {pendientes.ferias.map((f) => (
                        <tr
                          key={f.feria.id}
                          className="cursor-pointer hover:bg-primary-50/40"
                          onClick={() => { setFeriaId(String(f.feria.id)); setPestana('registrar') }}
                        >
                          <td className="px-4 py-2 font-medium text-neutral-900">{nombreFeria(f.feria)}</td>
                          <td className="px-4 py-2 text-neutral-600">{f.feria.responsable ?? '—'}{f.feria.telefono ? ` · ${f.feria.telefono}` : ''}</td>
                          <td className="px-4 py-2 text-right">{f.total}</td>
                          <td className="px-4 py-2 text-right">{f.pagados}</td>
                          <td className="px-4 py-2 text-right">{f.pendientes}</td>
                          <td className="px-4 py-2 text-right">${money(f.monto_pendiente_usd)}<span className="block text-xs text-neutral-500">Bs {money(f.monto_pendiente_bs)}</span></td>
                          <td className="px-4 py-2">{badgeEstadoFeria(f.estado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ================= HISTORIAL (RF-SAL-14) ================= */}
      {pestana === 'historial' && (
        <div className="space-y-5">
          <Card className="p-4">
            <div
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-5"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                  e.preventDefault()
                  setPaginaPagos(1)
                  setFiltrosAplicados(filtros)
                }
              }}
            >
              <label className={labelClass}>
                <span className="mb-1.5 block">Feria</span>
                <select value={filtros.feria_id} onChange={(e) => setFiltros({ ...filtros, feria_id: e.target.value })} className={controlClass}>
                  <option value="">Todas</option>
                  {ferias.map((f) => <option key={f.id} value={f.id}>{nombreFeria(f)}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Estado</span>
                <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} className={controlClass}>
                  <option value="">Todos</option>
                  <option value="vigente">Vigentes</option>
                  <option value="anulado">Anulados</option>
                </select>
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Referencia</span>
                <input value={filtros.referencia} onChange={(e) => setFiltros({ ...filtros, referencia: e.target.value })} className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Trabajador</span>
                <input value={filtros.trabajador} onChange={(e) => setFiltros({ ...filtros, trabajador: e.target.value })} placeholder="Codigo, cedula o apellido" className={controlClass} />
              </label>
              <Button onClick={() => { setPaginaPagos(1); setFiltrosAplicados(filtros) }}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </Card>

          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Feria</th>
                    <th className="px-4 py-2">Periodo</th>
                    <th className="px-4 py-2 text-right">Trabajadores</th>
                    <th className="px-4 py-2 text-right">Esperado</th>
                    <th className="px-4 py-2 text-right">Recibido</th>
                    <th className="px-4 py-2">Referencia</th>
                    <th className="px-4 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {cargandoPagos ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" /></td></tr>
                  ) : pagos.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">No hay pagos con estos filtros</td></tr>
                  ) : (
                    pagos.map((p) => (
                      <tr key={p.id} className="cursor-pointer hover:bg-primary-50/40" onClick={() => void abrirPago(p.id)}>
                        <td className="px-4 py-2">{dia(p.fecha_pago)}</td>
                        <td className="px-4 py-2 font-medium text-neutral-900">{nombreFeria(p.feria)}</td>
                        <td className="px-4 py-2">{p.periodo.etiqueta}</td>
                        <td className="px-4 py-2 text-right">{p.cantidad_trabajadores}</td>
                        <td className="px-4 py-2 text-right">${money(p.monto_esperado_usd)}</td>
                        <td className="px-4 py-2 text-right">{p.moneda === 'USD' ? '$' : 'Bs '}{money(p.monto_recibido)}</td>
                        <td className="px-4 py-2 text-neutral-600">{p.referencia ?? '—'}</td>
                        <td className="px-4 py-2">{p.estado === 'vigente' ? <Badge variant="success">Vigente</Badge> : <Badge variant="error">Anulado</Badge>}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
              <span>{totalPagos} pago(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={paginaPagos <= 1} onClick={() => setPaginaPagos((x) => x - 1)}>Anterior</Button>
                <span>Pagina {paginaPagos} de {paginasPagos}</span>
                <Button variant="outline" size="sm" disabled={paginaPagos >= paginasPagos} onClick={() => setPaginaPagos((x) => x + 1)}>Siguiente</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================= CONFIRMACION (RF-SAL-10) ================= */}
      {confirmando && deuda && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card padding="none" className="w-full max-w-md overflow-hidden border-neutral-200">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-neutral-900">Confirmar pago de salud</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-neutral-500">Feria</dt><dd className="font-medium">{nombreFeria(deuda.feria)}</dd>
                <dt className="text-neutral-500">Periodo</dt><dd className="font-medium">{deuda.periodo.etiqueta}</dd>
                <dt className="text-neutral-500">Trabajadores</dt><dd className="font-medium">{deuda.resumen.pendientes}</dd>
                <dt className="text-neutral-500">Monto total</dt><dd className="font-medium">${money(esperadoUsd)} · Bs {money(deuda.monto_pendiente_bs)}</dd>
                <dt className="text-neutral-500">Recibido</dt><dd className="font-medium">{pago.moneda === 'USD' ? '$' : 'Bs '}{money(pago.monto_recibido)}</dd>
              </dl>
              <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                <HeartPulse className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Esta por registrar {deuda.resumen.pendientes} pago(s) individual(es) por un monto de ${money(esperadoUsd)}. Se genera un movimiento de salud por cada trabajador.
              </p>
              {hayDiferencia && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <input type="checkbox" checked={aceptarDiferencia} onChange={(e) => setAceptarDiferencia(e.target.checked)} className="mt-0.5" />
                  El recibido difiere del esperado en {money(diferencia)} {pago.moneda}. Registrarlo con esa diferencia.
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={registrando}>Cancelar</Button>
              <Button onClick={() => void confirmarPago()} disabled={registrando || (hayDiferencia && !aceptarDiferencia)}>
                {registrando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ================= DETALLE DEL PAGO (HU-10) ================= */}
      <Drawer
        open={!!detallePago}
        onClose={() => { setDetallePago(null); setAnulacion(null) }}
        title={detallePago ? `Pago #${detallePago.id} · ${detallePago.feria.codigo}` : ''}
        description={detallePago ? `${detallePago.periodo.etiqueta} · pagado el ${dia(detallePago.fecha_pago)}` : undefined}
        width="xl"
        footer={
          detallePago && detallePago.estado === 'vigente' && puedeAnular && anulacion === null ? (
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => { setErrorAnulacion(''); setAnulacion('') }}>
                <Ban className="h-4 w-4" />
                Anular pago
              </Button>
            </div>
          ) : undefined
        }
      >
        {detallePago && (
          <div className="space-y-5 text-sm">
            {detallePago.estado === 'anulado' && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                Anulado el {dia(detallePago.fecha_anulacion)} por {detallePago.anulado_por_usuario?.nombre_completo ?? '—'}: {detallePago.motivo_anulacion}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <div><dt className="text-xs uppercase text-neutral-500">Trabajadores</dt><dd className="font-medium">{detallePago.cantidad_trabajadores}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-500">Esperado</dt><dd className="font-medium">${money(detallePago.monto_esperado_usd)} · Bs {money(detallePago.monto_esperado_bs)}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-500">Recibido</dt><dd className="font-medium">{detallePago.moneda === 'USD' ? '$' : 'Bs '}{money(detallePago.monto_recibido)}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-500">Metodo</dt><dd>{METODOS[detallePago.metodo_pago] ?? detallePago.metodo_pago}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-500">Referencia</dt><dd>{detallePago.referencia ?? '—'}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-500">Registrado por</dt><dd>{detallePago.registrado_por?.nombre_completo ?? '—'}</dd></div>
            </dl>
            {detallePago.observaciones && <p className="whitespace-pre-line text-neutral-700">{detallePago.observaciones}</p>}
            <p className={`flex items-center gap-2 ${detallePago.cuadra ? 'text-emerald-700' : 'text-red-700'}`}>
              {detallePago.cuadra ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Suma de los renglones: ${money(detallePago.suma_detalles_usd)} {detallePago.cuadra ? 'coincide con el total' : 'NO coincide con el total'}
            </p>
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full">
                <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                  <tr><th className="px-3 py-2">Codigo</th><th className="px-3 py-2">Trabajador</th><th className="px-3 py-2">Identificacion</th><th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2">Estado</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {detallePago.detalles.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-mono">{d.trabajador.codigo_trabajador}</td>
                      <td className="px-3 py-2">{d.trabajador.persona.apellidos}, {d.trabajador.persona.nombres}</td>
                      <td className="px-3 py-2">{d.trabajador.persona.tipo_identificacion}-{d.trabajador.persona.numero_identificacion}</td>
                      <td className="px-3 py-2 text-right">${money(d.monto_usd)}</td>
                      <td className="px-3 py-2">{d.estado === 'vigente' ? <Badge variant="success">Pagado</Badge> : <Badge variant="error">Anulado</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {anulacion !== null && (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
                <p className="flex items-start gap-2 font-medium text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Se anulan el pago y sus {detallePago.detalles.length} movimientos individuales. Esos trabajadores vuelven a quedar pendientes en {detallePago.periodo.etiqueta}. Nada se borra.
                </p>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Motivo de la anulacion *</span>
                  <textarea value={anulacion} onChange={(e) => setAnulacion(e.target.value)} rows={3} maxLength={500} autoFocus className={controlClass} />
                </label>
                {errorAnulacion && <p role="alert" className="text-red-700">{errorAnulacion}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setAnulacion(null)} disabled={anulando}>Cancelar</Button>
                  <Button variant="danger" onClick={() => void confirmarAnulacion()} disabled={anulando || anulacion.trim().length < 5}>
                    {anulando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    Confirmar anulacion
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
