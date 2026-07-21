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
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Trash2,
  UserX,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import * as sociosService from '../services/sociosService'
import { formatearFecha, normalizarFechaParaInput } from '../utils/formatters'

interface Ubicacion {
  id: number
  codigo: string
  nombre: string
  direccion: string | null
}

interface Socio {
  id: number
  codigo_socio: string
  cedula: string
  nombre: string
  apellido: string
  sexo: string | null
  fecha_nacimiento: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  fecha_inscripcion: string
  estado: 'activo' | 'retirado' | 'invalido'
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
  sexo: string
  fecha_nacimiento: string
  direccion: string
  telefono: string
  email: string
  fecha_inscripcion: string
  ubicacion_id: number | null
  autorizado_nombre: string
  autorizado_cedula: string
  notas: string
}

interface RetiroSocioFormData {
  fecha_retiro: string
  motivo_retiro: 'Socio' | 'Voluntario' | 'Art. 5'
}

interface Estadisticas {
  totalSocios: number
  sociosActivos: number
  sociosRetirados: number
}

const getFechaHoy = (): string => new Date().toISOString().slice(0, 10)

const emptyForm = (): SocioFormData => ({
  codigo_socio: '',
  cedula: '',
  nombre: '',
  apellido: '',
  sexo: '',
  fecha_nacimiento: '',
  direccion: '',
  telefono: '',
  email: '',
  fecha_inscripcion: getFechaHoy(),
  ubicacion_id: null,
  autorizado_nombre: '',
  autorizado_cedula: '',
  notas: '',
})

export const SociosPage = () => {
  const [socios, setSocios] = useState<Socio[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false)
  const [modalRetiroAbierto, setModalRetiroAbierto] = useState(false)
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null)
  const [socioDetalle, setSocioDetalle] = useState<Socio | null>(null)
  const [socioParaRetiro, setSocioParaRetiro] = useState<Socio | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [formData, setFormData] = useState<SocioFormData>(emptyForm)
  const [formRetiro, setFormRetiro] = useState<RetiroSocioFormData>({
    fecha_retiro: getFechaHoy(),
    motivo_retiro: 'Socio',
  })
  const [errorFormulario, setErrorFormulario] = useState('')
  const [errorRetiro, setErrorRetiro] = useState('')
  const [procesandoRetiro, setProcesandoRetiro] = useState(false)
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null)
  
  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(20)
  
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
            sociosRetirados: response.data.sociosRetirados,
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
        console.error('Error cargando socios:', err)
      } finally {
        setLoading(false)
      }
    }

    void cargarSocios()
  }, [paginaActual, busqueda, filtroEstado, filtroUbicacion, registrosPorPagina])

  // Usar estadísticas del backend o calcular locales como fallback
  const estadisticas = useMemo<Estadisticas>(() => {
    if (estadisticasBackend) {
      return estadisticasBackend
    }
    
    // Fallback: Mostrar solo el total de la página actual si no hay estadísticas del backend
    // No calculamos activos/retirados porque solo tenemos los de la página actual
    return {
      totalSocios: totalRegistros || socios.length,
      sociosActivos: 0, // Se mostrará cuando cargue del backend
      sociosRetirados: 0, // Se mostrará cuando cargue del backend
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

  const cargarSocios = async () => {
    setLoading(true)

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
      console.error('Error cargando socios:', err)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: Socio['estado']) => {
    const config = {
      activo: {
        icon: CheckCircle2,
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        txt: 'Activo',
      },
      retirado: {
        icon: UserX,
        cls: 'bg-red-50 text-red-700 border-red-200',
        txt: 'Retirado',
      },
      invalido: {
        icon: AlertCircle,
        cls: 'bg-purple-50 text-purple-700 border-purple-200',
        txt: 'Inválido',
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
      sexo: socio.sexo ?? '',
      fecha_nacimiento: normalizarFechaParaInput(socio.fecha_nacimiento),
      direccion: socio.direccion ?? '',
      telefono: socio.telefono ?? '',
      email: socio.email ?? '',
      fecha_inscripcion: normalizarFechaParaInput(socio.fecha_inscripcion),
      ubicacion_id: socio.ubicacion_id,
      autorizado_nombre: socio.autorizado_nombre ?? '',
      autorizado_cedula: socio.autorizado_cedula ?? '',
      notas: socio.notas ?? '',
    })
    setErrorFormulario('')
    setModalAbierto(true)
  }

  const abrirModalDetalle = (socio: Socio) => {
    setMenuAbiertoId(null)
    setSocioDetalle(socio)
    setModalDetalleAbierto(true)
  }

  const abrirModalRetiro = (socio: Socio) => {
    setMenuAbiertoId(null)
    setSocioParaRetiro(socio)
    setFormRetiro({
      fecha_retiro: getFechaHoy(),
      motivo_retiro: 'Socio',
    })
    setErrorRetiro('')
    setModalRetiroAbierto(true)
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
          sexo: formData.sexo || null,
          fecha_nacimiento: formData.fecha_nacimiento || null,
          direccion: formData.direccion || null,
          telefono: formData.telefono || null,
          email: formData.email || null,
          fecha_inscripcion: formData.fecha_inscripcion,
          estado: 'activo',
          es_delegado: false,
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

  const confirmarRetiro = async () => {
    if (!socioParaRetiro) {
      return
    }

    setProcesandoRetiro(true)
    setErrorRetiro('')

    try {
      const response = await sociosService.retirarSocio(socioParaRetiro.id, formRetiro)

      if (!response.success) {
        throw new Error('No fue posible retirar el socio')
      }

      setModalRetiroAbierto(false)
      setSocioParaRetiro(null)
      await cargarSocios()
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al retirar el socio'
      setErrorRetiro(mensaje)
    } finally {
      setProcesandoRetiro(false)
    }
  }

  const eliminarRegistro = async (socio: Socio) => {
    const confirmado = window.confirm(
      `Eliminar definitivamente al socio ${socio.apellido}, ${socio.nombre}? Esta acción solo se permite si no tiene relaciones en el sistema.`
    )

    if (!confirmado) {
      return
    }

    try {
      const response = await sociosService.eliminarSocio(socio.id)

      if (!response.success) {
        throw new Error('No fue posible eliminar el socio')
      }

      await cargarSocios()
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al eliminar el socio'
      window.alert(mensaje)
    }
  }

  const totalRelacionesSocio = (socio: Socio): number => {
    return (socio._count?.beneficiarios ?? 0) + (socio._count?.cuentas_ahorro ?? 0) + (socio._count?.prestamos ?? 0)
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

        <Card className="border-red-200 bg-red-50/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Retirados</p>
          <p className="mt-2 text-3xl font-semibold text-red-700">{estadisticas.sociosRetirados}</p>
          <p className="mt-1 text-sm text-red-700/80">Estado historico</p>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5">
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
                  <option value="retirado">Retirado</option>
                  <option value="invalido">Inválido</option>
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
                    <th className="px-4 py-3">Fecha ing</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="w-12 px-2 py-3 text-right"></th>
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
                          <p className="text-xs text-neutral-500">{socio.ubicacion?.direccion ?? 'Sin feria'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 text-neutral-700">
                            <Phone className="h-3.5 w-3.5 text-neutral-400" />
                            {socio.telefono ?? 'Sin telefono'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-neutral-800">{formatearFecha(socio.fecha_inscripcion)}</p>
                        </td>
                        <td className="px-4 py-3">{getEstadoBadge(socio.estado)}</td>
                        <td className="px-2 py-3">
                          <div className="relative flex items-center justify-end">
                            <button
                              onClick={() => setMenuAbiertoId(menuAbiertoId === socio.id ? null : socio.id)}
                              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                              title="Acciones"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            
                            {menuAbiertoId === socio.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setMenuAbiertoId(null)}
                                />
                                <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-neutral-200 bg-white shadow-lg">
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        abrirModalDetalle(socio)
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                    >
                                      <Eye className="h-4 w-4 text-neutral-500" />
                                      <span>Ver detalle</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setMenuAbiertoId(null)
                                        abrirModalEditar(socio)
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                    >
                                      <Edit2 className="h-4 w-4 text-primary-600" />
                                      <span>Editar socio</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setMenuAbiertoId(null)
                                        // Imprimir ficha (pendiente)
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                    >
                                      <Download className="h-4 w-4 text-emerald-600" />
                                      <span>Imprimir ficha</span>
                                    </button>
                                    <div className="my-1 border-t border-neutral-200" />
                                    {socio.estado !== 'retirado' && (
                                      <button
                                        onClick={() => abrirModalRetiro(socio)}
                                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                                      >
                                        <UserX className="h-4 w-4" />
                                        <span>Retirar socio</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => void eliminarRegistro(socio)}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>Eliminar socio</span>
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
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
                <div className="flex items-center gap-3">
                  <p className="text-sm text-neutral-600">
                    Mostrando <span className="font-semibold">{socios.length === 0 ? 0 : (paginaActual - 1) * registrosPorPagina + 1}</span> a{' '}
                    <span className="font-semibold">{Math.min(paginaActual * registrosPorPagina, totalRegistros)}</span> de{' '}
                    <span className="font-semibold">{totalRegistros}</span> socios
                  </p>
                  <select
                    value={registrosPorPagina}
                    onChange={(e) => {
                      setRegistrosPorPagina(Number(e.target.value))
                      setPaginaActual(1)
                    }}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                
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
                    <span>Sexo</span>
                    <select
                      value={formData.sexo}
                      onChange={(e) => actualizarCampo('sexo', e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[center_right_0.5rem] bg-no-repeat pr-10"
                    >
                      <option value="" className="text-neutral-500">Seleccionar...</option>
                      <option value="M" className="py-2">Masculino</option>
                      <option value="F" className="py-2">Femenino</option>
                    </select>
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
                  <span>Feria *</span>
                  <select
                    value={formData.ubicacion_id ?? ''}
                    onChange={(e) =>
                      actualizarCampo('ubicacion_id', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[center_right_0.5rem] bg-no-repeat pr-10"
                  >
                    <option value="" className="text-neutral-500">Seleccione una feria</option>
                    {ubicaciones.map((ubicacion) => (
                      <option key={ubicacion.id} value={ubicacion.id} className="py-2">
                        {ubicacion.codigo} - {ubicacion.direccion || 'Sin dirección'}
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

      {modalRetiroAbierto && socioParaRetiro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-neutral-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">Registrar retiro</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {socioParaRetiro.apellido}, {socioParaRetiro.nombre} - {socioParaRetiro.codigo_socio}
                </p>
              </div>
              <button
                onClick={() => setModalRetiroAbierto(false)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Fecha del retiro</span>
                <input
                  type="date"
                  value={formRetiro.fecha_retiro}
                  onChange={(e) => setFormRetiro((prev) => ({ ...prev, fecha_retiro: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Motivo</span>
                <select
                  value={formRetiro.motivo_retiro}
                  onChange={(e) =>
                    setFormRetiro((prev) => ({
                      ...prev,
                      motivo_retiro: e.target.value as RetiroSocioFormData['motivo_retiro'],
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[center_right_0.5rem] bg-no-repeat pr-10"
                >
                  <option value="Socio">Socio</option>
                  <option value="Voluntario">Voluntario</option>
                  <option value="Art. 5">Art. 5</option>
                </select>
              </label>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                El retiro cambia el estado del socio a retirado y deja el motivo registrado en el historial.
              </div>

              {errorRetiro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorRetiro}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setModalRetiroAbierto(false)} disabled={procesandoRetiro}>
                  Cancelar
                </Button>
                <Button onClick={() => void confirmarRetiro()} disabled={procesandoRetiro}>
                  {procesandoRetiro ? 'Procesando...' : 'Confirmar retiro'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {modalDetalleAbierto && socioDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto border-neutral-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">Detalle del socio</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Vista de solo lectura sin posibilidad de edición.
                </p>
              </div>
              <button
                onClick={() => setModalDetalleAbierto(false)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Identificación</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Expediente</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-neutral-900">{socioDetalle.codigo_socio}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Cédula</dt>
                    <dd className="mt-1 text-sm font-semibold text-neutral-900">{socioDetalle.cedula}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Nombre completo</dt>
                    <dd className="mt-1 text-sm font-semibold text-neutral-900">
                      {socioDetalle.apellido}, {socioDetalle.nombre}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Sexo</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.sexo || 'Sin dato'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Estado</dt>
                    <dd className="mt-1">{getEstadoBadge(socioDetalle.estado)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Delegado</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.es_delegado ? 'Sí' : 'No'}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Contacto y ubicación</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Teléfono</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.telefono || 'Sin teléfono'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Correo</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.email || 'Sin correo'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Feria / Ubicación</dt>
                    <dd className="mt-1 text-sm text-neutral-700">
                      {socioDetalle.ubicacion ? `${socioDetalle.ubicacion.codigo} - ${socioDetalle.ubicacion.nombre}` : 'Sin feria'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Dirección</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.direccion || 'Sin dirección'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Fecha ingreso</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{formatearFecha(socioDetalle.fecha_inscripcion)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Fecha nacimiento</dt>
                    <dd className="mt-1 text-sm text-neutral-700">
                      {socioDetalle.fecha_nacimiento ? formatearFecha(socioDetalle.fecha_nacimiento) : 'Sin dato'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Autorización y notas</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Autorizado por</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.autorizado_nombre || 'Sin dato'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Cédula autorizado</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle.autorizado_cedula || 'Sin dato'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Notas</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-neutral-700">{socioDetalle.notas || 'Sin notas'}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Relaciones registradas</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Beneficiarios</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle._count?.beneficiarios ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Cuentas de ahorro</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle._count?.cuentas_ahorro ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Préstamos</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{socioDetalle._count?.prestamos ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Total</dt>
                    <dd className="mt-1 text-sm font-semibold text-neutral-900">{totalRelacionesSocio(socioDetalle)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="outline" onClick={() => setModalDetalleAbierto(false)}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
