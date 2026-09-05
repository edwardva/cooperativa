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
import { FileDown, Loader2, Calculator, ListFilter, AlertTriangle, Wallet, Users } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PrintableListado } from '../components/print/PrintableListado'
import * as colectaService from '../services/colectaService'
import type { AsientoContable, CorteCuadre, ReporteCaja, ReportePorServicio } from '../services/colectaService'
import { getErrorMessage } from '../services/api'

type Vista = 'servicios' | 'caja' | 'asiento'

/** Filtro por periodo: dia/rango, o un mes completo */
type ModoPeriodo = 'rango' | 'mes'

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
  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>('rango')
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [mes, setMes] = useState(() => hoyISO().slice(0, 7))
  const [servicio, setServicio] = useState('todos')

  const [reporte, setReporte] = useState<ReportePorServicio | null>(null)
  const [caja, setCaja] = useState<ReporteCaja | null>(null)
  const [asiento, setAsiento] = useState<AsientoContable | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  /**
   * El backend acepta `mes=AAAA-MM` o el par desde/hasta. El cliente pidio
   * poder ver el ingreso de un mes — el de salud sobre todo — sin sumar a mano
   * los reportes de cada dia.
   */
  const periodo = useMemo(
    () => (modoPeriodo === 'mes' ? { mes } : { desde, hasta }),
    [modoPeriodo, mes, desde, hasta]
  )

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      if (vista === 'servicios') {
        const r = await colectaService.obtenerReportePorServicio({ ...periodo, servicio })
        if (r.success) setReporte(r.data)
      } else if (vista === 'caja') {
        const r = await colectaService.obtenerReporteCaja(periodo)
        if (r.success) setCaja(r.data)
      } else {
        const r = await colectaService.obtenerAsientoContable(
          periodo as { desde: string; hasta: string }
        )
        if (r.success) setAsiento(r.data)
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al generar el reporte')
    } finally {
      setCargando(false)
    }
  }, [vista, periodo, servicio])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const rango =
    modoPeriodo === 'mes' ? `mes ${mes}` : desde === hasta ? desde : `${desde} al ${hasta}`

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
        f.numero_acuerdo ?? '—',
        f.pagado_hasta_texto,
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
          { id: 'caja' as const, label: 'Cuadre de caja', icon: Wallet },
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
            <span className="mb-1.5 block">Periodo</span>
            <select
              value={modoPeriodo}
              onChange={(e) => setModoPeriodo(e.target.value as ModoPeriodo)}
              className={controlClass}
            >
              <option value="rango">Dia o rango</option>
              <option value="mes">Mes completo</option>
            </select>
          </label>

          {modoPeriodo === 'mes' ? (
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1.5 block">Mes</span>
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={controlClass} />
            </label>
          ) : (
            <>
              <label className="text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Desde</span>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={controlClass} />
              </label>
              <label className="text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Hasta</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={controlClass} />
              </label>
            </>
          )}
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
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-neutral-900">
                    ${money(datos.usd)}
                  </p>
                  <p className="text-xs tabular-nums text-neutral-500">
                    {datos.cantidad} cobro(s) · {datos.personas} persona(s) · {money(datos.bs)} Bs
                  </p>
                </Card>
              ))}
              <Card className="border-primary-200 bg-primary-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Total</p>
                <p className="mt-1.5 text-2xl font-bold text-primary-900">
                  ${money(reporte.resumen.total_usd)}
                </p>
                <p className="text-xs tabular-nums text-primary-700">
                  {reporte.resumen.cantidad} linea(s) · {reporte.resumen.personas} persona(s) ·{' '}
                  {money(reporte.resumen.total_bs)} Bs
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
                    <th className="px-4 py-3 text-left">Acuerdo</th>
                    <th className="px-4 py-3 text-center">Sem.</th>
                    <th className="px-4 py-3 text-left">Pagado hasta</th>
                    <th className="px-4 py-3 text-left">Cajero</th>
                    <th className="px-4 py-3 text-right">USD</th>
                    <th className="px-4 py-3 text-right">Bs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {cargando ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-neutral-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Generando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !reporte || reporte.filas.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-neutral-500">
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
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-neutral-600">
                          {f.numero_acuerdo ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm tabular-nums text-neutral-600">
                          {f.es_reintegro ? 'reint.' : (f.semanas ?? '—')}
                        </td>
                        {/* Ano y semana hasta los que quedo pagado: el cliente
                            lo pidio expresamente en el reporte de servicios */}
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-neutral-700">
                          {f.pagado_hasta_texto}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">{f.cajero}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums text-neutral-900">
                          {money(f.monto_usd)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-neutral-600">
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
              { label: 'Personas', value: String(reporte?.resumen.personas ?? 0) },
              { label: 'Total USD', value: `$${money(reporte?.resumen.total_usd ?? 0)}` },
              { label: 'Total Bs', value: money(reporte?.resumen.total_bs ?? 0) },
            ]}
            columnas={[
              'Fecha',
              'Colecta',
              'Servicio',
              'Expediente',
              'Socio',
              'Acuerdo',
              'Pagado hasta',
              'Cajero',
              'USD',
              'Bs',
            ]}
            filas={filasServicios}
          />
        </>
      )}

      {/* VISTA: CUADRE DE CAJA */}
      {vista === 'caja' && (
        <>
          {/*
            Requisito 9: el cuadre se pide por oficina, por colector y por
            canal, con el detalle de cada uno Y un consolidado general. Antes
            habia que sumar a mano los reportes diarios de cada oficina.
          */}
          {caja && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {(
                [
                  ['Ahorro', caja.consolidado.ahorro_usd],
                  ['Funeraria', caja.consolidado.funeraria_usd],
                  ['Salud', caja.consolidado.salud_usd],
                  ['Prestamos', caja.consolidado.prestamos_usd],
                ] as const
              ).map(([titulo, monto]) => (
                <Card key={titulo} className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {titulo}
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-neutral-900">
                    ${money(monto)}
                  </p>
                </Card>
              ))}
              <Card className="border-primary-200 bg-primary-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                  Consolidado
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-primary-900">
                  ${money(caja.consolidado.total_usd)}
                </p>
                <p className="flex items-center gap-1 text-xs tabular-nums text-primary-700">
                  <Users className="h-3 w-3" />
                  {caja.consolidado.personas} persona(s) · {caja.consolidado.operaciones} operacion(es)
                </p>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(
              [
                ['Por oficina', caja?.por_oficina ?? []],
                ['Por colector', caja?.por_colector ?? []],
                ['Por canal', caja?.por_canal ?? []],
              ] as const
            ).map(([titulo, cortes]) => (
              <Card key={titulo} padding="none" className="overflow-hidden">
                <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-neutral-800">{titulo}</h3>
                </div>
                <div className="divide-y divide-neutral-100">
                  {cortes.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-neutral-400">Sin movimientos</p>
                  )}
                  {(cortes as CorteCuadre[]).map((corte) => (
                    <div key={corte.clave} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">{corte.nombre}</p>
                        <p className="text-xs tabular-nums text-neutral-500">
                          {corte.totales.personas} persona(s) · {corte.totales.operaciones} op.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-neutral-900">
                          ${money(corte.totales.total_usd)}
                        </p>
                        <p className="text-xs tabular-nums text-neutral-500">
                          {money(corte.totales.total_bs)} Bs
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Detalle CON NOMBRES: el cliente lo pidio para poder rastrear
              diferencias sin cruzar contra otro listado */}
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Colecta</th>
                    <th className="px-4 py-3 text-left">Expediente</th>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-left">Oficina</th>
                    <th className="px-4 py-3 text-left">Colector</th>
                    <th className="px-4 py-3 text-left">Canal</th>
                    <th className="px-4 py-3 text-center">Sem.</th>
                    <th className="px-4 py-3 text-right">USD</th>
                    <th className="px-4 py-3 text-right">Bs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {cargando ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-neutral-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Generando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !caja || caja.detalle.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-neutral-500">
                        No hay cobros en el periodo seleccionado
                      </td>
                    </tr>
                  ) : (
                    caja.detalle.map((d) => (
                      <tr key={d.colecta_id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">
                          {new Date(d.fecha).toLocaleDateString('es-VE')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-neutral-700">
                          #{d.colecta_id}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-neutral-700">
                          {d.codigo_socio}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-neutral-900">{d.socio}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">
                          {d.oficina ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">
                          {d.colector}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-neutral-600">
                          {d.canal === 'digital' ? 'Cajero digital' : 'Presencial'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm tabular-nums text-neutral-600">
                          {d.semanas}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums text-neutral-900">
                          {money(d.monto_usd)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-neutral-600">
                          {money(d.monto_bs)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <PrintableListado
            titulo="Cuadre de caja"
            subtitulo={`Consolidado del ${rango}`}
            filtros={[{ label: 'Periodo', value: rango }]}
            resumenes={[
              { label: 'Personas', value: String(caja?.consolidado.personas ?? 0) },
              { label: 'Operaciones', value: String(caja?.consolidado.operaciones ?? 0) },
              { label: 'Total USD', value: `$${money(caja?.consolidado.total_usd ?? 0)}` },
              { label: 'Total Bs', value: money(caja?.consolidado.total_bs ?? 0) },
            ]}
            columnas={['Fecha', 'Colecta', 'Expediente', 'Socio', 'Oficina', 'Colector', 'USD', 'Bs']}
            filas={(caja?.detalle ?? []).map((d) => [
              new Date(d.fecha).toLocaleDateString('es-VE'),
              String(d.colecta_id),
              d.codigo_socio,
              d.socio,
              d.oficina ?? '—',
              d.colector,
              money(d.monto_usd),
              money(d.monto_bs),
            ])}
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
