/**
 * ============================================
 * PAGE: PRESTAMOS
 * ============================================
 * El sistema viejo reparte esto en cinco items de menu: Prestamos, Prestamos
 * por Cobrar, Cobrados, Morosos y Emitidos. Aca conviven en una pantalla con
 * un filtro de cartera, mas la ficha del prestamo con su plan de pagos.
 *
 * Antes de otorgar se simula: el socio ve la cuota y el total a pagar sin que
 * se cree nada, que hoy se calcula a mano.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DollarSign,
  Search,
  PlusCircle,
  Loader2,
  AlertTriangle,
  X,
  Calculator,
  TrendingDown,
  CheckCircle2,
  Users,
  Printer,
  Wallet,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PrintableListado } from '../components/print/PrintableListado'
import * as prestamosService from '../services/prestamosService'
import * as sociosService from '../services/sociosService'
import type {
  FilaCartera,
  PrestamoDetalle,
  ReporteCartera,
  Simulacion,
  TipoPrestamo,
} from '../services/prestamosService'
import type { Socio } from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { formatearFecha } from '../utils/formatters'
import { usePermissions } from '../store/authStore'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

const labelClass = 'block text-sm font-medium text-neutral-700'

const money = (v: number | string | null | undefined): string =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const VISTAS = [
  { id: 'por_cobrar', label: 'Por cobrar' },
  { id: 'morosos', label: 'Morosos' },
  { id: 'cobrados', label: 'Cobrados' },
  { id: 'emitidos', label: 'Todos los emitidos' },
]

const badgeEstado = (estado: string) => {
  if (estado === 'saldado') return <Badge variant="success">Saldado</Badge>
  if (estado === 'moroso') return <Badge variant="error">Moroso</Badge>
  if (estado === 'cancelado') return <Badge variant="neutral">Cancelado</Badge>
  if (estado === 'refinanciado') return <Badge variant="warning">Refinanciado</Badge>
  return <Badge variant="info">Activo</Badge>
}

const hoyISO = (): string => new Date().toISOString().split('T')[0] ?? ''

export default function PrestamosPage() {
  const { hasPermission } = usePermissions()
  const puedeOtorgar = hasPermission('prestamos', 'create')
  const puedeAbonar = hasPermission('prestamos', 'update')

  const [vista, setVista] = useState('por_cobrar')
  const [cartera, setCartera] = useState<ReporteCartera | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [detalle, setDetalle] = useState<PrestamoDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  // --- Alta ---
  const [modalNuevo, setModalNuevo] = useState(false)
  const [tipos, setTipos] = useState<TipoPrestamo[]>([])
  const [cedulaSocio, setCedulaSocio] = useState('')
  const [socioElegido, setSocioElegido] = useState<Socio | null>(null)
  const [tipoId, setTipoId] = useState<number | ''>('')
  const [monto, setMonto] = useState('')
  const [plazo, setPlazo] = useState('12')
  const [fechaDesembolso, setFechaDesembolso] = useState(hoyISO())
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null)
  const [fiadores, setFiadores] = useState<{ socio: Socio; monto: string }[]>([])
  const [cedulaFiador, setCedulaFiador] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  // --- Abono ---
  const [modalAbono, setModalAbono] = useState(false)
  const [montoAbono, setMontoAbono] = useState('')
  const [abonando, setAbonando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const r = await prestamosService.obtenerCartera(vista)
      if (r.success) setCartera(r.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar la cartera')
    } finally {
      setCargando(false)
    }
  }, [vista])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void (async () => {
      try {
        const r = await prestamosService.obtenerTiposPrestamo()
        if (r.success) setTipos(r.data.filter((t) => t.estado))
      } catch {
        // el selector queda vacio; el error se ve al intentar simular
      }
    })()
  }, [])

  // ============================================
  // SIMULACION: se recalcula sola al cambiar los datos
  // ============================================
  useEffect(() => {
    const m = parseFloat(monto)
    const p = parseInt(plazo, 10)
    if (!tipoId || !m || m <= 0 || !p || p <= 0) {
      setSimulacion(null)
      return
    }

    const t = window.setTimeout(async () => {
      try {
        const r = await prestamosService.simular({
          tipo_prestamo_id: Number(tipoId),
          monto_usd: m,
          plazo_semanas: p,
          fecha_desembolso: fechaDesembolso,
        })
        if (r.success) {
          setSimulacion(r.data)
          setErrorForm('')
        }
      } catch (err) {
        setSimulacion(null)
        setErrorForm(getErrorMessage(err) || '')
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [tipoId, monto, plazo, fechaDesembolso])

  const buscarSocio = async (cedula: string, para: 'titular' | 'fiador') => {
    if (!cedula.trim()) return
    try {
      const r = await sociosService.buscarSocioPorCedula(cedula.trim())
      const encontrado = r.success && r.data.length > 0 ? r.data.find((s) => s.estado === 'activo') : null
      if (!encontrado) {
        setErrorForm('No se encontro un socio activo con esa cedula')
        return
      }
      setErrorForm('')
      if (para === 'titular') {
        setSocioElegido(encontrado)
        setCedulaSocio('')
      } else {
        if (encontrado.id === socioElegido?.id) {
          setErrorForm('El socio no puede ser fiador de su propio prestamo')
          return
        }
        if (fiadores.some((f) => f.socio.id === encontrado.id)) {
          setErrorForm('Ese fiador ya esta en la lista')
          return
        }
        setFiadores((prev) => [...prev, { socio: encontrado, monto: '' }])
        setCedulaFiador('')
      }
    } catch (err) {
      setErrorForm(getErrorMessage(err) || 'Error al buscar el socio')
    }
  }

  const abrirNuevo = () => {
    setSocioElegido(null)
    setCedulaSocio('')
    setTipoId(tipos[0]?.id ?? '')
    setMonto('')
    setPlazo('12')
    setFechaDesembolso(hoyISO())
    setSimulacion(null)
    setFiadores([])
    setErrorForm('')
    setModalNuevo(true)
  }

  const otorgar = async () => {
    if (!socioElegido) {
      setErrorForm('Busque y seleccione al socio titular')
      return
    }
    if (!simulacion) {
      setErrorForm('Complete monto y plazo para calcular la cuota')
      return
    }

    setGuardando(true)
    setErrorForm('')
    try {
      const r = await prestamosService.crearPrestamo({
        socio_id: socioElegido.id,
        tipo_prestamo_id: Number(tipoId),
        monto_usd: parseFloat(monto),
        plazo_semanas: parseInt(plazo, 10),
        fecha_desembolso: fechaDesembolso,
        fiadores: fiadores
          .filter((f) => parseFloat(f.monto) > 0)
          .map((f) => ({ socio_id: f.socio.id, monto_garantizado_usd: parseFloat(f.monto) })),
      })
      if (!r.success) throw new Error('No fue posible otorgar el prestamo')
      setModalNuevo(false)
      await cargar()
    } catch (err) {
      setErrorForm(getErrorMessage(err) || 'Error al otorgar el prestamo')
    } finally {
      setGuardando(false)
    }
  }

  const abrirDetalle = async (fila: FilaCartera) => {
    setCargandoDetalle(true)
    try {
      const r = await prestamosService.obtenerPrestamo(fila.id)
      if (r.success) setDetalle(r.data)
    } catch (err) {
      window.alert(getErrorMessage(err) || 'Error al abrir el prestamo')
    } finally {
      setCargandoDetalle(false)
    }
  }

  const confirmarAbono = async () => {
    if (!detalle) return
    const m = parseFloat(montoAbono)
    if (!m || m <= 0) return

    setAbonando(true)
    try {
      const r = await prestamosService.registrarAbono(detalle.id, m)
      if (!r.success) throw new Error('No fue posible registrar el abono')
      setModalAbono(false)
      setMontoAbono('')
      const actualizado = await prestamosService.obtenerPrestamo(detalle.id)
      if (actualizado.success) setDetalle(actualizado.data)
      await cargar()
    } catch (err) {
      window.alert(getErrorMessage(err) || 'Error al registrar el abono')
    } finally {
      setAbonando(false)
    }
  }

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!cartera) return []
    if (!q) return cartera.filas
    return cartera.filas.filter(
      (f) =>
        f.numero_prestamo.toLowerCase().includes(q) ||
        f.codigo_socio.toLowerCase().includes(q) ||
        f.cedula.includes(q) ||
        f.socio.toLowerCase().includes(q)
    )
  }, [cartera, busqueda])

  const filasImpresion = filas.map((f) => [
    f.numero_prestamo,
    f.codigo_socio,
    f.socio,
    f.tipo,
    money(f.monto_original_usd),
    money(f.deuda_total_usd),
    `${f.cuotas_pagadas}/${f.cuotas_totales}`,
    String(f.cuotas_vencidas),
    f.estado,
  ])

  const tipoElegido = tipos.find((t) => t.id === Number(tipoId))

  return (
    <div className="space-y-5">
      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Prestamos</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Cartera, plan de pagos y abonos. Los pagos se aplican en orden mora, interes y capital.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          {puedeOtorgar && (
            <Button onClick={abrirNuevo}>
              <PlusCircle className="h-4 w-4" />
              Nuevo prestamo
            </Button>
          )}
        </div>
      </div>

      {/* RESUMEN DE CARTERA */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Prestamos</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{cartera?.resumen.cantidad ?? 0}</p>
          <p className="mt-1 text-sm text-neutral-500">{VISTAS.find((v) => v.id === vista)?.label}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Otorgado</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            ${money(cartera?.resumen.otorgado_usd)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Capital original</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Por cobrar</p>
          <p className="mt-2 text-3xl font-bold text-primary-700">
            ${money(cartera?.resumen.por_cobrar_usd)}
          </p>
          <p className="mt-1 text-sm text-primary-700">Capital + interes + mora</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Mora</p>
          <p className="mt-2 text-3xl font-bold text-rose-600">${money(cartera?.resumen.mora_usd)}</p>
          <p className="mt-1 text-sm text-rose-700">Acumulada</p>
        </Card>
      </div>

      {/* FILTRO DE CARTERA */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              vista === v.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por numero, expediente, cedula o socio..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* TABLA */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 text-left">Prestamo</th>
                <th className="px-4 py-3 text-left">Socio</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Otorgado</th>
                <th className="px-4 py-3 text-right">Deuda</th>
                <th className="px-4 py-3 text-center">Cuotas</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-neutral-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Cargando cartera...</span>
                    </div>
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                    No hay prestamos en esta vista
                  </td>
                </tr>
              ) : (
                filas.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => void abrirDetalle(f)}
                    className="cursor-pointer transition-colors hover:bg-primary-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-mono text-sm font-semibold text-neutral-900">{f.numero_prestamo}</p>
                      <p className="text-xs text-neutral-500">{formatearFecha(f.fecha_desembolso)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-900">{f.socio}</p>
                      <p className="text-xs text-neutral-500">
                        {f.codigo_socio} · {f.cedula}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{f.tipo}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-neutral-600">
                      ${money(f.monto_original_usd)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <p className="text-sm font-semibold text-neutral-900">${money(f.deuda_total_usd)}</p>
                      {f.saldo_mora_usd > 0 && (
                        <p className="text-xs text-rose-600">mora ${money(f.saldo_mora_usd)}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className="text-sm text-neutral-900">
                        {f.cuotas_pagadas}/{f.cuotas_totales}
                      </span>
                      {f.cuotas_vencidas > 0 && (
                        <p className="text-xs text-rose-600">{f.cuotas_vencidas} vencida(s)</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">{badgeEstado(f.estado)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PrintableListado
        titulo={`Prestamos — ${VISTAS.find((v) => v.id === vista)?.label}`}
        subtitulo="Cartera de prestamos"
        filtros={[
          { label: 'Vista', value: VISTAS.find((v) => v.id === vista)?.label ?? vista },
          { label: 'Busqueda', value: busqueda || 'Sin busqueda' },
        ]}
        resumenes={[
          { label: 'Prestamos', value: String(filas.length) },
          { label: 'Otorgado', value: `$${money(cartera?.resumen.otorgado_usd)}` },
          { label: 'Por cobrar', value: `$${money(cartera?.resumen.por_cobrar_usd)}` },
          { label: 'Mora', value: `$${money(cartera?.resumen.mora_usd)}` },
        ]}
        columnas={['Prestamo', 'Expediente', 'Socio', 'Tipo', 'Otorgado', 'Deuda', 'Cuotas', 'Vencidas', 'Estado']}
        filas={filasImpresion}
      />

      {/* ================= MODAL: NUEVO PRESTAMO ================= */}
      {modalNuevo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card
            padding="none"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden border-neutral-200"
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Nuevo prestamo</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  La cuota se calcula sola. Nada se guarda hasta confirmar.
                </p>
              </div>
              <button
                onClick={() => setModalNuevo(false)}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* Titular */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Socio titular
                </p>
                {socioElegido ? (
                  <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {socioElegido.apellido}, {socioElegido.nombre}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {socioElegido.codigo_socio} · {socioElegido.cedula}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSocioElegido(null)}>
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={cedulaSocio}
                      onChange={(e) => setCedulaSocio(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void buscarSocio(cedulaSocio, 'titular')}
                      placeholder="Cedula del socio"
                      className={controlClass}
                    />
                    <Button onClick={() => void buscarSocio(cedulaSocio, 'titular')}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Condiciones */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <label className={labelClass}>
                  <span className="mb-1.5 block">Tipo</span>
                  <select
                    value={tipoId}
                    onChange={(e) => setTipoId(e.target.value ? Number(e.target.value) : '')}
                    className={controlClass}
                  >
                    <option value="">Seleccione...</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Monto USD</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className={`${controlClass} font-semibold`}
                  />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Plazo (semanas)</span>
                  <input
                    type="number"
                    min={1}
                    max={tipoElegido?.plazo_maximo_semanas ?? 520}
                    value={plazo}
                    onChange={(e) => setPlazo(e.target.value)}
                    className={controlClass}
                  />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Desembolso</span>
                  <input
                    type="date"
                    value={fechaDesembolso}
                    onChange={(e) => setFechaDesembolso(e.target.value)}
                    className={controlClass}
                  />
                </label>
              </div>

              {tipoElegido && (
                <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  {tipoElegido.nombre}: {tipoElegido.tasa_interes_anual}% anual, mora{' '}
                  {tipoElegido.tasa_mora_mensual}% mensual, maximo {tipoElegido.plazo_maximo_semanas}{' '}
                  semanas.{' '}
                  {tipoElegido.requiere_fiadores ? 'Requiere fiadores.' : 'No requiere fiadores.'}
                </p>
              )}

              {/* Simulacion */}
              {simulacion && (
                <div className="rounded-xl border-2 border-primary-200 bg-primary-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary-600" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                      Simulacion
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-neutral-600">Cuota semanal</p>
                      <p className="text-xl font-bold text-neutral-900">
                        ${money(simulacion.cuota_semanal_usd)}
                      </p>
                      <p className="text-xs text-neutral-500">{money(simulacion.cuota_semanal_bs)} Bs</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600">Interes total</p>
                      <p className="text-xl font-bold text-neutral-900">
                        ${money(simulacion.total_interes_usd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600">Total a pagar</p>
                      <p className="text-xl font-bold text-primary-700">
                        ${money(simulacion.total_a_pagar_usd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-600">Vence</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {formatearFecha(
                          String(simulacion.plan[simulacion.plan.length - 1]?.fecha_vencimiento ?? '')
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fiadores */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <Users className="h-4 w-4" />
                  Fiadores
                  {tipoElegido?.requiere_fiadores && <span className="text-rose-600">(obligatorio)</span>}
                </p>

                <div className="flex gap-2">
                  <input
                    value={cedulaFiador}
                    onChange={(e) => setCedulaFiador(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void buscarSocio(cedulaFiador, 'fiador')}
                    placeholder="Cedula del fiador"
                    className={controlClass}
                  />
                  <Button variant="outline" onClick={() => void buscarSocio(cedulaFiador, 'fiador')}>
                    Agregar
                  </Button>
                </div>

                {fiadores.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {fiadores.map((f, i) => (
                      <div
                        key={f.socio.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            {f.socio.apellido}, {f.socio.nombre}
                          </p>
                          <p className="text-xs text-neutral-500">{f.socio.codigo_socio}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={f.monto}
                            onChange={(e) =>
                              setFiadores((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x))
                              )
                            }
                            placeholder="Garantia USD"
                            className="w-32 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                          />
                          <button
                            onClick={() => setFiadores((prev) => prev.filter((_, j) => j !== i))}
                            className="rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-neutral-500">
                      Se bloquea ese monto del ahorro de cada fiador hasta que el prestamo se salde.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-200 px-6 py-4">
              {errorForm && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorForm}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setModalNuevo(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button onClick={() => void otorgar()} disabled={guardando || !simulacion || !socioElegido}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                  {guardando ? 'Otorgando...' : 'Otorgar prestamo'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================= MODAL: FICHA DEL PRESTAMO ================= */}
      {(detalle || cargandoDetalle) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card
            padding="none"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden border-neutral-200"
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  {detalle ? detalle.numero_prestamo : 'Cargando...'}
                </h2>
                {detalle && (
                  <p className="mt-1 text-sm text-neutral-500">
                    {detalle.socio.apellido}, {detalle.socio.nombre} · {detalle.socio.codigo_socio} ·{' '}
                    {detalle.tipo_prestamo.nombre}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detalle && detalle.estado !== 'saldado' && puedeAbonar && (
                  <Button size="sm" onClick={() => setModalAbono(true)}>
                    <Wallet className="h-4 w-4" />
                    Abonar
                  </Button>
                )}
                <button
                  onClick={() => setDetalle(null)}
                  className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {detalle && (
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {/* Saldos */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Capital', valor: detalle.saldo_capital_usd, color: 'text-neutral-900' },
                    { label: 'Interes', valor: detalle.saldo_interes_usd, color: 'text-neutral-900' },
                    { label: 'Mora', valor: detalle.saldo_mora_usd, color: 'text-rose-600' },
                    { label: 'Deuda total', valor: detalle.resumen.deuda_total_usd, color: 'text-primary-700' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-neutral-50 px-3 py-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.label}</p>
                      <p className={`mt-1 text-lg font-bold ${s.color}`}>${money(s.valor)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-neutral-600">
                      <span>
                        {detalle.resumen.cuotas_pagadas} de {detalle.resumen.cuotas_totales} cuotas
                      </span>
                      <span>{detalle.resumen.avance_porcentaje}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all"
                        style={{ width: `${detalle.resumen.avance_porcentaje}%` }}
                      />
                    </div>
                  </div>
                  {badgeEstado(detalle.estado)}
                </div>

                {/* Fiadores */}
                {detalle.fiadores.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Fiadores
                    </p>
                    <div className="space-y-1.5">
                      {detalle.fiadores.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                        >
                          <span className="text-neutral-800">
                            {f.socio.apellido}, {f.socio.nombre} · {f.socio.codigo_socio}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-neutral-600">${money(f.monto_garantizado_usd)}</span>
                            {f.estado === 'liberado' ? (
                              <Badge variant="success">Liberado</Badge>
                            ) : (
                              <Badge variant="warning">Bloqueado</Badge>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan de pagos */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Plan de pagos
                  </p>
                  <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-neutral-200">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                      <thead className="sticky top-0 bg-neutral-50">
                        <tr className="text-xs uppercase tracking-wider text-neutral-500">
                          <th className="px-3 py-2 text-left">Cuota</th>
                          <th className="px-3 py-2 text-left">Vence</th>
                          <th className="px-3 py-2 text-right">Capital</th>
                          <th className="px-3 py-2 text-right">Interes</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {detalle.plan_pagos.map((c) => (
                          <tr key={c.numero_cuota} className={c.estado === 'vencida' ? 'bg-rose-50/50' : ''}>
                            <td className="px-3 py-2 font-mono">{c.numero_cuota}</td>
                            <td className="px-3 py-2 text-neutral-600">
                              {formatearFecha(c.fecha_vencimiento)}
                            </td>
                            <td className="px-3 py-2 text-right">${money(c.monto_capital_usd)}</td>
                            <td className="px-3 py-2 text-right text-neutral-600">
                              ${money(c.monto_interes_usd)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">${money(c.monto_total_usd)}</td>
                            <td className="px-3 py-2 text-center">
                              {c.estado === 'pagada' ? (
                                <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                              ) : c.estado === 'vencida' ? (
                                <AlertTriangle className="mx-auto h-4 w-4 text-rose-600" />
                              ) : (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Abonos */}
                {detalle.abonos.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Abonos ({detalle.abonos.length})
                    </p>
                    <div className="space-y-1.5">
                      {detalle.abonos.map((a) => (
                        <div key={a.id} className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-neutral-700">{formatearFecha(a.fecha_abono)}</span>
                            <span className="font-semibold text-neutral-900">${money(a.monto_usd)}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            mora ${money(a.aplicado_mora_usd)} · interes ${money(a.aplicado_interes_usd)} ·
                            capital ${money(a.aplicado_capital_usd)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================= MODAL: ABONO ================= */}
      {modalAbono && detalle && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card padding="none" className="w-full max-w-md overflow-hidden border-neutral-200">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-neutral-900">Registrar abono</h2>
              <p className="mt-1 text-sm text-neutral-500">{detalle.numero_prestamo}</p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg bg-neutral-50 px-3 py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Mora</span>
                  <span className="font-medium">${money(detalle.saldo_mora_usd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Interes</span>
                  <span className="font-medium">${money(detalle.saldo_interes_usd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Capital</span>
                  <span className="font-medium">${money(detalle.saldo_capital_usd)}</span>
                </div>
                <div className="mt-1.5 flex justify-between border-t border-neutral-200 pt-1.5">
                  <span className="font-semibold text-neutral-800">Deuda total</span>
                  <span className="font-bold text-neutral-900">
                    ${money(detalle.resumen.deuda_total_usd)}
                  </span>
                </div>
              </div>

              <label className={labelClass}>
                <span className="mb-1.5 block">Monto a abonar (USD)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={detalle.resumen.deuda_total_usd}
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  autoFocus
                  className={`${controlClass} text-lg font-bold`}
                />
              </label>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMontoAbono(String(detalle.cuota_semanal_usd))}
                >
                  Una cuota (${money(detalle.cuota_semanal_usd)})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMontoAbono(String(detalle.resumen.deuda_total_usd))}
                >
                  Saldar todo
                </Button>
              </div>

              <p className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Se aplica en orden: primero mora, luego interes y por ultimo capital.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setModalAbono(false)} disabled={abonando}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmarAbono()} disabled={abonando || !parseFloat(montoAbono)}>
                {abonando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar abono
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
