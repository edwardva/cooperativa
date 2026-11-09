/**
 * ============================================
 * PAGE: FUNERARIA
 * ============================================
 * Gestión de acuerdos de funeraria: acuerdos activos/suspendidos/retirados,
 * ficha del socio con todos sus beneficiarios, impresión, reporte de
 * suspendidos e importación rápida hacia Salud.
 */

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
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
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ArrowRightLeft,
  Contact,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { CruzFallecido } from '../components/ui/CruzFallecido'
import { Modal } from '../components/ui/Modal'
import { SortableHeader } from '../components/ui/SortableHeader'
import { PrintableListado } from '../components/print/PrintableListado'
import { PrintableFichaAcuerdo, type PrintableFichaAcuerdoProps } from '../components/print/PrintableFichaAcuerdo'
import { EncabezadoImpresion, imprimirCuandoEsteListo, LOGO_COOPERATIVA, NOMBRE_COOPERATIVA } from '../components/print/EncabezadoImpresion'
import { ModalRevertirConNuevoAcuerdo } from '../components/funeraria/ModalRevertirConNuevoAcuerdo'
import { ModalTraspasoAcuerdo, type AcuerdoATraspasar } from '../components/traspaso/ModalTraspasoAcuerdo'
import * as funerariaService from '../services/funerariaService'
import * as sociosService from '../services/sociosService'
import * as saludService from '../services/saludService'
import type { AcuerdoFuneraria, AcuerdoDetalle } from '../services/funerariaService'
import type { Socio, Beneficiario, BeneficiarioFormData } from '../services/sociosService'
import { getErrorCode, getErrorMessage, getErrorMessageDetallado } from '../services/api'
import { formatearFecha, calcularEdad, nombreEnMayusculas } from '../utils/formatters'
import { valorEnMayusculas } from '../utils/mayusculas'
import { usePermissions } from '../store/authStore'
import { DistintivoTrabajadorTriunfo } from '../components/socios/DistintivoTrabajadorTriunfo'

type Tab = 'activo' | 'suspendido' | 'retirado' | 'todos'

// El dia de Venezuela: toISOString daba el dia siguiente despues de las 8 pm
const hoyISO = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

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
  const [wizardNumeroAcuerdo, setWizardNumeroAcuerdo] = useState('')
  // Un socio puede tener varios acuerdos activos, cada uno con hasta 8 beneficiarios
  const [wizardAcuerdosSocio, setWizardAcuerdosSocio] = useState<funerariaService.AcuerdoFunerariaPorSocio[]>([])
  const [wizardFechaInicio, setWizardFechaInicio] = useState(hoyISO())
  const [wizardEnviando, setWizardEnviando] = useState(false)

  const cerrarWizard = () => {
    setWizardAbierto(false)
    setWizardPaso(1)
    setWizardAcuerdosSocio([])
    setWizardCedula('')
    setWizardError(null)
    setWizardSocio(null)
    setWizardNumeroAcuerdo('')
    setWizardFechaInicio(hoyISO())
  }

  // ============================================
  // TRASPASO DEL ACUERDO A OTRO SOCIO (fallecimiento, migración...)
  // ============================================
  // Desde el botón principal se pide el expediente del titular actual; desde
  // "Nuevo acuerdo" el acuerdo ya viene elegido.
  const [traspasoAbierto, setTraspasoAbierto] = useState(false)
  const [traspasoAcuerdoInicial, setTraspasoAcuerdoInicial] = useState<AcuerdoATraspasar | null>(null)
  const [traspasoTitularInicial, setTraspasoTitularInicial] = useState<Socio | null>(null)

  const abrirTraspaso = (acuerdo?: funerariaService.AcuerdoFunerariaPorSocio, titular?: Socio) => {
    setTraspasoAcuerdoInicial(
      acuerdo
        ? { clave: acuerdo.id, numero_acuerdo: acuerdo.numero_acuerdo, estado: acuerdo.estado, fecha_inicio: acuerdo.fecha_inicio }
        : null
    )
    setTraspasoTitularInicial(titular ?? null)
    setTraspasoAbierto(true)
  }

  const cerrarTraspaso = () => {
    setTraspasoAbierto(false)
    setTraspasoAcuerdoInicial(null)
    setTraspasoTitularInicial(null)
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
      // Si el detalle de un acuerdo de este socio está cargado, se refleja al instante
      const guardado = respuesta.data
      setAcuerdoDetalle((prev) =>
        prev?.socio && prev.socio.id === guardado.id ? { ...prev, socio: { ...prev.socio, codigo_social: guardado.codigo_social } } : prev
      )
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
  const [editNumeroAcuerdo, setEditNumeroAcuerdo] = useState('')
  const [editFechaInicio, setEditFechaInicio] = useState(hoyISO())
  const [editEnviando, setEditEnviando] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const abrirModalEditar = (acuerdo: AcuerdoFuneraria) => {
    cerrarMenuAcciones()
    setAcuerdoEditando(acuerdo)
    setEditNumeroAcuerdo(acuerdo.numero_acuerdo || '')
    setEditFechaInicio(acuerdo.fecha_inicio.split('T')[0] || hoyISO())
    setEditError(null)
    setEditModalAbierto(true)
  }

  const editFormularioValido = editFechaInicio.trim() !== ''

  const confirmarEdicion = async () => {
    if (!acuerdoEditando || !editFormularioValido) {
      setEditError('La fecha de ingreso es obligatoria.')
      return
    }

    setEditEnviando(true)
    setEditError(null)

    try {
      const respuesta = await funerariaService.actualizarAcuerdo(acuerdoEditando.id, {
        // Vacío = se deja el número que tenía
        ...(editNumeroAcuerdo.trim() ? { numero_acuerdo: editNumeroAcuerdo.trim() } : {}),
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

  // Solo necesita el id: se llama con una fila de la tabla o con el acuerdo recién creado
  const abrirFicha = async (acuerdo: Pick<AcuerdoFuneraria, 'id'>) => {
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

  // Máximo 8 beneficiarios activos por ACUERDO; sumando al titular dan 9
  // personas. Un socio puede tener varios acuerdos, cada uno con sus propios
  // beneficiarios y su propio tope. Al retirar o marcar como fallecido a un
  // beneficiario, su cupo queda libre. El backend aplica el mismo tope al crear
  // (ver agregarBeneficiario en sociosController.ts). La lista del detalle solo
  // muestra los beneficiarios activos y fallecidos (estos sin acciones) de ESTE
  // acuerdo; los retirados desaparecen de la lista y solo aparecen en la ficha impresa.
  //
  // Los datos migrados incluyen, para cada socio, una fila de Beneficiario con
  // parentesco "titular" que representa al propio socio (usada para imprimir la
  // ficha con el formato histórico). Esa fila no es un beneficiario real: hay
  // que excluirla de la lista visible y del conteo, o el titular ocuparía uno
  // de los 8 cupos de su propia familia.
  const MAX_BENEFICIARIOS_POR_ACUERDO = 8
  const esFilaTitular = (b: Beneficiario) => b.parentesco?.trim().toLowerCase() === 'titular'
  // Beneficiarios de un acuerdo, incluidos los retirados de funeraria (para la ficha)
  const beneficiariosDeAcuerdo = (beneficiarios: Beneficiario[], acuerdoId: number) =>
    beneficiarios.filter((b) => b.acuerdo_funeraria_id === acuerdoId && !esFilaTitular(b))
  // El retiro de funeraria es propio de este módulo (fecha_retiro_funeraria):
  // retirar aquí no cambia el estado de la persona en Salud, ni al revés.
  const retiradoDeFuneraria = (b: Beneficiario) => b.fecha_retiro_funeraria !== null
  const beneficiariosVisibles = (acuerdoDetalle ? beneficiariosDeAcuerdo(beneficiariosSocio, acuerdoDetalle.id) : []).filter(
    (b) => !retiradoDeFuneraria(b) && (b.estado === 'activo' || b.estado === 'fallecido')
  )
  const beneficiariosActivosCount = beneficiariosVisibles.filter((b) => b.estado === 'activo').length
  const limiteBeneficiariosAlcanzado = beneficiariosActivosCount >= MAX_BENEFICIARIOS_POR_ACUERDO

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
        await sociosService.crearBeneficiario(socioId, {
          ...beneficiarioForm,
          ...(acuerdoDetalle ? { acuerdo_funeraria_id: acuerdoDetalle.id } : {}),
        })
      }
      setBeneficiarioModalAbierto(false)
      await recargarBeneficiarios()
    } catch (err) {
      setBeneficiarioError(getErrorMessageDetallado(err))
    } finally {
      setBeneficiarioEnviando(false)
    }
  }

  const marcarFallecido = async (beneficiario: Beneficiario) => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return
    const confirmado = window.confirm(
      `¿Marcar a ${beneficiario.nombre} ${beneficiario.apellido} como fallecido?\n\n` +
        'El fallecimiento es de la persona: también quedará como fallecido en Salud.'
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

  // Si el acuerdo ya tiene los 8 activos, revertir un fallecido abre otro
  // acuerdo del mismo titular para esa persona (ver ModalRevertirConNuevoAcuerdo)
  const [revertirNuevoAcuerdo, setRevertirNuevoAcuerdo] = useState<Beneficiario | null>(null)

  // Corrige un "fallecido" marcado por error: vuelve a activo y ocupa de nuevo
  // uno de los 8 cupos (el backend valida el mismo tope).
  const revertirFallecido = async (beneficiario: Beneficiario) => {
    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return
    if (limiteBeneficiariosAlcanzado) {
      setRevertirNuevoAcuerdo(beneficiario)
      return
    }
    const confirmado = window.confirm(
      `¿${beneficiario.nombre} ${beneficiario.apellido} fue marcado como fallecido por error?\n\n` +
        'Volverá a estar activo, se borrará la fecha de fallecimiento y ocupará nuevamente un cupo. También se revierte en Salud.'
    )
    if (!confirmado) return

    try {
      await sociosService.actualizarBeneficiario(socioId, beneficiario.id, {
        estado: 'activo',
        fecha_fallecimiento: null,
      })
      await recargarBeneficiarios()
    } catch (err) {
      // Otro usuario pudo llenar el acuerdo mientras tanto
      if (getErrorCode(err) === 'LIMITE_BENEFICIARIOS') setRevertirNuevoAcuerdo(beneficiario)
      else window.alert(getErrorMessage(err))
    }
  }

  const completarRevertirNuevoAcuerdo = async (numeroAcuerdo: string | null) => {
    const beneficiario = revertirNuevoAcuerdo
    setRevertirNuevoAcuerdo(null)
    await Promise.all([recargarBeneficiarios(), cargarAcuerdos(), cargarEstadisticas()])
    window.alert(
      `Se abrió el acuerdo ${numeroAcuerdo || 'sin número'} y ${beneficiario?.nombre} ${beneficiario?.apellido} volvió a estar activo en él.`
    )
  }

  const eliminarBeneficiarioAccion = async (beneficiario: Beneficiario) => {
    if (!acuerdoDetalle) return
    const nombreCompleto = `${beneficiario.nombre} ${beneficiario.apellido}`
    const confirmado = window.confirm(
      `¿Retirar a ${nombreCompleto} (C.I. ${beneficiario.cedula}) de este acuerdo de funeraria?\n\n` +
        'Dejará de aparecer en la lista y su cupo quedará libre. Si también está en Salud, allá no cambia nada.'
    )
    if (!confirmado) return
    // Segunda confirmación: retirar es una acción que no se deshace desde esta pantalla
    const reconfirmado = window.confirm(
      `Confirma de nuevo: ¿seguro que deseas retirar a ${nombreCompleto}? Esta acción no se puede deshacer.`
    )
    if (!reconfirmado) return

    try {
      await funerariaService.retirarBeneficiarioAcuerdo(acuerdoDetalle.id, beneficiario.id)
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
  // COPIA beneficiarios de este acuerdo de funeraria al acuerdo de salud del
  // mismo titular (si tiene varios, se pregunta a cuál). En Funeraria nada cambia.
  // Si el acuerdo no tiene beneficiarios se copia solo el titular: si ya tiene
  // acuerdo de salud se pregunta si se le abre otro.
  const [importarSaludAbierto, setImportarSaludAbierto] = useState(false)
  const [importarSaludCargando, setImportarSaludCargando] = useState(false)
  const [importarSaludGrupos, setImportarSaludGrupos] = useState<{ numero_acuerdo: string; estado: string; fecha_inicio: string }[]>([])
  const [importarSaludElegirAbierto, setImportarSaludElegirAbierto] = useState(false)
  const [importarSaludGrupoElegido, setImportarSaludGrupoElegido] = useState('')
  const [importarSaludSeleccionados, setImportarSaludSeleccionados] = useState<number[]>([])
  const [importarSaludEnviando, setImportarSaludEnviando] = useState(false)
  const [importarSaludError, setImportarSaludError] = useState<string | null>(null)
  // Ventana final: éxito o fallo de la operación, antes de volver al detalle
  const [importarSaludResultado, setImportarSaludResultado] = useState<{ exito: boolean; mensaje: string } | null>(null)
  // Acuerdo sin beneficiarios y el titular ya tiene acuerdo de salud: ¿abrir otro?
  const [importarSaludPreguntarOtro, setImportarSaludPreguntarOtro] = useState(false)
  const [importarSaludAbrirOtro, setImportarSaludAbrirOtro] = useState(false)
  // Titular sin acuerdo de salud: número del acuerdo que se le creará (editable).
  // null = sí tiene acuerdo de salud (o aún se está consultando)
  const [importarSaludNumeroNuevo, setImportarSaludNumeroNuevo] = useState<string | null>(null)
  const importarSaludCrearAcuerdo = importarSaludNumeroNuevo !== null
  // Fecha de inicio del acuerdo de salud que se creará (por defecto hoy, editable)
  const [importarSaludFechaNueva, setImportarSaludFechaNueva] = useState(hoyISO())

  // Beneficiarios vivos y vigentes de ESTE acuerdo (el titular ya es el dueño de su acuerdo de salud)
  const importarSaludCandidatos = (acuerdoDetalle ? beneficiariosDeAcuerdo(beneficiariosSocio, acuerdoDetalle.id) : []).filter(
    (b) => b.estado === 'activo' && !retiradoDeFuneraria(b)
  )
  const importarSaludTodos =
    importarSaludCandidatos.length > 0 && importarSaludCandidatos.every((b) => importarSaludSeleccionados.includes(b.id))
  const alternarTodosImportarSalud = () =>
    setImportarSaludSeleccionados(importarSaludTodos ? [] : importarSaludCandidatos.map((b) => b.id))

  // Número propuesto para el acuerdo de salud nuevo (el expediente, o -1, -2… si ya se usa)
  const proponerNumeroSaludNuevo = async (socioId: number) => {
    const sugerido = await saludService.obtenerNumeroSugeridoSalud(socioId)
    setImportarSaludNumeroNuevo(sugerido.data?.numero_sugerido ?? acuerdoDetalle?.socio?.codigo_socio ?? '')
  }

  const cerrarImportarSalud = () => {
    setImportarSaludPreguntarOtro(false)
    setImportarSaludElegirAbierto(false)
    setImportarSaludAbierto(false)
  }

  const abrirImportarSalud = async () => {
    cerrarMenuAcciones()
    setImportarSaludSeleccionados([])
    setImportarSaludGrupos([])
    setImportarSaludGrupoElegido('')
    setImportarSaludError(null)
    setImportarSaludResultado(null)
    setImportarSaludNumeroNuevo(null)
    setImportarSaludFechaNueva(hoyISO())
    setImportarSaludPreguntarOtro(false)
    setImportarSaludAbrirOtro(false)
    setImportarSaludAbierto(true)

    const socioId = acuerdoDetalle?.socio?.id
    if (!socioId) return
    const sinBeneficiarios = importarSaludCandidatos.length === 0
    setImportarSaludCargando(true)
    try {
      // Acuerdos de salud vigentes donde este socio es el titular
      const respuesta = await saludService.obtenerAcuerdosPorSocio(socioId)
      const grupos = (respuesta.data ?? [])
        .filter((a) => a.numero_acuerdo && a.estado !== 'retirado' && a.beneficiario.parentesco.trim().toLowerCase() === 'titular')
        .map((a) => ({ numero_acuerdo: a.numero_acuerdo!, estado: a.estado, fecha_inicio: a.fecha_inicio }))
      setImportarSaludGrupos(grupos)
      if (grupos.length === 1) setImportarSaludGrupoElegido(grupos[0]!.numero_acuerdo)
      if (grupos.length === 0) {
        // No tiene acuerdo de salud: se le creará uno al copiar
        await proponerNumeroSaludNuevo(socioId)
      } else if (sinBeneficiarios) {
        // Solo se copiaría el titular, que ya tiene acuerdo de salud: se pregunta
        setImportarSaludPreguntarOtro(true)
      }
    } catch (err) {
      setImportarSaludError(getErrorMessage(err))
    } finally {
      setImportarSaludCargando(false)
    }
  }

  // Respuesta "Sí" a "¿Desea abrir un nuevo acuerdo para este socio?"
  const aceptarAbrirOtroSalud = async () => {
    const socioId = acuerdoDetalle?.socio?.id
    setImportarSaludPreguntarOtro(false)
    if (!socioId) return
    setImportarSaludCargando(true)
    try {
      await proponerNumeroSaludNuevo(socioId)
      setImportarSaludAbrirOtro(true)
    } catch (err) {
      setImportarSaludError(getErrorMessage(err))
    } finally {
      setImportarSaludCargando(false)
    }
  }

  // Sin acuerdo de salud se crea uno; con uno solo se copia directo; con varios,
  // primero se pregunta a cuál. Sin beneficiarios en el acuerdo de funeraria
  // solo se puede crear (con el titular).
  const continuarImportarSalud = () => {
    if (importarSaludSeleccionados.length === 0 && !(importarSaludCrearAcuerdo && importarSaludCandidatos.length === 0)) return
    if (importarSaludCrearAcuerdo) {
      void confirmarImportarSalud(null)
      return
    }
    if (importarSaludGrupos.length === 0) return
    if (importarSaludGrupos.length > 1) {
      setImportarSaludElegirAbierto(true)
      return
    }
    void confirmarImportarSalud(importarSaludGrupos[0]!.numero_acuerdo)
  }

  // numeroAcuerdoSalud null = el titular no tiene acuerdo de salud y se crea
  const confirmarImportarSalud = async (numeroAcuerdoSalud: string | null) => {
    if (!acuerdoDetalle) return
    if (importarSaludSeleccionados.length === 0 && numeroAcuerdoSalud !== null) return
    const numeroNuevo = (importarSaludNumeroNuevo ?? '').trim()
    if (numeroAcuerdoSalud === null && !numeroNuevo) {
      setImportarSaludError('Escribe el número del acuerdo de salud que se va a crear.')
      return
    }
    if (numeroAcuerdoSalud === null && !importarSaludFechaNueva) {
      setImportarSaludError('Indica la fecha de inicio del acuerdo de salud que se va a crear.')
      return
    }
    const cantidad = importarSaludSeleccionados.length
    const origen = `del acuerdo de funeraria ${acuerdoDetalle.numero_acuerdo || 'sin número'}`
    const expediente = acuerdoDetalle.socio?.codigo_socio ?? ''
    const confirmado = window.confirm(
      (numeroAcuerdoSalud === null
        ? (importarSaludAbrirOtro
            ? `El socio ${expediente} ya tiene acuerdo de salud; se le abrirá uno ADICIONAL.\n\n`
            : `El socio ${expediente} no tiene acuerdo de salud.\n\n`) +
          `Se CREARÁ el acuerdo de salud ${numeroNuevo} a su nombre (inicia el ${formatearFecha(importarSaludFechaNueva)})` +
          (cantidad > 0
            ? ` y se copiarán ahí ${cantidad} beneficiario(s) ${origen}. ¿Continuar?\n\n`
            : ` con los datos del titular (el acuerdo de funeraria no tiene beneficiarios). ¿Continuar?\n\n`)
        : `¿Copiar ${cantidad} beneficiario(s) ${origen} al acuerdo de salud ${numeroAcuerdoSalud}?\n\n`) +
        'Solo se copian: en Funeraria no se borra ni cambia nada.'
    )
    if (!confirmado) return

    setImportarSaludElegirAbierto(false)
    setImportarSaludEnviando(true)
    setImportarSaludError(null)
    try {
      const datos = { beneficiario_ids: importarSaludSeleccionados, acuerdo_funeraria_id: acuerdoDetalle.id }
      const respuesta =
        numeroAcuerdoSalud === null
          ? await saludService.importarDesdeFunerariaNuevoAcuerdo({
              ...datos,
              numero_acuerdo: numeroNuevo,
              fecha_inicio: importarSaludFechaNueva,
              abrir_otro: importarSaludAbrirOtro,
            })
          : await saludService.importarDesdeFuneraria(numeroAcuerdoSalud, datos)
      if (!respuesta.success) throw new Error('No fue posible completar la copia')
      const { numero_acuerdo_salud, acuerdo_creado, copiados, ya_estaban, omitidos } = respuesta.data
      setImportarSaludResultado({
        exito: true,
        mensaje: [
          acuerdo_creado ? `Se creó el acuerdo de salud ${numero_acuerdo_salud} a nombre del socio ${expediente}, con sus datos como titular.` : '',
          copiados.length || !acuerdo_creado
            ? `${copiados.length} beneficiario(s) copiado(s) al acuerdo de salud ${numero_acuerdo_salud}${copiados.length ? `: ${copiados.join(', ')}` : ''}.`
            : '',
          ya_estaban.length ? `Ya estaban en ese acuerdo: ${ya_estaban.join(', ')}.` : '',
          omitidos.length ? `No se copiaron (no activos): ${omitidos.join(', ')}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      })
    } catch (err) {
      // Siempre se informa qué pasó: la operación es todo o nada
      const motivo = getErrorMessage(err)
      setImportarSaludResultado({
        exito: false,
        mensaje:
          numeroAcuerdoSalud === null
            ? `No se creó el acuerdo de salud ${numeroNuevo} ni se copió ningún dato. Motivo: ${motivo}`
            : `No se copió ningún beneficiario al acuerdo de salud ${numeroAcuerdoSalud}. Motivo: ${motivo}`,
      })
    } finally {
      setImportarSaludEnviando(false)
    }
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
  }, [])

  useEffect(() => {
    void cargarAcuerdos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual, busqueda, tab, itemsPorPagina])

  // ============================================
  // WIZARD: ACCIONES
  // ============================================
  const buscarSocioWizard = async () => {
    const texto = wizardCedula.trim()
    if (!texto) return

    setWizardBuscando(true)
    setWizardError(null)

    try {
      // El acuerdo se registra con el numero de EXPEDIENTE; la cedula tambien sirve
      const porExpediente = async () => {
        const r = await sociosService.buscarSocioPorExpediente(texto).catch(() => null)
        return r?.success ? r.data : null
      }
      const porCedula = async () => {
        const r = await sociosService.buscarSocioPorCedula(texto).catch(() => null)
        return r?.success ? r.data?.[0] ?? null : null
      }
      const soloDigitos = /^\d+$/.test(texto)
      const socio = soloDigitos
        ? (await porCedula()) ?? (await porExpediente())
        : (await porExpediente()) ?? (await porCedula())
      if (!socio) throw new Error('No se encontro un socio con ese expediente ni con esa cedula')

      setWizardSocio(socio)
      // Número propuesto: expediente-0 para el primer acuerdo, -1, -2... para los
      // siguientes (el primero libre). Se puede modificar.
      const acuerdos = await funerariaService.obtenerAcuerdosPorSocio(socio.id).catch(() => null)
      const existentes = acuerdos?.data ?? []
      const usados = new Set(existentes.map((a) => a.numero_acuerdo))
      let sufijo = 0
      while (usados.has(`${socio.codigo_socio}-${sufijo}`)) sufijo++
      setWizardAcuerdosSocio(existentes)
      setWizardNumeroAcuerdo(`${socio.codigo_socio}-${sufijo}`)
      setWizardPaso(2)
    } catch (err) {
      setWizardError(getErrorMessage(err) || 'Socio no encontrado')
    } finally {
      setWizardBuscando(false)
    }
  }

  const confirmarNuevoAcuerdo = async () => {
    if (!wizardSocio) return

    setWizardEnviando(true)
    setWizardError(null)

    try {
      const respuesta = await funerariaService.crearAcuerdo({
        socio_id: wizardSocio.id,
        numero_acuerdo: wizardNumeroAcuerdo.trim() || undefined,
        fecha_inicio: new Date(wizardFechaInicio).toISOString(),
      })

      if (!respuesta.success) throw new Error('No fue posible crear el acuerdo')

      cerrarWizard()
      await Promise.all([cargarAcuerdos(), cargarEstadisticas()])
      const advertencias = (respuesta as { advertencias?: string[] }).advertencias ?? []
      window.alert(
        [
          `Acuerdo de funeraria ${respuesta.data.numero_acuerdo || ''} creado exitosamente`,
          ...advertencias,
          'A continuación se abre el detalle del acuerdo para agregar sus beneficiarios.',
        ].join('\n\n')
      )
      // Detalle del acuerdo recién creado, para cargar ahí sus beneficiarios
      await abrirFicha(respuesta.data)
    } catch (err) {
      setWizardError(getErrorMessageDetallado(err))
    } finally {
      setWizardEnviando(false)
    }
  }

  // ============================================
  // IMPRIMIR FICHA
  // ============================================
  // Mismo formato y encabezado que la ficha de Salud: el documento se renderiza
  // localmente con PrintableFichaAcuerdo y la API de impresión solo se llama
  // para dejar la impresión en el audit log.
  //
  // Estado con que sale cada beneficiario: el del acuerdo (suspendido/retirado)
  // manda, luego su retiro de funeraria y por último el de la persona.
  const estadoEnFicha = (detalle: AcuerdoDetalle, b: Beneficiario): string =>
    detalle.estado !== 'activo' ? detalle.estado : retiradoDeFuneraria(b) ? 'retirado' : b.estado

  const construirPayloadFicha = (
    detalle: AcuerdoDetalle,
    beneficiarios: Beneficiario[]
  ): funerariaService.FichaAcuerdoFunerariaData => ({
    numero_acuerdo: detalle.numero_acuerdo || 'S/N',
    fecha_inicio: detalle.fecha_inicio,
    socio: {
      codigo: detalle.socio?.codigo_socio || '',
      cedula: detalle.socio?.cedula || '',
      nombre: nombreEnMayusculas(detalle.socio?.nombre_completo),
      direccion: detalle.socio?.direccion || undefined,
      telefono: detalle.socio?.telefono || undefined,
    },
    beneficiarios: beneficiarios.map((b) => ({
      id: b.id,
      nombre: nombreEnMayusculas(`${b.nombre} ${b.apellido}`),
      cedula: b.cedula,
      parentesco: b.parentesco,
      fecha_ingreso: b.fecha_ingreso || b.created_at,
      fecha_nacimiento: b.fecha_nacimiento || undefined,
      edad: calcularEdad(b.fecha_nacimiento) ?? undefined,
      estado: estadoEnFicha(detalle, b),
    })),
  })

  const construirPropsFichaImpresion = (
    detalle: AcuerdoDetalle,
    beneficiarios: Beneficiario[]
  ): PrintableFichaAcuerdoProps => ({
    servicio: 'FUNERARIA',
    numero_acuerdo: detalle.numero_acuerdo || 'S/N',
    fecha_inicio: detalle.fecha_inicio,
    estado: detalle.estado,
    socio: {
      codigo: detalle.socio?.codigo_socio || '',
      cedula: detalle.socio?.cedula || '',
      nombre: detalle.socio?.nombre_completo || '',
      direccion: detalle.socio?.direccion,
      telefono: detalle.socio?.telefono,
    },
    beneficiarios: beneficiarios.map((b, index) => ({
      numero: index + 1,
      nombre: `${b.nombre} ${b.apellido}`,
      cedula: b.cedula,
      parentesco: b.parentesco,
      fecha_ingreso: b.fecha_ingreso || b.created_at,
      fecha_nacimiento: b.fecha_nacimiento,
      edad: calcularEdad(b.fecha_nacimiento),
      estado: estadoEnFicha(detalle, b),
    })),
  })

  const [fichaParaImprimir, setFichaParaImprimir] = useState<PrintableFichaAcuerdoProps | null>(null)

  // Solo los beneficiarios de ESTE acuerdo (el titular va en el encabezado)
  const generarFicha = async (detalle: AcuerdoDetalle, beneficiariosDelSocio: Beneficiario[]) => {
    const beneficiarios = beneficiariosDeAcuerdo(beneficiariosDelSocio, detalle.id)
    const respuesta = await funerariaService.imprimirFichaAcuerdo(construirPayloadFicha(detalle, beneficiarios))
    if (!respuesta.success) throw new Error('No fue posible generar la ficha')
    setFichaParaImprimir(construirPropsFichaImpresion(detalle, beneficiarios))
  }

  // Se dispara solo cuando hay una ficha lista: espera a que React monte
  // PrintableFichaAcuerdo con los datos antes de abrir el diálogo de impresión.
  useEffect(() => {
    if (!fichaParaImprimir) return
    const limpiar = () => setFichaParaImprimir(null)
    window.addEventListener('afterprint', limpiar, { once: true })
    let cancelado = false
    void imprimirCuandoEsteListo(() => cancelado)
    return () => {
      cancelado = true
      window.removeEventListener('afterprint', limpiar)
    }
  }, [fichaParaImprimir])

  const imprimirFicha = async () => {
    if (!acuerdoDetalle?.socio) return

    setImprimiendo(true)
    try {
      await generarFicha(acuerdoDetalle, beneficiariosSocio)
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

      await generarFicha(detalle, beneficiarios)
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

  // ============================================
  // REPORTE SUSPENDIDOS: vista previa en pantalla y, si el usuario quiere, Excel
  // ============================================
  const [reporteAbierto, setReporteAbierto] = useState(false)
  const [reporteCargando, setReporteCargando] = useState(false)
  const [reporteFilas, setReporteFilas] = useState<funerariaService.AcuerdoSuspendidoListado[]>([])
  const [reporteError, setReporteError] = useState<string | null>(null)
  const [reporteGeneradoEn, setReporteGeneradoEn] = useState(new Date())

  const abrirReporteSuspendidos = async () => {
    setReporteAbierto(true)
    setReporteCargando(true)
    setReporteError(null)
    setReporteFilas([])
    setReporteGeneradoEn(new Date())
    try {
      const respuesta = await funerariaService.obtenerListadoSuspendidos()
      if (!respuesta.success) throw new Error('No fue posible generar el reporte')
      setReporteFilas(respuesta.data)
    } catch (err) {
      setReporteError(`No se pudo generar el reporte. Motivo: ${getErrorMessage(err)}`)
    } finally {
      setReporteCargando(false)
    }
  }

  const descargarReporteSuspendidos = async () => {
    setGenerandoReporte(true)
    setReporteError(null)
    try {
      await funerariaService.descargarReporteSuspendidos()
    } catch (err) {
      setReporteError(`No se descargó el Excel. Motivo: ${getErrorMessage(err)}`)
    } finally {
      setGenerandoReporte(false)
    }
  }

  // ============================================
  // IMPRIMIR LISTADO: se elige qué listado y se imprime con el encabezado común
  // ============================================
  const OPCIONES_LISTADO: { valor: funerariaService.EstadoListadoFuneraria; etiqueta: string; titulo: string }[] = [
    { valor: 'activo', etiqueta: 'Listado de activos', titulo: 'Listado de Acuerdos Activos - Funeraria' },
    { valor: 'suspendido', etiqueta: 'Listado de suspendidos', titulo: 'Listado de Acuerdos Suspendidos - Funeraria' },
    { valor: 'retirado', etiqueta: 'Listado de retirados', titulo: 'Listado de Acuerdos Retirados - Funeraria' },
    { valor: 'todos', etiqueta: 'Todos', titulo: 'Listado de Todos los Acuerdos - Funeraria' },
  ]
  const [listadoElegirAbierto, setListadoElegirAbierto] = useState(false)
  const [listadoEstado, setListadoEstado] = useState<funerariaService.EstadoListadoFuneraria>('activo')
  const [listadoCargando, setListadoCargando] = useState(false)
  const [listadoError, setListadoError] = useState<string | null>(null)
  const [listadoParaImprimir, setListadoParaImprimir] = useState<{
    estado: funerariaService.EstadoListadoFuneraria
    filas: funerariaService.AcuerdoSuspendidoListado[]
  } | null>(null)

  const abrirElegirListado = () => {
    setListadoEstado(tab)
    setListadoError(null)
    setListadoElegirAbierto(true)
  }

  const generarListado = async () => {
    setListadoCargando(true)
    setListadoError(null)
    try {
      const respuesta = await funerariaService.obtenerListadoParaImprimir(listadoEstado)
      if (!respuesta.success) throw new Error('No fue posible generar el listado')
      setListadoElegirAbierto(false)
      setListadoParaImprimir({ estado: listadoEstado, filas: respuesta.data })
    } catch (err) {
      setListadoError(`No se generó el listado. Motivo: ${getErrorMessage(err)}`)
    } finally {
      setListadoCargando(false)
    }
  }

  // Igual que la ficha: se imprime cuando el listado ya está montado (y el logo cargado)
  useEffect(() => {
    if (!listadoParaImprimir) return
    const limpiar = () => setListadoParaImprimir(null)
    window.addEventListener('afterprint', limpiar, { once: true })
    let cancelado = false
    void imprimirCuandoEsteListo(() => cancelado)
    return () => {
      cancelado = true
      window.removeEventListener('afterprint', limpiar)
    }
  }, [listadoParaImprimir])

  const opcionListado = OPCIONES_LISTADO.find((o) => o.valor === listadoParaImprimir?.estado)
  const listadoConRetiro = listadoParaImprimir?.estado === 'retirado' || listadoParaImprimir?.estado === 'todos'
  const columnasListado = [
    'N°',
    'N° Expediente',
    'N° Acuerdo',
    'Apellidos y Nombres',
    'Cédula',
    'Teléfono',
    'Sem. sin pago',
    'Estado',
    'Fecha ingreso',
    ...(listadoConRetiro ? ['Fecha retiro'] : []),
  ]
  const filasListado = (listadoParaImprimir?.filas ?? []).map((f, i) => [
    String(i + 1),
    f.expediente,
    f.numero_acuerdo,
    `${f.apellidos} ${f.nombres}`,
    f.cedula,
    f.telefono,
    String(f.semanas_atraso),
    f.estado.toUpperCase(),
    formatearFecha(f.fecha_inicio),
    ...(listadoConRetiro ? [f.fecha_retiro ? formatearFecha(f.fecha_retiro) : '—'] : []),
  ])

  const abrirVentanaImpresionListado = (filas: funerariaService.AcuerdoSuspendidoListado[]) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    const filasHtml = filas
      .map(
        (fila, i) => `
          <tr class="${i % 2 === 1 ? 'par' : ''}">
            <td>${fila.expediente}</td>
            <td>${fila.numero_acuerdo}</td>
            <td>${nombreEnMayusculas(`${fila.apellidos} ${fila.nombres}`)}</td>
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
            /* Mismo encabezado que el resto de impresiones (EncabezadoImpresion) */
            header {
              display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
              margin-bottom: 16px; border-bottom: 2px solid #d1d5db; padding-bottom: 10px;
            }
            header .marca { display: flex; align-items: center; gap: 12px; }
            header img { height: 48px; width: auto; object-fit: contain; }
            header .cooperativa { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: #111827; }
            header .titulo { margin-top: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em; color: #047857; }
            header .datos { text-align: right; font-size: 10px; color: #6b7280; }
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
            <div class="marca">
              <img src="${new URL(LOGO_COOPERATIVA, window.location.href).href}" alt="${NOMBRE_COOPERATIVA}" />
              <div>
                <div class="cooperativa">${NOMBRE_COOPERATIVA}</div>
                <div class="titulo">Listado de Socios Suspendidos - Funeraria</div>
              </div>
            </div>
            <div class="datos">
              <div>Total: ${filas.length}</div>
              <div>Generado: ${new Date().toLocaleString('es-VE')}</div>
              <div>Documento generado por el sistema</div>
            </div>
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
          <Badge variant="purple" icon={<CruzFallecido className="h-3.5 w-3.5" />}>
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

  // ============================================
  // RENDER
  // ============================================
  return (
    // El padding lo pone MainLayout (p-4 sm:p-6); repetirlo aqui reducia el
    // ancho util en un telefono.
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Funeraria</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Acuerdos de servicio funerario por socio y sus beneficiarios cubiertos
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={abrirElegirListado} isLoading={listadoCargando}>
            <Printer className="w-4 h-4" />
            Imprimir listado
          </Button>
          <Button variant="outline" onClick={() => void abrirReporteSuspendidos()}>
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

      {/* Solo se monta un documento imprimible a la vez (igual que en Salud): el
          listado oculta todo lo demás al imprimir (body * { visibility: hidden }),
          así que si estuviera montado junto a la ficha, ésta saldría en blanco. */}
      {fichaParaImprimir ? (
        <PrintableFichaAcuerdo {...fichaParaImprimir} />
      ) : listadoParaImprimir && opcionListado ? (
        <PrintableListado
          titulo={opcionListado.titulo}
          subtitulo={`Total de acuerdos: ${listadoParaImprimir.filas.length}`}
          filtros={[{ label: 'Listado', value: opcionListado.etiqueta }]}
          columnas={columnasListado}
          columnasMayusculas={['Apellidos y Nombres']}
          filas={filasListado}
        />
      ) : null}

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
          {/*
              Cuatro pestanas no entran en el ancho de un telefono: median
              492px. Se deslizan en horizontal, que es el gesto esperado en
              una tira de filtros, en vez de partirse en dos lineas.
            */}
            <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:px-0">
              <div className="flex w-max gap-1 rounded-lg bg-neutral-100 p-1 md:w-auto">
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
            </div>

          {puedeEscribir && (
            <Button variant="outline" onClick={() => abrirTraspaso()}>
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
          <table className="w-full divide-y divide-neutral-200">
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
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {acuerdo.socio?.codigo_socio || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-primary-700">
                        {acuerdo.numero_acuerdo || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 min-w-[12rem] break-words">
                      <p className="text-sm font-medium text-neutral-900">
                        {acuerdo.socio?.nombre_completo || 'Sin socio asignado'}
                      </p>
                      <p className="text-xs text-neutral-500">{acuerdo.socio?.cedula}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      {acuerdo.semanas_sin_pago >= 5 ? (
                        <Badge variant="error">{acuerdo.semanas_sin_pago}</Badge>
                      ) : acuerdo.semanas_sin_pago > 0 ? (
                        <Badge variant="warning">{acuerdo.semanas_sin_pago}</Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">{badgeEstado(acuerdo.estado)}</td>
                    <td className="px-3 py-3 text-sm text-neutral-500">
                      {acuerdo.estado === 'retirado' && acuerdo.fecha_retiro
                        ? formatearFecha(acuerdo.fecha_retiro)
                        : formatearFecha(acuerdo.fecha_inicio)}
                      {acuerdo.estado !== 'retirado' && acuerdo.en_espera && acuerdo.fecha_fin_espera && (
                        <span className="mt-1 block text-xs font-medium text-amber-700">
                          En espera hasta {formatearFecha(acuerdo.fecha_fin_espera)}
                        </span>
                      )}
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
              label="N° de expediente del socio (o su cédula)"
              value={wizardCedula}
              onChange={(e) => setWizardCedula(valorEnMayusculas(e))}
              placeholder="Ej: 00123 o 012345678"
              data-enter-propio onKeyDown={(e) => e.key === 'Enter' && void buscarSocioWizard()}
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
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                {wizardSocio.apellido}, {wizardSocio.nombre}
                {wizardSocio.es_trabajador_triunfo && <DistintivoTrabajadorTriunfo compacto />}
              </p>
              <p className="text-xs text-neutral-500">
                {wizardSocio.codigo_socio} • {wizardSocio.cedula} • Tel. {wizardSocio.telefono || 'sin dato'}
              </p>
            </div>

            {wizardAcuerdosSocio.length > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                Este socio ya tiene {wizardAcuerdosSocio.length} acuerdo(s) de funeraria:{' '}
                <span className="font-mono">
                  {wizardAcuerdosSocio.map((a) => a.numero_acuerdo || 'sin número').join(', ')}
                </span>
                . Se abrirá uno adicional con sus propios beneficiarios (hasta {MAX_BENEFICIARIOS_POR_ACUERDO}).
              </div>
            )}

            {/* Si el titular ya no estará (fallecimiento, migración...), su acuerdo se traspasa a otro socio */}
            {puedeEscribir && wizardAcuerdosSocio.some((a) => a.estado !== 'retirado') && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">
                  ¿El titular ya no estará? Traspasa su acuerdo a otro socio registrado:
                </p>
                {wizardAcuerdosSocio
                  .filter((a) => a.estado !== 'retirado')
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                    >
                      <div className="text-sm">
                        <p className="font-mono font-medium text-neutral-900">{a.numero_acuerdo || 'sin número'}</p>
                        <p className="text-xs text-neutral-500">
                          {a.estado} • desde {formatearFecha(a.fecha_inicio)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const titular = wizardSocio
                          cerrarWizard()
                          abrirTraspaso(a, titular)
                        }}
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Traspaso
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <Input
              label="N° de acuerdo de funeraria"
              value={wizardNumeroAcuerdo}
              onChange={(e) => setWizardNumeroAcuerdo(valorEnMayusculas(e))}
              helperText="Propuesto como expediente-número; puedes modificarlo"
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
              <Button onClick={() => setWizardPaso(3)} className="flex-1">
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
                <span className="text-neutral-500">N° de expediente:</span>{' '}
                <span className="font-mono font-medium">{wizardSocio.codigo_socio}</span>
              </p>
              <p>
                <span className="text-neutral-500">Socio:</span>{' '}
                <span className="font-medium">
                  {wizardSocio.apellido}, {wizardSocio.nombre}
                </span>
                {wizardSocio.es_trabajador_triunfo && <DistintivoTrabajadorTriunfo compacto className="ml-2" />}
              </p>
              {/* Solo lectura: los datos del socio se editan en el módulo de Socios */}
              <p>
                <span className="text-neutral-500">Teléfono:</span>{' '}
                <span className="font-medium">{wizardSocio.telefono || 'Sin dato'}</span>
              </p>
              <p>
                <span className="text-neutral-500">N° de acuerdo de funeraria:</span>{' '}
                <span className="font-mono font-medium">{wizardNumeroAcuerdo || 'se asigna después'}</span>
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
      {/* MODAL: TRASPASO DEL ACUERDO A OTRO SOCIO */}
      {/* ============================================ */}
      <ModalTraspasoAcuerdo
        open={traspasoAbierto}
        onClose={cerrarTraspaso}
        modulo="funeraria"
        acuerdoInicial={traspasoAcuerdoInicial}
        titularInicial={traspasoTitularInicial}
        onCompletado={() => void Promise.all([cargarAcuerdos(), cargarEstadisticas()])}
      />

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
              onChange={(e) => setSocialesCodigo(valorEnMayusculas(e))}
              placeholder="Ingresa el código de programas sociales"
              data-enter-propio onKeyDown={(e) => e.key === 'Enter' && void guardarCodigoSocial()}
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
            </div>
          )}

          <Input
            label="N° de acuerdo de funeraria"
            value={editNumeroAcuerdo}
            onChange={(e) => setEditNumeroAcuerdo(valorEnMayusculas(e))}
            placeholder={acuerdoEditando?.socio?.codigo_socio ? `${acuerdoEditando.socio.codigo_socio}-0` : undefined}
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
          // Igual que el detalle de Salud: acciones a la izquierda, Cerrar a la derecha
          <div className="flex w-full flex-wrap gap-3">
            {acuerdoDetalle && (
              <>
                <Button variant="outline" onClick={() => void imprimirFicha()} isLoading={imprimiendo}>
                  <Printer className="h-4 w-4" />
                  Imprimir Ficha
                </Button>
                {puedeEscribir && (
                  <Button variant="outline" onClick={() => void abrirImportarSalud()}>
                    <HeartPulse className="h-4 w-4" />
                    Importar a Salud
                  </Button>
                )}
              </>
            )}
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setDrawerAbierto(false)}>
              Cerrar
            </Button>
          </div>
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
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Número de acuerdo</dt>
                    <dd className="mt-1 font-mono text-sm text-neutral-700">{acuerdoDetalle.numero_acuerdo || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Fecha de inicio</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{formatearFecha(acuerdoDetalle.fecha_inicio)}</dd>
                    {acuerdoDetalle.en_espera && acuerdoDetalle.fecha_fin_espera && (
                      <dd className="mt-1 text-xs font-medium text-amber-700">
                        En espera hasta {formatearFecha(acuerdoDetalle.fecha_fin_espera)}: todavía no se puede usar
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Semanas sin pago</dt>
                    <dd className="mt-1 text-sm text-neutral-700">{acuerdoDetalle.semanas_sin_pago}</dd>
                  </div>
                  {/* Se lee del socio cada vez que se abre el detalle: siempre muestra el último guardado */}
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-neutral-500">Código sociales</dt>
                    <dd className="mt-1 font-mono text-sm text-neutral-700">{acuerdoDetalle.socio?.codigo_social || 'Sin código'}</dd>
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
                    Beneficiarios de este acuerdo ({beneficiariosVisibles.length})
                  </p>
                  <p className="text-xs text-neutral-500">
                    {beneficiariosActivosCount}/{MAX_BENEFICIARIOS_POR_ACUERDO} beneficiarios (+1 titular = máx. {MAX_BENEFICIARIOS_POR_ACUERDO + 1} personas)
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
                        ? `Este acuerdo ya alcanzó el máximo de ${MAX_BENEFICIARIOS_POR_ACUERDO} beneficiarios (${MAX_BENEFICIARIOS_POR_ACUERDO + 1} personas incluyendo al titular)`
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
                  Este acuerdo ya tiene el máximo de {MAX_BENEFICIARIOS_POR_ACUERDO} beneficiarios permitidos ({MAX_BENEFICIARIOS_POR_ACUERDO + 1} personas incluyendo al titular). Para agregar uno nuevo, retira a alguno de los registrados o abre otro acuerdo de funeraria para este socio.
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
                          Este acuerdo no tiene beneficiarios registrados.
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
                                    <CruzFallecido className="h-4 w-4" />
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
                              {beneficiario.estado === 'fallecido' && (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => void revertirFallecido(beneficiario)}
                                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                                    title="Revertir fallecimiento (volver a activo)"
                                  >
                                    <RotateCcw className="h-4 w-4" />
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

      {revertirNuevoAcuerdo && acuerdoDetalle?.socio && (
        <ModalRevertirConNuevoAcuerdo
          open
          onClose={() => setRevertirNuevoAcuerdo(null)}
          onCompletado={(numero) => void completarRevertirNuevoAcuerdo(numero)}
          socio={acuerdoDetalle.socio}
          beneficiario={revertirNuevoAcuerdo}
        />
      )}

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
            onChange={(e) =>
              setBeneficiarioForm((f) => ({ ...f, cedula: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))
            }
            maxLength={20}
            placeholder="Ej: 12345678 o 12345678-1"
            helperText="Números, letras y guión (-). Menor sin cédula: escribe MENOR y se le asigna MENOR-1, MENOR-2…"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nombre *"
              value={beneficiarioForm.nombre}
              onChange={(e) => setBeneficiarioForm((f) => ({ ...f, nombre: valorEnMayusculas(e) }))}
            />
            <Input
              label="Apellido *"
              value={beneficiarioForm.apellido}
              onChange={(e) => setBeneficiarioForm((f) => ({ ...f, apellido: valorEnMayusculas(e) }))}
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
              {sociosService.PARENTESCOS_FUNERARIA.map((parentesco) => (
                <option key={parentesco} value={parentesco}>
                  {parentesco}
                </option>
              ))}
              {/* Beneficiario cargado antes con un parentesco que la funeraria no cubre */}
              {beneficiarioForm.parentesco &&
                !(sociosService.PARENTESCOS_FUNERARIA as readonly string[]).includes(beneficiarioForm.parentesco) && (
                  <option value={beneficiarioForm.parentesco}>{beneficiarioForm.parentesco} (no lo cubre la funeraria)</option>
                )}
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
              onChange={(e) => setEstadoMotivo(valorEnMayusculas(e))}
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
        onClose={cerrarImportarSalud}
        title={
          importarSaludResultado
            ? importarSaludResultado.exito
              ? 'Importación a Salud completada'
              : 'No se completó la importación a Salud'
            : 'Importar a Salud'
        }
        description={
          importarSaludResultado
            ? undefined
            : 'Copia los beneficiarios seleccionados (o solo el titular, si el acuerdo no tiene beneficiarios) a un acuerdo de salud del mismo titular. En Funeraria no se borra nada.'
        }
        size="md"
        footer={
          importarSaludResultado ? (
            <>
              {!importarSaludResultado.exito && (
                <Button variant="outline" onClick={() => setImportarSaludResultado(null)}>
                  Corregir e intentar de nuevo
                </Button>
              )}
              <Button onClick={cerrarImportarSalud}>Volver al acuerdo de funeraria</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={cerrarImportarSalud}>
                Cancelar
              </Button>
              <Button
                onClick={continuarImportarSalud}
                isLoading={importarSaludEnviando}
                disabled={
                  (importarSaludSeleccionados.length === 0 && !(importarSaludCrearAcuerdo && importarSaludCandidatos.length === 0)) ||
                  importarSaludCargando ||
                  (importarSaludGrupos.length === 0 && !importarSaludCrearAcuerdo)
                }
              >
                {importarSaludCrearAcuerdo
                  ? importarSaludCandidatos.length === 0
                    ? 'Crear acuerdo de salud'
                    : 'Crear acuerdo de salud y copiar'
                  : importarSaludGrupos.length > 1
                    ? 'Continuar'
                    : 'Copiar a Salud'}
              </Button>
            </>
          )
        }
      >
        {importarSaludResultado ? (
          <div
            className={
              importarSaludResultado.exito
                ? 'rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800'
                : 'rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700'
            }
          >
            {importarSaludResultado.mensaje}
          </div>
        ) : (
          <div className="space-y-4">
            {importarSaludError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
                {importarSaludError}
              </div>
            )}

            {acuerdoDetalle?.socio && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-sm font-semibold text-neutral-900">{acuerdoDetalle.socio.nombre_completo}</p>
                <p className="text-xs text-neutral-500">
                  Titular • Exp. {acuerdoDetalle.socio.codigo_socio} •{' '}
                  {importarSaludCrearAcuerdo ? 'será el titular del acuerdo de salud nuevo' : importarSaludGrupos.length > 0 ? 'ya es el dueño de su acuerdo de salud' : ''}
                </p>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-neutral-700">
                  Beneficiarios a copiar ({importarSaludSeleccionados.length} de {importarSaludCandidatos.length})
                </p>
                {importarSaludCandidatos.length > 0 && (
                  <Button variant="outline" size="sm" onClick={alternarTodosImportarSalud}>
                    {importarSaludTodos ? 'Quitar todos' : 'Seleccionar todos'}
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {importarSaludCandidatos.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-neutral-500">
                    Este acuerdo no tiene beneficiarios vivos para copiar: solo se copiarán los datos del titular.
                  </p>
                )}
                {importarSaludCandidatos.map((beneficiario) => (
                  <label
                    key={beneficiario.id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 text-sm cursor-pointer hover:bg-neutral-50"
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

            {importarSaludCargando && <p className="text-sm text-neutral-500">Buscando los acuerdos de salud del titular...</p>}
            {!importarSaludCrearAcuerdo && importarSaludCandidatos.length > 0 && importarSaludGrupos.length === 1 && (
              <p className="text-sm text-neutral-600">
                Se copiarán al acuerdo de salud{' '}
                <span className="font-mono font-medium">{importarSaludGrupos[0]!.numero_acuerdo}</span>.
              </p>
            )}
            {!importarSaludCrearAcuerdo && importarSaludCandidatos.length > 0 && importarSaludGrupos.length > 1 && (
              <p className="text-sm text-neutral-600">
                El titular tiene {importarSaludGrupos.length} acuerdos de salud; al continuar se te preguntará a cuál copiarlos.
              </p>
            )}
            {!importarSaludCrearAcuerdo && !importarSaludCargando && importarSaludCandidatos.length === 0 && importarSaludGrupos.length > 0 && (
              <p className="text-sm text-neutral-600">
                El socio ya tiene acuerdo de salud ({importarSaludGrupos.map((g) => g.numero_acuerdo).join(', ')}) y no se abrió uno
                nuevo. No hay nada más que copiar.
              </p>
            )}
            {importarSaludCrearAcuerdo && (
              <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
                <p className="text-sm text-sky-800">
                  {importarSaludAbrirOtro ? (
                    <>
                      El socio {acuerdoDetalle?.socio?.codigo_socio} ya tiene acuerdo de salud (
                      {importarSaludGrupos.map((g) => g.numero_acuerdo).join(', ')}). Se le abrirá <strong>un acuerdo nuevo adicional</strong>{' '}
                      a su nombre
                    </>
                  ) : (
                    <>
                      El socio {acuerdoDetalle?.socio?.codigo_socio} <strong>no tiene acuerdo de salud</strong>. Se le creará uno nuevo a
                      su nombre
                    </>
                  )}
                  {importarSaludCandidatos.length > 0
                    ? ' y los beneficiarios seleccionados se agregarán a ese acuerdo.'
                    : ', con sus datos como titular.'}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="N° del acuerdo de salud que se creará"
                    value={importarSaludNumeroNuevo ?? ''}
                    onChange={(e) => setImportarSaludNumeroNuevo(valorEnMayusculas(e))}
                    maxLength={20}
                    helperText="Propuesto con el número de expediente; puedes modificarlo"
                  />
                  <Input
                    label="Fecha de inicio"
                    type="date"
                    value={importarSaludFechaNueva}
                    onChange={(e) => setImportarSaludFechaNueva(e.target.value)}
                    helperText="Por defecto hoy; puedes modificarla"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Ventana adicional: el titular tiene más de un acuerdo de salud */}
      <Modal
        open={importarSaludElegirAbierto}
        onClose={() => setImportarSaludElegirAbierto(false)}
        title="¿A qué acuerdo de salud?"
        description={`El titular (exp. ${acuerdoDetalle?.socio?.codigo_socio ?? ''}) tiene varios acuerdos de salud. Elige a cuál copiar los ${importarSaludSeleccionados.length} beneficiario(s).`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setImportarSaludElegirAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => importarSaludGrupoElegido && void confirmarImportarSalud(importarSaludGrupoElegido)}
              disabled={!importarSaludGrupoElegido}
              isLoading={importarSaludEnviando}
            >
              Copiar a este acuerdo
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {importarSaludGrupos.map((g) => (
            <label
              key={g.numero_acuerdo}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 text-sm hover:bg-neutral-50 cursor-pointer"
            >
              <input
                type="radio"
                name="acuerdo-salud-destino"
                checked={importarSaludGrupoElegido === g.numero_acuerdo}
                onChange={() => setImportarSaludGrupoElegido(g.numero_acuerdo)}
              />
              <span className="font-mono font-medium">{g.numero_acuerdo}</span>
              <span className="text-neutral-500">
                • desde {formatearFecha(g.fecha_inicio)} • {g.estado}
              </span>
            </label>
          ))}
        </div>
      </Modal>

      {/* Ventana informativa: acuerdo sin beneficiarios y el titular ya tiene acuerdo de salud */}
      <Modal
        open={importarSaludPreguntarOtro}
        onClose={cerrarImportarSalud}
        title="El socio ya tiene acuerdo de salud"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={cerrarImportarSalud}>
              No
            </Button>
            <Button onClick={() => void aceptarAbrirOtroSalud()}>Sí, abrir un acuerdo nuevo</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-neutral-700">
          <p>
            El socio <strong>{acuerdoDetalle?.socio?.nombre_completo}</strong> (exp. {acuerdoDetalle?.socio?.codigo_socio}) ya tiene{' '}
            {importarSaludGrupos.length === 1 ? 'un acuerdo de salud abierto' : `${importarSaludGrupos.length} acuerdos de salud abiertos`}:
          </p>
          <ul className="space-y-1">
            {importarSaludGrupos.map((g) => (
              <li key={g.numero_acuerdo} className="rounded border border-neutral-200 px-3 py-1.5">
                <span className="font-mono font-medium">{g.numero_acuerdo}</span>
                <span className="text-neutral-500">
                  {' '}
                  • desde {formatearFecha(g.fecha_inicio)} • {g.estado}
                </span>
              </li>
            ))}
          </ul>
          <p className="font-medium">¿Desea abrir un nuevo acuerdo para este socio?</p>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: ¿QUÉ LISTADO IMPRIMIR? */}
      {/* ============================================ */}
      <Modal
        open={listadoElegirAbierto}
        onClose={() => setListadoElegirAbierto(false)}
        title="Imprimir listado"
        description="Elige qué acuerdos de funeraria quieres imprimir."
        size="sm"
        footer={
          <div className="flex w-full flex-wrap gap-3">
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setListadoElegirAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void generarListado()} isLoading={listadoCargando}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {listadoError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">{listadoError}</div>
          )}
          {OPCIONES_LISTADO.map((opcion) => (
            <label
              key={opcion.valor}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 text-sm hover:bg-neutral-50 cursor-pointer"
            >
              <input
                type="radio"
                name="listado-funeraria"
                checked={listadoEstado === opcion.valor}
                onChange={() => setListadoEstado(opcion.valor)}
              />
              <span className="font-medium text-neutral-900">{opcion.etiqueta}</span>
            </label>
          ))}
        </div>
      </Modal>

      {/* ============================================ */}
      {/* MODAL: REPORTE SUSPENDIDOS (vista previa + descarga en Excel) */}
      {/* ============================================ */}
      <Modal
        open={reporteAbierto}
        onClose={() => setReporteAbierto(false)}
        title="Reporte de suspendidos"
        description="Vista previa del reporte. Descárgalo en Excel solo si lo necesitas."
        size="xl"
        footer={
          <div className="flex w-full flex-wrap gap-3">
            <Button
              onClick={() => void descargarReporteSuspendidos()}
              isLoading={generandoReporte}
              disabled={reporteCargando || !!(reporteError && reporteFilas.length === 0)}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Descargar Excel
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setReporteAbierto(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        {reporteError && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">{reporteError}</div>
        )}
        {/* También arriba: la hoja puede ser muy larga y no hace falta bajar hasta el final */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            {reporteCargando ? 'Generando...' : `${reporteFilas.length} acuerdo(s) suspendido(s)`}
          </p>
          <Button
            onClick={() => void descargarReporteSuspendidos()}
            isLoading={generandoReporte}
            disabled={reporteCargando || !!(reporteError && reporteFilas.length === 0)}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Descargar Excel
          </Button>
        </div>
        {reporteCargando ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generando reporte...</span>
          </div>
        ) : (
          // La "hoja": mismo encabezado y tabla que las impresiones y el Excel
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
            <EncabezadoImpresion
              titulo="Reporte de Acuerdos de Funeraria Suspendidos"
              detalles={<div>Total suspendidos: {reporteFilas.length}</div>}
              generadoEn={reporteGeneradoEn}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    {['N°', 'N° Expediente', 'N° Acuerdo', 'Apellidos y Nombres', 'Cédula', 'Teléfono', 'Semanas de Atraso'].map((col) => (
                      <th key={col} className="border border-neutral-300 px-2 py-1.5 text-center font-semibold uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reporteFilas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-neutral-300 px-2 py-6 text-center italic text-neutral-500">
                        No hay acuerdos suspendidos.
                      </td>
                    </tr>
                  ) : (
                    reporteFilas.map((f, i) => (
                      <tr key={`${f.numero_acuerdo}-${i}`} className={i % 2 === 1 ? 'bg-neutral-100' : ''}>
                        <td className="border border-neutral-300 px-2 py-1 text-center">{i + 1}</td>
                        <td className="border border-neutral-300 px-2 py-1 text-center">{f.expediente}</td>
                        <td className="border border-neutral-300 px-2 py-1 text-center">{f.numero_acuerdo}</td>
                        <td className="border border-neutral-300 px-2 py-1">{nombreEnMayusculas(`${f.apellidos} ${f.nombres}`)}</td>
                        <td className="border border-neutral-300 px-2 py-1 text-center">{f.cedula}</td>
                        <td className="border border-neutral-300 px-2 py-1 text-center">{f.telefono}</td>
                        <td className="border border-neutral-300 px-2 py-1 text-center font-semibold text-rose-700">{f.semanas_atraso}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
