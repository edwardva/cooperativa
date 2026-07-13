import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserX,
  XCircle,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import * as sociosService from '../services/sociosService'
import { getErrorMessage } from '../services/api'

interface Ubicacion {
  id: number
  codigo: string
  nombre: string
}

interface Socio {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  fecha_nacimiento: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  fecha_inscripcion: string
  estado: 'activo' | 'suspendido' | 'inactivo' | 'retirado'
  es_delegado: boolean
  ubicacion_id: number | null
  autorizado_nombre: string | null
  autorizado_cedula: string | null
  notas: string | null
  foto_url: string | null
  ubicacion?: Ubicacion
  _count?: {
    beneficiarios: number
    cuentas_ahorro: number
    prestamos: number
  }
}

interface SocioFormData {
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  fecha_nacimiento: string
  direccion: string
  telefono: string
  email: string
  fecha_inscripcion: string
  ubicacion_id: number | null
  autorizado_nombre: string
  autorizado_cedula: string
  notas: string
  es_delegado: boolean
}

interface Estadisticas {
  totalSocios: number
  sociosActivos: number
  sociosSuspendidos: number
  sociosRetirados: number
  totalBeneficiarios: number
}

const getFechaHoy = (): string => new Date().toISOString().slice(0, 10)

const emptyForm = (): SocioFormData => ({
  codigo_socio: '',
  cedula: '',
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  direccion: '',
  telefono: '',
  email: '',
  fecha_inscripcion: getFechaHoy(),
  ubicacion_id: null,
  autorizado_nombre: '',
  autorizado_cedula: '',
  notas: '',
  es_delegado: false,
})

export const SociosPage = () => {
  const [socios, setSocios] = useState<Socio[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [formData, setFormData] = useState<SocioFormData>(emptyForm)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const registrosPorPagina = 50
  
  // Estadísticas del backend
  const [estadisticasBackend, setEstadisticasBackend] = useState<Estadisticas | null>(null)

  // Cargar estadísticas (una sola vez al montar)
  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        const response = await sociosService.obtenerEstadisticasSocios()
        if (response.success) {
          setEstadisticasBackend({
            totalSocios: response.data.totalSocios,
            sociosActivos: response.data.sociosActivos,
            sociosSuspendidos: response.data.sociosSuspendidos,
            sociosRetirados: response.data.sociosRetirados,
            totalBeneficiarios: response.data.totalBeneficiarios,
          })
        }
      } catch (err) {
        console.warn('No se pudieron cargar las estadísticas:', err)
      }
    }
    
    // Cargar ubicaciones (opcional)
    const cargarUbicaciones = async () => {
      try {
        const ubicacionesResponse = await sociosService.obtenerUbicaciones()
        if (ubicacionesResponse.success) {
          setUbicaciones(ubicacionesResponse.data)
        }
      } catch (ubicError) {
        console.warn('No se pudieron cargar las ubicaciones (permisos insuficientes):', ubicError)
      }
    }
    
    void cargarEstadisticas()
    void cargarUbicaciones()
  }, [])
  
  // Cargar socios cuando cambian los filtros o la página
  useEffect(() => {
    const cargarSocios = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const sociosResponse = await sociosService.obtenerSocios({
          page: paginaActual,
          limit: registrosPorPagina,
          search: busqueda || undefined,
          estado: filtroEstado || undefined,
          ubicacion_id: filtroUbicacion ? Number(filtroUbicacion) : undefined,
        })
        
        if (sociosResponse.success) {
          setSocios(sociosResponse.data)
          setTotalPaginas(sociosResponse.meta.totalPages)
          setTotalRegistros(sociosResponse.meta.total)
        }
      } catch (err) {
        const errorMsg = getErrorMessage(err)
        setError(errorMsg)
        console.error('Error cargando socios:', err)
      } finally {
        setLoading(false)
      }
    }

    void cargarSocios()
  }, [paginaActual, busqueda, filtroEstado, filtroUbicacion])

  // Usar estadísticas del backend o calcular locales como fallback
  const estadisticas = useMemo<Estadisticas>(() => {
    if (estadisticasBackend) {
      return estadisticasBackend
    }
    
    // Fallback: calcular de los socios cargados (solo para la página actual)
    const activos = socios.filter((item) => item.estado === 'activo').length
    const suspendidos = socios.filter((item) => item.estado === 'suspendido').length
    const retirados = socios.filter((item) => item.estado === 'retirado').length
    const beneficiarios = socios.reduce((acc, item) => acc + (item._count?.beneficiarios ?? 0), 0)

    return {
      totalSocios: totalRegistros || socios.length,
      sociosActivos: activos,
      sociosSuspendidos: suspendidos,
      sociosRetirados: retirados,
      totalBeneficiarios: beneficiarios,
    }
  }, [socios, estadisticasBackend, totalRegistros])

  const sociosFiltrados = useMemo(() => {
    return socios.filter((socio) => {
      const matchBusqueda =
        !busqueda ||
        socio.codigo_socio.toLowerCase().includes(busqueda.toLowerCase()) ||
        socio.cedula.includes(busqueda) ||
        socio.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        socio.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
        (socio.telefono ?? '').includes(busqueda)

      const matchEstado = !filtroEstado || socio.estado === filtroEstado
      const matchUbicacion = !filtroUbicacion || socio.ubicacion_id === Number(filtroUbicacion)

      return matchBusqueda && matchEstado && matchUbicacion
    })
  }, [socios, busqueda, filtroEstado, filtroUbicacion])

  const feriaResumen = useMemo(() => {
    const contador = new Map<number, { codigo: string; nombre: string; total: number }>()

    ubicaciones.forEach((ubi) => {
      contador.set(ubi.id, { codigo: ubi.codigo, nombre: ubi.nombre, total: 0 })
    })

    sociosFiltrados.forEach((socio) => {
      if (socio.ubicacion_id && contador.has(socio.ubicacion_id)) {
        const item = contador.get(socio.ubicacion_id)
        if (item) {
          item.total += 1
        }
      }
    })

    return Array.from(contador.values()).sort((a, b) => b.total - a.total)
  }, [sociosFiltrados, ubicaciones])

  const getEstadoBadge = (estado: Socio['estado']) => {
    const config = {
      activo: {
        icon: CheckCircle2,
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        txt: 'Activo',
      },
      suspendido: {
        icon: AlertCircle,
        cls: 'bg-amber-50 text-amber-700 border-amber-200',
        txt: 'Suspendido',
      },
      inactivo: {
        icon: XCircle,
        cls: 'bg-neutral-100 text-neutral-600 border-neutral-200',
        txt: 'Inactivo',
      },
      retirado: {
        icon: UserX,
        cls: 'bg-red-50 text-red-700 border-red-200',
        txt: 'Retirado',
      },
    }[estado]

    const Icon = config.icon
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${config.cls}`}>
        <Icon className="h-3.5 w-3.5" />
        {config.txt}
      </span>
    )
  }

  const abrirModalNuevo = () => {
    setModoEdicion(false)
    setSocioSeleccionado(null)
    setFormData(emptyForm())
    setErrorFormulario('')
    setModalAbierto(true)
  }

  const abrirModalEditar = (socio: Socio) => {
    setModoEdicion(true)
    setSocioSeleccionado(socio)
    setFormData({
      codigo_socio: socio.codigo_socio,
      cedula: socio.cedula,
      nombre: socio.nombre,
      apellido: socio.apellido,
      fecha_nacimiento: socio.fecha_nacimiento ?? '',
      direccion: socio.direccion ?? '',
      telefono: socio.telefono ?? '',
      email: socio.email ?? '',
      fecha_inscripcion: socio.fecha_inscripcion,
      ubicacion_id: socio.ubicacion_id,
      autorizado_nombre: socio.autorizado_nombre ?? '',
      autorizado_cedula: socio.autorizado_cedula ?? '',
      notas: socio.notas ?? '',
      es_delegado: socio.es_delegado,
    })
    setErrorFormulario('')
    setModalAbierto(true)
  }

  const actualizarCampo = (campo: keyof SocioFormData, valor: string | boolean | number | null) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }))
  }

  const validarFormulario = (): boolean => {
    if (!formData.codigo_socio.trim()) {
      setErrorFormulario('El expediente (codigo de socio) es obligatorio.')
      return false
    }

    if (!formData.cedula.trim()) {
      setErrorFormulario('La cedula es obligatoria.')
      return false
    }

    if (!/^\d+$/.test(formData.cedula)) {
      setErrorFormulario('La cedula debe contener solo numeros.')
      return false
    }

    if (!formData.telefono.trim()) {
      setErrorFormulario('El telefono es obligatorio para el listado principal.')
      return false
    }

    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      setErrorFormulario('Nombre y apellido son obligatorios.')
      return false
    }

    if (!formData.ubicacion_id) {
      setErrorFormulario('Debe seleccionar una feria/ubicacion.')
      return false
    }

    setErrorFormulario('')
    return true
  }

  const guardarSocio = () => {
    if (!validarFormulario()) {
      return
    }

    if (modoEdicion && socioSeleccionado) {
      setSocios((prev) =>
        prev.map((item) => {
          if (item.id !== socioSeleccionado.id) {
            return item
          }

          const ubicacion = ubicaciones.find((ubi) => ubi.id === formData.ubicacion_id)
          return {
            ...item,
            ...formData,
            fecha_nacimiento: formData.fecha_nacimiento || null,
            direccion: formData.direccion || null,
            telefono: formData.telefono || null,
            email: formData.email || null,
            autorizado_nombre: formData.autorizado_nombre || null,
            autorizado_cedula: formData.autorizado_cedula || null,
            notas: formData.notas || null,
            ubicacion: ubicacion,
          }
        })
      )
    } else {
      const idNuevo = socios.length > 0 ? Math.max(...socios.map((item) => item.id)) + 1 : 1
      const ubicacion = ubicaciones.find((ubi) => ubi.id === formData.ubicacion_id)

      setSocios((prev) => [
        {
          id: idNuevo,
          codigo_socio: formData.codigo_socio,
          cedula: formData.cedula,
          nombre: formData.nombre,
          apellido: formData.apellido,
          fecha_nacimiento: formData.fecha_nacimiento || null,
          direccion: formData.direccion || null,
          telefono: formData.telefono || null,
          email: formData.email || null,
          fecha_inscripcion: formData.fecha_inscripcion,
          estado: 'activo',
          es_delegado: formData.es_delegado,
          ubicacion_id: formData.ubicacion_id,
          autorizado_nombre: formData.autorizado_nombre || null,
          autorizado_cedula: formData.autorizado_cedula || null,
          notas: formData.notas || null,
          foto_url: null,
          ubicacion,
          _count: { beneficiarios: 0, cuentas_ahorro: 0, prestamos: 0 },
        },
        ...prev,
      ])
    }

    setModalAbierto(false)
  }

  const retirarSocio = (socio: Socio) => {
    const confirmado = window.confirm(`Desea retirar al socio ${socio.apellido}, ${socio.nombre}?`)
    if (!confirmado) {
      return
    }

    setSocios((prev) =>
      prev.map((item) =>
        item.id === socio.id
          ? {
              ...item,
              estado: 'retirado',
            }
          : item
      )
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary-100 bg-[linear-gradient(135deg,rgba(255,107,28,0.08),rgba(58,122,44,0.06))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-900">Socios y Ferias</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Gestion centralizada de expediente, cedula, telefono y ubicacion de feria.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroUbicacion(''); setPaginaActual(1) }}>
              Limpiar filtros
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Download className="h-4 w-4" />
              Imprimir listado
            </Button>
            <Button onClick={abrirModalNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo socio
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-primary-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total socios</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{estadisticas.totalSocios}</p>
          <p className="mt-1 text-sm text-neutral-500">Registros en sistema</p>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Activos</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{estadisticas.sociosActivos}</p>
          <p className="mt-1 text-sm text-emerald-700/80">Al dia en pagos</p>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Suspendidos</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{estadisticas.sociosSuspendidos}</p>
          <p className="mt-1 text-sm text-amber-700/80">Revision requerida</p>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Retirados</p>
          <p className="mt-2 text-3xl font-semibold text-red-700">{estadisticas.sociosRetirados}</p>
          <p className="mt-1 text-sm text-red-700/80">Estado historico</p>
        </Card>

        <Card className="border-secondary-200 bg-secondary-50/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary-800">Beneficiarios</p>
          <p className="mt-2 text-3xl font-semibold text-secondary-800">{estadisticas.totalBeneficiarios}</p>
          <p className="mt-1 text-sm text-secondary-800/80">Total registrados</p>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="border-neutral-200">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1) }}
                  placeholder="Buscar por expediente, cedula, nombre o telefono"
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <select
                  value={filtroEstado}
                  onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1) }}
                  className="w-full appearance-none rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="retirado">Retirado</option>
                </select>
              </div>

              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <select
                  value={filtroUbicacion}
                  onChange={(e) => { setFiltroUbicacion(e.target.value); setPaginaActual(1) }}
                  className="w-full appearance-none rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">Todas las ferias</option>
                  {ubicaciones.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {ubicacion.codigo} - {ubicacion.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border-neutral-200 p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">Expediente</th>
                    <th className="px-4 py-3">Cedula</th>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3">Telefono</th>
                    <th className="px-4 py-3">Feria</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
                        Cargando socios...
                      </td>
                    </tr>
                  )}

                  {!loading && sociosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
                        No hay socios para los filtros seleccionados.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    sociosFiltrados.map((socio) => (
                      <tr key={socio.id} className="border-b border-neutral-100 text-sm text-neutral-700 hover:bg-primary-50/40">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm font-semibold text-primary-700">{socio.codigo_socio}</div>
                          {socio.es_delegado && (
                            <span className="mt-1 inline-flex rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-semibold text-secondary-800">
                              Delegado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-900">{socio.cedula}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-neutral-900">
                            {socio.apellido}, {socio.nombre}
                          </p>
                          <p className="text-xs text-neutral-500">Ingreso: {socio.fecha_inscripcion}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 text-neutral-700">
                            <Phone className="h-3.5 w-3.5 text-neutral-400" />
                            {socio.telefono ?? 'Sin telefono'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-neutral-800">{socio.ubicacion?.nombre ?? 'Sin feria'}</p>
                          <p className="text-xs text-neutral-500">{socio.ubicacion?.codigo ?? '--'}</p>
                        </td>
                        <td className="px-4 py-3">{getEstadoBadge(socio.estado)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => abrirModalEditar(socio)}
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-primary-100 hover:text-primary-700"
                              title="Editar socio"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-emerald-100 hover:text-emerald-700"
                              title="Imprimir ficha"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              disabled={socio.estado === 'retirado'}
                              onClick={() => retirarSocio(socio)}
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Retirar socio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            {/* Controles de paginación */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-600">
                  Mostrando <span className="font-semibold">{socios.length === 0 ? 0 : (paginaActual - 1) * registrosPorPagina + 1}</span> a{' '}
                  <span className="font-semibold">{Math.min(paginaActual * registrosPorPagina, totalRegistros)}</span> de{' '}
                  <span className="font-semibold">{totalRegistros}</span> socios
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                    disabled={paginaActual === 1}
                    className="h-9 px-3"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                      let pageNum: number
                      if (totalPaginas <= 5) {
                        pageNum = i + 1
                      } else if (paginaActual <= 3) {
                        pageNum = i + 1
                      } else if (paginaActual >= totalPaginas - 2) {
                        pageNum = totalPaginas - 4 + i
                      } else {
                        pageNum = paginaActual - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPaginaActual(pageNum)}
                          className={`h-9 min-w-[36px] rounded-lg px-2 text-sm font-medium transition ${
                            paginaActual === pageNum
                              ? 'bg-primary-600 text-white'
                              : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="h-9 px-3"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="h-fit border-neutral-200">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary-700" />
            <h3 className="text-lg font-semibold text-neutral-900">Listado de ferias</h3>
          </div>
          <p className="mt-1 text-sm text-neutral-500">Numero de feria y socios registrados por feria.</p>

          <div className="mt-4 space-y-2">
            {feriaResumen.map((feria) => (
              <div key={feria.codigo} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{feria.codigo}</p>
                    <p className="text-sm font-medium text-neutral-900">{feria.nombre}</p>
                  </div>
                  <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700">
                    {feria.total} socios
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-neutral-500" />
              Usa los filtros para ver el impacto por feria en tiempo real.
            </div>
          </div>
        </Card>
      </section>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-5xl overflow-y-auto border-neutral-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">
                  {modoEdicion ? `Editar socio ${socioSeleccionado?.codigo_socio ?? ''}` : 'Nuevo socio'}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Completa los datos principales para que aparezcan en listados de ahorro y reportes.
                </p>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Datos principales</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Expediente *</span>
                    <input
                      value={formData.codigo_socio}
                      onChange={(e) => actualizarCampo('codigo_socio', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Cedula *</span>
                    <input
                      value={formData.cedula}
                      onChange={(e) => actualizarCampo('cedula', e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Nombres *</span>
                    <input
                      value={formData.nombre}
                      onChange={(e) => actualizarCampo('nombre', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Apellidos *</span>
                    <input
                      value={formData.apellido}
                      onChange={(e) => actualizarCampo('apellido', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Telefono *</span>
                    <input
                      value={formData.telefono}
                      onChange={(e) => actualizarCampo('telefono', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Correo</span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => actualizarCampo('email', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Fecha ingreso</span>
                    <input
                      type="date"
                      value={formData.fecha_inscripcion}
                      onChange={(e) => actualizarCampo('fecha_inscripcion', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Fecha nacimiento</span>
                    <input
                      type="date"
                      value={formData.fecha_nacimiento}
                      onChange={(e) => actualizarCampo('fecha_nacimiento', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>
                </div>

                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Direccion</span>
                  <input
                    value={formData.direccion}
                    onChange={(e) => actualizarCampo('direccion', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </label>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Control interno y autorizacion</p>

                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Feria / Ubicacion *</span>
                  <select
                    value={formData.ubicacion_id ?? ''}
                    onChange={(e) =>
                      actualizarCampo('ubicacion_id', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">Seleccione una feria</option>
                    {ubicaciones.map((ubicacion) => (
                      <option key={ubicacion.id} value={ubicacion.id}>
                        {ubicacion.codigo} - {ubicacion.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Autorizado por</span>
                    <input
                      value={formData.autorizado_nombre}
                      onChange={(e) => actualizarCampo('autorizado_nombre', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-neutral-700">
                    <span>Cedula autorizado</span>
                    <input
                      value={formData.autorizado_cedula}
                      onChange={(e) => actualizarCampo('autorizado_cedula', e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={formData.es_delegado}
                    onChange={(e) => actualizarCampo('es_delegado', e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  Marcar como delegado
                </label>

                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Historial / notas</span>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => actualizarCampo('notas', e.target.value)}
                    rows={7}
                    className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    placeholder="Suspensiones, observaciones, acuerdos internos..."
                  />
                </label>
              </div>
            </div>

            {errorFormulario && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorFormulario}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button onClick={guardarSocio}>{modoEdicion ? 'Actualizar socio' : 'Guardar socio'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
