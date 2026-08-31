// ============================================
// COOPERATIVA EL TRIUNFO - FRONTEND PAGE
// Semanas de Colecta (tasa semanal USD/Bs)
// ============================================
//
// La pantalla mostraba datos de ejemplo escritos en el archivo y el boton
// "Nueva Semana" no tenia handler. Ahora consume el API real
// (`/api/semanas-colecta`) y permite crear, editar y desactivar.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Printer,
  X,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PrintableListado } from '../components/print/PrintableListado'
import { SortableHeader } from '../components/ui/SortableHeader'
import * as semanasService from '../services/semanasColectaService'
import type { SemanaColecta, SemanaColectaFormData } from '../services/semanasColectaService'
import { numeroDeSemana, rangoDeSemana } from '../services/semanasColectaService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'

const labelClass = 'space-y-1.5 text-sm font-medium text-neutral-700'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

const tituloSeccionClass = 'text-xs font-semibold uppercase tracking-wide text-neutral-500'

const money = (valor: number | string | null, decimales = 2): string =>
  Number(valor ?? 0).toLocaleString('es-VE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

const formatearFecha = (fecha: string): string =>
  new Date(`${fecha.split('T')[0]}T12:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const formularioVacio = (): SemanaColectaFormData => {
  const hoy = new Date()
  const semana = numeroDeSemana(hoy)
  const ano = hoy.getFullYear()
  const rango = rangoDeSemana(semana, ano)
  return {
    semana,
    ano,
    tasa_usd_bs: 0,
    meta_ahorro: 0,
    meta_funeraria: 0,
    meta_salud: 0,
    fecha_inicio: rango.inicio,
    fecha_fin: rango.fin,
    estado: true,
  }
}

export const SemanasColectaPage = () => {
  const { hasPermission } = usePermissions()
  const puedeEscribir = hasPermission('semanas_colecta', 'create')
  const puedeEliminar = hasPermission('semanas_colecta', 'delete')

  const [semanas, setSemanas] = useState<SemanaColecta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [sortField, setSortField] = useState<string>('ano')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<SemanaColecta | null>(null)
  const [formulario, setFormulario] = useState<SemanaColectaFormData>(formularioVacio)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await semanasService.obtenerSemanas()
      if (respuesta.success) setSemanas(respuesta.data)
      else setError(respuesta.error?.message ?? 'Error al cargar las semanas')
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al conectar con el servidor')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ============================================
  // ALTA Y EDICION
  // ============================================
  const abrirNueva = () => {
    setEditando(null)
    setFormulario(formularioVacio())
    setErrorFormulario('')
    setModalAbierto(true)
  }

  const abrirEditar = (semana: SemanaColecta) => {
    setEditando(semana)
    setFormulario({
      semana: semana.semana,
      ano: semana.ano,
      tasa_usd_bs: Number(semana.tasa_usd_bs),
      meta_ahorro: Number(semana.meta_ahorro ?? 0),
      meta_funeraria: Number(semana.meta_funeraria ?? 0),
      meta_salud: Number(semana.meta_salud ?? 0),
      fecha_inicio: semana.fecha_inicio.slice(0, 10),
      fecha_fin: semana.fecha_fin.slice(0, 10),
      estado: semana.estado,
    })
    setErrorFormulario('')
    setModalAbierto(true)
  }

  /** Al cambiar semana o ano se recalculan las fechas del periodo. */
  const cambiarPeriodo = (semana: number, ano: number) => {
    const rango = rangoDeSemana(semana, ano)
    setFormulario((prev) => ({ ...prev, semana, ano, fecha_inicio: rango.inicio, fecha_fin: rango.fin }))
  }

  const guardar = async () => {
    if (formulario.tasa_usd_bs <= 0) {
      setErrorFormulario('La tasa debe ser mayor a cero')
      return
    }
    if (formulario.semana < 1 || formulario.semana > 53) {
      setErrorFormulario('La semana debe estar entre 1 y 53')
      return
    }

    setGuardando(true)
    setErrorFormulario('')
    try {
      const respuesta = editando
        ? await semanasService.actualizarSemana(editando.id, formulario)
        : await semanasService.crearSemana(formulario)

      if (!respuesta.success) throw new Error(respuesta.error?.message ?? 'No fue posible guardar')

      setModalAbierto(false)
      await cargar()
    } catch (err) {
      setErrorFormulario(getErrorMessage(err) || 'Error al guardar la semana')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (semana: SemanaColecta) => {
    const confirmado = window.confirm(
      `¿Desactivar la semana ${semana.semana}/${semana.ano}? Solo se permite si no tiene colectas registradas.`
    )
    if (!confirmado) return

    try {
      const respuesta = await semanasService.eliminarSemana(semana.id)
      if (!respuesta.success) throw new Error(respuesta.error?.message ?? 'No fue posible eliminar')
      await cargar()
    } catch (err) {
      window.alert(getErrorMessage(err) || 'Error al eliminar la semana')
    }
  }

  // ============================================
  // DERIVADOS
  // ============================================
  const semanasOrdenadas = useMemo(() => {
    const copia = [...semanas]
    copia.sort((a, b) => {
      let A: any = (a as any)[sortField]
      let B: any = (b as any)[sortField]
      if (A === null || A === undefined) A = ''
      if (B === null || B === undefined) B = ''
      if (typeof A === 'string') {
        A = A.toLowerCase()
        B = String(B).toLowerCase()
      }
      // Al ordenar por año, la semana desempata: si no, el listado se ve salteado
      if (A === B && sortField === 'ano') {
        return sortOrder === 'asc' ? a.semana - b.semana : b.semana - a.semana
      }
      if (A < B) return sortOrder === 'asc' ? -1 : 1
      if (A > B) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return copia
  }, [semanas, sortField, sortOrder])

  const semanasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return semanasOrdenadas
    return semanasOrdenadas.filter(
      (s) =>
        String(s.semana).includes(q) ||
        String(s.ano).includes(q) ||
        String(s.tasa_usd_bs).includes(q)
    )
  }, [semanasOrdenadas, busqueda])

  const activas = semanas.filter((s) => s.estado)
  const tasaActual = activas.length > 0 ? Number(activas[0]!.tasa_usd_bs) : 0
  const totalColectas = semanas.reduce((acc, s) => acc + (s._count?.colectas ?? 0), 0)

  const filtrosImpresion = [{ label: 'Búsqueda', value: busqueda || 'Sin búsqueda' }]

  const filasImpresion = semanasFiltradas.map((s) => [
    `${s.semana}/${s.ano}`,
    `${formatearFecha(s.fecha_inicio)} - ${formatearFecha(s.fecha_fin)}`,
    money(s.tasa_usd_bs, 4),
    money(s.meta_ahorro),
    money(s.meta_funeraria),
    money(s.meta_salud),
    String(s._count?.colectas ?? 0),
    s.estado ? 'Activa' : 'Inactiva',
  ])

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Semanas de Colecta</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Tasa semanal USD/Bs y metas por servicio. La colecta toma la tasa de la semana activa.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir listado
          </Button>
          {puedeEscribir && (
            <Button onClick={abrirNueva}>
              <Plus className="h-4 w-4" />
              Nueva semana
            </Button>
          )}
        </div>
      </div>

      {/* Sin semana activa no se puede cobrar: se avisa arriba de todo */}
      {!cargando && activas.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>
            No hay ninguna semana activa. <strong>El módulo de Colecta no puede cobrar</strong> hasta
            que se registre una semana con su tasa.
          </p>
        </div>
      )}

      {/* ESTADISTICAS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className={tituloSeccionClass}>Total semanas</p>
              <p className="mt-2 text-3xl font-bold text-neutral-900">{semanas.length}</p>
              <p className="mt-1 text-sm text-neutral-500">Registradas</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
              <Calendar className="h-5 w-5 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className={tituloSeccionClass}>Semanas activas</p>
              <p className="mt-2 text-3xl font-bold text-emerald-600">{activas.length}</p>
              <p className="mt-1 text-sm text-emerald-700">Habilitadas para cobrar</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className={tituloSeccionClass}>Tasa vigente</p>
              <p className="mt-2 text-3xl font-bold text-neutral-900">{money(tasaActual, 2)}</p>
              <p className="mt-1 text-sm text-neutral-500">Bs por USD</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-100">
              <DollarSign className="h-5 w-5 text-accent-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className={tituloSeccionClass}>Colectas</p>
              <p className="mt-2 text-3xl font-bold text-neutral-900">
                {totalColectas.toLocaleString('es-VE')}
              </p>
              <p className="mt-1 text-sm text-neutral-500">En todas las semanas</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* BUSQUEDA */}
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por semana, año o tasa..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* TABLA */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                <SortableHeader
                  label="Semana / Año"
                  field="semana"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Período"
                  field="fecha_inicio"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Tasa USD/Bs"
                  field="tasa_usd_bs"
                  align="right"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-right">Meta ahorro</th>
                <th className="px-4 py-3 text-right">Meta funeraria</th>
                <th className="px-4 py-3 text-right">Meta salud</th>
                <th className="px-4 py-3 text-center">Colectas</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {cargando ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-neutral-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Cargando semanas...</span>
                    </div>
                  </td>
                </tr>
              ) : semanasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-neutral-500">
                    {semanas.length === 0
                      ? 'No hay semanas registradas todavía'
                      : 'Ninguna semana coincide con la búsqueda'}
                  </td>
                </tr>
              ) : (
                semanasFiltradas.map((semana) => (
                  <tr key={semana.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {semana.semana}/{semana.ano}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                      {formatearFecha(semana.fecha_inicio)} — {formatearFecha(semana.fecha_fin)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold text-neutral-900">
                      {money(semana.tasa_usd_bs, 4)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-neutral-600">
                      ${money(semana.meta_ahorro)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-neutral-600">
                      ${money(semana.meta_funeraria)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-neutral-600">
                      ${money(semana.meta_salud)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-neutral-900">
                      {semana._count?.colectas ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {semana.estado ? (
                        <Badge variant="success">Activa</Badge>
                      ) : (
                        <Badge variant="neutral">Inactiva</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {puedeEscribir && (
                          <button
                            onClick={() => abrirEditar(semana)}
                            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-primary-600"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {puedeEliminar && (
                          <button
                            onClick={() => void eliminar(semana)}
                            className="rounded-lg p-2 text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Desactivar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PrintableListado
        titulo="Semanas de Colecta"
        subtitulo="Tasa semanal USD/Bs y metas por servicio"
        filtros={filtrosImpresion}
        resumenes={[
          { label: 'Semanas', value: String(semanasFiltradas.length) },
          { label: 'Activas', value: String(activas.length) },
          { label: 'Tasa vigente', value: money(tasaActual, 4) },
        ]}
        columnas={[
          'Semana/Año',
          'Período',
          'Tasa USD/Bs',
          'Meta ahorro',
          'Meta funeraria',
          'Meta salud',
          'Colectas',
          'Estado',
        ]}
        filas={filasImpresion}
      />

      {/* MODAL: ALTA / EDICION */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card
            padding="none"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border-neutral-200"
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  {editando ? `Editar semana ${editando.semana}/${editando.ano}` : 'Nueva semana'}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Las fechas del período se calculan solas a partir de la semana y el año.
                </p>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className={labelClass}>
                  <span>Semana *</span>
                  <input
                    type="number"
                    min={1}
                    max={53}
                    value={formulario.semana}
                    onChange={(e) => cambiarPeriodo(Number(e.target.value) || 1, formulario.ano)}
                    className={controlClass}
                  />
                </label>
                <label className={labelClass}>
                  <span>Año *</span>
                  <input
                    type="number"
                    min={2020}
                    max={2100}
                    value={formulario.ano}
                    onChange={(e) => cambiarPeriodo(formulario.semana, Number(e.target.value) || 2026)}
                    className={controlClass}
                  />
                </label>
                <label className={labelClass}>
                  <span>Tasa USD/Bs *</span>
                  <input
                    type="number"
                    step="0.0001"
                    min={0}
                    value={formulario.tasa_usd_bs}
                    onChange={(e) =>
                      setFormulario((p) => ({ ...p, tasa_usd_bs: Number(e.target.value) || 0 }))
                    }
                    className={`${controlClass} font-semibold`}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>Desde</span>
                  <input
                    type="date"
                    value={formulario.fecha_inicio}
                    onChange={(e) => setFormulario((p) => ({ ...p, fecha_inicio: e.target.value }))}
                    className={controlClass}
                  />
                </label>
                <label className={labelClass}>
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={formulario.fecha_fin}
                    onChange={(e) => setFormulario((p) => ({ ...p, fecha_fin: e.target.value }))}
                    className={controlClass}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className={`${tituloSeccionClass} mb-3`}>Metas de colecta (USD)</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([
                    ['meta_ahorro', 'Ahorro'],
                    ['meta_funeraria', 'Funeraria'],
                    ['meta_salud', 'Salud'],
                  ] as const).map(([campo, etiqueta]) => (
                    <label key={campo} className={labelClass}>
                      <span>{etiqueta}</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={formulario[campo] ?? 0}
                        onChange={(e) =>
                          setFormulario((p) => ({ ...p, [campo]: Number(e.target.value) || 0 }))
                        }
                        className={controlClass}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:border-primary-300">
                <input
                  type="checkbox"
                  checked={formulario.estado ?? true}
                  onChange={(e) => setFormulario((p) => ({ ...p, estado: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-neutral-800">Semana activa</span>
                  <span className="block text-xs text-neutral-500">
                    La colecta toma la tasa de la semana activa más reciente.
                  </span>
                </span>
              </label>
            </div>

            <div className="border-t border-neutral-200 px-6 py-4">
              {errorFormulario && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorFormulario}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setModalAbierto(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button onClick={() => void guardar()} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear semana'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
