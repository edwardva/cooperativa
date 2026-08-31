/**
 * ============================================
 * PAGE: REPORTES DE COLECTA
 * ============================================
 * Sustituye seis items sueltos del menu del sistema viejo (Colecta Ahorro,
 * Colecta Funeraria, Colecta Salud, Colecta Prestamos, Consolidada y Asiento
 * Contable) por una sola pantalla con filtro de servicio y de rango de fechas.
 *
 * El asiento contable reproduce la estructura del reporte original: una linea
 * por servicio con su cuenta contable, el monto en bolivares al haber, y la
 * contrapartida de caja al debe.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown, Loader2, Calculator, ListFilter, AlertTriangle } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PrintableListado } from '../components/print/PrintableListado'
import * as colectaService from '../services/colectaService'
import type { AsientoContable, ReportePorServicio } from '../services/colectaService'
import { getErrorMessage } from '../services/api'

type Vista = 'servicios' | 'asiento'

const hoyISO = (): string => new Date().toISOString().split('T')[0] ?? ''

const money = (valor: number): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

const SERVICIOS = [
  { value: 'todos', label: 'Todos los servicios' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'funeraria', label: 'Funeraria' },
  { value: 'salud', label: 'Salud' },
]

const etiquetaServicio: Record<string, string> = {
  ahorro: 'Ahorro',
  funeraria: 'Funeraria',
  salud: 'Salud',
  prestamo: 'Prestamo',
}

export default function ColectaReportesPage() {
  const [vista, setVista] = useState<Vista>('servicios')
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [servicio, setServicio] = useState('todos')

  const [reporte, setReporte] = useState<ReportePorServicio | null>(null)
  const [asiento, setAsiento] = useState<AsientoContable | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      if (vista === 'servicios') {
        const r = await colectaService.obtenerReportePorServicio({ desde, hasta, servicio })
        if (r.success) setReporte(r.data)
      } else {
        const r = await colectaService.obtenerAsientoContable({ desde, hasta })
        if (r.success) setAsiento(r.data)
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al generar el reporte')
    } finally {
      setCargando(false)
    }
  }, [vista, desde, hasta, servicio])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const rango = desde === hasta ? desde : `${desde} al ${hasta}`

  const filtrosImpresion = useMemo(
    () => [
      { label: 'Periodo', value: rango },
      { label: 'Servicio', value: SERVICIOS.find((s) => s.value === servicio)?.label ?? servicio },
    ],
    [rango, servicio]
  )

  const filasServicios = useMemo(
    () =>
      (reporte?.filas ?? []).map((f) => [
        new Date(f.fecha).toLocaleDateString('es-VE'),
        String(f.colecta_id),
        etiquetaServicio[f.servicio] ?? f.servicio,
        f.codigo_socio,
        f.socio,
        f.cajero,
        money(f.monto_usd),
        money(f.monto_bs),
      ]),
    [reporte]
  )

  const filasAsiento = useMemo(
    () =>
      (asiento?.lineas ?? []).map((l) => [
        l.cuenta || '—',
        l.nombre,
        l.debe > 0 ? money(l.debe) : '0,00',
        l.haber > 0 ? money(l.haber) : '0,00',
      ]),
    [asiento]
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Reportes de colecta</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Detalle de lo cobrado por servicio y asiento contable del periodo.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <FileDown className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Pestanas */}
      <div className="flex gap-2 border-b border-neutral-200">
        {([
          { id: 'servicios' as const, label: 'Por servicio', icon: ListFilter },
          { id: 'asiento' as const, label: 'Asiento contable', icon: Calculator },
        ]).map((item) => {
          const activa = vista === item.id
          return (
            <button
              key={item.id}
              onClick={() => setVista(item.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activa
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-medium text-neutral-700">
            <span className="mb-1.5 block">Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={controlClass} />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            <span className="mb-1.5 block">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={controlClass} />
          </label>
          {vista === 'servicios' && (
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1.5 block">Servicio</span>
              <select value={servicio} onChange={(e) => setServicio(e.target.value)} className={controlClass}>
                {SERVICIOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button onClick={() => void cargar()} disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListFilter className="h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* VISTA: POR SERVICIO */}
      {vista === 'servicios' && (
        <>
          {reporte && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Object.entries(reporte.resumen.por_servicio).map(([srv, datos]) => (
                <Card key={srv} className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {etiquetaServicio[srv] ?? srv}
                  </p>
                  <p className="mt-1.5 text-2xl font-bold text-neutral-900">${money(datos.usd)}</p>
                  <p className="text-xs text-neutral-500">
                    {datos.cantidad} cobro(s) · {money(datos.bs)} Bs
                  </p>
                </Card>
              ))}
              <Card className="border-primary-200 bg-primary-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Total</p>
                <p className="mt-1.5 text-2xl font-bold text-primary-900">
                  ${money(reporte.resumen.total_usd)}
                </p>
                <p className="text-xs text-primary-700">
                  {reporte.resumen.cantidad} linea(s) · {money(reporte.resumen.total_bs)} Bs
                </p>
              </Card>
            </div>
          )}

          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Colecta</th>
                    <th className="px-4 py-3 text-left">Servicio</th>
                    <th className="px-4 py-3 text-left">Expediente</th>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-left">Cajero</th>
                    <th className="px-4 py-3 text-right">USD</th>
                    <th className="px-4 py-3 text-right">Bs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {cargando ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-neutral-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Generando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !reporte || reporte.filas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-neutral-500">
                        No hay cobros en el periodo seleccionado
                      </td>
                    </tr>
                  ) : (
                    reporte.filas.map((f, i) => (
                      <tr key={`${f.colecta_id}-${i}`} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">
                          {new Date(f.fecha).toLocaleDateString('es-VE')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-neutral-700">
                          #{f.colecta_id}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-700">
                          {etiquetaServicio[f.servicio] ?? f.servicio}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-neutral-700">
                          {f.codigo_socio}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-neutral-900">{f.socio}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">{f.cajero}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-neutral-900">
                          {money(f.monto_usd)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-neutral-600">
                          {money(f.monto_bs)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <PrintableListado
            titulo="Colecta por servicio"
            subtitulo={`Detalle de cobros del ${rango}`}
            filtros={filtrosImpresion}
            resumenes={[
              { label: 'Lineas', value: String(reporte?.resumen.cantidad ?? 0) },
              { label: 'Total USD', value: `$${money(reporte?.resumen.total_usd ?? 0)}` },
              { label: 'Total Bs', value: money(reporte?.resumen.total_bs ?? 0) },
            ]}
            columnas={['Fecha', 'Colecta', 'Servicio', 'Expediente', 'Socio', 'Cajero', 'USD', 'Bs']}
            filas={filasServicios}
          />
        </>
      )}

      {/* VISTA: ASIENTO CONTABLE */}
      {vista === 'asiento' && (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
              <h3 className="text-sm font-semibold text-neutral-800">
                Asiento contable del {rango}
              </h3>
              <p className="text-xs text-neutral-500">
                Montos en bolivares · {asiento?.cantidad_colectas ?? 0} colecta(s)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-white">
                  <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 text-left">Cuenta</th>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-right">Debe</th>
                    <th className="px-4 py-3 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {cargando ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
                      </td>
                    </tr>
                  ) : !asiento || asiento.lineas.length <= 1 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                        No hay movimientos en el periodo
                      </td>
                    </tr>
                  ) : (
                    asiento.lineas.map((l, i) => (
                      <tr key={`${l.cuenta}-${i}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-neutral-900">
                          {l.cuenta || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">{l.nombre}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm text-neutral-900">
                          {l.debe > 0 ? money(l.debe) : '0,00'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm text-neutral-900">
                          {l.haber > 0 ? money(l.haber) : '0,00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {asiento && asiento.lineas.length > 1 && (
                  <tfoot className="border-t-2 border-neutral-300 bg-neutral-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-neutral-800">
                        Totales
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-bold text-neutral-900">
                        {money(asiento.totales.debe)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-bold text-neutral-900">
                        {money(asiento.totales.haber)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          <p className="text-xs text-neutral-500">
            Los codigos de cuenta se configuran en Parametros del sistema
            (CUENTA_CONTABLE_AHORRO, CUENTA_CONTABLE_FUNERARIA, CUENTA_CONTABLE_SALUD,
            CUENTA_CONTABLE_CAJA). Sin configurar, se usan los del sistema anterior.
          </p>

          <PrintableListado
            titulo="Asiento contable de colecta"
            subtitulo={`Periodo ${rango} · montos en bolivares`}
            filtros={[{ label: 'Periodo', value: rango }]}
            resumenes={[
              { label: 'Debe', value: money(asiento?.totales.debe ?? 0) },
              { label: 'Haber', value: money(asiento?.totales.haber ?? 0) },
            ]}
            columnas={['Cuenta', 'Nombre', 'Debe', 'Haber']}
            filas={filasAsiento}
          />
        </>
      )}
    </div>
  )
}
