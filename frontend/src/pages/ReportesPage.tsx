/**
 * ============================================
 * PAGE: REPORTES
 * ============================================
 * RF-REP-01 a 08. Cada reporte se ve en pantalla y se exporta a Excel o PDF
 * con los mismos datos y totales: los tres salen del mismo generador.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarRange, DollarSign, Eye, FileSpreadsheet, FileText, HardHat, HeartPulse, ListChecks, Loader2, Wallet } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { useEnterNavigation } from '../hooks/useEnterNavigation'
import * as reportesService from '../services/reportesService'
import * as feriasService from '../services/feriasService'
import type { ClaveReporte, Reporte } from '../services/reportesService'
import type { Ubicacion } from '../services/feriasService'

interface Campo {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'fecha' | 'numero' | 'select' | 'feria'
  opciones?: { valor: string; texto: string }[]
  ayuda?: string
}

interface Definicion {
  clave: ClaveReporte
  titulo: string
  descripcion: string
  icono: React.ElementType
  campos: Campo[]
  inicial: Record<string, string>
}

const pad = (n: number) => String(n).padStart(2, '0')
const hoy = new Date()
const hoyISO = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
const inicioMes = `${hoyISO.slice(0, 8)}01`

const TIPO_PERIODO: Campo = {
  nombre: 'tipo', etiqueta: 'Periodicidad', tipo: 'select',
  opciones: [{ valor: 'mensual', texto: 'Mensual' }, { valor: 'semanal', texto: 'Semanal' }],
}

const REPORTES: Definicion[] = [
  {
    clave: 'ferias-pendientes',
    titulo: 'Ferias pendientes de pago de salud',
    descripcion: 'Que ferias pagaron la salud del periodo, cuales deben y cuanto.',
    icono: HeartPulse,
    campos: [TIPO_PERIODO, { nombre: 'anio', etiqueta: 'Año', tipo: 'numero' }, { nombre: 'numero', etiqueta: 'Mes o semana', tipo: 'numero' }],
    inicial: { tipo: 'mensual', anio: String(hoy.getFullYear()), numero: String(hoy.getMonth() + 1) },
  },
  {
    clave: 'pagos-salud',
    titulo: 'Pagos de salud por feria',
    descripcion: 'Un renglon por trabajador pagado, con feria, periodo, estado y referencia.',
    icono: ListChecks,
    campos: [
      { nombre: 'feria_id', etiqueta: 'Feria', tipo: 'feria' },
      TIPO_PERIODO,
      { nombre: 'anio', etiqueta: 'Año', tipo: 'numero' },
      { nombre: 'numero', etiqueta: 'Mes o semana', tipo: 'numero', ayuda: 'Vacio: todo el año' },
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{ valor: '', texto: 'Todos' }, { valor: 'vigente', texto: 'Pagados' }, { valor: 'anulado', texto: 'Anulados' }] },
      { nombre: 'desde', etiqueta: 'Pagado desde', tipo: 'fecha' },
      { nombre: 'hasta', etiqueta: 'Pagado hasta', tipo: 'fecha' },
      { nombre: 'trabajador', etiqueta: 'Trabajador', tipo: 'texto', ayuda: 'Codigo, cedula o apellido' },
    ],
    inicial: { tipo: 'mensual', anio: String(hoy.getFullYear()) },
  },
  {
    clave: 'trabajadores-feria',
    titulo: 'Trabajadores por feria',
    descripcion: 'Activos, suspendidos, inactivos y retirados de cada feria, y cuantos tienen salud.',
    icono: HardHat,
    campos: [{ nombre: 'feria_id', etiqueta: 'Feria', tipo: 'feria' }],
    inicial: {},
  },
  {
    clave: 'cartera-prestamos',
    titulo: 'Cartera de prestamos',
    descripcion: 'Prestamos activos, vencidos o pagados, con saldo por cobrar y cuotas pendientes.',
    icono: DollarSign,
    campos: [{
      nombre: 'vista', etiqueta: 'Cartera', tipo: 'select',
      opciones: [
        { valor: 'solicitudes', texto: 'En solicitud' },
        { valor: 'por_cobrar', texto: 'Por cobrar' },
        { valor: 'morosos', texto: 'Morosos (vencidos)' },
        { valor: 'cobrados', texto: 'Cobrados' },
        { valor: 'emitidos', texto: 'Todos los emitidos' },
      ],
    }],
    inicial: { vista: 'por_cobrar' },
  },
  {
    clave: 'semanas-adelantadas',
    titulo: 'Semanas pagadas por adelantado',
    descripcion: 'Cobros que dejaron servicios cubiertos por delante de la semana en curso.',
    icono: CalendarRange,
    campos: [
      { nombre: 'desde', etiqueta: 'Cobrado desde', tipo: 'fecha' },
      { nombre: 'hasta', etiqueta: 'Cobrado hasta', tipo: 'fecha' },
      { nombre: 'socio', etiqueta: 'Socio', tipo: 'texto', ayuda: 'Expediente, cedula o apellido' },
    ],
    inicial: { desde: inicioMes, hasta: hoyISO },
  },
  {
    clave: 'atraso-socios',
    titulo: 'Socios por semanas de atraso',
    descripcion: 'Quienes llegaron a la semana 41, quienes estan cerca y quienes caen en suspension. Solo informa: no cambia estados.',
    icono: AlertTriangle,
    campos: [
      {
        nombre: 'nivel', etiqueta: 'Atraso', tipo: 'select',
        opciones: [
          { valor: '41', texto: '41 semanas o mas: pierden los servicios' },
          { valor: '36', texto: '36 a 40: proximos a la semana 41' },
          { valor: '11', texto: '11 a 35: suspension de 1 mes y 7 dias' },
          { valor: '6', texto: '6 a 10: suspension de 3 dias' },
          { valor: '1', texto: '1 a 5: atrasados' },
          { valor: 'todos', texto: 'Todos con 6 semanas o mas' },
        ],
      },
      { nombre: 'feria_id', etiqueta: 'Feria', tipo: 'feria' },
    ],
    inicial: { nivel: '41' },
  },
  {
    clave: 'conversion-prestamos',
    titulo: 'Prestamos vigentes con el calculo nuevo',
    descripcion: 'Como quedaria cada prestamo ya otorgado con el interes diario y las cuotas de la tabla. Solo informa: no cambia nada.',
    icono: DollarSign,
    campos: [],
    inicial: {},
  },
  {
    clave: 'retiros-semana-41',
    titulo: 'Retiros por pasividad (semana 41)',
    descripcion: 'Socios que el sistema retiro por el articulo 5, literal c, con el ahorro por devolver y si deben un prestamo. Para archivar como soporte.',
    icono: ListChecks,
    campos: [
      { nombre: 'desde', etiqueta: 'Retirados desde', tipo: 'fecha' },
      { nombre: 'hasta', etiqueta: 'Retirados hasta', tipo: 'fecha' },
    ],
    inicial: { desde: inicioMes, hasta: hoyISO },
  },
  {
    clave: 'colectas',
    titulo: 'Colectas',
    descripcion: 'Colectas por fecha, socio o semana cobrada, con totales y reversos.',
    icono: Wallet,
    campos: [
      { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
      { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
      { nombre: 'socio', etiqueta: 'Socio', tipo: 'texto', ayuda: 'Expediente, cedula o apellido' },
      { nombre: 'anio', etiqueta: 'Año cobrado', tipo: 'numero' },
      { nombre: 'semana', etiqueta: 'Semana cobrada', tipo: 'numero' },
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{ valor: '', texto: 'Todas' }, { valor: 'vigentes', texto: 'Vigentes' }, { valor: 'reversadas', texto: 'Reversadas' }] },
    ],
    inicial: { desde: inicioMes, hasta: hoyISO },
  },
]

/** La vista previa muestra hasta aca; Excel y PDF llevan todo */
const MAXIMO_EN_PANTALLA = 500

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

// Mismo diseño de combo que el formulario de Socios
const selectClass = `${controlClass} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[center_right_0.5rem] bg-no-repeat pr-10`
const labelClass = 'block text-sm font-medium text-neutral-700'

const celda = (v: string | number | null) =>
  typeof v === 'number' && !Number.isInteger(v)
    ? v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v ?? ''

export const ReportesPage = () => {
  const { hasPermission } = usePermissions()
  const puedeExportar = hasPermission('reportes', 'export')
  const alEnter = useEnterNavigation()

  const [seleccion, setSeleccion] = useState<ClaveReporte>('ferias-pendientes')
  const [valores, setValores] = useState<Record<ClaveReporte, Record<string, string>>>(
    () => Object.fromEntries(REPORTES.map((r) => [r.clave, r.inicial])) as Record<ClaveReporte, Record<string, string>>
  )
  const [ferias, setFerias] = useState<Ubicacion[]>([])
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [trabajando, setTrabajando] = useState<'ver' | 'excel' | 'pdf' | null>(null)
  const [error, setError] = useState('')

  const definicion = REPORTES.find((r) => r.clave === seleccion)!
  const params = valores[seleccion]

  useEffect(() => {
    feriasService.obtenerUbicaciones().then((r) => r.success && r.data && setFerias(r.data)).catch(() => undefined)
  }, [])

  const elegir = (clave: ClaveReporte) => {
    setSeleccion(clave)
    setReporte(null)
    setError('')
  }

  const cambiar = (nombre: string, valor: string) =>
    setValores((v) => ({ ...v, [seleccion]: { ...v[seleccion], [nombre]: valor } }))

  const ver = async () => {
    setTrabajando('ver')
    setError('')
    try {
      setReporte(await reportesService.verReporte(seleccion, params))
    } catch (err) {
      setReporte(null)
      setError(getErrorMessage(err) || 'No fue posible generar el reporte')
    } finally {
      setTrabajando(null)
    }
  }

  const exportar = async (formato: 'excel' | 'pdf') => {
    setTrabajando(formato)
    setError('')
    try {
      await reportesService.exportarReporte(seleccion, formato, params)
    } catch (err) {
      setError(getErrorMessage(err) || 'No fue posible exportar el reporte')
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Reportes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Vea el reporte en pantalla y exportelo a Excel o PDF con los mismos datos y totales.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTES.map((r) => {
          const Icono = r.icono
          return (
            <button
              key={r.clave}
              onClick={() => elegir(r.clave)}
              className={`rounded-xl border-2 p-4 text-left transition ${seleccion === r.clave ? 'border-primary-500 bg-primary-50/50' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
            >
              <div className="flex items-start gap-3">
                <Icono className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
                <div>
                  <p className="font-medium text-neutral-900">{r.titulo}</p>
                  <p className="mt-1 text-sm text-neutral-600">{r.descripcion}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold text-neutral-800">{definicion.titulo}</p>
        {definicion.campos.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" onKeyDown={alEnter}>
            {definicion.campos.map((c) => (
              <label key={c.nombre} className={labelClass}>
                <span className="mb-1.5 block">{c.etiqueta}</span>
                {c.tipo === 'select' ? (
                  <select value={params[c.nombre] ?? ''} onChange={(e) => cambiar(c.nombre, e.target.value)} className={selectClass}>
                    {c.opciones!.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                  </select>
                ) : c.tipo === 'feria' ? (
                  <select value={params[c.nombre] ?? ''} onChange={(e) => cambiar(c.nombre, e.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    {ferias.map((f) => <option key={f.id} value={f.id}>{f.direccion?.trim() || f.nombre || f.codigo}</option>)}
                  </select>
                ) : (
                  <input
                    type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                    value={params[c.nombre] ?? ''}
                    onChange={(e) => cambiar(c.nombre, e.target.value)}
                    className={controlClass}
                  />
                )}
                {c.ayuda && <span className="mt-1 block text-xs font-normal text-neutral-500">{c.ayuda}</span>}
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void ver()} disabled={trabajando !== null}>
            {trabajando === 'ver' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Ver en pantalla
          </Button>
          {puedeExportar && (
            <>
              <Button variant="outline" onClick={() => void exportar('excel')} disabled={trabajando !== null}>
                {trabajando === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Excel
              </Button>
              <Button variant="outline" onClick={() => void exportar('pdf')} disabled={trabajando !== null}>
                {trabajando === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                PDF
              </Button>
            </>
          )}
        </div>
      </Card>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {reporte && (
        <div className="space-y-4">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{reporte.titulo}</p>
            {reporte.subtitulo && <p className="text-sm text-neutral-500">{reporte.subtitulo}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {reporte.totales.map((t) => (
              <Card key={t.etiqueta} className="p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{t.etiqueta}</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{celda(t.valor)}</p>
              </Card>
            ))}
          </div>
          <Card padding="none">
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>{reporte.columnas.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reporte.filas.length === 0 ? (
                    <tr><td colSpan={reporte.columnas.length} className="px-3 py-8 text-center text-neutral-500">Sin datos con estos filtros</td></tr>
                  ) : (
                    reporte.filas.slice(0, MAXIMO_EN_PANTALLA).map((fila, i) => (
                      <tr key={i}>{fila.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{celda(v)}</td>)}</tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {reporte.filas.length > MAXIMO_EN_PANTALLA && (
              <p className="border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
                Se muestran {MAXIMO_EN_PANTALLA} de {reporte.filas.length} filas. Excel y PDF incluyen todas.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
