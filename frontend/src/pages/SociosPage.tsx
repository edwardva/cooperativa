import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Contact,
  Download,
  Edit2,
  Eye,
  Filter,
  HardHat,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  Search,
  UserX,
  X,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PrintableListado } from '../components/print/PrintableListado'
import { SortableHeader } from '../components/ui/SortableHeader'
import * as sociosService from '../services/sociosService'
import { formatearFecha, normalizarFechaParaInput } from '../utils/formatters'
import { validarCedula } from '../utils/cedula'
import { getErrorMessage } from '../services/api'
import * as personasService from '../services/personasService'
import type { ResultadoIdentificacion } from '../services/personasService'
import { useEnterNavigation } from '../hooks/useEnterNavigation'

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
  foto: string | null // Base64 de la foto
  ubicacion?: Ubicacion
  _count?: {
    beneficiarios: number
    cuentas_ahorro: number
    prestamos: number
  }
  /** Expediente de trabajador vigente de la misma persona, si lo tiene */
  trabajador?: { codigo: string; feria: string | null } | null
  /** Nula mientras la cédula esté pendiente de revisión: sin ella no hay ficha completa */
  persona_id?: number | null
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
  es_delegado: boolean
  notas: string
  foto?: string // Base64 de la foto
}

type MotivoRetiro = 'Fallecimiento' | 'Renuncia' | 'Pasividad'

const MOTIVOS_RETIRO: { value: MotivoRetiro; label: string; descripcion: string }[] = [
  {
    value: 'Fallecimiento',
    label: 'Fallecimiento',
    descripcion: 'El socio ha fallecido.',
  },
  {
    value: 'Renuncia',
    label: 'Renuncia',
    descripcion: 'El socio renuncia voluntariamente a su condicion de asociado.',
  },
  {
    value: 'Pasividad',
    label: 'Pasividad mayor a 6 meses',
    descripcion:
      'Pasividad mayor a 6 meses: dejar de asistir sin causa justificada a dos reuniones sectoriales consecutivas.',
  },
]

interface RetiroSocioFormData {
  fecha_retiro: string
  motivo_retiro: MotivoRetiro | ''
}

interface Estadisticas {
  totalSocios: number
  sociosActivos: number
  sociosRetirados: number
}

const getFechaHoy = (): string => new Date().toISOString().slice(0, 10)

const labelClass = 'space-y-1.5 text-sm font-medium text-neutral-700'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

const selectClass = `${controlClass} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[center_right_0.5rem] bg-no-repeat pr-10`

const seccionClass = 'space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4'

const tituloSeccionClass = 'text-sm font-semibold uppercase tracking-wide text-neutral-500'


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
  es_delegado: false,
  notas: '',
})

/** "Ahorrista 00123 (activo) · Trabajador T-000004 (activo, F01)" */
const resumenExpedientes = (r: ResultadoIdentificacion): string => {
  const socios = r.persona
    ? r.persona.socios.map((s) => `Ahorrista ${s.codigo_socio} (${s.estado})`)
    : r.socios_sin_persona.map((s) => `Ahorrista ${s.codigo_socio} (${s.estado})`)
  const trabajadores = (r.persona?.trabajadores ?? []).map(
    (t) =>
      `Trabajador ${t.codigo_trabajador} (${t.estado}${
        t.feria_actual ? `, ${t.feria_actual.direccion?.trim() || t.feria_actual.nombre || t.feria_actual.codigo}` : ''
      })`
  )
  return [...socios, ...trabajadores].join(' · ')
}

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
    motivo_retiro: '',
  })
  const [errorFormulario, setErrorFormulario] = useState('')
  const [errorRetiro, setErrorRetiro] = useState('')
  const [procesandoRetiro, setProcesandoRetiro] = useState(false)
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null)
  // El menú se posiciona sobre la ventana: dentro de la tabla (overflow) se cortaba en las últimas filas
  const [posicionMenu, setPosicionMenu] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 })

  useEffect(() => {
    if (menuAbiertoId === null) return
    const cerrar = () => setMenuAbiertoId(null)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [menuAbiertoId])

  const alternarMenu = (socioId: number, boton: HTMLElement) => {
    if (menuAbiertoId === socioId) {
      setMenuAbiertoId(null)
      return
    }
    const r = boton.getBoundingClientRect()
    const right = window.innerWidth - r.right
    // Sin espacio debajo para las opciones, abre hacia arriba
    setPosicionMenu(window.innerHeight - r.bottom < 280 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right })
    setMenuAbiertoId(socioId)
  }
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  // Fase 2: la cedula se consulta al salir del campo para no duplicar a la persona
  const [identificacion, setIdentificacion] = useState<ResultadoIdentificacion | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const alEnter = useEnterNavigation()
  const navigate = useNavigate()
  
  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(20)
  
  // Estados de ordenamiento
  const [sortField, setSortField] = useState<string>('codigo_socio')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
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
    let resultado = socios.filter((socio) => {
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

    // Aplicar ordenamiento
    resultado.sort((a, b) => {
      let compareA: any = a[sortField as keyof Socio]
      let compareB: any = b[sortField as keyof Socio]

      // Manejar campos anidados
      if (sortField === 'ubicacion') {
        compareA = a.ubicacion?.direccion ?? ''
        compareB = b.ubicacion?.direccion ?? ''
      }

      // Manejar valores nulos
      if (compareA === null || compareA === undefined) compareA = ''
      if (compareB === null || compareB === undefined) compareB = ''

      // Comparación
      if (typeof compareA === 'string') {
        compareA = compareA.toLowerCase()
        compareB = compareB.toLowerCase()
      }

      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return resultado
  }, [socios, busqueda, filtroEstado, filtroUbicacion, sortField, sortOrder])

  // Función para manejar el ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Alternar entre asc y desc
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Nuevo campo, empezar con asc
      setSortField(field)
      setSortOrder('asc')
    }
  }

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

  const abrirModalNuevo = (cedula = '') => {
    setModoEdicion(false)
    setSocioSeleccionado(null)
    setFormData({ ...emptyForm(), cedula })
    setIdentificacion(null)
    setFotoPreview(null)
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
      es_delegado: socio.es_delegado ?? false,
      notas: socio.notas ?? '',
      foto: socio.foto ?? undefined,
    })
    setFotoPreview(socio.foto)
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
      motivo_retiro: '',
    })
    setErrorRetiro('')
    setModalRetiroAbierto(true)
  }

  const actualizarCampo = (campo: keyof SocioFormData, valor: string | boolean | number | null) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }))
  }

  /**
   * En un alta, al salir del campo cedula: si la persona ya existe se completan
   * los campos vacios con sus datos y se muestra que expedientes tiene. Sin
   * permiso de personas (403) el formulario sigue funcionando como antes.
   */
  const consultarCedula = async (cedula = formData.cedula) => {
    if (modoEdicion) return
    const revision = validarCedula(cedula)
    if (!revision.valida) {
      setIdentificacion(null)
      return
    }
    try {
      const r = await personasService.buscarPorIdentificacion(revision.cedula)
      setIdentificacion(r.data)
      const persona = r.data.persona
      if (persona) {
        setFormData((prev) => ({
          ...prev,
          nombre: prev.nombre || persona.nombres,
          apellido: prev.apellido || persona.apellidos,
          sexo: prev.sexo || persona.sexo || '',
          fecha_nacimiento: prev.fecha_nacimiento || (persona.fecha_nacimiento?.slice(0, 10) ?? ''),
          telefono: prev.telefono || persona.telefono || '',
          email: prev.email || persona.email || '',
          direccion: prev.direccion || persona.direccion || '',
        }))
      }
    } catch {
      setIdentificacion(null)
    }
  }

  // "Inscribir como ahorrista" desde la ficha del trabajador llega con ?nuevo=1&cedula=
  useEffect(() => {
    if (searchParams.get('nuevo') !== '1') return
    const cedula = searchParams.get('cedula') ?? ''
    abrirModalNuevo(cedula)
    void consultarCedula(cedula)
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const manejarCambioFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) {
      return
    }

    // Validar tipo de archivo
    if (!archivo.type.startsWith('image/')) {
      setErrorFormulario('El archivo debe ser una imagen')
      return
    }

    // Validar tamaño (máximo 2MB)
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorFormulario('La imagen debe pesar menos de 2MB')
      return
    }

    // Convertir a base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setFormData((prev) => ({ ...prev, foto: base64 }))
      setFotoPreview(base64)
    }
    reader.readAsDataURL(archivo)
  }

  const eliminarFoto = () => {
    setFormData((prev) => ({ ...prev, foto: undefined }))
    setFotoPreview(null)
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

    // Mismo validador que usa el backend: acepta "V-12.345.678" y normaliza
    const revision = validarCedula(formData.cedula)
    if (!revision.valida) {
      setErrorFormulario(revision.error ?? 'Cedula invalida.')
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

  const guardarSocio = async () => {
    if (!validarFormulario()) {
      return
    }

    try {
      // Se envia normalizada para que "V-12.345.678" y "12345678" no convivan
      const datos = { ...formData, cedula: validarCedula(formData.cedula).cedula }

      const respuesta =
        modoEdicion && socioSeleccionado
          ? await sociosService.actualizarSocio(socioSeleccionado.id, datos)
          : await sociosService.crearSocio(datos)

      // Se guardo, pero hay algo que quien atiende tiene que saber
      if (respuesta.advertencias?.length) {
        window.alert(`Socio guardado.\n\n${respuesta.advertencias.join('\n\n')}`)
      }
      
      setModalAbierto(false)
      await cargarSocios()
    } catch (error) {
      console.error('Error guardando socio:', error)
      // El backend explica el motivo (cedula duplicada, invalida, expediente en uso)
      setErrorFormulario(getErrorMessage(error) || 'Error al guardar el socio. Por favor, intente nuevamente.')
    }
  }

  const confirmarRetiro = async () => {
    if (!socioParaRetiro) {
      return
    }

    if (!formRetiro.motivo_retiro) {
      setErrorRetiro('Seleccione el motivo del retiro')
      return
    }

    setProcesandoRetiro(true)
    setErrorRetiro('')

    try {
      const response = await sociosService.retirarSocio(socioParaRetiro.id, {
        fecha_retiro: formRetiro.fecha_retiro,
        motivo_retiro: formRetiro.motivo_retiro,
      })

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

  const totalRelacionesSocio = (socio: Socio): number => {
    return (socio._count?.beneficiarios ?? 0) + (socio._count?.cuentas_ahorro ?? 0) + (socio._count?.prestamos ?? 0)
  }

  const descripcionMotivoRetiro =
    MOTIVOS_RETIRO.find((motivo) => motivo.value === formRetiro.motivo_retiro)?.descripcion ?? ''

  const nombreFeria = (ubicacion: Ubicacion): string =>
    ubicacion.direccion || ubicacion.nombre || ubicacion.codigo

  const filtrosImpresion = [
    { label: 'Búsqueda', value: busqueda || 'Sin búsqueda' },
    { label: 'Estado', value: filtroEstado || 'Todos los estados' },
    {
      label: 'Feria',
      value: filtroUbicacion
        ? (() => {
            const feria = ubicaciones.find((u) => String(u.id) === filtroUbicacion)
            return feria ? nombreFeria(feria) : 'Todas las ferias'
          })()
        : 'Todas las ferias',
    },
    { label: 'Registros por página', value: String(registrosPorPagina) },
  ]

  const filasImpresion = sociosFiltrados.map((socio) => [
    socio.codigo_socio,
    socio.cedula,
    `${socio.apellido}, ${socio.nombre}`,
    socio.telefono ?? 'Sin teléfono',
    formatearFecha(socio.fecha_inscripcion),
    socio.estado,
    socio.ubicacion?.direccion ?? 'Sin feria',
  ])

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
            <Button onClick={() => abrirModalNuevo()}>
              <Plus className="h-4 w-4" />
              Nuevo socio
            </Button>
          </div>
        </div>
      </section>

      <PrintableListado
        titulo="Listado de Socios y Ferias"
        subtitulo="Reporte generado con los filtros actuales del módulo de socios"
        filtros={filtrosImpresion}
        resumenes={[
          { label: 'Total visibles', value: String(sociosFiltrados.length) },
          { label: 'Total sistema', value: String(estadisticas.totalSocios) },
          { label: 'Activos', value: String(estadisticas.sociosActivos) },
          { label: 'Retirados', value: String(estadisticas.sociosRetirados) },
        ]}
        columnas={['Expediente', 'Cédula', 'Socio', 'Teléfono', 'Fecha ingreso', 'Estado', 'Feria']}
        filas={filasImpresion}
      />

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
                      {nombreFeria(ubicacion)}
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
                    <SortableHeader
                      label="Expediente"
                      field="codigo_socio"
                      currentSortField={sortField}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Cédula"
                      field="cedula"
                      currentSortField={sortField}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Socio"
                      field="apellido"
                      currentSortField={sortField}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Teléfono"
                      field="telefono"
                      currentSortField={sortField}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Fecha ing"
                      field="fecha_inscripcion"
                      currentSortField={sortField}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Estado"
                      field="estado"
                      currentSortField={sortField}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
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
                          {socio.trabajador && (
                            <span
                              className="mt-1 ml-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700"
                              title={`Trabajador de feria ${socio.trabajador.codigo}${socio.trabajador.feria ? `: ${socio.trabajador.feria}` : ''}`}
                            >
                              Trabajador
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
                              onClick={(e) => alternarMenu(socio.id, e.currentTarget)}
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
                                <div
                                  className="fixed z-20 w-60 rounded-lg border border-neutral-200 bg-white shadow-lg"
                                  style={posicionMenu}
                                >
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
                                        if (socio.persona_id) navigate(`/ficha/${socio.persona_id}`)
                                      }}
                                      disabled={!socio.persona_id}
                                      title={socio.persona_id ? undefined : 'La cédula de este socio está pendiente de revisión'}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <Contact className="h-4 w-4 text-primary-600" />
                                      <span>Ficha completa</span>
                                    </button>
                                    {!socio.trabajador && socio.estado === 'activo' && (
                                      <button
                                        onClick={() => {
                                          setMenuAbiertoId(null)
                                          navigate(`/trabajadores?nuevo=1&cedula=${encodeURIComponent(socio.cedula)}`)
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                      >
                                        <HardHat className="h-4 w-4 text-purple-600" />
                                        <span>Registrar como trabajador</span>
                                      </button>
                                    )}
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
                                    {socio.estado !== 'retirado' && (
                                      <>
                                        <div className="my-1 border-t border-neutral-200" />
                                        <button
                                          onClick={() => abrirModalRetiro(socio)}
                                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                                        >
                                          <UserX className="h-4 w-4" />
                                          <span>Retirar socio</span>
                                        </button>
                                      </>
                                    )}
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
            {!loading && sociosFiltrados.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm text-gray-700">
                    Mostrando {(paginaActual - 1) * registrosPorPagina + 1} a{' '}
                    {Math.min(paginaActual * registrosPorPagina, totalRegistros)} de {totalRegistros} socios
                  </div>
                  <select
                    value={registrosPorPagina}
                    onChange={(e) => {
                      setRegistrosPorPagina(Number(e.target.value))
                      setPaginaActual(1)
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => setPaginaActual(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>

                  <div className="flex flex-wrap gap-1">
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
                        <Button
                          key={pageNum}
                          onClick={() => setPaginaActual(pageNum)}
                          variant={paginaActual === pageNum ? 'primary' : 'secondary'}
                          className="w-9 h-9 p-0"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    onClick={() => setPaginaActual(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/*
        En un telefono el modal ocupa la pantalla completa: con margenes y
        esquinas redondeadas se pierden ~40px de alto y otros tantos de ancho
        que hacen falta para el formulario.
      */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[100] m-0 flex items-stretch justify-center bg-neutral-900/40 backdrop-blur-sm sm:items-center sm:p-4">
          <Card
            padding="none"
            className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-none border-neutral-200 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl"
          >
            {/*
              La cabecera se comprime en movil: el titulo baja de tamano, la
              descripcion se oculta (es de ayuda, no de uso) y "Cerrar" pasa a
              ser un icono. Antes ocupaba una quinta parte de la pantalla y
              empujaba los campos fuera de la vista.
            */}
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-neutral-900 sm:text-2xl">
                  {modoEdicion ? `Editar socio ${socioSeleccionado?.codigo_socio ?? ''}` : 'Nuevo socio'}
                </h2>
                <p className="mt-1 hidden text-sm text-neutral-500 sm:block">
                  Completa los datos principales para que aparezcan en listados de ahorro y reportes.
                </p>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
                className="flex-shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-600 transition hover:bg-neutral-50 sm:px-3 sm:py-1.5"
              >
                <X className="h-4 w-4 sm:hidden" />
                <span className="hidden text-sm sm:inline">Cerrar</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5" onKeyDown={alEnter}>
              <div className="grid grid-cols-1 gap-5">
              {/* Fila 1: Datos principales + Foto */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Datos principales - Ocupa 2 columnas */}
                <div className={`${seccionClass} lg:col-span-2`}>
                  <p className={tituloSeccionClass}>Datos principales</p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    <span>Expediente *</span>
                    <input
                      value={formData.codigo_socio}
                      onChange={(e) => actualizarCampo('codigo_socio', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Cedula *</span>
                    <input
                      value={formData.cedula}
                      onChange={(e) => {
                        actualizarCampo('cedula', e.target.value.replace(/\D/g, ''))
                        setIdentificacion(null)
                      }}
                      onBlur={() => void consultarCedula()}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Nombres *</span>
                    <input
                      value={formData.nombre}
                      onChange={(e) => actualizarCampo('nombre', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Apellidos *</span>
                    <input
                      value={formData.apellido}
                      onChange={(e) => actualizarCampo('apellido', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Sexo</span>
                    <select
                      value={formData.sexo}
                      onChange={(e) => actualizarCampo('sexo', e.target.value)}
                      className={selectClass}
                    >
                      <option value="" className="text-neutral-500">Seleccionar...</option>
                      <option value="M" className="py-2">Masculino</option>
                      <option value="F" className="py-2">Femenino</option>
                    </select>
                  </label>

                  <label className={labelClass}>
                    <span>Telefono *</span>
                    <input
                      value={formData.telefono}
                      onChange={(e) => actualizarCampo('telefono', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Correo</span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => actualizarCampo('email', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Fecha ingreso</span>
                    <input
                      type="date"
                      value={formData.fecha_inscripcion}
                      onChange={(e) => actualizarCampo('fecha_inscripcion', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Fecha nacimiento</span>
                    <input
                      type="date"
                      value={formData.fecha_nacimiento}
                      onChange={(e) => actualizarCampo('fecha_nacimiento', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={`${labelClass} sm:col-span-2`}>
                    <span>Direccion</span>
                    <input
                      value={formData.direccion}
                      onChange={(e) => actualizarCampo('direccion', e.target.value)}
                      className={controlClass}
                    />
                  </label>
                  </div>

                  {identificacion && !modoEdicion && (identificacion.persona || identificacion.socios_sin_persona.length > 0) && (
                    <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
                      <p className="font-medium">
                        {identificacion.persona
                          ? `Persona ya registrada: ${identificacion.persona.nombres} ${identificacion.persona.apellidos}. Se completan sus datos.`
                          : 'Esta cedula ya tiene expedientes de socio.'}
                      </p>
                      <p>{resumenExpedientes(identificacion)}</p>
                    </div>
                  )}
                  {identificacion && !modoEdicion && identificacion.advertencias_ahorrista.map((aviso) => (
                    <p key={aviso} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      {aviso}
                    </p>
                  ))}
                </div>

              {/* Sección de foto - Ocupa 1 columna */}
              <div className={seccionClass}>
                <p className={tituloSeccionClass}>Fotografía del socio</p>
                
                <div className="flex flex-col items-center gap-4">
                  {fotoPreview ? (
                    <div className="relative">
                      <img 
                        src={fotoPreview} 
                        alt="Foto del socio" 
                        className="h-32 w-32 rounded-lg object-cover border-2 border-neutral-200"
                      />
                      <button
                        type="button"
                        onClick={eliminarFoto}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-on-accent hover:bg-red-600 transition"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-100">
                      <svg className="h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  
                  <label className="cursor-pointer">
                    <span className="rounded-lg border border-primary-400 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 transition inline-block">
                      {fotoPreview ? 'Cambiar foto' : 'Seleccionar foto'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={manejarCambioFoto}
                      className="hidden"
                    />
                  </label>
                  
                  <p className="text-xs text-neutral-500 text-center">
                    Formatos: JPG, PNG, GIF. Máximo 2MB
                  </p>
                </div>
              </div>
              </div>
              </div>

            {/* Fila 2: Control interno - Full width */}
            <div className={seccionClass}>
                <p className={tituloSeccionClass}>Control interno y autorizacion</p>

                <label className={labelClass}>
                  <span>Feria *</span>
                  <select
                    value={formData.ubicacion_id ?? ''}
                    onChange={(e) =>
                      actualizarCampo('ubicacion_id', e.target.value ? Number(e.target.value) : null)
                    }
                    className={selectClass}
                  >
                    <option value="" className="text-neutral-500">Seleccione una feria</option>
                    {ubicaciones.map((ubicacion) => (
                      <option key={ubicacion.id} value={ubicacion.id} className="py-2">
                        {nombreFeria(ubicacion)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    <span>Autorizado por</span>
                    <input
                      value={formData.autorizado_nombre}
                      onChange={(e) => actualizarCampo('autorizado_nombre', e.target.value)}
                      className={controlClass}
                    />
                  </label>

                  <label className={labelClass}>
                    <span>Cedula autorizado</span>
                    <input
                      value={formData.autorizado_cedula}
                      onChange={(e) => actualizarCampo('autorizado_cedula', e.target.value.replace(/\D/g, ''))}
                      className={controlClass}
                    />
                  </label>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:border-primary-300">
                  <input
                    type="checkbox"
                    checked={formData.es_delegado}
                    onChange={(e) => actualizarCampo('es_delegado', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium text-neutral-800">Es delegado</span>
                    <span className="block text-xs text-neutral-500">
                      Representa a su feria ante la cooperativa. Se muestra en el listado de socios.
                    </span>
                  </span>
                </label>

                <label className={labelClass}>
                  <span>Historial / notas</span>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => actualizarCampo('notas', e.target.value)}
                    rows={4}
                    className={`${controlClass} resize-y`}
                    placeholder="Suspensiones, observaciones, acuerdos internos..."
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
              {errorFormulario && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorFormulario}
                </div>
              )}

              {/*
                En movil los botones ocupan el ancho completo y se apilan con
                `flex-col-reverse`, que deja Guardar arriba y Cancelar debajo
                sin alterar el orden del DOM: en escritorio la fila sigue
                siendo Cancelar a la izquierda y Guardar a la derecha.
              */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setModalAbierto(false)}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button onClick={guardarSocio} className="w-full sm:w-auto">
                  {modoEdicion ? 'Actualizar socio' : 'Guardar socio'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {modalRetiroAbierto && socioParaRetiro && (
        <div className="fixed top-0 left-0 right-0 bottom-0 m-0 z-[100] flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-lg border-neutral-200 my-8">
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
              <label className={labelClass}>
                <span>Fecha del retiro</span>
                <input
                  type="date"
                  value={formRetiro.fecha_retiro}
                  onChange={(e) => setFormRetiro((prev) => ({ ...prev, fecha_retiro: e.target.value }))}
                  className={controlClass}
                />
              </label>

              <label className={labelClass}>
                <span>Motivo</span>
                <select
                  value={formRetiro.motivo_retiro}
                  onChange={(e) =>
                    setFormRetiro((prev) => ({
                      ...prev,
                      motivo_retiro: e.target.value as RetiroSocioFormData['motivo_retiro'],
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">Seleccione un motivo...</option>
                  {MOTIVOS_RETIRO.map((motivo) => (
                    <option key={motivo.value} value={motivo.value}>
                      {motivo.label}
                    </option>
                  ))}
                </select>
              </label>

              {descripcionMotivoRetiro && (
                <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  {descripcionMotivoRetiro}
                </p>
              )}

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
        <div className="fixed top-0 left-0 right-0 bottom-0 m-0 z-[100] flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto border-neutral-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">Detalle del socio</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Vista de solo lectura sin posibilidad de edición.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {socioDetalle.persona_id && (
                  <button
                    onClick={() => navigate(`/ficha/${socioDetalle.persona_id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                  >
                    <Contact className="h-4 w-4" />
                    Ficha completa
                  </button>
                )}
                <button
                  onClick={() => setModalDetalleAbierto(false)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Foto del socio */}
            {socioDetalle.foto && (
              <div className="mt-4 flex justify-center">
                <div className="rounded-xl border-2 border-neutral-200 bg-white p-2">
                  <img 
                    src={socioDetalle.foto} 
                    alt={`Foto de ${socioDetalle.nombre} ${socioDetalle.apellido}`}
                    className="h-40 w-40 rounded-lg object-cover"
                  />
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={seccionClass}>
                <p className={tituloSeccionClass}>Identificación</p>
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

              <div className={seccionClass}>
                <p className={tituloSeccionClass}>Contacto y ubicación</p>
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

              <div className={seccionClass}>
                <p className={tituloSeccionClass}>Autorización y notas</p>
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

              <div className={seccionClass}>
                <p className={tituloSeccionClass}>Relaciones registradas</p>
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
