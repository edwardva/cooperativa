/**
 * ============================================
 * PAGE: SALUD
 * ============================================
 * Gestión de acuerdos de salud: hasta 9 personas (titular + 8 beneficiarios)
 * comparten un mismo número de acuerdo y una sola cuota familiar. Suspender
 * o reactivar por falta de pago aplica a todo el grupo a la vez; retirar
 * aplica a una sola persona.
 */


import { useEffect, useMemo, useState } from 'react';
import { PrintableFichaAcuerdo } from '../components/print/PrintableFichaAcuerdo';
import type { PrintableFichaAcuerdoProps } from '../components/print/PrintableFichaAcuerdo';
import { PrintableListadoGrupos } from '../components/print/PrintableListadoGrupos';
import { SortableHeader } from '../components/ui/SortableHeader';


import {
  PlusCircle,
  Search,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  HeartPulse,
  ShieldOff,
  MoreVertical,
  MoreHorizontal,
  Eye,
  Printer,
  FileSpreadsheet,
  FileDown,
  UserPlus,
  UserMinus,
  Edit2,
  Trash2,
  Skull,
  ArrowRight,
  ArrowLeft,
  ArrowRightLeft,
  Wallet,
  X,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { ActionMenu } from '../components/ui/ActionMenu'
import type { ActionMenuItem } from '../components/ui/ActionMenu'
import * as saludService from '../services/saludService'
import * as sociosService from '../services/sociosService'
import * as funerariaService from '../services/funerariaService'
import * as feriasService from '../services/feriasService'
import * as ahorroService from '../services/ahorroService'
import type {
  AcuerdoSalud,
  TipoAcuerdo,
  GrupoSalud,
  MiembroGrupoSalud,
  BeneficiarioGrupoInput,
  SuspendidoSalud,
} from '../services/saludService'
import type { Socio } from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { formatearFecha, calcularEdad } from '../utils/formatters'
import { usePermissions } from '../store/authStore'

type Tab = 'activo' | 'suspendido' | 'retirado' | 'todos'

/** Datos mínimos necesarios para abrir el modal de retiro individual. */
type RetiroCandidato = {
  id: number
  numero_acuerdo: string | null
  estado: string
  beneficiario: { cedula: string; nombre_completo: string }
}

/** Forma mínima que necesita abrirCambiarEstado; AcuerdoSalud y GrupoSalud.titular la cumplen. */
type CambiarEstadoCandidato = {
  id: number
  numero_acuerdo: string | null
  socio: { nombre_completo: string } | null
}

const MAX_BENEFICIARIOS_POR_GRUPO = 8

const hoyISO = (): string => new Date().toISOString().split('T')[0] ?? ''

const emptyBeneficiarioGrupoForm = (): BeneficiarioGrupoInput => ({
  cedula: '',
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  fecha_ingreso: hoyISO(),
  parentesco: '',
  estado: 'activo',
  telefono: '',
})

/** Mini-formulario "buscar por número" reutilizado en los modales de Eliminar, Retirar, Pagos y Traspaso. */
function BuscarPorNumeroInline({
  label,
  value,
  onChange,
  onBuscar,
  buscando,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBuscar: () => void
  buscando: boolean
  autoFocus?: boolean
}) {
  return (
    <div className="flex gap-2">
      <Input
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onBuscar()}
        className="flex-1"
        autoFocus={autoFocus}
      />
      <Button onClick={onBuscar} isLoading={buscando} className="self-end">
        <Search className="w-4 h-4" />
      </Button>
    </div>
  )
}

/** Tarjeta resumen de socio/grupo reutilizada en varios modales de Salud. */
function ResumenSocioCard({ nombre, detalle }: { nombre: string; detalle: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-sm font-semibold text-neutral-900">{nombre}</p>
      <p className="text-xs text-neutral-500">{detalle}</p>
    </div>
  )
}

export default function SaludPage() {
  const { hasPermission } = usePermissions()
  const puedeEscribir = hasPermission('salud', 'create') || hasPermission('salud', 'update')
  const puedeEliminar = hasPermission('salud', 'delete')

  // ============================================
  // DATOS Y FILTROS
  // ============================================
  const [acuerdos, setAcuerdos] = useState<AcuerdoSalud[]>([])
  const [tiposAcuerdo, setTiposAcuerdo] = useState<TipoAcuerdo[]>([])
  const [estadisticas, setEstadisticas] = useState({
    total_acuerdos: 0,
    activos: 0,
    suspendidos: 0,
    retirados: 0,
    proximos_suspender: 0,
    sin_derecho_servicio: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState<Tab>('activo')
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [itemsPorPagina, setItemsPorPagina] = useState(5)



  // Ordenamiento
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Función para manejar el ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Modales
  //const [modalAbierto, setModalAbierto] = useState<'crear' | 'detalle' | 'cambiar-estado' | null>(
 //   null
  //);
//  const [_acuerdoSeleccionado, setAcuerdoSeleccionado] = useState<AcuerdoSalud | null>(null);

  // Menú de acciones por fila (Radix ActionMenu, ver components/ui/ActionMenu)
  const [imprimiendoFilaId, setImprimiendoFilaId] = useState<number | null>(null)

  // ============================================
  // CARGA DE DATOS
  // ============================================
  const cargarEstadisticas = async () => {
    try {
      const response = await saludService.obtenerEstadisticas()
      if (response.success && response.data) {
        const data = response.data
        setEstadisticas({
          total_acuerdos: data.total_acuerdos || 0,
          activos: data.por_estado?.activos || 0,
          suspendidos: data.por_estado?.suspendidos || 0,
          retirados: data.por_estado?.retirados || 0,
          proximos_suspender: data.alertas?.proximos_suspender || 0,
          sin_derecho_servicio: data.alertas?.sin_derecho_servicio || 0,
        })
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err)
    }
  }

  const cargarAcuerdos = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {
        page: paginaActual,
        limit: itemsPorPagina,
        ...(tab !== 'todos' && { estado: tab }),
        ...(busqueda && { buscar: busqueda }),
      }

      const response = await saludService.obtenerAcuerdos(params)
      if (response.success && response.data) {
        setAcuerdos(response.data)
        setTotalRegistros(response.meta?.total || 0)
        setTotalPaginas(response.meta?.totalPages || 1)
      }
    } catch (err) {
      setError(getErrorMessage(err))
      setAcuerdos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargarEstadisticas()
    void (async () => {
      const respuesta = await saludService.obtenerTiposAcuerdo()
      if (respuesta.success) setTiposAcuerdo(respuesta.data)
    })()
  }, [])

  useEffect(() => {
    void cargarAcuerdos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual, busqueda, tab, itemsPorPagina])

  // ============================================
  // WIZARD: NUEVO ACUERDO (titular + beneficiarios en un solo paso)
  // ============================================
  const [wizardAbierto, setWizardAbierto] = useState(false)
  const [wizardPaso, setWizardPaso] = useState<1 | 2 | 3>(1)
  const [wizardExpediente, setWizardExpediente] = useState('')
  const [wizardBuscando, setWizardBuscando] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [wizardSocio, setWizardSocio] = useState<Socio | null>(null)
  const [wizardTipoAcuerdoId, setWizardTipoAcuerdoId] = useState<number | ''>('')
  const [wizardNumeroAcuerdo, setWizardNumeroAcuerdo] = useState('')
  const [wizardNumeroContrato, setWizardNumeroContrato] = useState('')
  const [wizardFechaInicio, setWizardFechaInicio] = useState(hoyISO())
  const [wizardBeneficiarios, setWizardBeneficiarios] = useState<BeneficiarioGrupoInput[]>([])
  const [wizardBenefForm, setWizardBenefForm] = useState<BeneficiarioGrupoInput>(emptyBeneficiarioGrupoForm())
  const [wizardBenefError, setWizardBenefError] = useState<string | null>(null)
  const [wizardEnviando, setWizardEnviando] = useState(false)

  const cerrarWizard = () => {
    setWizardAbierto(false)
    setWizardPaso(1)
    setWizardExpediente('')
    setWizardError(null)
    setWizardSocio(null)
    setWizardTipoAcuerdoId('')
    setWizardNumeroAcuerdo('')
    setWizardNumeroContrato('')
    setWizardFechaInicio(hoyISO())
    setWizardBeneficiarios([])
    setWizardBenefForm(emptyBeneficiarioGrupoForm())
    setWizardBenefError(null)
  }

  const buscarSocioWizard = async () => {
    if (!wizardExpediente.trim()) return
    setWizardBuscando(true)
    setWizardError(null)
    try {
      const respuesta = await sociosService.buscarSocioPorExpediente(wizardExpediente.trim())
      if (!respuesta.success || !respuesta.data) throw new Error('Socio no encontrado')
      const socio = respuesta.data

      // La misma regla de negocio que valida el backend al crear el grupo
      // (el socio necesita una cuenta de ahorro activa), pero verificada acá
      // para avisar de inmediato en el paso 1 y no dejar que el usuario
      // complete todo el wizard para recién enterarse en el paso 3.
      const respuestaCuentas = await ahorroService.obtenerCuentasPorSocio(socio.id)
      const tieneCuentaActiva =
        respuestaCuentas.success && respuestaCuentas.data.cuentas.some((c) => c.estado)
      if (!tieneCuentaActiva) {
        setWizardError(
          `El socio con expediente ${socio.codigo_socio} (cédula ${socio.cedula}) no tiene ninguna cuenta de ahorro activa registrada. Debe tener al menos una cuenta de ahorro activa para acceder al beneficio de salud.`
        )
        return
      }

      setWizardSocio(socio)
      setWizardPaso(2)
    } catch (err) {
      setWizardError(getErrorMessage(err) || 'Socio no encontrado')
    } finally {
      setWizardBuscando(false)
    }
  }

  const wizardBenefFormValido =
    wizardBenefForm.cedula.trim() !== '' &&
    wizardBenefForm.nombre.trim() !== '' &&
    wizardBenefForm.apellido.trim() !== '' &&
    wizardBenefForm.parentesco.trim() !== '' &&
    wizardBenefForm.fecha_nacimiento.trim() !== '' &&
    wizardBenefForm.fecha_ingreso.trim() !== ''

  const agregarBeneficiarioAWizard = () => {
    if (!wizardBenefFormValido) {
      setWizardBenefError('Completa cédula, nombre, apellido, parentesco, fecha de nacimiento y fecha de ingreso.')
      return
    }
    if (wizardBeneficiarios.length >= MAX_BENEFICIARIOS_POR_GRUPO) {
      setWizardBenefError('Ya agregaste el máximo de 8 beneficiarios (9 personas en total con el titular).')
      return
    }
    if (wizardBeneficiarios.some((b) => b.cedula === wizardBenefForm.cedula)) {
      setWizardBenefError('Ya agregaste un beneficiario con esa cédula.')
      return
    }
    setWizardBeneficiarios((prev) => [...prev, wizardBenefForm])
    setWizardBenefForm(emptyBeneficiarioGrupoForm())
    setWizardBenefError(null)
  }

  const quitarBeneficiarioDeWizard = (cedula: string) => {
    setWizardBeneficiarios((prev) => prev.filter((b) => b.cedula !== cedula))
  }

  const wizardPaso2Valido = Boolean(wizardTipoAcuerdoId) && wizardNumeroAcuerdo.trim() !== '' && wizardFechaInicio.trim() !== ''

  const confirmarNuevoAcuerdo = async () => {
    if (!wizardSocio || !wizardTipoAcuerdoId || !wizardNumeroAcuerdo.trim()) return

    setWizardEnviando(true)
    setWizardError(null)

    try {
      const respuesta = await saludService.crearGrupoAcuerdo({
        socio_id: wizardSocio.id,
        tipo_acuerdo_id: wizardTipoAcuerdoId,
        numero_acuerdo: wizardNumeroAcuerdo.trim(),
        numero_contrato: wizardNumeroContrato.trim() || undefined,
        fecha_inicio: new Date(wizardFechaInicio).toISOString(),
        beneficiarios: wizardBeneficiarios,
      })

      if (!respuesta.success) throw new Error('No fue posible crear el acuerdo')

      cerrarWizard()
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      window.alert('Acuerdo de salud creado exitosamente')
    } catch (err) {
      setWizardError(getErrorMessage(err))
    } finally {
      setWizardEnviando(false)
    }
  }

  // ============================================
  // MODAL: GRUPO (Modificar / detalle)
  // ============================================
  const [grupoModalAbierto, setGrupoModalAbierto] = useState(false)
  const [grupoCargando, setGrupoCargando] = useState(false)
  const [grupoActual, setGrupoActual] = useState<GrupoSalud | null>(null)
  const [imprimiendoFicha, setImprimiendoFicha] = useState(false)
  const [fichaParaImprimir, setFichaParaImprimir] = useState<PrintableFichaAcuerdoProps | null>(null)

  // ============================================
  // MODAL: LISTADO POR TIPO (Imprimir listado / Acuerdos en Excel)
  // ============================================
  const [modoListadoModal, setModoListadoModal] = useState<'pdf' | 'excel' | null>(null)
  const [tipoListadoSeleccionado, setTipoListadoSeleccionado] = useState<saludService.TipoListadoSalud>('activos')
  const [procesandoListado, setProcesandoListado] = useState(false)
  const [listadoSinDatosMensaje, setListadoSinDatosMensaje] = useState<string | null>(null)
  const [gruposParaImprimir, setGruposParaImprimir] = useState<{
    tipo: saludService.TipoListadoSalud
    grupos: saludService.GrupoSalud[]
  } | null>(null)

  const ETIQUETAS_TIPO_LISTADO: Record<saludService.TipoListadoSalud, string> = {
    activos: 'socios activos',
    suspendidos: 'socios suspendidos',
    proximos_suspender: 'socios próximos a suspender',
  }

  const abrirModalListado = (modo: 'pdf' | 'excel') => {
    setTipoListadoSeleccionado('activos')
    setListadoSinDatosMensaje(null)
    setModoListadoModal(modo)
  }

  const cambiarTipoListado = (tipo: saludService.TipoListadoSalud) => {
    setTipoListadoSeleccionado(tipo)
    setListadoSinDatosMensaje(null)
  }

  const confirmarImprimirListado = async () => {
    setProcesandoListado(true)
    setListadoSinDatosMensaje(null)
    try {
      // Antes de imprimir o descargar se valida que la selección tenga
      // resultados: evita generar un PDF/Excel vacío y, en el caso del PDF,
      // una última página en blanco cuando no hay ni un solo grupo que imprimir.
      const respuesta = await saludService.listarGruposPorTipo(tipoListadoSeleccionado)
      if (!respuesta.success) throw new Error('No fue posible obtener el listado')

      if (respuesta.data.length === 0) {
        setListadoSinDatosMensaje(`No hay registros de ${ETIQUETAS_TIPO_LISTADO[tipoListadoSeleccionado]} para mostrar.`)
        return
      }

      if (modoListadoModal === 'excel') {
        await saludService.descargarReporteGrupos(tipoListadoSeleccionado)
        setModoListadoModal(null)
      } else {
        setModoListadoModal(null)
        setGruposParaImprimir({ tipo: tipoListadoSeleccionado, grupos: respuesta.data })
      }
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setProcesandoListado(false)
    }
  }

  // Se dispara solo cuando hay un listado agrupado listo: espera a que React
  // monte PrintableListadoGrupos con los datos antes de abrir el diálogo de impresión.
  useEffect(() => {
    if (!gruposParaImprimir) return
    window.print()
    const limpiar = () => setGruposParaImprimir(null)
    window.addEventListener('afterprint', limpiar, { once: true })
    return () => window.removeEventListener('afterprint', limpiar)
  }, [gruposParaImprimir])

  const abrirGrupo = async (numeroAcuerdo: string) => {
    setGrupoModalAbierto(true)
    setGrupoCargando(true)
    setGrupoActual(null)
    try {
      const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(numeroAcuerdo)
      if (!respuesta.success) throw new Error('No fue posible cargar el acuerdo')
      setGrupoActual(respuesta.data)
    } catch (err) {
      window.alert(getErrorMessage(err))
      setGrupoModalAbierto(false)
    } finally {
      setGrupoCargando(false)
    }
  }

  const recargarGrupoActual = async () => {
    if (!grupoActual?.numero_acuerdo) return
    const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(grupoActual.numero_acuerdo)
    if (respuesta.success) setGrupoActual(respuesta.data)
  }

  const abrirDetalle = (acuerdo: AcuerdoSalud) => {
    if (acuerdo.numero_acuerdo) {
      void abrirGrupo(acuerdo.numero_acuerdo)
    } else {
      window.alert(
        'Este acuerdo proviene de una importación desde Funeraria y no tiene número de acuerdo asignado. Use "Editar" en Socios > Beneficiarios para modificar sus datos personales.'
      )
    }
  }

  const gruposBeneficiariosVisibles = grupoActual?.beneficiarios || []
  // El tope de 9 personas (titular + 8) solo cuenta miembros vigentes; los
  // retirados del acuerdo liberan su cupo, igual que en el backend.
  const grupoMiembrosVigentes =
    (grupoActual?.titular && grupoActual.titular.estado_acuerdo !== 'retirado' ? 1 : 0) +
    gruposBeneficiariosVisibles.filter((b) => b.estado_acuerdo !== 'retirado').length
  const grupoLimiteAlcanzado = grupoMiembrosVigentes >= MAX_BENEFICIARIOS_POR_GRUPO + 1

  // ============================================
  // MODAL: BENEFICIARIO (agregar / editar, dentro del grupo)
  // ============================================
  const [beneficiarioModalAbierto, setBeneficiarioModalAbierto] = useState(false)
  const [beneficiarioEditando, setBeneficiarioEditando] = useState<MiembroGrupoSalud | null>(null)
  const [beneficiarioForm, setBeneficiarioForm] = useState<BeneficiarioGrupoInput>(emptyBeneficiarioGrupoForm())
  const [beneficiarioEnviando, setBeneficiarioEnviando] = useState(false)
  const [beneficiarioError, setBeneficiarioError] = useState<string | null>(null)

  const abrirNuevoBeneficiarioGrupo = () => {
    setBeneficiarioEditando(null)
    setBeneficiarioForm(emptyBeneficiarioGrupoForm())
    setBeneficiarioError(null)
    setBeneficiarioModalAbierto(true)
  }

  const abrirEditarBeneficiarioGrupo = (miembro: MiembroGrupoSalud) => {
    setBeneficiarioEditando(miembro)
    setBeneficiarioForm({
      cedula: miembro.cedula,
      nombre: miembro.nombre,
      apellido: miembro.apellido,
      fecha_nacimiento: miembro.fecha_nacimiento?.split('T')[0] || '',
      fecha_ingreso: miembro.fecha_ingreso?.split('T')[0] || '',
      parentesco: miembro.parentesco,
      telefono: miembro.telefono || '',
    })
    setBeneficiarioError(null)
    setBeneficiarioModalAbierto(true)
  }

  const beneficiarioFormularioValido =
    beneficiarioForm.cedula.trim() !== '' &&
    beneficiarioForm.nombre.trim() !== '' &&
    beneficiarioForm.apellido.trim() !== '' &&
    beneficiarioForm.parentesco.trim() !== '' &&
    beneficiarioForm.fecha_nacimiento.trim() !== '' &&
    beneficiarioForm.fecha_ingreso.trim() !== ''

  const guardarBeneficiarioGrupo = async () => {
    if (!grupoActual?.numero_acuerdo) return
    if (!beneficiarioFormularioValido) {
      setBeneficiarioError('Completa todos los campos obligatorios.')
      return
    }

    setBeneficiarioEnviando(true)
    setBeneficiarioError(null)

    try {
      if (beneficiarioEditando) {
        const socioId = grupoActual.socio?.id
        if (!socioId) throw new Error('No se encontró el socio del acuerdo')
        await sociosService.actualizarBeneficiario(socioId, beneficiarioEditando.beneficiario_id, beneficiarioForm)
      } else {
        await saludService.agregarBeneficiarioAGrupo(grupoActual.numero_acuerdo, beneficiarioForm)
      }
      setBeneficiarioModalAbierto(false)
      await Promise.all([recargarGrupoActual(), cargarAcuerdos(), cargarEstadisticas()])
    } catch (err) {
      setBeneficiarioError(getErrorMessage(err))
    } finally {
      setBeneficiarioEnviando(false)
    }
  }

  const marcarFallecidoGrupo = async (miembro: MiembroGrupoSalud) => {
    const socioId = grupoActual?.socio?.id
    if (!socioId) return
    const confirmado = window.confirm(`¿Marcar a ${miembro.nombre} ${miembro.apellido} como fallecido?`)
    if (!confirmado) return

    try {
      await sociosService.actualizarBeneficiario(socioId, miembro.beneficiario_id, {
        estado: 'fallecido',
        fecha_fallecimiento: hoyISO(),
      })
      await Promise.all([recargarGrupoActual(), cargarAcuerdos()])
    } catch (err) {
      window.alert(getErrorMessage(err))
    }
  }

  const eliminarMiembroGrupo = async (miembro: MiembroGrupoSalud) => {
    const confirmado = window.confirm(
      `¿Eliminar definitivamente a ${miembro.nombre} ${miembro.apellido} de este acuerdo de salud? Solo se permite si no tiene pagos registrados.`
    )
    if (!confirmado) return

    try {
      const respuesta = await saludService.eliminarAcuerdo(miembro.acuerdo_id)
      if (!respuesta.success) throw new Error('No fue posible eliminar')
      await Promise.all([recargarGrupoActual(), cargarAcuerdos(), cargarEstadisticas()])
    } catch (err) {
      window.alert(getErrorMessage(err))
    }
  }

  // ============================================
  // MODAL: ELIMINAR ACUERDO COMPLETO
  // ============================================
  const [eliminarModalAbierto, setEliminarModalAbierto] = useState(false)
  const [eliminarNumeroAcuerdo, setEliminarNumeroAcuerdo] = useState('')
  const [eliminarBuscando, setEliminarBuscando] = useState(false)
  const [eliminarError, setEliminarError] = useState<string | null>(null)
  const [eliminarGrupoData, setEliminarGrupoData] = useState<GrupoSalud | null>(null)
  const [eliminarSeleccionados, setEliminarSeleccionados] = useState<number[]>([])
  const [eliminarEnviando, setEliminarEnviando] = useState(false)

  const abrirEliminarModal = () => {
    setEliminarModalAbierto(true)
    setEliminarNumeroAcuerdo('')
    setEliminarError(null)
    setEliminarGrupoData(null)
    setEliminarSeleccionados([])
  }

  const buscarGrupoParaEliminar = async () => {
    if (!eliminarNumeroAcuerdo.trim()) return
    setEliminarBuscando(true)
    setEliminarError(null)
    setEliminarGrupoData(null)
    setEliminarSeleccionados([])
    try {
      const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(eliminarNumeroAcuerdo.trim())
      if (!respuesta.success) throw new Error('Acuerdo no encontrado')
      setEliminarGrupoData(respuesta.data)
    } catch (err) {
      setEliminarError(getErrorMessage(err) || 'Acuerdo no encontrado')
    } finally {
      setEliminarBuscando(false)
    }
  }

  const alternarSeleccionEliminar = (acuerdoId: number) => {
    setEliminarSeleccionados((prev) =>
      prev.includes(acuerdoId) ? prev.filter((id) => id !== acuerdoId) : [...prev, acuerdoId]
    )
  }

  const eliminarSeleccionadosAccion = async () => {
    if (eliminarSeleccionados.length === 0) return
    const confirmado = window.confirm(`¿Eliminar ${eliminarSeleccionados.length} beneficiario(s) seleccionado(s)?`)
    if (!confirmado) return

    setEliminarEnviando(true)
    setEliminarError(null)
    try {
      for (const id of eliminarSeleccionados) {
        await saludService.eliminarAcuerdo(id)
      }
      setEliminarModalAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
    } catch (err) {
      setEliminarError(getErrorMessage(err))
    } finally {
      setEliminarEnviando(false)
    }
  }

  const eliminarCompletoAccion = async () => {
    if (!eliminarGrupoData?.numero_acuerdo) return
    const confirmado = window.confirm(
      `¿Eliminar por completo el acuerdo ${eliminarGrupoData.numero_acuerdo}? Esto elimina a las ${eliminarGrupoData.total_personas} persona(s) del acuerdo. Solo se permite si no tienen pagos registrados.`
    )
    if (!confirmado) return

    setEliminarEnviando(true)
    setEliminarError(null)
    try {
      const respuesta = await saludService.eliminarGrupoAcuerdo(eliminarGrupoData.numero_acuerdo)
      if (!respuesta.success) throw new Error('No fue posible eliminar el acuerdo')
      setEliminarModalAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
    } catch (err) {
      setEliminarError(getErrorMessage(err))
    } finally {
      setEliminarEnviando(false)
    }
  }

  // ============================================
  // MODAL: BUSCAR
  // ============================================
  const [buscarModalAbierto, setBuscarModalAbierto] = useState(false)
  const [buscarInput, setBuscarInput] = useState('')
  const [buscarBuscando, setBuscarBuscando] = useState(false)
  const [buscarError, setBuscarError] = useState<string | null>(null)

  const abrirBuscarModal = () => {
    setBuscarModalAbierto(true)
    setBuscarInput('')
    setBuscarError(null)
  }

  const ejecutarBusqueda = async () => {
    const valor = buscarInput.trim()
    if (!valor) return

    setBuscarBuscando(true)
    setBuscarError(null)

    try {
      const porNumeroAcuerdo = await saludService.obtenerGrupoPorNumeroAcuerdo(valor)
      if (porNumeroAcuerdo.success) {
        setBuscarModalAbierto(false)
        setGrupoModalAbierto(true)
        setGrupoActual(porNumeroAcuerdo.data)
        return
      }
    } catch {
      // Continúa intentando por expediente
    }

    try {
      const socio = await sociosService.buscarSocioPorExpediente(valor)
      if (!socio.success || !socio.data) throw new Error('No se encontró ningún acuerdo o expediente con ese dato')

      const acuerdosSocio = await saludService.obtenerAcuerdosPorSocio(socio.data.id)
      const conNumero = acuerdosSocio.success ? acuerdosSocio.data.find((a) => a.numero_acuerdo) : undefined

      if (!conNumero?.numero_acuerdo) {
        throw new Error('Este socio no tiene ningún acuerdo de salud con número asignado')
      }

      setBuscarModalAbierto(false)
      await abrirGrupo(conNumero.numero_acuerdo)
    } catch (err) {
      setBuscarError(getErrorMessage(err) || 'No se encontró ningún acuerdo o expediente con ese dato')
    } finally {
      setBuscarBuscando(false)
    }
  }

  // ============================================
  // MODAL: RETIRAR ACUERDOS (retiro individual)
  // ============================================
  const [retirarAbierto, setRetirarAbierto] = useState(false)
  const [retirarExpediente, setRetirarExpediente] = useState('')
  const [retirarBuscando, setRetirarBuscando] = useState(false)
  const [retirarError, setRetirarError] = useState<string | null>(null)
  const [retirarSocioActual, setRetirarSocioActual] = useState<Socio | null>(null)
  const [retirarOpciones, setRetirarOpciones] = useState<AcuerdoSalud[]>([])
  const [retirarSeleccionado, setRetirarSeleccionado] = useState<RetiroCandidato | null>(null)
  const [retirarFecha, setRetirarFecha] = useState(hoyISO())
  const [retirarMotivo, setRetirarMotivo] = useState<(typeof saludService.MOTIVOS_RETIRO_SALUD)[number]>('Voluntario')
  const [retirarEnviando, setRetirarEnviando] = useState(false)

  // ============================================
  // MODAL: RETIRAR ACUERDO (titular + cascada a todo el grupo)
  // ============================================
  const [retirarTitularAbierto, setRetirarTitularAbierto] = useState(false)
  const [retirarTitularAcuerdo, setRetirarTitularAcuerdo] = useState<AcuerdoSalud | null>(null)
  const [retirarTitularFecha, setRetirarTitularFecha] = useState(hoyISO())
  const [retirarTitularMotivo, setRetirarTitularMotivo] = useState<(typeof saludService.MOTIVOS_RETIRO_SALUD)[number]>('Voluntario')
  const [retirarTitularEnviando, setRetirarTitularEnviando] = useState(false)
  const [retirarTitularError, setRetirarTitularError] = useState<string | null>(null)

  const abrirRetirarTitularModal = (acuerdo: AcuerdoSalud) => {
    setRetirarTitularAbierto(true)
    setRetirarTitularAcuerdo(acuerdo)
    setRetirarTitularFecha(hoyISO())
    setRetirarTitularMotivo('Voluntario')
    setRetirarTitularError(null)
  }

  const confirmarRetirarTitular = async () => {
    if (!retirarTitularAcuerdo || !retirarTitularFecha) return
    setRetirarTitularEnviando(true)
    setRetirarTitularError(null)
    try {
      const respuesta = await saludService.cambiarEstado(retirarTitularAcuerdo.id, {
        estado: 'retirado',
        fecha_retiro: retirarTitularFecha,
        motivo_retiro: retirarTitularMotivo,
      })
      if (!respuesta.success) throw new Error('No fue posible retirar el acuerdo')
      setRetirarTitularAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      if (grupoModalAbierto) await recargarGrupoActual()
    } catch (err) {
      setRetirarTitularError(getErrorMessage(err))
    } finally {
      setRetirarTitularEnviando(false)
    }
  }

  const abrirRetirarModal = () => {
    setRetirarAbierto(true)
    setRetirarExpediente('')
    setRetirarError(null)
    setRetirarSocioActual(null)
    setRetirarOpciones([])
    setRetirarSeleccionado(null)
    setRetirarFecha(hoyISO())
    setRetirarMotivo('Voluntario')
  }

  const abrirRetirarDirecto = (acuerdo: RetiroCandidato) => {
    setRetirarAbierto(true)
    setRetirarError(null)
    setRetirarSocioActual(null)
    setRetirarOpciones([])
    setRetirarSeleccionado(acuerdo)
    setRetirarFecha(hoyISO())
    setRetirarMotivo('Voluntario')
  }

  const buscarParaRetirar = async () => {
    if (!retirarExpediente.trim()) return
    setRetirarBuscando(true)
    setRetirarError(null)
    setRetirarSocioActual(null)
    setRetirarOpciones([])
    setRetirarSeleccionado(null)

    try {
      const socio = await sociosService.buscarSocioPorExpediente(retirarExpediente.trim())
      if (!socio.success || !socio.data) throw new Error('Socio no encontrado')
      setRetirarSocioActual(socio.data)

      const acuerdosSocio = await saludService.obtenerAcuerdosPorSocio(socio.data.id)
      if (!acuerdosSocio.success) throw new Error('No fue posible obtener los acuerdos del socio')

      const opciones = acuerdosSocio.data.filter(
        (a) => a.beneficiario.parentesco.trim().toLowerCase() !== 'titular' && a.estado !== 'retirado'
      )
      setRetirarOpciones(opciones)
    } catch (err) {
      setRetirarError(getErrorMessage(err) || 'Socio no encontrado')
    } finally {
      setRetirarBuscando(false)
    }
  }

  const confirmarRetiro = async () => {
    if (!retirarSeleccionado || !retirarFecha) return

    setRetirarEnviando(true)
    setRetirarError(null)
    try {
      const respuesta = await saludService.retirarBeneficiario(retirarSeleccionado.id, {
        fecha_retiro: retirarFecha,
        motivo_retiro: retirarMotivo,
      })
      if (!respuesta.success) throw new Error('No fue posible retirar al beneficiario')

      setRetirarAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      if (grupoModalAbierto) await recargarGrupoActual()
    } catch (err) {
      setRetirarError(getErrorMessage(err))
    } finally {
      setRetirarEnviando(false)
    }
  }

  // ============================================
  // MODAL: ACUERDOS SUSPENDIDOS
  // ============================================
  const [suspendidosAbierto, setSuspendidosAbierto] = useState(false)
  const [suspendidosCargando, setSuspendidosCargando] = useState(false)
  const [suspendidosLista, setSuspendidosLista] = useState<SuspendidoSalud[]>([])
  const [suspendidosDescargando, setSuspendidosDescargando] = useState<'pdf' | 'excel' | null>(null)

  const abrirSuspendidos = async () => {
    setSuspendidosAbierto(true)
    setSuspendidosCargando(true)
    try {
      const respuesta = await saludService.listarSuspendidosParaImpresion()
      if (respuesta.success) setSuspendidosLista(respuesta.data)
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setSuspendidosCargando(false)
    }
  }

  const descargarSuspendidos = async (formato: 'pdf' | 'excel') => {
    setSuspendidosDescargando(formato)
    try {
      await saludService.descargarReporteSuspendidos(formato)
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setSuspendidosDescargando(null)
    }
  }

  // ============================================
  // MODAL: GENERAR PAGO DE SALUD
  // ============================================
  const [pagosAbierto, setPagosAbierto] = useState(false)
  const [pagosNumeroAcuerdo, setPagosNumeroAcuerdo] = useState('')
  const [pagosBuscando, setPagosBuscando] = useState(false)
  const [pagosGrupo, setPagosGrupo] = useState<GrupoSalud | null>(null)
  const [pagosError, setPagosError] = useState<string | null>(null)
  const [pagosFecha, setPagosFecha] = useState(hoyISO())
  const [pagosMontoUsd, setPagosMontoUsd] = useState('')
  const [pagosMontoBs, setPagosMontoBs] = useState('')
  const [pagosTasaCambio, setPagosTasaCambio] = useState('')
  const [pagosSemanas, setPagosSemanas] = useState('1')
  const [pagosAnio, setPagosAnio] = useState(String(new Date().getFullYear()))
  const [pagosNumeroRecibo, setPagosNumeroRecibo] = useState('')
  const [pagosUbicacionId, setPagosUbicacionId] = useState<number | ''>('')
  const [pagosUbicaciones, setPagosUbicaciones] = useState<feriasService.Ubicacion[]>([])
  const [pagosEnviando, setPagosEnviando] = useState(false)

  const abrirPagosModal = async (numeroAcuerdoPrefill?: string) => {
    setPagosAbierto(true)
    setPagosNumeroAcuerdo(numeroAcuerdoPrefill || '')
    setPagosGrupo(null)
    setPagosError(null)
    setPagosFecha(hoyISO())
    setPagosMontoUsd('')
    setPagosMontoBs('')
    setPagosTasaCambio('')
    setPagosSemanas('1')
    setPagosAnio(String(new Date().getFullYear()))
    setPagosNumeroRecibo('')
    setPagosUbicacionId('')

    if (pagosUbicaciones.length === 0) {
      try {
        const respuesta = await feriasService.obtenerUbicacionesActivas()
        if (respuesta.success && respuesta.data) setPagosUbicaciones(respuesta.data)
      } catch {
        // El selector quedará vacío
      }
    }

    if (numeroAcuerdoPrefill) {
      await buscarGrupoParaPago(numeroAcuerdoPrefill)
    }
  }

  const buscarGrupoParaPago = async (numeroAcuerdoParam?: string) => {
    const numero = (numeroAcuerdoParam ?? pagosNumeroAcuerdo).trim()
    if (!numero) return
    setPagosBuscando(true)
    setPagosError(null)
    setPagosGrupo(null)
    try {
      const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(numero)
      if (!respuesta.success) throw new Error('Acuerdo no encontrado')
      setPagosGrupo(respuesta.data)
    } catch (err) {
      setPagosError(getErrorMessage(err) || 'Acuerdo no encontrado')
    } finally {
      setPagosBuscando(false)
    }
  }

  const pagosFormularioValido =
    !!pagosGrupo &&
    pagosFecha.trim() !== '' &&
    pagosMontoUsd.trim() !== '' &&
    pagosMontoBs.trim() !== '' &&
    pagosTasaCambio.trim() !== '' &&
    pagosSemanas.trim() !== '' &&
    pagosAnio.trim() !== '' &&
    pagosNumeroRecibo.trim() !== '' &&
    pagosUbicacionId !== ''

  const confirmarPago = async () => {
    if (!pagosGrupo?.numero_acuerdo || !pagosFormularioValido) return
    const ubicacionId: number = pagosUbicacionId

    setPagosEnviando(true)
    setPagosError(null)
    try {
      const respuesta = await saludService.registrarPago(pagosGrupo.numero_acuerdo, {
        fecha_pago: pagosFecha,
        monto_usd: Number(pagosMontoUsd),
        monto_bs: Number(pagosMontoBs),
        tasa_cambio: Number(pagosTasaCambio),
        semanas: Number(pagosSemanas),
        anio: Number(pagosAnio),
        numero_recibo: pagosNumeroRecibo.trim(),
        ubicacion_id: ubicacionId,
      })
      if (!respuesta.success) throw new Error('No fue posible registrar el pago')

      setPagosAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      if (grupoModalAbierto) await recargarGrupoActual()
      window.alert(
        respuesta.data.reactivado
          ? 'Pago registrado. El acuerdo estaba suspendido y fue reactivado.'
          : 'Pago registrado correctamente.'
      )
    } catch (err) {
      setPagosError(getErrorMessage(err))
    } finally {
      setPagosEnviando(false)
    }
  }

  // ============================================
  // MODAL: TRASPASO A FUNERARIA
  // ============================================
  const [traspasoAbierto, setTraspasoAbierto] = useState(false)
  const [traspasoNumeroAcuerdo, setTraspasoNumeroAcuerdo] = useState('')
  const [traspasoBuscando, setTraspasoBuscando] = useState(false)
  const [traspasoGrupo, setTraspasoGrupo] = useState<GrupoSalud | null>(null)
  const [traspasoError, setTraspasoError] = useState<string | null>(null)
  const [traspasoSeleccionados, setTraspasoSeleccionados] = useState<number[]>([])
  const [tiposFuneraria, setTiposFuneraria] = useState<funerariaService.TipoAcuerdo[]>([])
  const [traspasoTipoId, setTraspasoTipoId] = useState<number | ''>('')
  const [traspasoNumeroBase, setTraspasoNumeroBase] = useState('')
  const [traspasoNumeroContrato, setTraspasoNumeroContrato] = useState('')
  const [traspasoEnviando, setTraspasoEnviando] = useState(false)
  const [traspasoResultado, setTraspasoResultado] = useState<string | null>(null)

  const abrirTraspasoModal = async (numeroAcuerdoPrefill?: string) => {
    setTraspasoAbierto(true)
    setTraspasoNumeroAcuerdo(numeroAcuerdoPrefill || '')
    setTraspasoGrupo(null)
    setTraspasoError(null)
    setTraspasoSeleccionados([])
    setTraspasoTipoId('')
    setTraspasoNumeroBase('')
    setTraspasoNumeroContrato('')
    setTraspasoResultado(null)

    if (tiposFuneraria.length === 0) {
      try {
        const respuesta = await funerariaService.obtenerTiposAcuerdo()
        if (respuesta.success) setTiposFuneraria(respuesta.data)
      } catch {
        // El selector quedará vacío
      }
    }

    if (numeroAcuerdoPrefill) {
      await buscarGrupoParaTraspaso(numeroAcuerdoPrefill)
    }
  }

  const buscarGrupoParaTraspaso = async (numeroAcuerdoParam?: string) => {
    const numero = (numeroAcuerdoParam ?? traspasoNumeroAcuerdo).trim()
    if (!numero) return
    setTraspasoBuscando(true)
    setTraspasoError(null)
    setTraspasoGrupo(null)
    try {
      const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(numero)
      if (!respuesta.success) throw new Error('Acuerdo no encontrado')
      setTraspasoGrupo(respuesta.data)
      const todosLosIds = [
        ...(respuesta.data.titular ? [respuesta.data.titular.beneficiario_id] : []),
        ...respuesta.data.beneficiarios.map((b) => b.beneficiario_id),
      ]
      setTraspasoSeleccionados(todosLosIds)
      if (respuesta.data.estado === 'suspendido') {
        setTraspasoError(
          `El acuerdo ${numero} está suspendido; reactívelo antes de traspasar personas a Funeraria.`
        )
      }
    } catch (err) {
      setTraspasoError(getErrorMessage(err) || 'Acuerdo no encontrado')
    } finally {
      setTraspasoBuscando(false)
    }
  }

  const alternarSeleccionTraspaso = (beneficiarioId: number) => {
    setTraspasoSeleccionados((prev) =>
      prev.includes(beneficiarioId) ? prev.filter((id) => id !== beneficiarioId) : [...prev, beneficiarioId]
    )
  }

  const traspasoFormularioValido =
    !!traspasoGrupo &&
    traspasoGrupo.estado !== 'suspendido' &&
    traspasoSeleccionados.length > 0 &&
    !!traspasoTipoId &&
    traspasoNumeroBase.trim() !== ''

  const confirmarTraspasoFuneraria = async () => {
    if (!traspasoGrupo?.numero_acuerdo || !traspasoFormularioValido || !traspasoTipoId) return

    const confirmado = window.confirm(
      `¿Transferir ${traspasoSeleccionados.length} persona(s) del acuerdo de salud ${traspasoGrupo.numero_acuerdo} al servicio de funeraria? Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setTraspasoEnviando(true)
    setTraspasoError(null)
    try {
      const respuesta = await saludService.importarGrupoAFuneraria(traspasoGrupo.numero_acuerdo, {
        beneficiario_ids: traspasoSeleccionados,
        tipo_acuerdo_funeraria_id: traspasoTipoId,
        numero_acuerdo_funeraria: traspasoNumeroBase.trim(),
        numero_contrato_funeraria: traspasoNumeroContrato.trim() || undefined,
      })
      if (!respuesta.success) throw new Error('No fue posible completar el traspaso')

      setTraspasoResultado(
        `${respuesta.data.transferidos} persona(s) transferida(s) a Funeraria con los números: ${respuesta.data.numeros_acuerdo_funeraria.join(', ')}`
      )
    } catch (err) {
      setTraspasoError(getErrorMessage(err))
    } finally {
      setTraspasoEnviando(false)
    }
  }

  // ============================================
  // MODAL: CAMBIAR ESTADO (suspender / reactivar, en cascada por grupo)
  // ============================================
  const [estadoModalAbierto, setEstadoModalAbierto] = useState(false)
  const [estadoAcuerdo, setEstadoAcuerdo] = useState<CambiarEstadoCandidato | null>(null)
  const [estadoAccion, setEstadoAccion] = useState<'activo' | 'suspendido' | null>(null)
  const [estadoMotivo, setEstadoMotivo] = useState('')
  const [estadoEnviando, setEstadoEnviando] = useState(false)
  const [estadoError, setEstadoError] = useState<string | null>(null)

  const abrirCambiarEstado = (acuerdo: CambiarEstadoCandidato, accion: 'activo' | 'suspendido') => {
    setEstadoAcuerdo(acuerdo)
    setEstadoAccion(accion)
    setEstadoMotivo('')
    setEstadoError(null)
    setEstadoModalAbierto(true)
  }

  const confirmarCambiarEstado = async () => {
    if (!estadoAcuerdo || !estadoAccion) return

    setEstadoEnviando(true)
    setEstadoError(null)
    try {
      const respuesta = await saludService.cambiarEstado(estadoAcuerdo.id, {
        estado: estadoAccion,
        motivo: estadoMotivo || undefined,
      })
      if (!respuesta.success) throw new Error('No fue posible actualizar el estado del acuerdo')

      setEstadoModalAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      if (grupoModalAbierto) await recargarGrupoActual()
    } catch (err) {
      setEstadoError(getErrorMessage(err))
    } finally {
      setEstadoEnviando(false)
    }
  }

  // ============================================
  // IMPRIMIR FICHA
  // ============================================
  // La API de impresión solo se usa para registrar la impresión en el audit
  // log; el documento en sí se renderiza localmente con PrintableFichaAcuerdo
  // (mismo patrón que PrintableListado) para poder imprimirlo o guardarlo
  // como PDF sin depender del ticket de texto plano de 80mm.
  const construirPayloadFichaDesdeGrupo = (grupo: GrupoSalud): saludService.FichaAcuerdoSaludData => ({
    numero_acuerdo: grupo.numero_acuerdo || 'S/N',
    numero_contrato: grupo.numero_contrato || undefined,
    fecha_inicio: grupo.fecha_inicio || hoyISO(),
    socio: {
      codigo: grupo.socio?.codigo_socio || '',
      cedula: grupo.socio?.cedula || '',
      nombre: grupo.socio?.nombre_completo || '',
      direccion: grupo.socio?.direccion || undefined,
      telefono: grupo.socio?.telefono || undefined,
    },
    beneficiarios: grupo.beneficiarios.map((b) => ({
      id: b.beneficiario_id,
      nombre: `${b.nombre} ${b.apellido}`,
      cedula: b.cedula,
      parentesco: b.parentesco,
      fecha_ingreso: b.fecha_ingreso || grupo.fecha_inicio || hoyISO(),
      fecha_nacimiento: b.fecha_nacimiento || undefined,
      edad: calcularEdad(b.fecha_nacimiento) ?? undefined,
      // El acuerdo suspendido/retirado manda sobre el estado propio de la
      // persona: si no, un beneficiario con vida "activa" en un acuerdo
      // suspendido salía impreso como "Activo", sin reflejar la suspensión.
      estado: b.estado_acuerdo !== 'activo' ? b.estado_acuerdo : b.estado_persona,
    })),
  })

  const construirPropsFichaImpresion = (grupo: GrupoSalud): PrintableFichaAcuerdoProps => ({
    servicio: 'SALUD',
    numero_acuerdo: grupo.numero_acuerdo || 'S/N',
    numero_contrato: grupo.numero_contrato,
    fecha_inicio: grupo.fecha_inicio,
    estado: grupo.estado || 'activo',
    socio: {
      codigo: grupo.socio?.codigo_socio || '',
      cedula: grupo.socio?.cedula || '',
      nombre: grupo.socio?.nombre_completo || '',
      direccion: grupo.socio?.direccion,
      telefono: grupo.socio?.telefono,
    },
    beneficiarios: grupo.beneficiarios.map((b, index) => ({
      numero: index + 1,
      nombre: `${b.nombre} ${b.apellido}`,
      cedula: b.cedula,
      parentesco: b.parentesco,
      fecha_ingreso: b.fecha_ingreso || grupo.fecha_inicio,
      fecha_nacimiento: b.fecha_nacimiento,
      edad: calcularEdad(b.fecha_nacimiento),
      // Mismo criterio: el estado del acuerdo (suspendido/retirado) tiene
      // prioridad sobre el estado propio de la persona.
      estado: b.estado_acuerdo !== 'activo' ? b.estado_acuerdo : b.estado_persona,
    })),
  })

  const imprimirFichaGrupo = async () => {
    if (!grupoActual) return
    setImprimiendoFicha(true)
    try {
      const respuesta = await saludService.imprimirFichaAcuerdo(construirPayloadFichaDesdeGrupo(grupoActual))
      if (!respuesta.success) throw new Error('No fue posible generar la ficha')
      setFichaParaImprimir(construirPropsFichaImpresion(grupoActual))
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setImprimiendoFicha(false)
    }
  }

  const imprimirFichaDesdeFila = async (acuerdo: AcuerdoSalud) => {
    if (!acuerdo.numero_acuerdo) {
      window.alert('Este acuerdo no tiene número asignado; no se puede generar la ficha completa.')
      return
    }
    setImprimiendoFilaId(acuerdo.id)
    try {
      const respuesta = await saludService.obtenerGrupoPorNumeroAcuerdo(acuerdo.numero_acuerdo)
      if (!respuesta.success) throw new Error('No fue posible cargar el acuerdo')
      const respuestaFicha = await saludService.imprimirFichaAcuerdo(construirPayloadFichaDesdeGrupo(respuesta.data))
      if (!respuestaFicha.success) throw new Error('No fue posible generar la ficha')
      setFichaParaImprimir(construirPropsFichaImpresion(respuesta.data))
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setImprimiendoFilaId(null)
    }
  }

  // Se dispara solo cuando hay una ficha lista: evita imprimir contenido
  // obsoleto y espera a que React monte PrintableFichaAcuerdo con los datos.
  useEffect(() => {
    if (!fichaParaImprimir) return
    window.print()
    const limpiar = () => setFichaParaImprimir(null)
    window.addEventListener('afterprint', limpiar, { once: true })
    return () => window.removeEventListener('afterprint', limpiar)
  }, [fichaParaImprimir])


  // ============================================
  // HELPERS DE PRESENTACIÓN
  // ============================================
  const badgeEstado = (estado: string) => {
    switch (estado) {
      case 'activo':
        return (
          <Badge variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            Activo
          </Badge>
        )
      case 'suspendido':
        return (
          <Badge variant="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            Suspendido
          </Badge>
        )
      case 'retirado':
        return (
          <Badge variant="neutral" icon={<XCircle className="h-3.5 w-3.5" />}>
            Retirado
          </Badge>
        )
      default:
        return <Badge variant="neutral">{estado}</Badge>
    }
  }

  const badgePersona = (estado: string) => {
    switch (estado) {
      case 'fallecido':
        return (
          <Badge variant="purple" icon={<Skull className="h-3.5 w-3.5" />}>
            Fallecido
          </Badge>
        )
      case 'retirado':
        return <Badge variant="neutral">Retirado</Badge>
      case 'inactivo':
        return <Badge variant="neutral">Inactivo</Badge>
      default:
        return <Badge variant="success">Vivo</Badge>
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'activo', label: 'Activos', count: estadisticas.activos },
    { id: 'suspendido', label: 'Suspendidos', count: estadisticas.suspendidos },
    { id: 'retirado', label: 'Retirados', count: estadisticas.retirados },
    { id: 'todos', label: 'Todos' },
  ]

  // Ordenar acuerdos según el campo seleccionado
  const acuerdosOrdenados = useMemo(() => {
    const acuerdosCopia = [...acuerdos];
    
    acuerdosCopia.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      // Manejar campos anidados
      if (sortField.includes('.')) {
        const [obj, prop] = sortField.split('.');
        compareA = (a as any)[obj ?? '']?.[prop ?? ''];
        compareB = (b as any)[obj ?? '']?.[prop ?? ''];
      } else {
        compareA = (a as any)[sortField];
        compareB = (b as any)[sortField];
      }

      // Manejar valores nulos
      if (compareA === null || compareA === undefined) compareA = '';
      if (compareB === null || compareB === undefined) compareB = '';

      // Comparación
      if (typeof compareA === 'string') {
        compareA = compareA.toLowerCase();
        compareB = compareB.toLowerCase();
      }

      if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return acuerdosCopia;
  }, [acuerdos, sortField, sortOrder]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Salud</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Acuerdos familiares de salud · Hasta 9 personas comparten un mismo número de acuerdo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={abrirBuscarModal}>
            <FileSearch className="w-4 h-4" />
            Ir a acuerdo
          </Button>
          {puedeEscribir && (
            <Button variant="outline" size="sm" onClick={() => void abrirPagosModal()}>
              <Wallet className="w-4 h-4" />
              Generar Pago
            </Button>
          )}
          {puedeEscribir && (
            <Button size="sm" onClick={() => setWizardAbierto(true)}>
              <PlusCircle className="w-4 h-4" />
              Nuevo Acuerdo
            </Button>
          )}
          <ActionMenu
            align="end"
            trigger={
              <button
                type="button"
                title="Más acciones"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
              >
                <MoreHorizontal className="h-4 w-4" />
                Más
              </button>
            }
            groups={[
              [
                {
                  key: 'imprimir-listado',
                  label: 'Imprimir listado',
                  icon: <FileDown className="h-4 w-4 text-neutral-500" />,
                  onSelect: () => abrirModalListado('pdf'),
                },
                {
                  key: 'excel',
                  label: 'Acuerdos en Excel',
                  icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600" />,
                  onSelect: () => abrirModalListado('excel'),
                },
              ],
              puedeEscribir
                ? [
                    {
                      key: 'traspaso',
                      label: 'Traspaso a Funeraria',
                      icon: <ArrowRightLeft className="h-4 w-4 text-primary-600" />,
                      onSelect: () => void abrirTraspasoModal(),
                    },
                    {
                      key: 'retirar',
                      label: 'Retirar acuerdos',
                      icon: <UserMinus className="h-4 w-4 text-amber-600" />,
                      onSelect: abrirRetirarModal,
                    },
                  ]
                : [],
              puedeEliminar
                ? [
                    {
                      key: 'eliminar',
                      label: 'Eliminar',
                      icon: <Trash2 className="h-4 w-4" />,
                      onSelect: abrirEliminarModal,
                      tone: 'danger' as const,
                    },
                  ]
                : [],
            ]}
          />
        </div>
      </div>

      {/* Solo se monta uno de los documentos imprimibles a la vez: si más de
          un "print root" coincidiera en el DOM durante window.print(), se
          mostrarían superpuestos. */}
      {fichaParaImprimir ? (
        <PrintableFichaAcuerdo {...fichaParaImprimir} />
      ) : gruposParaImprimir ? (
        <PrintableListadoGrupos tipo={gruposParaImprimir.tipo} grupos={gruposParaImprimir.grupos} />
      ) : null}

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Acuerdos</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{estadisticas.total_acuerdos.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Activos</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{estadisticas.activos.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Suspendidos</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{estadisticas.suspendidos.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Próximos a Suspender</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{estadisticas.proximos_suspender.toLocaleString()}</p>
              <p className="text-xs text-neutral-500 mt-1">≥ 10 semanas sin pago</p>
            </div>
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Sin Derecho a Servicio</p>
              <p className="text-2xl font-bold text-neutral-700 mt-1">{estadisticas.sin_derecho_servicio.toLocaleString()}</p>
              <p className="text-xs text-neutral-500 mt-1">Activos con atraso</p>
            </div>
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
              <ShieldOff className="w-5 h-5 text-neutral-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* TABS + BÚSQUEDA */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id)
                  setPaginaActual(1)
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {t.label}
                {t.count !== undefined && <span className="rounded-full bg-neutral-200/70 px-1.5 text-xs">{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar por expediente, cédula, nombre o número de acuerdo..."
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setPaginaActual(1)
                }}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* TABLA */}
      {/* table-fixed + anchos en % garantiza que las columnas quepan en el
          ancho disponible sin scroll horizontal, sin importar el contenido:
          a diferencia de un layout automático, el navegador nunca deja que
          la tabla crezca más allá del 100% del contenedor. */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-neutral-200">
            <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-wide text-neutral-700">
              <tr>
                <SortableHeader
                 label="Expediente"
                 field="socio.codigo_socio"
                 className={tab === 'activo' ? 'w-[10%]' : 'w-[9%]'}
                 currentSortField={sortField}
                 currentSortOrder={sortOrder}
                 onSort={handleSort}
                  />
                <SortableHeader
                 label="Acuerdo"
                 field="numero_acuerdo"
                 className={tab === 'activo' ? 'w-[10%]' : 'w-[9%]'}
                 currentSortField={sortField}
                 currentSortOrder={sortOrder}
                 onSort={handleSort}
                   />
                <SortableHeader
                 label="Titular"
                 field="beneficiario.nombre_completo"
                 className={tab === 'activo' ? 'w-[30%]' : 'w-[27%]'}
                 currentSortField={sortField}
                 currentSortOrder={sortOrder}
                 onSort={handleSort}
                  />
                <SortableHeader
                 label="Tipo"
                 field="tipo_acuerdo.nombre"
                 className={tab === 'activo' ? 'w-[15%]' : 'w-[13%]'}
                 currentSortField={sortField}
                 currentSortOrder={sortOrder}
                 onSort={handleSort}
                  />
                <SortableHeader
                 label="Sem. sin pago"
                 field="semanas_sin_pago"
                 align="center"
                 className={tab === 'activo' ? 'w-[10%]' : 'w-[9%]'}
                 currentSortField={sortField}
                 currentSortOrder={sortOrder}
                 onSort={handleSort}
                  />
                <SortableHeader
                 label="Estado"
                 field="estado"
                 align="center"
                 className={tab === 'activo' ? 'w-[10%]' : 'w-[9%]'}
                 currentSortField={sortField}
                 currentSortOrder={sortOrder}
                 onSort={handleSort}
                  />
                {/* Socios activos no tienen fecha de suspensión ni de
                    retiro: la columna no aporta nada en esa vista, así que
                    no se muestra. En Suspendidos se convierte en "F.
                    Suspendido" (fecha_suspension); en el resto (Retirados /
                    Todos) sigue siendo "F. Retiro" (fecha_retiro). */}
                {tab !== 'activo' && (
                  <SortableHeader
                   label={tab === 'suspendido' ? 'F. Suspendido' : 'F. Retiro'}
                   field={tab === 'suspendido' ? 'fecha_suspension' : 'fecha_retiro'}
                   className="w-[13%]"
                   currentSortField={sortField}
                   currentSortOrder={sortOrder}
                   onSort={handleSort}
                    />
                )}
                <th className={tab === 'activo' ? 'w-[15%] px-2 py-3' : 'w-[11%] px-2 py-3'} />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={tab === 'activo' ? 7 : 8} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-neutral-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Cargando acuerdos...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={tab === 'activo' ? 7 : 8} className="px-6 py-12 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              ) : acuerdos.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'activo' ? 7 : 8} className="px-6 py-12 text-center text-neutral-500">
                    No se encontraron acuerdos
                  </td>
                </tr>
              ) : (
                acuerdosOrdenados.map((acuerdo) => (
                  <tr
                    key={acuerdo.id}
                    className="hover:bg-primary-50/40 cursor-pointer transition-colors"
                    onClick={() => abrirDetalle(acuerdo)}
                  >
                    <td className="px-3 py-3 truncate">
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {acuerdo.socio?.codigo_socio || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 truncate">
                      <span className="font-mono text-sm font-semibold text-primary-700">{acuerdo.numero_acuerdo || '—'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate text-sm font-medium text-neutral-900" title={acuerdo.beneficiario.nombre_completo}>
                        {acuerdo.beneficiario.nombre_completo}
                      </p>
                      <p className="truncate text-xs text-neutral-500">{acuerdo.beneficiario.cedula}</p>
                    </td>
                    <td className="overflow-hidden px-3 py-3">
                      <Badge variant="info">{acuerdo.tipo_acuerdo.nombre}</Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      {acuerdo.semanas_sin_pago >= 10 ? (
                        <Badge variant="error">{acuerdo.semanas_sin_pago}</Badge>
                      ) : acuerdo.semanas_sin_pago > 0 ? (
                        <Badge variant="warning">{acuerdo.semanas_sin_pago}</Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">{badgeEstado(acuerdo.estado)}</td>
                    {tab !== 'activo' && (
                      <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-neutral-600">
                        {tab === 'suspendido'
                          ? (acuerdo.estado === 'suspendido' && acuerdo.fecha_suspension ? formatearFecha(acuerdo.fecha_suspension) : '')
                          : (acuerdo.estado === 'retirado' && acuerdo.fecha_retiro ? formatearFecha(acuerdo.fecha_retiro) : '')}
                      </td>
                    )}
                    <td className="px-2 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        trigger={
                          <button
                            type="button"
                            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                            title="Acciones"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                        groups={[
                          [
                            {
                              key: 'ver',
                              label: 'Ver / Modificar',
                              icon: <Eye className="h-4 w-4 text-neutral-500" />,
                              onSelect: () => abrirDetalle(acuerdo),
                            },
                            {
                              key: 'imprimir-ficha',
                              label: 'Imprimir ficha',
                              icon:
                                imprimiendoFilaId === acuerdo.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                ) : (
                                  <Printer className="h-4 w-4 text-emerald-600" />
                                ),
                              disabled: imprimiendoFilaId === acuerdo.id,
                              onSelect: () => void imprimirFichaDesdeFila(acuerdo),
                            },
                            ...(puedeEscribir && acuerdo.numero_acuerdo && acuerdo.estado !== 'retirado'
                              ? [
                                  {
                                    key: 'generar-pago',
                                    label: 'Generar pago',
                                    icon: <Wallet className="h-4 w-4 text-primary-600" />,
                                    onSelect: () => void abrirPagosModal(acuerdo.numero_acuerdo || undefined),
                                  } satisfies ActionMenuItem,
                                ]
                              : []),
                            ...(puedeEscribir && acuerdo.estado === 'suspendido'
                              ? [
                                  {
                                    key: 'reactivar',
                                    label: 'Reactivar acuerdo',
                                    icon: <CheckCircle2 className="h-4 w-4" />,
                                    onSelect: () => abrirCambiarEstado(acuerdo, 'activo'),
                                    tone: 'success' as const,
                                  } satisfies ActionMenuItem,
                                ]
                              : []),
                          ],
                          puedeEscribir && acuerdo.estado === 'activo'
                            ? [
                                {
                                  key: 'suspender',
                                  label: 'Suspender acuerdo',
                                  icon: <AlertTriangle className="h-4 w-4" />,
                                  onSelect: () => abrirCambiarEstado(acuerdo, 'suspendido'),
                                  tone: 'warning' as const,
                                },
                              ]
                            : [],
                          puedeEscribir && acuerdo.estado !== 'retirado'
                            ? [
                                {
                                  key: 'retirar-titular',
                                  label: 'Retirar',
                                  icon: <UserMinus className="h-4 w-4" />,
                                  onSelect: () => abrirRetirarTitularModal(acuerdo),
                                  tone: 'danger' as const,
                                },
                              ]
                            : [],
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && acuerdos.length > 0 && (
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm text-neutral-600">
                  Mostrando <span className="font-semibold">{(paginaActual - 1) * itemsPorPagina + 1}</span> a{' '}
                  <span className="font-semibold">{Math.min(paginaActual * itemsPorPagina, totalRegistros)}</span> de{' '}
                  <span className="font-semibold">{totalRegistros}</span>
                </p>
                <select
                  value={itemsPorPagina}
                  onChange={(e) => {
                    setItemsPorPagina(Number(e.target.value))
                    setPaginaActual(1)
                  }}
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {tab === 'suspendido' && (
                  <Button variant="outline" size="sm" onClick={() => void abrirSuspendidos()}>
                    <Printer className="h-4 w-4" />
                    Ver Suspendidos
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setPaginaActual((p) => Math.max(1, p - 1))} disabled={paginaActual === 1}>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-neutral-600 px-2">
                  {paginaActual} / {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================ */}
      {/* WIZARD: NUEVO ACUERDO */}
      {/* ============================================ */}
      <Modal open={wizardAbierto} onClose={cerrarWizard} title="Nuevo Acuerdo de Salud" size="lg">
        <div className="mb-5 flex items-center gap-2">
          {(['Buscar socio', 'Datos del acuerdo', 'Confirmar'] as const).map((etiqueta, i) => {
            const paso = (i + 1) as 1 | 2 | 3
            const activo = paso === wizardPaso
            const completado = paso < wizardPaso
            return (
              <div key={paso} className="flex flex-1 flex-col gap-1.5">
                <div className={`h-1.5 rounded-full ${completado || activo ? 'bg-primary-600' : 'bg-neutral-200'}`} />
                <span className={`text-xs font-medium ${activo ? 'text-primary-700' : 'text-neutral-400'}`}>
                  {paso}. {etiqueta}
                </span>
              </div>
            )
          })}
        </div>

        {wizardError && (
          <Alert variant="error" className="mb-4">{wizardError}</Alert>
        )}

        {wizardPaso === 1 && (
          <div className="space-y-4">
            <Input
              label="Número de expediente del socio"
              value={wizardExpediente}
              onChange={(e) => setWizardExpediente(e.target.value)}
              placeholder="Ej: S001"
              onKeyDown={(e) => e.key === 'Enter' && void buscarSocioWizard()}
              autoFocus
              helperText="El socio debe ser ahorrista (tener un acuerdo de ahorro activo) para acceder al beneficio de salud."
            />
            <Button onClick={() => void buscarSocioWizard()} isLoading={wizardBuscando} className="w-full">
              <Search className="w-4 h-4" />
              Buscar Socio
            </Button>
          </div>
        )}

        {wizardPaso === 2 && wizardSocio && (
          <div className="space-y-5">
            <ResumenSocioCard
              nombre={`Titular: ${wizardSocio.apellido}, ${wizardSocio.nombre}`}
              detalle={`${wizardSocio.codigo_socio} • ${wizardSocio.cedula}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tipo de acuerdo"
                value={wizardTipoAcuerdoId}
                onChange={(e) => setWizardTipoAcuerdoId(Number(e.target.value))}
              >
                <option value="">Selecciona un tipo...</option>
                {tiposAcuerdo.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre} (${tipo.monto_usd} USD)
                  </option>
                ))}
              </Select>
              <Input label="Fecha de ingreso" type="date" value={wizardFechaInicio} onChange={(e) => setWizardFechaInicio(e.target.value)} />
              <Input label="Número de acuerdo" value={wizardNumeroAcuerdo} onChange={(e) => setWizardNumeroAcuerdo(e.target.value)} placeholder="Ej: SAL-001234" required />
              <Input label="Número de contrato (opcional)" value={wizardNumeroContrato} onChange={(e) => setWizardNumeroContrato(e.target.value)} />
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Beneficiarios ({wizardBeneficiarios.length} / {MAX_BENEFICIARIOS_POR_GRUPO})
              </h4>
              <p className="text-xs text-neutral-500 mb-3">
                Hasta 8 personas además del titular (9 en total). Puedes continuar sin beneficiarios y agregarlos después.
              </p>

              {wizardBeneficiarios.length > 0 && (
                <div className="mb-3 space-y-2">
                  {wizardBeneficiarios.map((b) => (
                    <div key={b.cedula} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{b.nombre} {b.apellido}</p>
                        <p className="text-xs text-neutral-500">{b.cedula} • {b.parentesco}</p>
                      </div>
                      <button onClick={() => quitarBeneficiarioDeWizard(b.cedula)} className="text-neutral-400 hover:text-rose-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {wizardBeneficiarios.length < MAX_BENEFICIARIOS_POR_GRUPO && (
                <div className="rounded-lg border border-dashed border-neutral-300 p-3 space-y-3">
                  {wizardBenefError && <p className="text-xs text-rose-600">{wizardBenefError}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Cédula"
                      value={wizardBenefForm.cedula}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, cedula: e.target.value }))}
                    />
                    <Select
                      label="Parentesco"
                      value={wizardBenefForm.parentesco}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, parentesco: e.target.value }))}
                    >
                      <option value="">Selecciona...</option>
                      {saludService.PARENTESCOS_BENEFICIARIO_SALUD.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </Select>
                    <Input
                      label="Nombre"
                      value={wizardBenefForm.nombre}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                    <Input
                      label="Apellido"
                      value={wizardBenefForm.apellido}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, apellido: e.target.value }))}
                    />
                    <Input
                      label="Fecha de nacimiento"
                      type="date"
                      value={wizardBenefForm.fecha_nacimiento}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))}
                    />
                    <Input
                      label="Fecha de ingreso"
                      type="date"
                      value={wizardBenefForm.fecha_ingreso}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, fecha_ingreso: e.target.value }))}
                    />
                    <Select
                      label="Estado"
                      value={wizardBenefForm.estado}
                      onChange={(e) => setWizardBenefForm((f) => ({ ...f, estado: e.target.value as 'activo' | 'fallecido' }))}
                    >
                      <option value="activo">Vivo</option>
                      <option value="fallecido">Fallecido</option>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={agregarBeneficiarioAWizard} className="w-full">
                    <UserPlus className="h-4 w-4" />
                    Agregar a la lista
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setWizardPaso(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button onClick={() => setWizardPaso(3)} disabled={!wizardPaso2Valido} className="flex-1">
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {wizardPaso === 3 && wizardSocio && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 p-4 space-y-2 text-sm">
              <p><span className="text-neutral-500">Titular:</span> <span className="font-medium">{wizardSocio.apellido}, {wizardSocio.nombre}</span></p>
              <p><span className="text-neutral-500">Tipo de acuerdo:</span> <span className="font-medium">{tiposAcuerdo.find((t) => t.id === wizardTipoAcuerdoId)?.nombre}</span></p>
              <p><span className="text-neutral-500">Número de acuerdo:</span> <span className="font-mono font-medium">{wizardNumeroAcuerdo}</span></p>
              <p><span className="text-neutral-500">Fecha de ingreso:</span> <span className="font-medium">{formatearFecha(wizardFechaInicio)}</span></p>
              <p><span className="text-neutral-500">Total de personas:</span> <span className="font-medium">{wizardBeneficiarios.length + 1} (titular + {wizardBeneficiarios.length} beneficiario(s))</span></p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setWizardPaso(2)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button onClick={() => void confirmarNuevoAcuerdo()} isLoading={wizardEnviando} className="flex-1">
                Confirmar y Crear
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: GRUPO (Ver / Modificar) */}
      {/* ============================================ */}
      <Modal open={grupoModalAbierto} onClose={() => setGrupoModalAbierto(false)} title="Acuerdo de Salud" size="xl">
        {grupoCargando ? (
          <div className="flex justify-center items-center gap-2 text-neutral-500 py-12">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando acuerdo...</span>
          </div>
        ) : grupoActual ? (
          <div className="space-y-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Titular</dt>
                <dd className="text-sm font-semibold text-neutral-900">{grupoActual.socio?.nombre_completo || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Expediente / Cédula</dt>
                <dd className="text-sm text-neutral-900">{grupoActual.socio?.codigo_socio} • {grupoActual.socio?.cedula}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Número de Acuerdo</dt>
                <dd className="text-sm font-mono font-semibold text-primary-700">{grupoActual.numero_acuerdo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Tipo de Acuerdo</dt>
                <dd className="text-sm text-neutral-900">{grupoActual.tipo_acuerdo?.nombre}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Estado del Acuerdo</dt>
                <dd>{grupoActual.estado && badgeEstado(grupoActual.estado)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Semanas Sin Pago</dt>
                <dd className="text-sm text-neutral-900">{grupoActual.semanas_sin_pago}</dd>
              </div>
              {grupoActual.estado === 'retirado' && (
                <div>
                  <dt className="text-xs font-medium uppercase text-neutral-500">Fecha de Retiro</dt>
                  <dd className="text-sm text-neutral-900">{formatearFecha(grupoActual.titular?.fecha_retiro) || '—'}</dd>
                </div>
              )}
            </dl>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-neutral-900">
                  Beneficiarios ({gruposBeneficiariosVisibles.filter((b) => b.estado_acuerdo !== 'retirado').length} / {MAX_BENEFICIARIOS_POR_GRUPO})
                </h4>
                {puedeEscribir && !grupoLimiteAlcanzado && grupoActual.estado !== 'retirado' && (
                  <Button size="sm" onClick={abrirNuevoBeneficiarioGrupo}>
                    <UserPlus className="h-4 w-4" />
                    Agregar
                  </Button>
                )}
              </div>

              {gruposBeneficiariosVisibles.length === 0 ? (
                <p className="text-sm text-neutral-500">Este acuerdo aún no tiene beneficiarios agregados.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Cédula</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Nombre</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Fecha de Ingreso</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Parentesco</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Fecha de Nacimiento</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">Edad</th>
                        <th className="px-3 py-2 text-center font-medium text-neutral-500">Estado</th>
                        {puedeEscribir && <th className="px-3 py-2" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {gruposBeneficiariosVisibles.map((b) => (
                        <tr key={b.acuerdo_id}>
                          <td className="px-3 py-2 text-neutral-600">{b.cedula}</td>
                          <td className="px-3 py-2 font-medium text-neutral-900">{b.nombre} {b.apellido}</td>
                          <td className="px-3 py-2 text-neutral-600">{formatearFecha(b.fecha_ingreso) || '—'}</td>
                          <td className="px-3 py-2 text-neutral-600">{b.parentesco}</td>
                          <td className="px-3 py-2 text-neutral-600">{formatearFecha(b.fecha_nacimiento) || '—'}</td>
                          <td className="px-3 py-2 text-neutral-600">{calcularEdad(b.fecha_nacimiento) ?? '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {badgePersona(b.estado_persona)}
                              {b.estado_acuerdo === 'retirado' && (
                                <span className="text-[10px] uppercase tracking-wide text-neutral-400">Retirado del acuerdo</span>
                              )}
                            </div>
                          </td>
                          {puedeEscribir && (
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {b.estado_persona === 'activo' && b.estado_acuerdo !== 'retirado' && (
                                <div className="flex justify-end gap-2">
                                  <button title="Editar" onClick={() => abrirEditarBeneficiarioGrupo(b)} className="text-primary-600 hover:text-primary-800">
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button title="Marcar como fallecido" onClick={() => void marcarFallecidoGrupo(b)} className="text-purple-600 hover:text-purple-800">
                                    <Skull className="h-4 w-4" />
                                  </button>
                                  <button
                                    title="Retirar"
                                    onClick={() => abrirRetirarDirecto({
                                      id: b.acuerdo_id,
                                      numero_acuerdo: grupoActual.numero_acuerdo,
                                      estado: b.estado_acuerdo,
                                      beneficiario: { cedula: b.cedula, nombre_completo: `${b.nombre} ${b.apellido}` },
                                    })}
                                    className="text-amber-600 hover:text-amber-800"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </button>
                                  <button title="Eliminar" onClick={() => void eliminarMiembroGrupo(b)} className="text-rose-600 hover:text-rose-800">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-4">
              {puedeEscribir && grupoActual.estado === 'suspendido' && grupoActual.titular && (
                <Button
                  onClick={() =>
                    abrirCambiarEstado(
                      { id: grupoActual.titular!.acuerdo_id, numero_acuerdo: grupoActual.numero_acuerdo, socio: grupoActual.socio },
                      'activo'
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Activar
                </Button>
              )}
              <Button variant="outline" onClick={() => void imprimirFichaGrupo()} isLoading={imprimiendoFicha}>
                <Printer className="h-4 w-4" />
                Imprimir Ficha
              </Button>
              {puedeEscribir && grupoActual.estado !== 'retirado' && (
                <Button variant="outline" onClick={() => void abrirPagosModal(grupoActual.numero_acuerdo || undefined)}>
                  <Wallet className="h-4 w-4" />
                  Generar Pago
                </Button>
              )}
              {puedeEscribir && grupoActual.estado !== 'retirado' && (
                <Button
                  variant="outline"
                  onClick={() => void abrirTraspasoModal(grupoActual.numero_acuerdo || undefined)}
                  disabled={grupoActual.estado === 'suspendido'}
                  title={
                    grupoActual.estado === 'suspendido'
                      ? 'No se puede traspasar a Funeraria un acuerdo suspendido: reactívelo primero.'
                      : undefined
                  }
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Traspaso a Funeraria
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="secondary" onClick={() => setGrupoModalAbierto(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: BENEFICIARIO (agregar / editar) */}
      {/* ============================================ */}
      <Modal
        open={beneficiarioModalAbierto}
        onClose={() => setBeneficiarioModalAbierto(false)}
        title={beneficiarioEditando ? 'Editar Beneficiario' : 'Agregar Beneficiario'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBeneficiarioModalAbierto(false)}>Cancelar</Button>
            <Button onClick={() => void guardarBeneficiarioGrupo()} isLoading={beneficiarioEnviando}>Guardar</Button>
          </>
        }
      >
        {beneficiarioError && (
          <Alert variant="error" className="mb-4">{beneficiarioError}</Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Cédula" value={beneficiarioForm.cedula} onChange={(e) => setBeneficiarioForm((f) => ({ ...f, cedula: e.target.value }))} disabled={!!beneficiarioEditando} required />
          <Select
            label="Parentesco"
            value={beneficiarioForm.parentesco}
            onChange={(e) => setBeneficiarioForm((f) => ({ ...f, parentesco: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {saludService.PARENTESCOS_BENEFICIARIO_SALUD.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          <Input label="Nombre" value={beneficiarioForm.nombre} onChange={(e) => setBeneficiarioForm((f) => ({ ...f, nombre: e.target.value }))} required />
          <Input label="Apellido" value={beneficiarioForm.apellido} onChange={(e) => setBeneficiarioForm((f) => ({ ...f, apellido: e.target.value }))} required />
          <Input label="Fecha de nacimiento" type="date" value={beneficiarioForm.fecha_nacimiento} onChange={(e) => setBeneficiarioForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))} required />
          <Input label="Fecha de ingreso" type="date" value={beneficiarioForm.fecha_ingreso} onChange={(e) => setBeneficiarioForm((f) => ({ ...f, fecha_ingreso: e.target.value }))} required />
          <Input label="Teléfono (opcional)" value={beneficiarioForm.telefono || ''} onChange={(e) => setBeneficiarioForm((f) => ({ ...f, telefono: e.target.value }))} />
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: ELIMINAR ACUERDO */}
      {/* ============================================ */}
      <Modal open={eliminarModalAbierto} onClose={() => setEliminarModalAbierto(false)} title="Eliminar Acuerdo de Salud" size="md">
        {eliminarError && (
          <Alert variant="error" className="mb-4">{eliminarError}</Alert>
        )}
        <div className="space-y-4">
          <BuscarPorNumeroInline
            label="Número de acuerdo"
            value={eliminarNumeroAcuerdo}
            onChange={setEliminarNumeroAcuerdo}
            onBuscar={() => void buscarGrupoParaEliminar()}
            buscando={eliminarBuscando}
            autoFocus
          />

          {eliminarGrupoData && (
            <div className="space-y-3">
              <ResumenSocioCard
                nombre={eliminarGrupoData.socio?.nombre_completo || ''}
                detalle={`${eliminarGrupoData.total_personas} persona(s) en este acuerdo`}
              />

              <div className="space-y-1 max-h-56 overflow-y-auto">
                {eliminarGrupoData.titular && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="text-neutral-400">Titular:</span>
                    <span className="font-medium">{eliminarGrupoData.titular.nombre} {eliminarGrupoData.titular.apellido}</span>
                  </div>
                )}
                {eliminarGrupoData.beneficiarios.map((b) => (
                  <label key={b.acuerdo_id} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eliminarSeleccionados.includes(b.acuerdo_id)}
                      onChange={() => alternarSeleccionEliminar(b.acuerdo_id)}
                    />
                    <span>{b.nombre} {b.apellido} <span className="text-neutral-400">({b.parentesco})</span></span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => void eliminarSeleccionadosAccion()}
                  disabled={eliminarSeleccionados.length === 0}
                  isLoading={eliminarEnviando}
                  className="flex-1"
                >
                  Eliminar Seleccionados
                </Button>
                <Button variant="danger" onClick={() => void eliminarCompletoAccion()} isLoading={eliminarEnviando} className="flex-1">
                  Eliminar Acuerdo Completo
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: BUSCAR */}
      {/* ============================================ */}
      <Modal open={buscarModalAbierto} onClose={() => setBuscarModalAbierto(false)} title="Buscar Acuerdo de Salud" size="sm">
        {buscarError && (
          <Alert variant="error" className="mb-4">{buscarError}</Alert>
        )}
        <div className="space-y-4">
          <Input
            label="Número de expediente o número de acuerdo"
            value={buscarInput}
            onChange={(e) => setBuscarInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void ejecutarBusqueda()}
            autoFocus
          />
          <Button onClick={() => void ejecutarBusqueda()} isLoading={buscarBuscando} className="w-full">
            <Search className="w-4 h-4" />
            Buscar
          </Button>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: RETIRAR ACUERDOS */}
      {/* ============================================ */}
      <Modal open={retirarAbierto} onClose={() => setRetirarAbierto(false)} title="Retirar Acuerdos" description="Retira a un beneficiario específico (no aplica al titular)" size="md">
        {retirarError && (
          <Alert variant="error" className="mb-4">{retirarError}</Alert>
        )}

        {!retirarSeleccionado && (
          <div className="space-y-4">
            <BuscarPorNumeroInline
              label="Número de expediente del socio"
              value={retirarExpediente}
              onChange={setRetirarExpediente}
              onBuscar={() => void buscarParaRetirar()}
              buscando={retirarBuscando}
              autoFocus
            />

            {retirarSocioActual && (
              <div>
                <p className="text-sm font-semibold text-neutral-900 mb-2">{retirarSocioActual.apellido}, {retirarSocioActual.nombre}</p>
                {retirarOpciones.length === 0 ? (
                  <p className="text-sm text-neutral-500">Este socio no tiene beneficiarios de salud disponibles para retirar.</p>
                ) : (
                  <div className="space-y-1">
                    {retirarOpciones.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setRetirarSeleccionado(a)}
                        className="w-full text-left px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm"
                      >
                        <span className="font-medium">{a.beneficiario.nombre_completo}</span>{' '}
                        <span className="text-neutral-500">({a.beneficiario.parentesco}) • {a.numero_acuerdo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {retirarSeleccionado && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">N° Acuerdo</dt>
                <dd className="font-mono font-medium">{retirarSeleccionado.numero_acuerdo || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Cédula</dt>
                <dd className="font-medium">{retirarSeleccionado.beneficiario.cedula}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-neutral-500">Nombre</dt>
                <dd className="font-medium">{retirarSeleccionado.beneficiario.nombre_completo}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-neutral-500">Estado actual</dt>
                <dd>{badgeEstado(retirarSeleccionado.estado)}</dd>
              </div>
            </dl>

            <Input label="Fecha de retiro" type="date" value={retirarFecha} onChange={(e) => setRetirarFecha(e.target.value)} required />

            <Select
              label="Motivo del retiro"
              value={retirarMotivo}
              onChange={(e) => setRetirarMotivo(e.target.value as (typeof saludService.MOTIVOS_RETIRO_SALUD)[number])}
            >
              {saludService.MOTIVOS_RETIRO_SALUD.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRetirarSeleccionado(null)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                Cambiar selección
              </Button>
              <Button onClick={() => void confirmarRetiro()} isLoading={retirarEnviando} className="flex-1">
                Confirmar Retiro
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: RETIRAR ACUERDO (titular + cascada a todo el grupo) */}
      {/* ============================================ */}
      <Modal
        open={retirarTitularAbierto}
        onClose={() => setRetirarTitularAbierto(false)}
        title="Retirar Acuerdo de Salud"
        description="El titular y todos los beneficiarios registrados en este acuerdo pasarán a estado Retirado."
        size="md"
      >
        {retirarTitularAcuerdo && (
          <div className="space-y-4">
            {retirarTitularError && (
              <Alert variant="error">{retirarTitularError}</Alert>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Acuerdo</dt>
                <dd className="text-sm font-mono font-semibold text-primary-700">{retirarTitularAcuerdo.numero_acuerdo || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-500">Cédula</dt>
                <dd className="text-sm text-neutral-900">{retirarTitularAcuerdo.socio?.cedula || retirarTitularAcuerdo.beneficiario.cedula}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase text-neutral-500">Titular</dt>
                <dd className="text-sm font-semibold text-neutral-900">
                  {retirarTitularAcuerdo.socio?.nombre_completo || retirarTitularAcuerdo.beneficiario.nombre_completo}
                </dd>
              </div>
            </dl>

            <Input
              label="Fecha de retiro"
              type="date"
              value={retirarTitularFecha}
              onChange={(e) => setRetirarTitularFecha(e.target.value)}
              required
            />

            <Select
              label="Motivo"
              value={retirarTitularMotivo}
              onChange={(e) => setRetirarTitularMotivo(e.target.value as (typeof saludService.MOTIVOS_RETIRO_SALUD)[number])}
            >
              {saludService.MOTIVOS_RETIRO_SALUD.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRetirarTitularAbierto(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => void confirmarRetirarTitular()}
                isLoading={retirarTitularEnviando}
                disabled={!retirarTitularFecha}
                className="flex-1"
              >
                Retirar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: LISTADO POR TIPO (Imprimir listado / Acuerdos en Excel) */}
      {/* ============================================ */}
      <Modal
        open={modoListadoModal !== null}
        onClose={() => setModoListadoModal(null)}
        title={modoListadoModal === 'excel' ? 'Descargar Acuerdos en Excel' : 'Imprimir Listado'}
        description="Selecciona qué grupo de socios quieres incluir en el listado."
        size="sm"
      >
        <div className="space-y-4">
          {listadoSinDatosMensaje && <Alert variant="info">{listadoSinDatosMensaje}</Alert>}

          <Select
            label="Tipo de listado"
            value={tipoListadoSeleccionado}
            onChange={(e) => cambiarTipoListado(e.target.value as saludService.TipoListadoSalud)}
          >
            <option value="activos">Socios activos</option>
            <option value="suspendidos">Socios suspendidos</option>
            <option value="proximos_suspender">Socios próximos a suspender</option>
          </Select>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModoListadoModal(null)} disabled={procesandoListado}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmarImprimirListado()} isLoading={procesandoListado}>
              Aceptar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: ACUERDOS SUSPENDIDOS */}
      {/* ============================================ */}
      <Modal open={suspendidosAbierto} onClose={() => setSuspendidosAbierto(false)} title="Acuerdos de Salud Suspendidos" size="lg">
        <div className="mb-4 flex gap-3">
          <Button variant="outline" onClick={() => void descargarSuspendidos('pdf')} isLoading={suspendidosDescargando === 'pdf'}>
            <FileDown className="h-4 w-4" />
            Descargar PDF
          </Button>
          <Button variant="outline" onClick={() => void descargarSuspendidos('excel')} isLoading={suspendidosDescargando === 'excel'}>
            <FileSpreadsheet className="h-4 w-4" />
            Descargar Excel
          </Button>
        </div>

        {suspendidosCargando ? (
          <div className="flex justify-center items-center gap-2 text-neutral-500 py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando...</span>
          </div>
        ) : suspendidosLista.length === 0 ? (
          <p className="text-sm text-neutral-500 py-8 text-center">No hay acuerdos de salud suspendidos.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">Expediente</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">N° Acuerdo</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">Nombre</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">Cédula</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">Teléfono</th>
                  <th className="px-3 py-2 text-center font-medium text-neutral-500">Sem. Atraso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {suspendidosLista.map((s, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{s.expediente}</td>
                    <td className="px-3 py-2 font-mono">{s.numero_acuerdo}</td>
                    <td className="px-3 py-2">{s.apellidos} {s.nombres}</td>
                    <td className="px-3 py-2">{s.cedula}</td>
                    <td className="px-3 py-2">{s.telefono}</td>
                    <td className="px-3 py-2 text-center"><Badge variant="error">{s.semanas_atraso}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: GENERAR PAGO DE SALUD */}
      {/* ============================================ */}
      <Modal open={pagosAbierto} onClose={() => setPagosAbierto(false)} title="Generar Pago de Salud" size="md">
        {pagosError && (
          <Alert variant="error" className="mb-4">{pagosError}</Alert>
        )}

        <div className="space-y-4">
          <BuscarPorNumeroInline
            label="Número de acuerdo"
            value={pagosNumeroAcuerdo}
            onChange={setPagosNumeroAcuerdo}
            onBuscar={() => void buscarGrupoParaPago()}
            buscando={pagosBuscando}
            autoFocus
          />

          {pagosGrupo && (
            <>
              <ResumenSocioCard
                nombre={pagosGrupo.socio?.nombre_completo || ''}
                detalle={`${pagosGrupo.total_personas} persona(s) cubierta(s) por este pago`}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Fecha de pago" type="date" value={pagosFecha} onChange={(e) => setPagosFecha(e.target.value)} required />
                <Input label="N° de recibo" value={pagosNumeroRecibo} onChange={(e) => setPagosNumeroRecibo(e.target.value)} required />
                <Input label="Monto (USD)" type="number" step="0.01" value={pagosMontoUsd} onChange={(e) => setPagosMontoUsd(e.target.value)} required />
                <Input label="Monto (Bs)" type="number" step="0.01" value={pagosMontoBs} onChange={(e) => setPagosMontoBs(e.target.value)} required />
                <Input label="Tasa de cambio" type="number" step="0.0001" value={pagosTasaCambio} onChange={(e) => setPagosTasaCambio(e.target.value)} required />
                <Input label="Cantidad de semanas" type="number" min="1" value={pagosSemanas} onChange={(e) => setPagosSemanas(e.target.value)} required />
                <Input label="Año" type="number" value={pagosAnio} onChange={(e) => setPagosAnio(e.target.value)} required />
                <Select
                  label="Ubicación / Feria"
                  value={pagosUbicacionId}
                  onChange={(e) => setPagosUbicacionId(Number(e.target.value))}
                >
                  <option value="">Selecciona...</option>
                  {pagosUbicaciones.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setPagosAbierto(false)} className="flex-1">Cerrar</Button>
                <Button onClick={() => void confirmarPago()} disabled={!pagosFormularioValido} isLoading={pagosEnviando} className="flex-1">
                  Guardar
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: TRASPASO A FUNERARIA */}
      {/* ============================================ */}
      <Modal open={traspasoAbierto} onClose={() => setTraspasoAbierto(false)} title="Traspaso a Funeraria" description="Copia al titular y beneficiarios seleccionados al servicio de funeraria" size="md">
        {traspasoError && (
          <Alert variant="error" className="mb-4">{traspasoError}</Alert>
        )}

        {traspasoResultado ? (
          <div className="space-y-4">
            <Alert variant="success">{traspasoResultado}</Alert>
            <Button onClick={() => setTraspasoAbierto(false)} className="w-full">Cerrar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <BuscarPorNumeroInline
              label="Número de acuerdo de salud"
              value={traspasoNumeroAcuerdo}
              onChange={setTraspasoNumeroAcuerdo}
              onBuscar={() => void buscarGrupoParaTraspaso()}
              buscando={traspasoBuscando}
              autoFocus
            />

            {traspasoGrupo && (
              <>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 mb-2">Personas a transferir</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {traspasoGrupo.titular && (
                      <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-neutral-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={traspasoSeleccionados.includes(traspasoGrupo.titular.beneficiario_id)}
                          onChange={() => alternarSeleccionTraspaso(traspasoGrupo.titular!.beneficiario_id)}
                        />
                        <span>{traspasoGrupo.titular.nombre} {traspasoGrupo.titular.apellido} <span className="text-neutral-400">(Titular)</span></span>
                      </label>
                    )}
                    {traspasoGrupo.beneficiarios.map((b) => (
                      <label key={b.beneficiario_id} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-neutral-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={traspasoSeleccionados.includes(b.beneficiario_id)}
                          onChange={() => alternarSeleccionTraspaso(b.beneficiario_id)}
                        />
                        <span>{b.nombre} {b.apellido} <span className="text-neutral-400">({b.parentesco})</span></span>
                      </label>
                    ))}
                  </div>
                </div>

                <Select
                  label="Tipo de acuerdo de funeraria"
                  value={traspasoTipoId}
                  onChange={(e) => setTraspasoTipoId(Number(e.target.value))}
                >
                  <option value="">Selecciona...</option>
                  {tiposFuneraria.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </Select>
                <Input label="Número de acuerdo base (funeraria)" value={traspasoNumeroBase} onChange={(e) => setTraspasoNumeroBase(e.target.value)} placeholder="Ej: FUN-005500" />
                <Input label="Número de contrato (opcional)" value={traspasoNumeroContrato} onChange={(e) => setTraspasoNumeroContrato(e.target.value)} />

                <Button onClick={() => void confirmarTraspasoFuneraria()} disabled={!traspasoFormularioValido} isLoading={traspasoEnviando} className="w-full">
                  <ArrowRightLeft className="w-4 h-4" />
                  Confirmar Traspaso
                </Button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: CAMBIAR ESTADO */}
      {/* ============================================ */}
      <Modal
        open={estadoModalAbierto}
        onClose={() => setEstadoModalAbierto(false)}
        title={estadoAccion === 'suspendido' ? 'Suspender Acuerdo' : 'Reactivar Acuerdo'}
        description="Esta acción afecta a todas las personas del acuerdo"
        size="sm"
      >
        {estadoError && (
          <Alert variant="error" className="mb-4">{estadoError}</Alert>
        )}
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Acuerdo <span className="font-mono font-medium">{estadoAcuerdo?.numero_acuerdo || estadoAcuerdo?.id}</span> —{' '}
            {estadoAcuerdo?.socio?.nombre_completo}
          </p>
          <label className="block text-sm font-medium text-neutral-700">
            Motivo (opcional)
            <textarea
              value={estadoMotivo}
              onChange={(e) => setEstadoMotivo(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <Button
            variant={estadoAccion === 'suspendido' ? 'danger' : 'primary'}
            onClick={() => void confirmarCambiarEstado()}
            isLoading={estadoEnviando}
            className="w-full"
          >
            {estadoAccion === 'suspendido' ? 'Confirmar Suspensión' : 'Confirmar Reactivación'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
