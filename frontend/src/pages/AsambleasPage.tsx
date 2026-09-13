/**
 * ============================================
 * PAGE: ASAMBLEAS
 * ============================================
 * Regla de negocio: en el año se realizan varias asambleas y cada socio debe
 * asistir AL MENOS A UNA. Esta pantalla cubre:
 *  - registro de las asambleas del año
 *  - pase de lista (asistencia por socio)
 *  - reporte anual de quienes no asistieron a ninguna
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  PlusCircle,
  Search,
  Users,
  UserCheck,
  UserX,
  Loader2,
  Trash2,
  Edit2,
  ClipboardList,
  AlertTriangle,
  FileDown,
  X,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { PrintableListado } from '../components/print/PrintableListado'
import * as asambleasService from '../services/asambleasService'
import * as sociosService from '../services/sociosService'
import type {
  Asamblea,
  AsambleaDetalle,
  AsambleaFormData,
  ReporteInasistentes,
  ResumenAnual,
  TipoAsamblea,
} from '../services/asambleasService'
import { TIPOS_ASAMBLEA } from '../services/asambleasService'
import type { Socio, Ubicacion } from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { formatearFecha } from '../utils/formatters'
import { usePermissions } from '../store/authStore'
import { useEnterNavigation } from '../hooks/useEnterNavigation'

type Pestana = 'asambleas' | 'inasistentes'

const labelClass = 'space-y-1.5 text-sm font-medium text-neutral-700'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

const hoyISO = (): string => new Date().toISOString().split('T')[0] ?? ''

const formularioVacio = (): AsambleaFormData => ({
  titulo: '',
  tipo: 'ordinaria',
  fecha: hoyISO(),
  ubicacion_id: null,
  descripcion: '',
})

const etiquetaTipo = (tipo: TipoAsamblea): string =>
  TIPOS_ASAMBLEA.find((t) => t.value === tipo)?.label ?? tipo

const badgeTipo = (tipo: TipoAsamblea) => {
  if (tipo === 'sectorial') return <Badge variant="info">Sectorial</Badge>
  if (tipo === 'extraordinaria') return <Badge variant="warning">Extraordinaria</Badge>
  return <Badge variant="success">Ordinaria</Badge>
}

const nombreFeria = (ubicacion: { direccion: string | null; nombre?: string; codigo: string } | null): string =>
  ubicacion ? ubicacion.direccion || ubicacion.nombre || ubicacion.codigo : 'General'

export default function AsambleasPage() {
  const alEnter = useEnterNavigation()
  const { hasPermission } = usePermissions()
  const puedeEscribir = hasPermission('asambleas', 'create')
  const puedeEliminar = hasPermission('asambleas', 'delete')

  // ============================================
  // ESTADO
  // ============================================
  const anoActual = new Date().getFullYear()
  const [ano, setAno] = useState<number>(anoActual)
  const [anosDisponibles, setAnosDisponibles] = useState<number[]>([anoActual])
  const [pestana, setPestana] = useState<Pestana>('asambleas')

  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [resumen, setResumen] = useState<ResumenAnual | null>(null)
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal de alta/edicion
  const [modalAbierto, setModalAbierto] = useState(false)
  const [asambleaEditando, setAsambleaEditando] = useState<Asamblea | null>(null)
  const [formulario, setFormulario] = useState<AsambleaFormData>(formularioVacio)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')

  // Modal de pase de lista
  const [detalle, setDetalle] = useState<AsambleaDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [sociosEncontrados, setSociosEncontrados] = useState<Socio[]>([])
  const [errorAsistencia, setErrorAsistencia] = useState('')

  // Reporte de inasistentes
  const [reporte, setReporte] = useState<ReporteInasistentes | null>(null)
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [filtroFeria, setFiltroFeria] = useState('')
  const [excluirNuevos, setExcluirNuevos] = useState(true)

  // ============================================
  // CARGA DE DATOS
  // ============================================
  const cargarAsambleas = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [respAsambleas, respResumen] = await Promise.all([
        asambleasService.obtenerAsambleas({ ano }),
        asambleasService.obtenerResumenAnual(ano),
      ])
      if (respAsambleas.success) setAsambleas(respAsambleas.data)
      if (respResumen.success) setResumen(respResumen.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar las asambleas')
    } finally {
      setCargando(false)
    }
  }, [ano])

  const cargarReporte = useCallback(async () => {
    setCargandoReporte(true)
    try {
      const respuesta = await asambleasService.obtenerReporteInasistentes({
        ano,
        ubicacion_id: filtroFeria ? Number(filtroFeria) : undefined,
        excluir_nuevos: excluirNuevos,
      })
      if (respuesta.success) setReporte(respuesta.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al generar el reporte')
    } finally {
      setCargandoReporte(false)
    }
  }, [ano, filtroFeria, excluirNuevos])

  useEffect(() => {
    const cargarIniciales = async () => {
      try {
        const [respAnos, respUbicaciones] = await Promise.all([
          asambleasService.obtenerAnosConAsambleas(),
          sociosService.obtenerUbicaciones(),
        ])
        if (respAnos.success && respAnos.data.length > 0) setAnosDisponibles(respAnos.data)
        if (respUbicaciones.success) setUbicaciones(respUbicaciones.data)
      } catch {
        // Los selectores caen a sus valores por defecto
      }
    }
    void cargarIniciales()
  }, [])

  useEffect(() => {
    void cargarAsambleas()
  }, [cargarAsambleas])

  useEffect(() => {
    if (pestana === 'inasistentes') {
      void cargarReporte()
    }
  }, [pestana, cargarReporte])

  // ============================================
  // ALTA Y EDICION
  // ============================================
  const abrirModalNueva = () => {
    setAsambleaEditando(null)
    setFormulario(formularioVacio())
    setErrorFormulario('')
    setModalAbierto(true)
  }

  const abrirModalEditar = (asamblea: Asamblea) => {
    setAsambleaEditando(asamblea)
    setFormulario({
      titulo: asamblea.titulo,
      tipo: asamblea.tipo,
      fecha: asamblea.fecha.slice(0, 10),
      ubicacion_id: asamblea.ubicacion_id,
      descripcion: asamblea.descripcion ?? '',
    })
    setErrorFormulario('')
    setModalAbierto(true)
  }

  const guardarAsamblea = async () => {
    if (!formulario.titulo.trim()) {
      setErrorFormulario('Indique el título de la asamblea')
      return
    }
    if (formulario.tipo === 'sectorial' && !formulario.ubicacion_id) {
      setErrorFormulario('Una asamblea sectorial debe indicar la feria')
      return
    }

    setGuardando(true)
    setErrorFormulario('')
    try {
      const respuesta = asambleaEditando
        ? await asambleasService.actualizarAsamblea(asambleaEditando.id, formulario)
        : await asambleasService.crearAsamblea(formulario)

      if (!respuesta.success) throw new Error('No fue posible guardar la asamblea')

      setModalAbierto(false)
      await cargarAsambleas()
    } catch (err) {
      setErrorFormulario(getErrorMessage(err) || 'Error al guardar la asamblea')
    } finally {
      setGuardando(false)
    }
  }

  const borrarAsamblea = async (asamblea: Asamblea) => {
    const confirmado = window.confirm(
      `¿Eliminar la asamblea "${asamblea.titulo}"? Solo se permite si no tiene asistencias registradas.`
    )
    if (!confirmado) return

    try {
      const respuesta = await asambleasService.eliminarAsamblea(asamblea.id)
      if (!respuesta.success) throw new Error('No fue posible eliminar la asamblea')
      await cargarAsambleas()
    } catch (err) {
      window.alert(getErrorMessage(err) || 'Error al eliminar la asamblea')
    }
  }

  // ============================================
  // PASE DE LISTA
  // ============================================
  const abrirPaseDeLista = async (asamblea: Asamblea) => {
    setCargandoDetalle(true)
    setErrorAsistencia('')
    setBusquedaSocio('')
    setSociosEncontrados([])
    try {
      const respuesta = await asambleasService.obtenerAsambleaPorId(asamblea.id)
      if (respuesta.success) setDetalle(respuesta.data)
    } catch (err) {
      window.alert(getErrorMessage(err) || 'Error al abrir la asamblea')
    } finally {
      setCargandoDetalle(false)
    }
  }

  const refrescarDetalle = async () => {
    if (!detalle) return
    const respuesta = await asambleasService.obtenerAsambleaPorId(detalle.id)
    if (respuesta.success) setDetalle(respuesta.data)
  }

  const buscarSocio = async () => {
    const termino = busquedaSocio.trim()
    if (!termino) return

    setBuscandoSocio(true)
    setErrorAsistencia('')
    setSociosEncontrados([])
    try {
      // Solo dígitos se interpreta como cédula; cualquier otra cosa, como expediente
      if (/^\d+$/.test(termino)) {
        const respuesta = await sociosService.buscarSocioPorCedula(termino)
        if (respuesta.success && respuesta.data.length > 0) {
          setSociosEncontrados(respuesta.data)
        } else {
          setErrorAsistencia('No se encontró ningún socio con esa cédula')
        }
      } else {
        const respuesta = await sociosService.buscarSocioPorExpediente(termino)
        if (respuesta.success && respuesta.data) {
          setSociosEncontrados([respuesta.data])
        } else {
          setErrorAsistencia('No se encontró ningún socio con ese expediente')
        }
      }
    } catch (err) {
      setErrorAsistencia(getErrorMessage(err) || 'Error al buscar el socio')
    } finally {
      setBuscandoSocio(false)
    }
  }

  const marcarAsistencia = async (socio: Socio) => {
    if (!detalle) return
    setErrorAsistencia('')
    try {
      const respuesta = await asambleasService.registrarAsistencia(detalle.id, socio.id)
      if (!respuesta.success) throw new Error('No fue posible registrar la asistencia')
      setBusquedaSocio('')
      setSociosEncontrados([])
      await refrescarDetalle()
      await cargarAsambleas()
    } catch (err) {
      setErrorAsistencia(getErrorMessage(err) || 'Error al registrar la asistencia')
    }
  }

  const quitarAsistencia = async (socioId: number) => {
    if (!detalle) return
    try {
      await asambleasService.eliminarAsistencia(detalle.id, socioId)
      await refrescarDetalle()
      await cargarAsambleas()
    } catch (err) {
      setErrorAsistencia(getErrorMessage(err) || 'Error al quitar la asistencia')
    }
  }

  const yaRegistrado = (socioId: number): boolean =>
    Boolean(detalle?.asistencias.some((a) => a.socio_id === socioId))

  // ============================================
  // IMPRESION DEL REPORTE
  // ============================================
  const filtrosImpresion = useMemo(
    () => [
      { label: 'Año', value: String(ano) },
      {
        label: 'Feria',
        value: filtroFeria
          ? nombreFeria(ubicaciones.find((u) => String(u.id) === filtroFeria) ?? null)
          : 'Todas las ferias',
      },
      { label: 'Socios nuevos', value: excluirNuevos ? 'Excluidos' : 'Incluidos' },
      { label: 'Asambleas del año', value: String(reporte?.asambleas.length ?? 0) },
    ],
    [ano, filtroFeria, ubicaciones, excluirNuevos, reporte]
  )

  const filasImpresion = useMemo(
    () =>
      (reporte?.inasistentes ?? []).map((socio) => [
        socio.codigo_socio,
        socio.cedula,
        `${socio.apellido}, ${socio.nombre}`,
        socio.telefono ?? 'Sin teléfono',
        nombreFeria(socio.ubicacion),
        formatearFecha(socio.fecha_inscripcion),
      ]),
    [reporte]
  )

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Asambleas</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Cada socio debe asistir al menos a una asamblea por año. Aquí se registran las asambleas,
            se pasa lista y se obtiene el reporte anual de inasistentes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <CalendarDays className="h-4 w-4 text-neutral-500" />
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              {anosDisponibles.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </label>

          {puedeEscribir && (
            <Button onClick={abrirModalNueva}>
              <PlusCircle className="h-4 w-4" />
              Nueva asamblea
            </Button>
          )}
        </div>
      </div>

      {/* RESUMEN ANUAL */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Asambleas del año</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{resumen?.total_asambleas ?? 0}</p>
          <p className="mt-1 text-sm text-neutral-500">Registradas en {ano}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Socios activos</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {(resumen?.total_socios_activos ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-neutral-500">Base del cálculo</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Cumplen</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {(resumen?.asistieron ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            {resumen?.porcentaje_participacion ?? 0}% de participación
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">No asistieron</p>
          <p className="mt-2 text-3xl font-bold text-rose-600">
            {(resumen?.no_asistieron ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-rose-700">Ninguna asamblea en {ano}</p>
        </Card>
      </div>

      {/* PESTAÑAS */}
      <div className="flex gap-2 border-b border-neutral-200">
        {([
          { id: 'asambleas' as const, label: 'Asambleas', icon: ClipboardList },
          { id: 'inasistentes' as const, label: 'Reporte de inasistentes', icon: UserX },
        ]).map((item) => {
          const activa = pestana === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPestana(item.id)}
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* PESTAÑA: ASAMBLEAS */}
      {pestana === 'asambleas' && (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Asamblea</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Feria</th>
                  <th className="px-4 py-3 text-center">Asistentes</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {cargando ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-neutral-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Cargando asambleas...</span>
                      </div>
                    </td>
                  </tr>
                ) : asambleas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                      No hay asambleas registradas en {ano}
                    </td>
                  </tr>
                ) : (
                  asambleas.map((asamblea) => (
                    <tr key={asamblea.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                        {formatearFecha(asamblea.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-neutral-900">{asamblea.titulo}</p>
                        {!asamblea.estado && <span className="text-xs text-rose-600">Anulada</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{badgeTipo(asamblea.tipo)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{nombreFeria(asamblea.ubicacion)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                          <Users className="h-4 w-4 text-neutral-400" />
                          {asamblea._count?.asistencias ?? 0}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void abrirPaseDeLista(asamblea)}>
                            <UserCheck className="h-4 w-4" />
                            Pasar lista
                          </Button>
                          {puedeEscribir && (
                            <button
                              onClick={() => abrirModalEditar(asamblea)}
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-primary-600"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {puedeEliminar && (
                            <button
                              onClick={() => void borrarAsamblea(asamblea)}
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"
                              title="Eliminar"
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
      )}

      {/* PESTAÑA: REPORTE DE INASISTENTES */}
      {pestana === 'inasistentes' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-end gap-4">
              <label className={labelClass}>
                <span>Feria</span>
                <select
                  value={filtroFeria}
                  onChange={(e) => setFiltroFeria(e.target.value)}
                  className={controlClass}
                >
                  <option value="">Todas las ferias</option>
                  {ubicaciones.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {nombreFeria(ubicacion)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 py-2.5 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={excluirNuevos}
                  onChange={(e) => setExcluirNuevos(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                Excluir socios inscritos después de la última asamblea
              </label>

              <div className="ml-auto">
                <Button variant="outline" onClick={() => window.print()} disabled={!reporte?.inasistentes.length}>
                  <FileDown className="h-4 w-4" />
                  Imprimir reporte
                </Button>
              </div>
            </div>
          </Card>

          {reporte?.sin_asambleas && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p>
                No hay asambleas registradas en {ano}, así que nadie pudo asistir. Registre las asambleas del
                año antes de emitir el reporte.
              </p>
            </div>
          )}

          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 text-left">Expediente</th>
                    <th className="px-4 py-3 text-left">Cédula</th>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-left">Teléfono</th>
                    <th className="px-4 py-3 text-left">Feria</th>
                    <th className="px-4 py-3 text-left">Inscripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {cargandoReporte ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-neutral-500">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Generando reporte...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !reporte || reporte.inasistentes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                        {reporte?.sin_asambleas
                          ? 'Sin asambleas registradas en el año'
                          : 'Todos los socios activos asistieron al menos a una asamblea'}
                      </td>
                    </tr>
                  ) : (
                    reporte.inasistentes.map((socio) => (
                      <tr key={socio.id} className="transition-colors hover:bg-rose-50/40">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold text-neutral-900">
                          {socio.codigo_socio}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-neutral-600">
                          {socio.cedula}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                          {socio.apellido}, {socio.nombre}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">{socio.telefono ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-neutral-600">{nombreFeria(socio.ubicacion)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-500">
                          {formatearFecha(socio.fecha_inscripcion)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <PrintableListado
            titulo={`Socios que no asistieron a ninguna asamblea en ${ano}`}
            subtitulo="Reporte anual de inasistencia a asambleas"
            filtros={filtrosImpresion}
            resumenes={[
              { label: 'Socios activos', value: String(reporte?.resumen.total_socios_activos ?? 0) },
              { label: 'Asistieron', value: String(reporte?.resumen.asistieron ?? 0) },
              { label: 'No asistieron', value: String(reporte?.resumen.no_asistieron ?? 0) },
              { label: 'Participación', value: `${reporte?.resumen.porcentaje_participacion ?? 0}%` },
            ]}
            columnas={['Expediente', 'Cédula', 'Socio', 'Teléfono', 'Feria', 'Inscripción']}
            filas={filasImpresion}
          />
        </div>
      )}

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
                  {asambleaEditando ? 'Editar asamblea' : 'Nueva asamblea'}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  El año se toma de la fecha y es el que agrupa el reporte anual.
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

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5" onKeyDown={alEnter}>
              <label className={labelClass}>
                <span>Título *</span>
                <input
                  value={formulario.titulo}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Asamblea general ordinaria"
                  className={controlClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>Fecha *</span>
                  <input
                    type="date"
                    value={formulario.fecha}
                    onChange={(e) => setFormulario((prev) => ({ ...prev, fecha: e.target.value }))}
                    className={controlClass}
                  />
                </label>

                <label className={labelClass}>
                  <span>Tipo *</span>
                  <select
                    value={formulario.tipo}
                    onChange={(e) =>
                      setFormulario((prev) => ({ ...prev, tipo: e.target.value as TipoAsamblea }))
                    }
                    className={controlClass}
                  >
                    {TIPOS_ASAMBLEA.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                {TIPOS_ASAMBLEA.find((t) => t.value === formulario.tipo)?.descripcion}
              </p>

              <label className={labelClass}>
                <span>Feria {formulario.tipo === 'sectorial' ? '*' : '(opcional)'}</span>
                <select
                  value={formulario.ubicacion_id ?? ''}
                  onChange={(e) =>
                    setFormulario((prev) => ({
                      ...prev,
                      ubicacion_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className={controlClass}
                >
                  <option value="">Asamblea general (todas las ferias)</option>
                  {ubicaciones.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {nombreFeria(ubicacion)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                <span>Descripción</span>
                <textarea
                  value={formulario.descripcion ?? ''}
                  onChange={(e) => setFormulario((prev) => ({ ...prev, descripcion: e.target.value }))}
                  rows={3}
                  className={`${controlClass} resize-y`}
                  placeholder="Orden del día, acuerdos, observaciones..."
                />
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
                <Button onClick={() => void guardarAsamblea()} disabled={guardando}>
                  {guardando ? 'Guardando...' : asambleaEditando ? 'Actualizar' : 'Crear asamblea'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: PASE DE LISTA */}
      {(detalle || cargandoDetalle) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card
            padding="none"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden border-neutral-200"
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  {detalle ? detalle.titulo : 'Cargando...'}
                </h2>
                {detalle && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                    {formatearFecha(detalle.fecha)} · {etiquetaTipo(detalle.tipo)} ·{' '}
                    {nombreFeria(detalle.ubicacion)} · {detalle.asistencias.length} asistente(s)
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {puedeEscribir && detalle && (
              <div className="space-y-3 border-b border-neutral-200 bg-neutral-50/60 px-6 py-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      value={busquedaSocio}
                      onChange={(e) => setBusquedaSocio(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void buscarSocio()
                      }}
                      placeholder="Cédula o número de expediente"
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={() => void buscarSocio()} disabled={buscandoSocio}>
                    {buscandoSocio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </Button>
                </div>

                {errorAsistencia && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorAsistencia}
                  </div>
                )}

                {sociosEncontrados.map((socio) => {
                  const registrado = yaRegistrado(socio.id)
                  return (
                    <div
                      key={socio.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {socio.apellido}, {socio.nombre}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {socio.codigo_socio} · {socio.cedula} · {socio.estado}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={registrado ? 'ghost' : 'primary'}
                        disabled={registrado}
                        onClick={() => void marcarAsistencia(socio)}
                      >
                        <UserCheck className="h-4 w-4" />
                        {registrado ? 'Ya registrado' : 'Marcar asistencia'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cargandoDetalle ? (
                <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Cargando...</span>
                </div>
              ) : !detalle || detalle.asistencias.length === 0 ? (
                <p className="py-12 text-center text-sm text-neutral-500">
                  Todavía no hay asistencias registradas en esta asamblea
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {detalle.asistencias.map((asistencia) => (
                    <li key={asistencia.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {asistencia.socio.apellido}, {asistencia.socio.nombre}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {asistencia.socio.codigo_socio} · {asistencia.socio.cedula}
                        </p>
                      </div>
                      {puedeEliminar && (
                        <button
                          onClick={() => void quitarAsistencia(asistencia.socio_id)}
                          className="rounded-lg p-2 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Quitar asistencia"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
