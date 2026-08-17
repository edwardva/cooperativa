/**
 * ============================================
 * PAGE: FUNERARIA
 * ============================================
 * Gestión de acuerdos de funeraria: acuerdos activos/suspendidos/retirados,
 * ficha del socio con todos sus beneficiarios, impresión, reporte de
 * suspendidos e importación rápida hacia Salud.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PlusCircle,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Shield,
  MoreVertical,
  Eye,
  Printer,
  FileSpreadsheet,
  HeartPulse,
  UserPlus,
  Edit2,
  Trash2,
  Skull,
  ArrowRight,
  ArrowLeft,
  ArrowRightLeft,
  Contact,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { SortableHeader } from '../components/ui/SortableHeader'
import { PrintableListado } from '../components/print/PrintableListado'
import * as funerariaService from '../services/funerariaService'
import * as sociosService from '../services/sociosService'
import * as saludService from '../services/saludService'
import type { AcuerdoFuneraria, AcuerdoDetalle, TipoAcuerdo } from '../services/funerariaService'
import type { Socio, Beneficiario, BeneficiarioFormData } from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { formatearFecha, calcularEdad } from '../utils/formatters'
import { usePermissions } from '../store/authStore'

type Tab = 'activo' | 'suspendido' | 'retirado' | 'todos'

const hoyISO = (): string => new Date().toISOString().split('T')[0] ?? ''

const emptyBeneficiarioForm = (): BeneficiarioFormData => ({
  cedula: '',
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  fecha_ingreso: hoyISO(),
  parentesco: '',
  telefono: '',
})

export default function FunerariaPage() {
  const { hasPermission } = usePermissions()
  const puedeEscribir = hasPermission('funeraria', 'create') || hasPermission('funeraria', 'update')

  // Datos
  const [acuerdos, setAcuerdos] = useState<AcuerdoFuneraria[]>([])
  const [tiposAcuerdo, setTiposAcuerdo] = useState<TipoAcuerdo[]>([])
  const [estadisticas, setEstadisticas] = useState({
    total_acuerdos: 0,
    activos: 0,
    suspendidos: 0,
    retirados: 0,
    proximos_suspender: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState<Tab>('activo')
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [itemsPorPagina, setItemsPorPagina] = useState(5)

  // Ordenamiento de la tabla
  const [sortField, setSortField] = useState<string>('socio.codigo_socio')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Menú de acciones por fila
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null)
  const [menuAncla, setMenuAncla] = useState<{ top: number; bottom: number; right: number } | null>(null)
  const [menuEstilo, setMenuEstilo] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [imprimiendoFilaId, setImprimiendoFilaId] = useState<number | null>(null)

  const cerrarMenuAcciones = () => {
    setMenuAbiertoId(null)
    setMenuAncla(null)
    setMenuEstilo(null)
  }

  const alternarMenuAcciones = (acuerdoId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (menuAbiertoId === acuerdoId) {
      cerrarMenuAcciones()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuEstilo(null)
    setMenuAncla({ top: rect.top, bottom: rect.bottom, right: rect.right })
    setMenuAbiertoId(acuerdoId)
  }

  // Calcula la posición final del menú (abre hacia arriba si no cabe hacia abajo)
  // y lo mantiene dentro de los límites horizontales de la ventana.
  useLayoutEffect(() => {
    if (menuAbiertoId === null || !menuAncla || !menuRef.current) return

    const MENU_ANCHO = 208
    const MARGEN = 8
    const alturaMenu = menuRef.current.offsetHeight
    const alturaVentana = window.innerHeight
    const anchoVentana = window.innerWidth

    const abrirHaciaArriba = menuAncla.bottom + alturaMenu + MARGEN > alturaVentana

    const top = abrirHaciaArriba
      ? Math.max(MARGEN, menuAncla.top - alturaMenu - 4)
      : menuAncla.bottom + 4

    const left = Math.min(
      Math.max(MARGEN, menuAncla.right - MENU_ANCHO),
      anchoVentana - MENU_ANCHO - MARGEN
    )

    setMenuEstilo({ top, left })
  }, [menuAbiertoId, menuAncla])

  // Cierra el menú si el usuario hace scroll o redimensiona la ventana
  useEffect(() => {
    if (menuAbiertoId === null) return
    window.addEventListener('scroll', cerrarMenuAcciones, true)
    window.addEventListener('resize', cerrarMenuAcciones)
    return () => {
      window.removeEventListener('scroll', cerrarMenuAcciones, true)
      window.removeEventListener('resize', cerrarMenuAcciones)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuAbiertoId])

  // Reporte de suspendidos
  const [generandoReporte, setGenerandoReporte] = useState(false)
  const [imprimiendoListadoSuspendidos, setImprimiendoListadoSuspendidos] = useState(false)

  // ============================================
  // WIZARD: NUEVO ACUERDO
  // ============================================
  const [wizardAbierto, setWizardAbierto] = useState(false)
  const [wizardPaso, setWizardPaso] = useState<1 | 2 | 3>(1)
  const [wizardCedula, setWizardCedula] = useState('')
  const [wizardBuscando, setWizardBuscando] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [wizardSocio, setWizardSocio] = useState<Socio | null>(null)
  const [wizardTipoAcuerdoId, setWizardTipoAcuerdoId] = useState<number | ''>('')
  const [wizardNumeroAcuerdo, setWizardNumeroAcuerdo] = useState('')
  const [wizardNumeroContrato, setWizardNumeroContrato] = useState('')
  const [wizardFechaInicio, setWizardFechaInicio] = useState(hoyISO())
  const [wizardEnviando, setWizardEnviando] = useState(false)

  const cerrarWizard = () => {
    setWizardAbierto(false)
    setWizardPaso(1)
    setWizardCedula('')
    setWizardError(null)
    setWizardSocio(null)
    setWizardTipoAcuerdoId('')
    setWizardNumeroAcuerdo('')
    setWizardNumeroContrato('')
    setWizardFechaInicio(hoyISO())
  }

  // ============================================
  // TRASPASO DE SOCIO (transferir titularidad a un familiar directo)
  // ============================================
  const emptyTraspasoForm = (): sociosService.TraspasoSocioData => ({
    nueva_cedula: '',
    nuevo_nombre: '',
    nuevo_apellido: '',
    nueva_fecha_nacimiento: '',
    parentesco: sociosService.PARENTESCOS_TRASPASO_DIRECTO[0],
    nuevo_telefono: '',
    nuevo_email: '',
    nueva_direccion: '',
    motivo: '',
    confirma_acuerdo_titular: false,
    confirma_problemas_medicos: false,
  })

  const [traspasoAbierto, setTraspasoAbierto] = useState(false)
  const [traspasoPaso, setTraspasoPaso] = useState<1 | 2 | 3>(1)
  const [traspasoExpediente, setTraspasoExpediente] = useState('')
  const [traspasoBuscando, setTraspasoBuscando] = useState(false)
  const [traspasoError, setTraspasoError] = useState<string | null>(null)
  const [traspasoSocio, setTraspasoSocio] = useState<Socio | null>(null)
  const [traspasoTieneAcuerdoActivo, setTraspasoTieneAcuerdoActivo] = useState<boolean | null>(null)
  const [traspasoForm, setTraspasoForm] = useState<sociosService.TraspasoSocioData>(emptyTraspasoForm())
  const [traspasoEnviando, setTraspasoEnviando] = useState(false)
  const [traspasoResultado, setTraspasoResultado] = useState<Socio | null>(null)

  const abrirTraspaso = () => {
    setTraspasoAbierto(true)
    setTraspasoPaso(1)
    setTraspasoExpediente('')
    setTraspasoError(null)
    setTraspasoSocio(null)
    setTraspasoTieneAcuerdoActivo(null)
    setTraspasoForm(emptyTraspasoForm())
    setTraspasoResultado(null)
  }

  const cerrarTraspaso = () => {
    setTraspasoAbierto(false)
    setTraspasoPaso(1)
    setTraspasoExpediente('')
    setTraspasoError(null)
    setTraspasoSocio(null)
    setTraspasoTieneAcuerdoActivo(null)
    setTraspasoForm(emptyTraspasoForm())
    setTraspasoResultado(null)
  }

  const traspasoEdadSocio = traspasoSocio ? calcularEdad(traspasoSocio.fecha_nacimiento) : null
  const traspasoSocioElegible =
    !!traspasoSocio &&
    traspasoSocio.estado !== 'retirado' &&
    traspasoTieneAcuerdoActivo === true &&
    traspasoEdadSocio !== null &&
    traspasoEdadSocio >= sociosService.EDAD_MINIMA_TRASPASO

  const buscarSocioTraspaso = async () => {
    if (!traspasoExpediente.trim()) return

    setTraspasoBuscando(true)
    setTraspasoError(null)
    setTraspasoSocio(null)
    setTraspasoTieneAcuerdoActivo(null)

    try {
      const respuesta = await sociosService.buscarSocioPorExpediente(traspasoExpediente.trim())
      if (!respuesta.success || !respuesta.data) {
        throw new Error('Socio no encontrado')
      }
      setTraspasoSocio(respuesta.data)
      setTraspasoForm(emptyTraspasoForm())

      const respuestaAcuerdos = await funerariaService.obtenerAcuerdosPorSocio(respuesta.data.id)
      const acuerdos = respuestaAcuerdos.success ? respuestaAcuerdos.data : []
      setTraspasoTieneAcuerdoActivo(acuerdos.some((a) => a.estado === 'activo'))
    } catch (err) {
      setTraspasoError(getErrorMessage(err) || 'Socio no encontrado')
    } finally {
      setTraspasoBuscando(false)
    }
  }

  const traspasoFormularioValido =
    traspasoSocioElegible &&
    traspasoForm.nueva_cedula.trim() !== '' &&
    traspasoForm.nuevo_nombre.trim() !== '' &&
    traspasoForm.nuevo_apellido.trim() !== '' &&
    traspasoForm.nueva_fecha_nacimiento.trim() !== '' &&
    traspasoForm.motivo.trim().length >= 10 &&
    traspasoForm.confirma_acuerdo_titular &&
    traspasoForm.confirma_problemas_medicos

  const confirmarTraspaso = async () => {
    if (!traspasoSocio || !traspasoFormularioValido) return

    const confirmado = window.confirm(
      `¿Confirmas el traspaso del expediente ${traspasoSocio.codigo_socio}, de ${traspasoSocio.nombre} ${traspasoSocio.apellido} a ${traspasoForm.nuevo_nombre} ${traspasoForm.nuevo_apellido}? El acuerdo, los beneficiarios y el histórico se mantienen; esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setTraspasoEnviando(true)
    setTraspasoError(null)

    try {
      const respuesta = await sociosService.traspasarSocio(traspasoSocio.id, traspasoForm)
      if (!respuesta.success) throw new Error('No fue posible completar el traspaso')
      setTraspasoResultado(respuesta.data)
      setTraspasoPaso(3)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
    } catch (err) {
      setTraspasoError(getErrorMessage(err))
    } finally {
      setTraspasoEnviando(false)
    }
  }

  // ============================================
  // MODAL: SOCIALES (código de programas sociales del socio)
  // ============================================
  const [socialesAbierto, setSocialesAbierto] = useState(false)
  const [socialesCargando, setSocialesCargando] = useState(false)
  const [socialesSocio, setSocialesSocio] = useState<Socio | null>(null)
  const [socialesCodigo, setSocialesCodigo] = useState('')
  const [socialesEnviando, setSocialesEnviando] = useState(false)
  const [socialesError, setSocialesError] = useState<string | null>(null)

  const cerrarSociales = () => {
    setSocialesAbierto(false)
    setSocialesSocio(null)
    setSocialesCodigo('')
    setSocialesError(null)
  }

  const abrirSociales = async (acuerdo: AcuerdoFuneraria) => {
    cerrarMenuAcciones()
    const socioId = acuerdo.socio?.id
    if (!socioId) return

    setSocialesAbierto(true)
    setSocialesCargando(true)
    setSocialesError(null)
    setSocialesSocio(null)
    setSocialesCodigo('')

    try {
      const respuesta = await sociosService.obtenerSocioPorId(socioId)
      if (!respuesta.success) throw new Error('No fue posible cargar el socio')
      setSocialesSocio(respuesta.data)
      setSocialesCodigo(respuesta.data.codigo_social || '')
    } catch (err) {
      setSocialesError(getErrorMessage(err))
    } finally {
      setSocialesCargando(false)
    }
  }

  const guardarCodigoSocial = async () => {
    if (!socialesSocio || socialesCodigo.trim() === '') return

    setSocialesEnviando(true)
    setSocialesError(null)

    try {
      const respuesta = await sociosService.actualizarCodigoSocial(socialesSocio.id, socialesCodigo.trim())
      if (!respuesta.success) throw new Error('No fue posible guardar el código social')
      setSocialesSocio(respuesta.data)
      setSocialesCodigo(respuesta.data.codigo_social || '')
      cerrarSociales()
    } catch (err) {
      setSocialesError(getErrorMessage(err))
    } finally {
      setSocialesEnviando(false)
    }
  }

  // ============================================
  // MODAL: EDITAR ACUERDO
  // ============================================
  const [editModalAbierto, setEditModalAbierto] = useState(false)
  const [acuerdoEditando, setAcuerdoEditando] = useState<AcuerdoFuneraria | null>(null)
  const [editTipoAcuerdoId, setEditTipoAcuerdoId] = useState<number | ''>('')
  const [editNumeroContrato, setEditNumeroContrato] = useState('')
  const [editFechaInicio, setEditFechaInicio] = useState(hoyISO())
  const [editEnviando, setEditEnviando] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const abrirModalEditar = (acuerdo: AcuerdoFuneraria) => {
    cerrarMenuAcciones()
    setAcuerdoEditando(acuerdo)
    setEditTipoAcuerdoId(acuerdo.tipo_acuerdo.id)
    setEditNumeroContrato(acuerdo.numero_contrato || '')
    setEditFechaInicio(acuerdo.fecha_inicio.split('T')[0] || hoyISO())
    setEditError(null)
    setEditModalAbierto(true)
  }

  const editFormularioValido = Boolean(editTipoAcuerdoId) && editFechaInicio.trim() !== ''

  const confirmarEdicion = async () => {
    if (!acuerdoEditando || !editFormularioValido) {
      setEditError('El tipo de acuerdo y la fecha de ingreso son obligatorios.')
      return
    }

    setEditEnviando(true)
    setEditError(null)

    try {
      const respuesta = await funerariaService.actualizarAcuerdo(acuerdoEditando.id, {
        tipo_acuerdo_id: editTipoAcuerdoId || undefined,
        numero_contrato: editNumeroContrato.trim() || null,
        fecha_inicio: new Date(editFechaInicio).toISOString(),
      })

      if (!respuesta.success) throw new Error('No fue posible actualizar el acuerdo')

      setEditModalAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      if (drawerAbierto && acuerdoDetalle?.id === acuerdoEditando.id) {
        await abrirFicha(acuerdoEditando)
      }
    } catch (err) {
      setEditError(getErrorMessage(err))
    } finally {
      setEditEnviando(false)
    }
  }

  // ============================================
  // DRAWER: FICHA DEL ACUERDO
  // ============================================
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [drawerCargando, setDrawerCargando] = useState(false)
  const [acuerdoDetalle, setAcuerdoDetalle] = useState<AcuerdoDetalle | null>(null)
  const [beneficiariosSocio, setBeneficiariosSocio] = useState<Beneficiario[]>([])
  const [imprimiendo, setImprimiendo] = useState(false)

  const abrirFicha = async (acuerdo: AcuerdoFuneraria) => {
    cerrarMenuAcciones()
    setDrawerAbierto(true)
    setDrawerCargando(true)
    setAcuerdoDetalle(null)
    setBeneficiariosSocio([])

    try {
      const respuestaAcuerdo = await funerariaService.obtenerAcuerdo(acuerdo.id)
      if (!respuestaAcuerdo.success) throw new Error('No fue posible cargar el acuerdo')
      setAcuerdoDetalle(respuestaAcuerdo.data)

      const socioId = respuestaAcuerdo.data.socio?.id
      if (socioId) {
        const respuestaBeneficiarios = await sociosService.obtenerBeneficiarios(socioId, true)
        if (respuestaBeneficiarios.success) {
          setBeneficiariosSocio(respuestaBeneficiarios.data)
        }
      }
    } catch (err) {
      window.alert(getErrorMessage(err))
      setDrawerAbierto(false)
    } finally {
      setDrawerCargando(false)
    }
  }

  const recargarBeneficiarios = async () => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return
    const respuesta = await sociosService.obtenerBeneficiarios(socioId, true)
    if (respuesta.success) setBeneficiariosSocio(respuesta.data)
  }

  // ============================================
  // MODAL: BENEFICIARIO (agregar / editar)
  // ============================================
  const [beneficiarioModalAbierto, setBeneficiarioModalAbierto] = useState(false)
  const [beneficiarioEditando, setBeneficiarioEditando] = useState<Beneficiario | null>(null)
  const [beneficiarioForm, setBeneficiarioForm] = useState<BeneficiarioFormData>(emptyBeneficiarioForm())
  const [beneficiarioEnviando, setBeneficiarioEnviando] = useState(false)
  const [beneficiarioError, setBeneficiarioError] = useState<string | null>(null)

  const abrirNuevoBeneficiario = () => {
    setBeneficiarioEditando(null)
    setBeneficiarioForm(emptyBeneficiarioForm())
    setBeneficiarioError(null)
    setBeneficiarioModalAbierto(true)
  }

  // Máximo 8 beneficiarios activos por socio; sumando al titular dan 9 personas
  // en total. Al retirar o marcar como fallecido a un beneficiario, su cupo
  // queda libre. El backend aplica el mismo tope al crear (ver agregarBeneficiario
  // en sociosController.ts). La lista del detalle solo muestra beneficiarios
  // activos; los retirados/fallecidos solo aparecen en la ficha impresa.
  //
  // Los datos migrados incluyen, para cada socio, una fila de Beneficiario con
  // parentesco "titular" que representa al propio socio (usada para imprimir la
  // ficha con el formato histórico). Esa fila no es un beneficiario real: hay
  // que excluirla de la lista visible y del conteo, o el titular ocuparía uno
  // de los 8 cupos de su propia familia.
  const MAX_BENEFICIARIOS_POR_SOCIO = 8
  const esFilaTitular = (b: Beneficiario) => b.parentesco?.trim().toLowerCase() === 'titular'
  const beneficiariosVisibles = beneficiariosSocio.filter((b) => b.estado === 'activo' && !esFilaTitular(b))
  const beneficiariosActivosCount = beneficiariosVisibles.length
  const limiteBeneficiariosAlcanzado = beneficiariosActivosCount >= MAX_BENEFICIARIOS_POR_SOCIO

  const abrirEditarBeneficiario = (beneficiario: Beneficiario) => {
    setBeneficiarioEditando(beneficiario)
    setBeneficiarioForm({
      cedula: beneficiario.cedula,
      nombre: beneficiario.nombre,
      apellido: beneficiario.apellido,
      fecha_nacimiento: beneficiario.fecha_nacimiento?.split('T')[0] || '',
      fecha_ingreso: beneficiario.fecha_ingreso?.split('T')[0] || beneficiario.created_at?.split('T')[0] || '',
      parentesco: beneficiario.parentesco,
      telefono: beneficiario.telefono || '',
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

  const guardarBeneficiario = async () => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return

    if (!beneficiarioFormularioValido) {
      setBeneficiarioError('Completa todos los campos: cédula, nombre, apellido, parentesco, fecha de nacimiento y fecha de ingreso.')
      return
    }

    setBeneficiarioEnviando(true)
    setBeneficiarioError(null)

    try {
      if (beneficiarioEditando) {
        await sociosService.actualizarBeneficiario(socioId, beneficiarioEditando.id, beneficiarioForm)
      } else {
        await sociosService.crearBeneficiario(socioId, beneficiarioForm)
      }
      setBeneficiarioModalAbierto(false)
      await recargarBeneficiarios()
    } catch (err) {
      setBeneficiarioError(getErrorMessage(err))
    } finally {
      setBeneficiarioEnviando(false)
    }
  }

  const marcarFallecido = async (beneficiario: Beneficiario) => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return
    const confirmado = window.confirm(
      `¿Marcar a ${beneficiario.nombre} ${beneficiario.apellido} como fallecido?`
    )
    if (!confirmado) return

    try {
      await sociosService.actualizarBeneficiario(socioId, beneficiario.id, {
        estado: 'fallecido',
        fecha_fallecimiento: hoyISO(),
      })
      await recargarBeneficiarios()
    } catch (err) {
      window.alert(getErrorMessage(err))
    }
  }

  const eliminarBeneficiarioAccion = async (beneficiario: Beneficiario) => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return
    const confirmado = window.confirm(
      `¿Retirar a ${beneficiario.nombre} ${beneficiario.apellido} de los beneficiarios?`
    )
    if (!confirmado) return

    try {
      await sociosService.eliminarBeneficiario(socioId, beneficiario.id)
      await recargarBeneficiarios()
    } catch (err) {
      window.alert(getErrorMessage(err))
    }
  }

  // ============================================
  // MODAL: CAMBIAR ESTADO
  // ============================================
  const [estadoModalAbierto, setEstadoModalAbierto] = useState(false)
  const [estadoAcuerdo, setEstadoAcuerdo] = useState<AcuerdoFuneraria | null>(null)
  const [estadoAccion, setEstadoAccion] = useState<'activo' | 'suspendido' | 'retirado' | null>(null)
  const [estadoFechaRetiro, setEstadoFechaRetiro] = useState(hoyISO())
  const [estadoMotivo, setEstadoMotivo] = useState('')
  const [estadoEnviando, setEstadoEnviando] = useState(false)
  const [estadoError, setEstadoError] = useState<string | null>(null)

  const abrirCambiarEstado = (acuerdo: AcuerdoFuneraria, accion: 'activo' | 'suspendido' | 'retirado') => {
    cerrarMenuAcciones()
    setEstadoAcuerdo(acuerdo)
    setEstadoAccion(accion)
    setEstadoFechaRetiro(hoyISO())
    setEstadoMotivo('')
    setEstadoError(null)
    setEstadoModalAbierto(true)
  }

  const confirmarCambiarEstado = async () => {
    if (!estadoAcuerdo || !estadoAccion) return

    setEstadoEnviando(true)
    setEstadoError(null)

    try {
      const respuesta = await funerariaService.cambiarEstado(estadoAcuerdo.id, {
        estado: estadoAccion,
        motivo: estadoMotivo || undefined,
        fecha_retiro: estadoAccion === 'retirado' ? estadoFechaRetiro : undefined,
      })
      if (!respuesta.success) throw new Error('No fue posible actualizar el estado del acuerdo')

      setEstadoModalAbierto(false)
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      if (drawerAbierto && acuerdoDetalle?.id === estadoAcuerdo.id) {
        await abrirFicha(estadoAcuerdo)
      }
    } catch (err) {
      setEstadoError(getErrorMessage(err))
    } finally {
      setEstadoEnviando(false)
    }
  }

  // ============================================
  // MODAL: IMPORTAR A SALUD
  // ============================================
  const [importarSaludAbierto, setImportarSaludAbierto] = useState(false)
  const [tiposSalud, setTiposSalud] = useState<saludService.TipoAcuerdo[]>([])
  const [importarSaludTipoId, setImportarSaludTipoId] = useState<number | ''>('')
  const [importarSaludSeleccionados, setImportarSaludSeleccionados] = useState<number[]>([])
  const [importarSaludEnviando, setImportarSaludEnviando] = useState(false)
  const [importarSaludError, setImportarSaludError] = useState<string | null>(null)
  const [importarSaludResultado, setImportarSaludResultado] = useState<string | null>(null)

  const abrirImportarSalud = async () => {
    cerrarMenuAcciones()
    setImportarSaludSeleccionados([])
    setImportarSaludTipoId('')
    setImportarSaludError(null)
    setImportarSaludResultado(null)
    setImportarSaludAbierto(true)

    if (tiposSalud.length === 0) {
      try {
        const respuesta = await saludService.obtenerTiposAcuerdo()
        if (respuesta.success) setTiposSalud(respuesta.data)
      } catch {
        // El selector quedará vacío; el usuario verá el mensaje de "sin tipos disponibles"
      }
    }
  }

  const confirmarImportarSalud = async () => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId || !importarSaludTipoId || importarSaludSeleccionados.length === 0) return

    setImportarSaludEnviando(true)
    setImportarSaludError(null)

    let exitosos = 0
    let yaExistentes = 0

    for (const beneficiarioId of importarSaludSeleccionados) {
      try {
        await saludService.crearAcuerdo({
          socio_id: socioId,
          tipo_acuerdo_id: importarSaludTipoId,
          beneficiario_id: beneficiarioId,
        })
        exitosos++
      } catch (err: any) {
        if (err?.response?.status === 409) {
          yaExistentes++
        } else {
          setImportarSaludError(getErrorMessage(err))
        }
      }
    }

    setImportarSaludEnviando(false)
    setImportarSaludResultado(
      `${exitosos} beneficiario(s) importado(s) a Salud. ${yaExistentes > 0 ? `${yaExistentes} ya tenían acuerdo activo.` : ''}`
    )
  }

  // ============================================
  // CARGA DE DATOS
  // ============================================
  const cargarEstadisticas = async () => {
    try {
      const response = await funerariaService.obtenerEstadisticas()
      if (response.success && response.data) {
        const data = response.data as any
        setEstadisticas({
          total_acuerdos: data.total_acuerdos || 0,
          activos: data.por_estado?.activos || 0,
          suspendidos: data.por_estado?.suspendidos || 0,
          retirados: data.por_estado?.retirados || 0,
          proximos_suspender: data.alertas?.proximos_suspender || 0,
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

      const response = await funerariaService.obtenerAcuerdos(params)

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
      const respuesta = await funerariaService.obtenerTiposAcuerdo()
      if (respuesta.success) setTiposAcuerdo(respuesta.data)
    })()
  }, [])

  useEffect(() => {
    void cargarAcuerdos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual, busqueda, tab, itemsPorPagina])

  // ============================================
  // WIZARD: ACCIONES
  // ============================================
  const buscarSocioWizard = async () => {
    if (!wizardCedula.trim()) return

    setWizardBuscando(true)
    setWizardError(null)

    try {
      const respuesta = await sociosService.buscarSocioPorCedula(wizardCedula.trim())
      if (!respuesta.success || !respuesta.data) {
        throw new Error('Socio no encontrado')
      }
      const socioEncontrado = respuesta.data[0]
      if (!socioEncontrado) {
        throw new Error('Socio no encontrado')
      }
      setWizardSocio(socioEncontrado)
      setWizardPaso(2)
    } catch (err) {
      setWizardError(getErrorMessage(err) || 'Socio no encontrado')
    } finally {
      setWizardBuscando(false)
    }
  }

  const confirmarNuevoAcuerdo = async () => {
    if (!wizardSocio || !wizardTipoAcuerdoId || !wizardNumeroAcuerdo.trim()) return

    setWizardEnviando(true)
    setWizardError(null)

    try {
      const respuesta = await funerariaService.crearAcuerdo({
        socio_id: wizardSocio.id,
        tipo_acuerdo_id: wizardTipoAcuerdoId,
        numero_acuerdo: wizardNumeroAcuerdo.trim(),
        numero_contrato: wizardNumeroContrato.trim() || undefined,
        fecha_inicio: new Date(wizardFechaInicio).toISOString(),
      })

      if (!respuesta.success) throw new Error('No fue posible crear el acuerdo')

      cerrarWizard()
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      window.alert('Acuerdo de funeraria creado exitosamente')
    } catch (err) {
      setWizardError(getErrorMessage(err))
    } finally {
      setWizardEnviando(false)
    }
  }

  // ============================================
  // IMPRIMIR FICHA
  // ============================================
  const construirPayloadFicha = (
    detalle: AcuerdoDetalle,
    beneficiarios: Beneficiario[]
  ): funerariaService.FichaAcuerdoFunerariaData => ({
    numero_acuerdo: detalle.numero_acuerdo || 'S/N',
    numero_contrato: detalle.numero_contrato || undefined,
    fecha_inicio: detalle.fecha_inicio,
    socio: {
      codigo: detalle.socio?.codigo_socio || '',
      cedula: detalle.socio?.cedula || '',
      nombre: detalle.socio?.nombre_completo || '',
      direccion: detalle.socio?.direccion || undefined,
      telefono: detalle.socio?.telefono || undefined,
    },
    beneficiarios: beneficiarios.map((b) => ({
      id: b.id,
      nombre: `${b.nombre} ${b.apellido}`,
      cedula: b.cedula,
      parentesco: b.parentesco,
      fecha_ingreso: b.fecha_ingreso || b.created_at,
      fecha_nacimiento: b.fecha_nacimiento || undefined,
      edad: calcularEdad(b.fecha_nacimiento) ?? undefined,
      estado: b.estado,
    })),
  })

  const abrirVentanaImpresionFicha = (contenido: string) => {
    const ventana = window.open('', '_blank')
    if (ventana) {
      ventana.document.write(`
        <html>
          <head>
            <title>Ficha de Acuerdo - Cooperativa el Triunfo</title>
            <style>
              body { margin: 0; padding: 20mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; }
              pre { margin: 0; white-space: pre-wrap; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <pre>${contenido}</pre>
            <script>
              window.onload = function () {
                window.print();
                window.onafterprint = function () { window.close(); };
              };
            </script>
          </body>
        </html>
      `)
      ventana.document.close()
    }
  }

  const imprimirFicha = async () => {
    if (!acuerdoDetalle?.socio) return

    setImprimiendo(true)
    try {
      const payload = construirPayloadFicha(acuerdoDetalle, beneficiariosSocio)
      const respuesta = await funerariaService.imprimirFichaAcuerdo(payload)
      if (!respuesta.success) throw new Error('No fue posible generar la ficha')
      abrirVentanaImpresionFicha(respuesta.data.contenido)
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setImprimiendo(false)
    }
  }

  const imprimirFichaDesdeFila = async (acuerdo: AcuerdoFuneraria) => {
    cerrarMenuAcciones()
    setImprimiendoFilaId(acuerdo.id)
    try {
      const respuestaAcuerdo = await funerariaService.obtenerAcuerdo(acuerdo.id)
      if (!respuestaAcuerdo.success) throw new Error('No fue posible cargar el acuerdo')
      const detalle = respuestaAcuerdo.data

      let beneficiarios: Beneficiario[] = []
      const socioId = detalle.socio?.id
      if (socioId) {
        const respuestaBeneficiarios = await sociosService.obtenerBeneficiarios(socioId, true)
        if (respuestaBeneficiarios.success) beneficiarios = respuestaBeneficiarios.data
      }

      const payload = construirPayloadFicha(detalle, beneficiarios)
      const respuesta = await funerariaService.imprimirFichaAcuerdo(payload)
      if (!respuesta.success) throw new Error('No fue posible generar la ficha')
      abrirVentanaImpresionFicha(respuesta.data.contenido)
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setImprimiendoFilaId(null)
    }
  }

  const eliminarAcuerdoAccion = async (acuerdo: AcuerdoFuneraria) => {
    cerrarMenuAcciones()
    const confirmado = window.confirm(
      `¿Eliminar definitivamente el acuerdo ${acuerdo.numero_acuerdo || acuerdo.id}? Esta acción solo se permite si no tiene movimientos registrados.`
    )
    if (!confirmado) return

    try {
      const respuesta = await funerariaService.eliminarAcuerdo(acuerdo.id)
      if (!respuesta.success) throw new Error('No fue posible eliminar el acuerdo')
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
    } catch (err) {
      window.alert(getErrorMessage(err))
    }
  }

  const descargarReporteSuspendidos = async () => {
    setGenerandoReporte(true)
    try {
      await funerariaService.descargarReporteSuspendidos()
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setGenerandoReporte(false)
    }
  }

  const abrirVentanaImpresionListado = (filas: funerariaService.AcuerdoSuspendidoListado[]) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    const filasHtml = filas
      .map(
        (fila, i) => `
          <tr class="${i % 2 === 1 ? 'par' : ''}">
            <td>${fila.expediente}</td>
            <td>${fila.numero_acuerdo}</td>
            <td>${fila.apellidos} ${fila.nombres}</td>
            <td>${fila.cedula}</td>
            <td>${fila.telefono}</td>
            <td class="text-center atraso">${fila.semanas_atraso}</td>
          </tr>
        `
      )
      .join('')

    ventana.document.write(`
      <html>
        <head>
          <title>Socios Suspendidos - Cooperativa el Triunfo</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 14mm 12mm;
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 12px;
              color: #1f2937;
            }
            header { margin-bottom: 16px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; }
            h1 { font-size: 17px; margin: 0 0 3px; font-weight: 700; letter-spacing: 0.2px; }
            p.subtitulo { margin: 0; color: #6b7280; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; }
            thead th {
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #6b7280;
              font-weight: 600;
              padding: 0 10px 8px;
              border-bottom: 1.5px solid #1f2937;
            }
            tbody td {
              padding: 7px 10px;
              vertical-align: top;
            }
            tbody tr.par { background: #f8fafc; }
            .text-center { text-align: center; }
            .atraso { font-weight: 700; color: #b91c1c; }
            footer { margin-top: 16px; color: #9ca3af; font-size: 10px; text-align: right; }
            @media print {
              body { padding: 0; }
              @page { margin: 14mm 12mm; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>Listado de Socios Suspendidos · Funeraria</h1>
            <p class="subtitulo">Cooperativa el Triunfo, R.L. — Generado el ${formatearFecha(hoyISO())} — Total: ${filas.length}</p>
          </header>
          <table>
            <thead>
              <tr>
                <th>N° Expediente</th>
                <th>N° Acuerdo</th>
                <th>Nombres y Apellidos</th>
                <th>Cédula</th>
                <th>Teléfono</th>
                <th class="text-center">Semanas de Atraso</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>
          <footer>${filas.length} registro${filas.length === 1 ? '' : 's'}</footer>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `)
    ventana.document.close()
  }

  const imprimirListadoSuspendidos = async () => {
    setImprimiendoListadoSuspendidos(true)
    try {
      const respuesta = await funerariaService.obtenerListadoSuspendidos()
      if (!respuesta.success) throw new Error('No fue posible generar el listado')
      if (respuesta.data.length === 0) {
        window.alert('No hay socios suspendidos para imprimir.')
        return
      }
      abrirVentanaImpresionListado(respuesta.data)
    } catch (err) {
      window.alert(getErrorMessage(err))
    } finally {
      setImprimiendoListadoSuspendidos(false)
    }
  }

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

  const badgeBeneficiario = (beneficiario: Beneficiario) => {
    switch (beneficiario.estado) {
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

    const obtenerValorOrdenable = (acuerdo: AcuerdoFuneraria): any => {
      if (!sortField.includes('.')) {
        return (acuerdo as any)[sortField];
      }

      const partes = sortField.split('.');
      const obj = partes[0] ?? '';
      const prop = partes[1] ?? '';
      if (!obj || !prop) {
        return undefined;
      }

      const base = (acuerdo as any)[obj];
      return base?.[prop];
    };
    
    acuerdosCopia.sort((a, b) => {
      let compareA: any = obtenerValorOrdenable(a);
      let compareB: any = obtenerValorOrdenable(b);

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

  const filtrosImpresion = [
    { label: 'Búsqueda', value: busqueda || 'Sin búsqueda' },
    { label: 'Estado', value: tabs.find((t) => t.id === tab)?.label ?? 'Todos' },
    { label: 'Página', value: `${paginaActual} de ${totalPaginas}` },
  ];

  const filasImpresion = acuerdosOrdenados.map((acuerdo) => [
    acuerdo.socio?.codigo_socio ?? '-',
    acuerdo.numero_acuerdo ?? '-',
    acuerdo.socio?.nombre_completo ?? '-',
    acuerdo.beneficiario.nombre_completo,
    acuerdo.tipo_acuerdo.nombre,
    String(acuerdo.semanas_sin_pago ?? 0),
    acuerdo.estado,
    formatearFecha(
      acuerdo.estado === 'retirado' && acuerdo.fecha_retiro ? acuerdo.fecha_retiro : acuerdo.fecha_inicio
    ),
  ]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Funeraria</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Acuerdos de servicio funerario por socio y sus beneficiarios cubiertos
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button
            variant="outline"
            onClick={() => void descargarReporteSuspendidos()}
            isLoading={generandoReporte}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Reporte Suspendidos
          </Button>
          {puedeEscribir && (
            <Button onClick={() => setWizardAbierto(true)}>
              <PlusCircle className="w-4 h-4" />
              Nuevo Acuerdo
            </Button>
          )}
        </div>
      </div>

      <PrintableListado
        titulo="Listado de Acuerdos de Funeraria"
        subtitulo="Listado generado con los filtros y orden actual del módulo de funeraria"
        filtros={filtrosImpresion}
        resumenes={[
          { label: 'Acuerdos visibles', value: String(acuerdosOrdenados.length) },
          { label: 'Total acuerdos', value: String(estadisticas.total_acuerdos) },
          { label: 'Activos', value: String(estadisticas.activos) },
          { label: 'Suspendidos', value: String(estadisticas.suspendidos) },
        ]}
        columnas={['N° Expediente', 'N° Acuerdo', 'Socio', 'Beneficiario', 'Tipo de acuerdo', 'Semanas sin pago', 'Estado', 'Fecha']}
        filas={filasImpresion}
      />

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Acuerdos</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {estadisticas.total_acuerdos.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Activos</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {estadisticas.activos.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Suspendidos</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {estadisticas.suspendidos.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Próximos a Suspender</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {estadisticas.proximos_suspender.toLocaleString()}
              </p>
              <p className="text-xs text-neutral-500 mt-1">≥ 5 semanas sin pago</p>
            </div>
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* TABS + BÚSQUEDA */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
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
                {t.count !== undefined && (
                  <span className="rounded-full bg-neutral-200/70 px-1.5 text-xs">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {puedeEscribir && (
            <Button variant="outline" onClick={abrirTraspaso}>
              <ArrowRightLeft className="w-4 h-4" />
              Traspaso
            </Button>
          )}

          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar por beneficiario, cédula o número de acuerdo..."
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
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <SortableHeader
                  label="N° Expediente"
                  field="socio.codigo_socio"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="N° Acuerdo"
                  field="numero_acuerdo"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Socio"
                  field="socio.nombre_completo"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Semanas Sin Pago"
                  field="semanas_sin_pago"
                  align="center"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Estado"
                  field="estado"
                  align="center"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Fecha"
                  field="fecha_inicio"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-neutral-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Cargando acuerdos...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              ) : acuerdos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                    No se encontraron acuerdos
                  </td>
                </tr>
              ) : (
                acuerdosOrdenados.map((acuerdo) => (
                  <tr
                    key={acuerdo.id}
                    className="hover:bg-primary-50/40 cursor-pointer transition-colors"
                    onClick={() => void abrirFicha(acuerdo)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {acuerdo.socio?.codigo_socio || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-primary-700">
                        {acuerdo.numero_acuerdo || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-neutral-900">
                        {acuerdo.socio?.nombre_completo || 'Sin socio asignado'}
                      </p>
                      <p className="text-xs text-neutral-500">{acuerdo.socio?.cedula}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {acuerdo.semanas_sin_pago >= 5 ? (
                        <Badge variant="error">{acuerdo.semanas_sin_pago}</Badge>
                      ) : acuerdo.semanas_sin_pago > 0 ? (
                        <Badge variant="warning">{acuerdo.semanas_sin_pago}</Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">{badgeEstado(acuerdo.estado)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-500">
                      {acuerdo.estado === 'retirado' && acuerdo.fecha_retiro
                        ? formatearFecha(acuerdo.fecha_retiro)
                        : formatearFecha(acuerdo.fecha_inicio)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-flex items-center justify-end">
                        <button
                          onClick={(e) => alternarMenuAcciones(acuerdo.id, e)}
                          className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                          title="Acciones"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {menuAbiertoId === acuerdo.id &&
                          createPortal(
                            <>
                              <div className="fixed inset-0 z-40" onClick={cerrarMenuAcciones} />
                              <div
                                ref={menuRef}
                                style={{
                                  position: 'fixed',
                                  top: menuEstilo?.top ?? menuAncla?.bottom ?? 0,
                                  left: menuEstilo?.left ?? (menuAncla ? menuAncla.right - 208 : 0),
                                  visibility: menuEstilo ? 'visible' : 'hidden',
                                }}
                                className="z-50 w-52 rounded-lg border border-neutral-200 bg-white shadow-lg"
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => void abrirFicha(acuerdo)}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                  >
                                    <Eye className="h-4 w-4 text-neutral-500" />
                                    Ver detalle
                                  </button>
                                  <button
                                    onClick={() => void abrirSociales(acuerdo)}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                  >
                                    <Contact className="h-4 w-4 text-indigo-600" />
                                    Sociales
                                  </button>
                                  {puedeEscribir && (
                                    <button
                                      onClick={() => abrirModalEditar(acuerdo)}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                                    >
                                      <Edit2 className="h-4 w-4 text-primary-600" />
                                      Editar acuerdo
                                    </button>
                                  )}
                                  <button
                                    onClick={() => void imprimirFichaDesdeFila(acuerdo)}
                                    disabled={imprimiendoFilaId === acuerdo.id}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                                  >
                                    {imprimiendoFilaId === acuerdo.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                    ) : (
                                      <Printer className="h-4 w-4 text-emerald-600" />
                                    )}
                                    Imprimir ficha
                                  </button>
                                  {puedeEscribir && acuerdo.estado === 'suspendido' && (
                                    <button
                                      onClick={() => abrirCambiarEstado(acuerdo, 'activo')}
                                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-emerald-700 transition hover:bg-emerald-50"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                      Reactivar acuerdo
                                    </button>
                                  )}
                                  {puedeEscribir && acuerdo.estado === 'activo' && (
                                    <>
                                      <div className="my-1 border-t border-neutral-200" />
                                      <button
                                        onClick={() => abrirCambiarEstado(acuerdo, 'suspendido')}
                                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-amber-700 transition hover:bg-amber-50"
                                      >
                                        <AlertTriangle className="h-4 w-4" />
                                        Suspender acuerdo
                                      </button>
                                    </>
                                  )}
                                  {puedeEscribir && (
                                    <>
                                      <div className="my-1 border-t border-neutral-200" />
                                      <button
                                        onClick={() => void eliminarAcuerdoAccion(acuerdo)}
                                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Eliminar acuerdo
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>,
                            document.body
                          )}
                      </div>
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
                  Mostrando{' '}
                  <span className="font-semibold">{(paginaActual - 1) * itemsPorPagina + 1}</span> a{' '}
                  <span className="font-semibold">
                    {Math.min(paginaActual * itemsPorPagina, totalRegistros)}
                  </span>{' '}
                  de <span className="font-semibold">{totalRegistros}</span>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void imprimirListadoSuspendidos()}
                    isLoading={imprimiendoListadoSuspendidos}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir Suspendidos
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                >
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
      <Modal
        open={wizardAbierto}
        onClose={cerrarWizard}
        title="Nuevo Acuerdo de Funeraria"
        description={`Paso ${wizardPaso} de 3`}
        size="md"
      >
        <div className="mb-5 flex gap-2">
          {[1, 2, 3].map((paso) => (
            <div
              key={paso}
              className={`h-1.5 flex-1 rounded-full ${
                paso <= wizardPaso ? 'bg-primary-600' : 'bg-neutral-200'
              }`}
            />
          ))}
        </div>

        {wizardError && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
            {wizardError}
          </div>
        )}

        {wizardPaso === 1 && (
          <div className="space-y-4">
            <Input
              label="Cédula o código del socio"
              value={wizardCedula}
              onChange={(e) => setWizardCedula(e.target.value)}
              placeholder="Ej: 012345678"
              onKeyDown={(e) => e.key === 'Enter' && void buscarSocioWizard()}
              autoFocus
            />
            <Button onClick={() => void buscarSocioWizard()} isLoading={wizardBuscando} className="w-full">
              <Search className="w-4 h-4" />
              Buscar Socio
            </Button>
          </div>
        )}

        {wizardPaso === 2 && wizardSocio && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-semibold text-neutral-900">
                {wizardSocio.apellido}, {wizardSocio.nombre}
              </p>
              <p className="text-xs text-neutral-500">
                {wizardSocio.codigo_socio} • {wizardSocio.cedula}
              </p>
            </div>

            <label className="block text-sm font-medium text-neutral-700">
              Tipo de acuerdo
              <select
                value={wizardTipoAcuerdoId}
                onChange={(e) => setWizardTipoAcuerdoId(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecciona un tipo...</option>
                {tiposAcuerdo.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre} (${tipo.monto_usd} USD)
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Número de acuerdo"
              value={wizardNumeroAcuerdo}
              onChange={(e) => setWizardNumeroAcuerdo(e.target.value)}
              placeholder="Ej: FUN-001234"
              required
            />
            <Input
              label="Número de contrato (opcional)"
              value={wizardNumeroContrato}
              onChange={(e) => setWizardNumeroContrato(e.target.value)}
            />
            <Input
              label="Fecha de inicio"
              type="date"
              value={wizardFechaInicio}
              onChange={(e) => setWizardFechaInicio(e.target.value)}
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setWizardPaso(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button
                onClick={() => setWizardPaso(3)}
                disabled={!wizardTipoAcuerdoId || !wizardNumeroAcuerdo.trim()}
                className="flex-1"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {wizardPaso === 3 && wizardSocio && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 p-4 space-y-2 text-sm">
              <p>
                <span className="text-neutral-500">Socio:</span>{' '}
                <span className="font-medium">
                  {wizardSocio.apellido}, {wizardSocio.nombre}
                </span>
              </p>
              <p>
                <span className="text-neutral-500">Tipo de acuerdo:</span>{' '}
                <span className="font-medium">
                  {tiposAcuerdo.find((t) => t.id === wizardTipoAcuerdoId)?.nombre}
                </span>
              </p>
              <p>
                <span className="text-neutral-500">Número de acuerdo:</span>{' '}
                <span className="font-mono font-medium">{wizardNumeroAcuerdo}</span>
              </p>
              <p>
                <span className="text-neutral-500">Fecha de inicio:</span>{' '}
                <span className="font-medium">{formatearFecha(wizardFechaInicio)}</span>
              </p>
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
      {/* MODAL: TRASPASO DE SOCIO */}
      {/* ============================================ */}
      <Modal
        open={traspasoAbierto}
        onClose={cerrarTraspaso}
        title="Traspaso de Titularidad"
        description={
          traspasoPaso === 3
            ? 'Traspaso completado'
            : 'Transferir el expediente, el acuerdo y los beneficios a un familiar directo'
        }
        size="md"
      >
        {traspasoError && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
            {traspasoError}
          </div>
        )}

        {traspasoPaso === 1 && (
          <div className="space-y-4">
            <Input
              label="Número de expediente del socio"
              value={traspasoExpediente}
              onChange={(e) => setTraspasoExpediente(e.target.value)}
              placeholder="Ej: 117556"
              onKeyDown={(e) => e.key === 'Enter' && void buscarSocioTraspaso()}
              autoFocus
            />
            <Button onClick={() => void buscarSocioTraspaso()} isLoading={traspasoBuscando} className="w-full">
              <Search className="w-4 h-4" />
              Buscar Socio
            </Button>

            {traspasoSocio && (
              <div className="space-y-3">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm font-semibold text-neutral-900">
                    {traspasoSocio.apellido}, {traspasoSocio.nombre}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {traspasoSocio.codigo_socio} • {traspasoSocio.cedula}
                    {traspasoEdadSocio !== null && ` • ${traspasoEdadSocio} años`}
                  </p>
                </div>

                {!traspasoSocioElegible && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {traspasoSocio.estado === 'retirado'
                      ? 'Este socio está retirado; no se puede traspasar su titularidad.'
                      : traspasoTieneAcuerdoActivo === false
                      ? 'El traspaso solo puede realizarse si el socio tiene un acuerdo de funeraria activo (no vale con acuerdos suspendidos o retirados).'
                      : traspasoTieneAcuerdoActivo === null
                      ? 'No fue posible verificar el acuerdo de funeraria del socio.'
                      : `El traspaso solo procede si el titular tiene ${sociosService.EDAD_MINIMA_TRASPASO} años o más (edad actual: ${traspasoEdadSocio ?? 'sin fecha de nacimiento registrada'}).`}
                  </div>
                )}

                <Button
                  onClick={() => setTraspasoPaso(2)}
                  disabled={!traspasoSocioElegible}
                  className="w-full"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {traspasoPaso === 2 && traspasoSocio && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Titular actual</p>
              <p className="text-sm font-semibold text-neutral-900">
                {traspasoSocio.apellido}, {traspasoSocio.nombre}
              </p>
              <p className="text-xs text-neutral-500">
                Expediente {traspasoSocio.codigo_socio} • {traspasoSocio.cedula} • {traspasoEdadSocio} años
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Cédula del nuevo titular"
                value={traspasoForm.nueva_cedula}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nueva_cedula: e.target.value }))}
                required
              />
              <label className="block text-sm font-medium text-neutral-700">
                Parentesco con el titular actual
                <select
                  value={traspasoForm.parentesco}
                  onChange={(e) =>
                    setTraspasoForm((f) => ({
                      ...f,
                      parentesco: e.target.value as sociosService.TraspasoSocioData['parentesco'],
                    }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {sociosService.PARENTESCOS_TRASPASO_DIRECTO.map((parentesco) => (
                    <option key={parentesco} value={parentesco}>
                      {parentesco}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Nombre"
                value={traspasoForm.nuevo_nombre}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nuevo_nombre: e.target.value }))}
                required
              />
              <Input
                label="Apellido"
                value={traspasoForm.nuevo_apellido}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nuevo_apellido: e.target.value }))}
                required
              />
              <Input
                label="Fecha de nacimiento"
                type="date"
                value={traspasoForm.nueva_fecha_nacimiento}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nueva_fecha_nacimiento: e.target.value }))}
                required
              />
              <Input
                label="Teléfono (opcional)"
                value={traspasoForm.nuevo_telefono}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nuevo_telefono: e.target.value }))}
              />
              <Input
                label="Correo (opcional)"
                value={traspasoForm.nuevo_email}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nuevo_email: e.target.value }))}
              />
              <Input
                label="Dirección (opcional)"
                value={traspasoForm.nueva_direccion}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, nueva_direccion: e.target.value }))}
              />
            </div>

            <label className="block text-sm font-medium text-neutral-700">
              Motivo del traspaso
              <textarea
                value={traspasoForm.motivo}
                onChange={(e) => setTraspasoForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Describe brevemente la condición médica y el motivo del traspaso..."
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </label>

            <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={traspasoForm.confirma_acuerdo_titular}
                  onChange={(e) => setTraspasoForm((f) => ({ ...f, confirma_acuerdo_titular: e.target.checked }))}
                />
                El titular actual está de acuerdo con este traspaso.
              </label>
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={traspasoForm.confirma_problemas_medicos}
                  onChange={(e) => setTraspasoForm((f) => ({ ...f, confirma_problemas_medicos: e.target.checked }))}
                />
                El titular presenta problemas médicos que motivan el traspaso.
              </label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setTraspasoPaso(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button
                onClick={() => void confirmarTraspaso()}
                isLoading={traspasoEnviando}
                disabled={!traspasoFormularioValido}
                className="flex-1"
              >
                Confirmar Traspaso
              </Button>
            </div>
          </div>
        )}

        {traspasoPaso === 3 && traspasoResultado && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              El expediente {traspasoResultado.codigo_socio} ahora pertenece a{' '}
              <span className="font-semibold">
                {traspasoResultado.nombre} {traspasoResultado.apellido}
              </span>
              . El acuerdo, los beneficiarios y el histórico se mantuvieron sin cambios.
            </div>
            <Button onClick={cerrarTraspaso} className="w-full">
              Cerrar
            </Button>
          </div>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: SOCIALES */}
      {/* ============================================ */}
      <Modal
        open={socialesAbierto}
        onClose={cerrarSociales}
        title="Sociales"
        description="Código de programas sociales del socio"
        size="sm"
      >
        {socialesCargando ? (
          <div className="flex justify-center items-center gap-2 py-10 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Cargando socio...
          </div>
        ) : socialesSocio ? (
          <div className="space-y-4">
            {socialesError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
                {socialesError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Expediente" value={socialesSocio.codigo_socio} disabled />
              <Input label="Cédula" value={socialesSocio.cedula} disabled />
              <Input
                label="Nombre completo"
                value={`${socialesSocio.nombre} ${socialesSocio.apellido}`}
                disabled
                className="sm:col-span-2"
              />
              <Input label="Teléfono" value={socialesSocio.telefono || 'Sin dato'} disabled />
              <Input label="Correo" value={socialesSocio.email || 'Sin dato'} disabled />
              <Input
                label="Dirección"
                value={socialesSocio.direccion || 'Sin dato'}
                disabled
                className="sm:col-span-2"
              />
            </div>

            <Input
              label="Cod. Sociales"
              value={socialesCodigo}
              onChange={(e) => setSocialesCodigo(e.target.value)}
              placeholder="Ingresa el código de programas sociales"
              onKeyDown={(e) => e.key === 'Enter' && void guardarCodigoSocial()}
              autoFocus
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={cerrarSociales} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => void guardarCodigoSocial()}
                isLoading={socialesEnviando}
                disabled={socialesCodigo.trim() === ''}
                className="flex-1"
              >
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          socialesError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
              {socialesError}
            </div>
          )
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: EDITAR ACUERDO */}
      {/* ============================================ */}
      <Modal
        open={editModalAbierto}
        onClose={() => setEditModalAbierto(false)}
        title="Editar Acuerdo de Funeraria"
        description={acuerdoEditando ? `Acuerdo ${acuerdoEditando.numero_acuerdo || 'sin número'}` : undefined}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditModalAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmarEdicion()}
              isLoading={editEnviando}
              disabled={!editFormularioValido}
            >
              Guardar cambios
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
              {editError}
            </div>
          )}

          {acuerdoEditando && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-semibold text-neutral-900">{acuerdoEditando.socio?.nombre_completo}</p>
              <p className="text-xs text-neutral-500">
                {acuerdoEditando.socio?.codigo_socio} • {acuerdoEditando.socio?.cedula}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                N° de acuerdo: <span className="font-mono">{acuerdoEditando.numero_acuerdo || 'sin número'}</span>
              </p>
            </div>
          )}

          <label className="block text-sm font-medium text-neutral-700">
            Tipo de acuerdo *
            <select
              value={editTipoAcuerdoId}
              onChange={(e) => setEditTipoAcuerdoId(e.target.value ? Number(e.target.value) : '')}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Selecciona un tipo...</option>
              {tiposAcuerdo.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre} (${tipo.monto_usd} USD)
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Número de contrato (opcional)"
            value={editNumeroContrato}
            onChange={(e) => setEditNumeroContrato(e.target.value)}
          />
          <Input
            label="Fecha de ingreso al beneficio *"
            type="date"
            value={editFechaInicio}
            onChange={(e) => setEditFechaInicio(e.target.value)}
            required
          />
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: DETALLE DEL ACUERDO Y BENEFICIARIOS */}
      {/* ============================================ */}
      <Modal
        open={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
        title="Detalle del acuerdo"
        description={acuerdoDetalle ? `Acuerdo ${acuerdoDetalle.numero_acuerdo || 'sin número'}` : undefined}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerAbierto(false)}>
              Cerrar
            </Button>
            {acuerdoDetalle && (
              <>
                <Button variant="outline" onClick={() => void imprimirFicha()} isLoading={imprimiendo}>
                  <Printer className="w-4 h-4" />
                  Imprimir Ficha
                </Button>
                {puedeEscribir && (
                  <Button variant="outline" onClick={() => void abrirImportarSalud()}>
                    <HeartPulse className="w-4 h-4" />
                    Importar a Salud
                  </Button>
                )}
              </>
            )}
          </>
        }
      >
        {drawerCargando ? (
          <div className="flex justify-center items-center gap-2 py-12 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Cargando ficha...
          </div>
        ) : acuerdoDetalle ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">{acuerdoDetalle.socio?.nombre_completo}</h3>
              {badgeEstado(acuerdoDetalle.estado)}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Datos del socio</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Expediente</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-neutral-900">
                      {acuerdoDetalle.socio?.codigo_socio}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Cédula</dt>
                    <dd className="mt-1 text-sm font-semibold text-neutral-900">{acuerdoDetalle.socio?.cedula}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Dirección</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.socio?.direccion || 'Sin dato'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Teléfono</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.socio?.telefono || 'Sin dato'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Correo</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.socio?.email || 'Sin dato'}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <p className="text-sm font-semibold text-neutral-800">Datos del acuerdo</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Tipo de acuerdo</dt>
                    <dd className="mt-1 text-sm text-neutral-700">
                      {acuerdoDetalle.tipo_acuerdo?.nombre} (${acuerdoDetalle.tipo_acuerdo?.monto_usd} USD)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Número de contrato</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.numero_contrato || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Fecha de inicio</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{formatearFecha(acuerdoDetalle.fecha_inicio)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Semanas sin pago</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.semanas_sin_pago}</dd>
                  </div>
                  {acuerdoDetalle.estado === 'retirado' && (
                    <>
                      <div>
                        <dt className="text-xs uppercase tracking-wider text-neutral-500">Fecha de retiro</dt>
                        <dd className="mt-1 text-sm text-neutral-700">{formatearFecha(acuerdoDetalle.fecha_retiro)}</dd>
                      </div>
                      {acuerdoDetalle.motivo_retiro && (
                        <div className="sm:col-span-2">
                          <dt className="text-xs uppercase tracking-wider text-neutral-500">Motivo</dt>
                          <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.motivo_retiro}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">
                    Beneficiarios registrados ({beneficiariosVisibles.length})
                  </p>
                  <p className="text-xs text-neutral-500">
                    {beneficiariosActivosCount}/{MAX_BENEFICIARIOS_POR_SOCIO} beneficiarios (+1 titular = máx. {MAX_BENEFICIARIOS_POR_SOCIO + 1} personas)
                  </p>
                </div>
                {puedeEscribir && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={abrirNuevoBeneficiario}
                    disabled={limiteBeneficiariosAlcanzado}
                    title={
                      limiteBeneficiariosAlcanzado
                        ? `Este socio ya alcanzó el máximo de ${MAX_BENEFICIARIOS_POR_SOCIO} beneficiarios (${MAX_BENEFICIARIOS_POR_SOCIO + 1} personas incluyendo al titular)`
                        : undefined
                    }
                  >
                    <UserPlus className="w-4 h-4" />
                    Agregar
                  </Button>
                )}
              </div>

              {limiteBeneficiariosAlcanzado && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Este socio ya tiene el máximo de {MAX_BENEFICIARIOS_POR_SOCIO} beneficiarios permitidos ({MAX_BENEFICIARIOS_POR_SOCIO + 1} personas incluyendo al titular). Para agregar uno nuevo, primero retira a alguno de los registrados.
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cédula</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Nombre completo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha Ingreso</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Parentesco</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha Nacimiento</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Edad</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                      {puedeEscribir && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-100">
                    {beneficiariosVisibles.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-sm text-neutral-500">
                          Este socio no tiene beneficiarios registrados.
                        </td>
                      </tr>
                    )}
                    {beneficiariosVisibles.map((beneficiario) => {
                      const edad = calcularEdad(beneficiario.fecha_nacimiento)
                      return (
                        <tr key={beneficiario.id} className="text-sm text-neutral-700">
                          <td className="px-3 py-2 whitespace-nowrap text-neutral-500">{beneficiario.id}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-neutral-900">
                            {beneficiario.cedula}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {beneficiario.nombre} {beneficiario.apellido}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatearFecha(beneficiario.fecha_ingreso || beneficiario.created_at)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{beneficiario.parentesco}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {beneficiario.fecha_nacimiento ? formatearFecha(beneficiario.fecha_nacimiento) : 'Sin dato'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-center">{edad !== null ? edad : '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center">{badgeBeneficiario(beneficiario)}</td>
                          {puedeEscribir && (
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              {beneficiario.estado === 'activo' && (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => abrirEditarBeneficiario(beneficiario)}
                                    className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                                    title="Editar"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => void marcarFallecido(beneficiario)}
                                    className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50"
                                    title="Marcar como fallecido"
                                  >
                                    <Skull className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => void eliminarBeneficiarioAccion(beneficiario)}
                                    className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                                    title="Retirar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ============================================ */}
      {/* MODAL: BENEFICIARIO */}
      {/* ============================================ */}
      <Modal
        open={beneficiarioModalAbierto}
        onClose={() => setBeneficiarioModalAbierto(false)}
        title={beneficiarioEditando ? 'Editar Beneficiario' : 'Agregar Beneficiario'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBeneficiarioModalAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void guardarBeneficiario()} isLoading={beneficiarioEnviando} disabled={!beneficiarioFormularioValido}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {beneficiarioError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
              {beneficiarioError}
            </div>
          )}
          <Input
            label="Cédula *"
            value={beneficiarioForm.cedula}
            onChange={(e) => setBeneficiarioForm((f) => ({ ...f, cedula: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre *"
              value={beneficiarioForm.nombre}
              onChange={(e) => setBeneficiarioForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <Input
              label="Apellido *"
              value={beneficiarioForm.apellido}
              onChange={(e) => setBeneficiarioForm((f) => ({ ...f, apellido: e.target.value }))}
            />
          </div>
          <label className="block text-sm font-medium text-neutral-700">
            Parentesco *
            <select
              value={beneficiarioForm.parentesco}
              onChange={(e) => setBeneficiarioForm((f) => ({ ...f, parentesco: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Selecciona un parentesco...</option>
              {sociosService.PARENTESCOS_BENEFICIARIO.map((parentesco) => (
                <option key={parentesco} value={parentesco}>
                  {parentesco}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Fecha de nacimiento *"
            type="date"
            value={beneficiarioForm.fecha_nacimiento || ''}
            onChange={(e) => setBeneficiarioForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))}
          />
          <Input
            label="Fecha de ingreso *"
            type="date"
            value={beneficiarioForm.fecha_ingreso || ''}
            onChange={(e) => setBeneficiarioForm((f) => ({ ...f, fecha_ingreso: e.target.value }))}
          />
          <Input
            label="Teléfono (opcional)"
            value={beneficiarioForm.telefono || ''}
            onChange={(e) => setBeneficiarioForm((f) => ({ ...f, telefono: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: CAMBIAR ESTADO */}
      {/* ============================================ */}
      <Modal
        open={estadoModalAbierto}
        onClose={() => setEstadoModalAbierto(false)}
        title={
          estadoAccion === 'suspendido'
            ? 'Suspender Acuerdo'
            : estadoAccion === 'activo'
              ? 'Reactivar Acuerdo'
              : 'Retirar Acuerdo'
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEstadoModalAbierto(false)}>
              Cancelar
            </Button>
            <Button
              variant={estadoAccion === 'retirado' ? 'danger' : 'primary'}
              onClick={() => void confirmarCambiarEstado()}
              isLoading={estadoEnviando}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {estadoError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
              {estadoError}
            </div>
          )}
          <p className="text-sm text-neutral-600">
            Acuerdo <span className="font-mono font-medium">{estadoAcuerdo?.numero_acuerdo || '—'}</span> de{' '}
            <span className="font-medium">{estadoAcuerdo?.socio?.nombre_completo}</span>
          </p>

          {estadoAccion === 'retirado' && (
            <Input
              label="Fecha de retiro"
              type="date"
              value={estadoFechaRetiro}
              onChange={(e) => setEstadoFechaRetiro(e.target.value)}
              required
            />
          )}

          <label className="block text-sm font-medium text-neutral-700">
            Motivo (opcional)
            <textarea
              value={estadoMotivo}
              onChange={(e) => setEstadoMotivo(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: IMPORTAR A SALUD */}
      {/* ============================================ */}
      <Modal
        open={importarSaludAbierto}
        onClose={() => setImportarSaludAbierto(false)}
        title="Importar Beneficiarios a Salud"
        description="Crea acuerdos de salud reutilizando los datos ya registrados en funeraria"
        size="md"
        footer={
          !importarSaludResultado && (
            <>
              <Button variant="outline" onClick={() => setImportarSaludAbierto(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void confirmarImportarSalud()}
                isLoading={importarSaludEnviando}
                disabled={!importarSaludTipoId || importarSaludSeleccionados.length === 0}
              >
                Importar Seleccionados
              </Button>
            </>
          )
        }
      >
        {importarSaludResultado ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            {importarSaludResultado}
          </div>
        ) : (
          <div className="space-y-4">
            {importarSaludError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
                {importarSaludError}
              </div>
            )}

            <label className="block text-sm font-medium text-neutral-700">
              Tipo de acuerdo de salud
              <select
                value={importarSaludTipoId}
                onChange={(e) => setImportarSaludTipoId(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecciona un tipo...</option>
                {tiposSalud.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre} (${tipo.monto_usd} USD)
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">Beneficiarios a importar</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {beneficiariosSocio
                  .filter((b) => b.estado === 'activo')
                  .map((beneficiario) => (
                    <label
                      key={beneficiario.id}
                      className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={importarSaludSeleccionados.includes(beneficiario.id)}
                        onChange={(e) => {
                          setImportarSaludSeleccionados((prev) =>
                            e.target.checked
                              ? [...prev, beneficiario.id]
                              : prev.filter((id) => id !== beneficiario.id)
                          )
                        }}
                      />
                      <span>
                        {beneficiario.nombre} {beneficiario.apellido} • {beneficiario.parentesco}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
