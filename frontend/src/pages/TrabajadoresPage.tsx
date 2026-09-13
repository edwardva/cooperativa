/**
 * ============================================
 * PAGE: TRABAJADORES DE FERIA
 * ============================================
 * Expediente de trabajador (HU-03, HU-04, HU-06). Es un expediente de la
 * persona separado del de ahorrista: darlo de alta no crea un socio, y la
 * ficha dice cuando termina la prueba para poder inscribirlo como ahorrista.
 *
 * El alta empieza por la identificacion: si la persona ya existe se reutiliza
 * con sus datos, nunca se registra dos veces.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  HardHat,
  HeartPulse,
  Loader2,
  LogOut,
  Plus,
  Search,
  UserCheck,
  X,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Drawer } from '../components/ui/Drawer'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { useEnterNavigation } from '../hooks/useEnterNavigation'
import { validarCedula } from '../utils/cedula'
import * as trabajadoresService from '../services/trabajadoresService'
import * as personasService from '../services/personasService'
import * as feriasService from '../services/feriasService'
import * as saludFeriaService from '../services/saludFeriaService'
import type { PagoDeTrabajador } from '../services/saludFeriaService'
import { TIPOS_IDENTIFICACION } from '../services/personasService'
import type { EstadoTrabajador, Trabajador, TrabajadorDetalle } from '../services/trabajadoresService'
import type { ResultadoIdentificacion, TipoIdentificacion } from '../services/personasService'
import type { Ubicacion } from '../services/feriasService'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 read-only:bg-neutral-50 read-only:text-neutral-600 disabled:bg-neutral-50'

const labelClass = 'block text-sm font-medium text-neutral-700'

const pad = (n: number) => String(n).padStart(2, '0')

/** Hoy en la fecha LOCAL: toISOString() daria manana despues de las 8 p.m. en Venezuela */
const hoyISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Columnas DATE: se leen tal cual, sin pasar por la zona horaria */
const dia = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'

const ESTADOS: { value: EstadoTrabajador; label: string }[] = [
  { value: 'activo', label: 'Activos' },
  { value: 'suspendido', label: 'Suspendidos' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'retirado', label: 'Retirados' },
]

const badgeEstado = (estado: EstadoTrabajador) => {
  if (estado === 'activo') return <Badge variant="success">Activo</Badge>
  if (estado === 'suspendido') return <Badge variant="warning">Suspendido</Badge>
  if (estado === 'retirado') return <Badge variant="error">Retirado</Badge>
  return <Badge variant="neutral">Inactivo</Badge>
}

const badgePrueba = (t: Trabajador) =>
  t.prueba.cumplida ? (
    <Badge variant="success">Cumplida</Badge>
  ) : (
    <Badge variant="warning">Hasta {dia(t.prueba.fin_prueba)}</Badge>
  )

const nombreFeria = (f: { codigo: string; nombre: string }) =>
  f.nombre && f.nombre !== f.codigo ? `${f.codigo} · ${f.nombre}` : f.codigo

const formularioVacio = () => ({
  tipo_identificacion: 'V' as TipoIdentificacion,
  numero_identificacion: '',
  nombres: '',
  apellidos: '',
  sexo: '' as '' | 'M' | 'F',
  fecha_nacimiento: '',
  telefono: '',
  direccion: '',
  feria_id: '',
  fecha_ingreso: hoyISO(),
  codigo_trabajador: '',
  observaciones: '',
})

export default function TrabajadoresPage() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const puedeCrear = hasPermission('trabajadores', 'create')
  const puedeEditar = hasPermission('trabajadores', 'update')
  const puedeVerSalud = hasPermission('salud_feria', 'read')
  const alEnter = useEnterNavigation()

  // --- Listado ---
  const [ferias, setFerias] = useState<Ubicacion[]>([])
  const [filas, setFilas] = useState<Trabajador[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [paginas, setPaginas] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [feriaFiltro, setFeriaFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('activo')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // --- Ficha ---
  const [detalle, setDetalle] = useState<TrabajadorDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [pagosSalud, setPagosSalud] = useState<PagoDeTrabajador[] | null>(null)

  // Historial de salud pagada por la feria (RF-SAL-14, por trabajador)
  const detalleId = detalle?.id
  useEffect(() => {
    setPagosSalud(null)
    if (!detalleId || !puedeVerSalud) return
    let vigente = true
    void saludFeriaService
      .historialTrabajador(detalleId)
      .then((r) => { if (vigente) setPagosSalud(r.data) })
      .catch(() => { if (vigente) setPagosSalud(null) })
    return () => { vigente = false }
  }, [detalleId, puedeVerSalud])

  // --- Alta ---
  const [altaAbierta, setAltaAbierta] = useState(false)
  const [form, setForm] = useState(formularioVacio)
  const [identificacion, setIdentificacion] = useState<ResultadoIdentificacion | null>(null)
  const [buscandoId, setBuscandoId] = useState(false)
  const [errorAlta, setErrorAlta] = useState('')
  const [guardando, setGuardando] = useState(false)

  // --- Traslado y retiro ---
  const [traslado, setTraslado] = useState<{ feria_id: string; fecha: string; motivo: string } | null>(null)
  const [retiro, setRetiro] = useState<{ fecha_salida: string; motivo: string } | null>(null)
  const [errorOperacion, setErrorOperacion] = useState('')
  const [procesando, setProcesando] = useState(false)

  const feriasActivas = ferias.filter((f) => f.estado)

  useEffect(() => {
    void (async () => {
      try {
        const r = await feriasService.obtenerUbicaciones()
        if (r.success && r.data) setFerias(r.data)
      } catch {
        // Sin ferias el filtro queda vacio; el error se ve al guardar
      }
    })()
  }, [])

  // La busqueda se aplica al dejar de escribir, no en cada tecla
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(espera)
  }, [busqueda])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const r = await trabajadoresService.listarTrabajadores({
        busqueda: busquedaAplicada || undefined,
        feria_id: feriaFiltro ? Number(feriaFiltro) : undefined,
        estado: estadoFiltro || undefined,
        ingreso_desde: desde || undefined,
        ingreso_hasta: hasta || undefined,
        page: pagina,
        limit: 20,
      })
      setFilas(r.data)
      setTotal(r.meta?.total ?? r.data.length)
      setPaginas(Math.max(1, r.meta?.totalPages ?? 1))
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar los trabajadores')
    } finally {
      setCargando(false)
    }
  }, [busquedaAplicada, feriaFiltro, estadoFiltro, desde, hasta, pagina])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const abrirDetalle = async (id: number) => {
    setCargandoDetalle(true)
    try {
      const r = await trabajadoresService.obtenerTrabajador(id)
      setDetalle(r.data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al abrir la ficha')
    } finally {
      setCargandoDetalle(false)
    }
  }

  // ================= ALTA =================

  const abrirAlta = () => {
    setForm(formularioVacio())
    setIdentificacion(null)
    setErrorAlta('')
    setAltaAbierta(true)
  }

  const cambiarCampo = (campo: keyof ReturnType<typeof formularioVacio>, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    // Cambiar la identificacion invalida lo que se habia encontrado
    if (campo === 'numero_identificacion' || campo === 'tipo_identificacion') setIdentificacion(null)
  }

  const consultarIdentificacion = async () => {
    const numero = form.numero_identificacion.trim()
    if (!numero || identificacion) return
    setErrorAlta('')

    if (form.tipo_identificacion === 'V' || form.tipo_identificacion === 'E') {
      const revision = validarCedula(numero)
      if (!revision.valida) {
        setErrorAlta(revision.error ?? 'Cedula invalida')
        return
      }
    }

    setBuscandoId(true)
    try {
      const r = await personasService.buscarPorIdentificacion(numero, form.tipo_identificacion)
      setIdentificacion(r.data)
      const persona = r.data.persona
      const socio = r.data.socios_sin_persona[0]
      if (persona) {
        setForm((f) => ({
          ...f,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
          sexo: persona.sexo ?? '',
          fecha_nacimiento: persona.fecha_nacimiento?.slice(0, 10) ?? '',
          telefono: persona.telefono ?? '',
          direccion: persona.direccion ?? '',
        }))
      } else if (socio) {
        setForm((f) => ({
          ...f,
          nombres: socio.nombre,
          apellidos: socio.apellido,
          sexo: socio.sexo ?? '',
          fecha_nacimiento: socio.fecha_nacimiento?.slice(0, 10) ?? '',
          telefono: socio.telefono ?? '',
          direccion: socio.direccion ?? '',
        }))
      }
    } catch (err) {
      setErrorAlta(getErrorMessage(err) || 'No fue posible consultar la identificacion')
    } finally {
      setBuscandoId(false)
    }
  }

  const personaExistente = identificacion?.persona ?? null
  const trabajadorVigente = personaExistente?.trabajadores.find((t) => t.estado !== 'retirado') ?? null

  const guardarAlta = async () => {
    if (!identificacion) {
      setErrorAlta('Primero consulte la identificacion: escriba el numero y pase al campo siguiente.')
      return
    }
    if (trabajadorVigente) {
      setErrorAlta(`Esta persona ya es trabajador (${trabajadorVigente.codigo_trabajador}). Use Trasladar desde su ficha.`)
      return
    }
    if (!personaExistente && (form.nombres.trim().length < 2 || form.apellidos.trim().length < 2)) {
      setErrorAlta('Nombres y apellidos son obligatorios.')
      return
    }
    if (!form.feria_id) {
      setErrorAlta('Seleccione la feria donde trabaja.')
      return
    }
    if (!form.fecha_ingreso) {
      setErrorAlta('Indique la fecha de ingreso.')
      return
    }

    setGuardando(true)
    setErrorAlta('')
    try {
      const r = await trabajadoresService.crearTrabajador({
        ...(personaExistente
          ? { persona_id: personaExistente.id }
          : {
              persona: {
                tipo_identificacion: form.tipo_identificacion,
                numero_identificacion: form.numero_identificacion.trim(),
                nombres: form.nombres.trim(),
                apellidos: form.apellidos.trim(),
                sexo: form.sexo || null,
                fecha_nacimiento: form.fecha_nacimiento || null,
                telefono: form.telefono.trim() || null,
                direccion: form.direccion.trim() || null,
              },
            }),
        feria_id: Number(form.feria_id),
        fecha_ingreso: form.fecha_ingreso,
        codigo_trabajador: form.codigo_trabajador.trim() || null,
        observaciones: form.observaciones.trim() || null,
      })
      setAltaAbierta(false)
      setAviso(
        `Trabajador ${r.data.codigo_trabajador} registrado en ${r.data.feria_actual?.codigo ?? 'su feria'}. ` +
          'El servicio de salud quedo asignado por la feria.'
      )
      setDetalle(r.data)
      await cargar()
    } catch (err) {
      setErrorAlta(getErrorMessage(err) || 'No fue posible registrar el trabajador')
    } finally {
      setGuardando(false)
    }
  }

  // ================= TRASLADO Y RETIRO =================

  const confirmarTraslado = async () => {
    if (!detalle || !traslado) return
    if (!traslado.feria_id) return setErrorOperacion('Seleccione la nueva feria.')
    if (traslado.motivo.trim().length < 5) return setErrorOperacion('Explique el motivo (minimo 5 caracteres).')

    setProcesando(true)
    setErrorOperacion('')
    try {
      const r = await trabajadoresService.trasladarTrabajador(detalle.id, {
        feria_id: Number(traslado.feria_id),
        fecha: traslado.fecha,
        motivo: traslado.motivo.trim(),
      })
      setTraslado(null)
      setDetalle(r.data)
      setAviso(`${r.data.codigo_trabajador} trasladado a ${r.data.feria_actual?.codigo}. Los pagos anteriores conservan su feria.`)
      await cargar()
    } catch (err) {
      setErrorOperacion(getErrorMessage(err) || 'No fue posible registrar el traslado')
    } finally {
      setProcesando(false)
    }
  }

  const confirmarRetiro = async () => {
    if (!detalle || !retiro) return
    if (retiro.motivo.trim().length < 5) return setErrorOperacion('Explique el motivo (minimo 5 caracteres).')

    setProcesando(true)
    setErrorOperacion('')
    try {
      const r = await trabajadoresService.retirarTrabajador(detalle.id, {
        fecha_salida: retiro.fecha_salida,
        motivo: retiro.motivo.trim(),
      })
      setRetiro(null)
      setDetalle(r.data)
      setAviso(`${r.data.codigo_trabajador} retirado. Su historial se conserva.`)
      await cargar()
    } catch (err) {
      setErrorOperacion(getErrorMessage(err) || 'No fue posible registrar el retiro')
    } finally {
      setProcesando(false)
    }
  }

  const inscribirComoAhorrista = () => {
    if (!detalle) return
    const { prueba, persona } = detalle
    if (
      !prueba.cumplida &&
      !window.confirm(
        `Todavia no cumple los ${prueba.meses} meses de prueba (termina el ${dia(prueba.fin_prueba)}). ` +
          '¿Inscribirlo como ahorrista de todas formas?'
      )
    ) {
      return
    }
    navigate(`/socios?nuevo=1&cedula=${encodeURIComponent(persona.numero_identificacion)}`)
  }

  const operable = detalle && puedeEditar && detalle.estado !== 'retirado' && detalle.estado !== 'inactivo'
  const cedulaInscribible = detalle && ['V', 'E'].includes(detalle.persona.tipo_identificacion)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
            <HardHat className="h-6 w-6 text-primary-600" />
            Trabajadores de feria
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Expediente laboral, feria actual y salud asignada por la feria. Es independiente del expediente de ahorrista.
          </p>
        </div>
        {puedeCrear && (
          <Button onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Nuevo trabajador
          </Button>
        )}
      </div>

      {aviso && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="flex-1">{aviso}</p>
          <button onClick={() => setAviso('')} aria-label="Cerrar aviso" className="text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filtros (RF-FER-06) */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className={`${labelClass} lg:col-span-2`}>
            <span className="mb-1.5 block">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, cedula o codigo"
                className={`${controlClass} pl-9`}
              />
            </div>
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Feria actual</span>
            <select
              value={feriaFiltro}
              onChange={(e) => { setFeriaFiltro(e.target.value); setPagina(1) }}
              className={controlClass}
            >
              <option value="">Todas</option>
              {ferias.map((f) => (
                <option key={f.id} value={f.id}>
                  {nombreFeria(f)}{f.estado ? '' : ' (inactiva)'}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className="mb-1.5 block">Estado</span>
            <select
              value={estadoFiltro}
              onChange={(e) => { setEstadoFiltro(e.target.value); setPagina(1) }}
              className={controlClass}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              <span className="mb-1.5 block">Ingreso desde</span>
              <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1) }} className={controlClass} />
            </label>
            <label className={labelClass}>
              <span className="mb-1.5 block">hasta</span>
              <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1) }} className={controlClass} />
            </label>
          </div>
        </div>
      </Card>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Listado */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Identificacion</th>
                <th className="px-4 py-3">Trabajador</th>
                <th className="px-4 py-3">Feria actual</th>
                <th className="px-4 py-3">Ingreso</th>
                <th className="px-4 py-3">Prueba</th>
                <th className="px-4 py-3">Salud</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cargando ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                    No hay trabajadores con estos filtros
                  </td>
                </tr>
              ) : (
                filas.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => void abrirDetalle(t.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void abrirDetalle(t.id) }}
                    tabIndex={0}
                    className="cursor-pointer transition hover:bg-primary-50/40 focus:bg-primary-50/40 focus:outline-none"
                  >
                    <td className="px-4 py-3 font-mono text-neutral-900">{t.codigo_trabajador}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {t.persona.tipo_identificacion}-{t.persona.numero_identificacion}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {t.persona.apellidos}, {t.persona.nombres}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{t.feria_actual ? nombreFeria(t.feria_actual) : '—'}</td>
                    <td className="px-4 py-3 text-neutral-700">{dia(t.fecha_ingreso)}</td>
                    <td className="px-4 py-3">{badgePrueba(t)}</td>
                    <td className="px-4 py-3">
                      {t.salud.asignada ? <Badge variant="info">Asignada</Badge> : <Badge variant="neutral">No</Badge>}
                    </td>
                    <td className="px-4 py-3">{badgeEstado(t.estado)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
          <span>{total} trabajador(es)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <span>Pagina {pagina} de {paginas}</span>
            <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      {/* ================= FICHA ================= */}
      <Drawer
        open={!!detalle || cargandoDetalle}
        onClose={() => setDetalle(null)}
        title={detalle ? `${detalle.persona.apellidos}, ${detalle.persona.nombres}` : 'Cargando...'}
        description={detalle ? `${detalle.codigo_trabajador} · ${detalle.persona.tipo_identificacion}-${detalle.persona.numero_identificacion}` : undefined}
        width="xl"
        footer={
          operable ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setErrorOperacion(''); setRetiro({ fecha_salida: hoyISO(), motivo: '' }) }}
              >
                <LogOut className="h-4 w-4" />
                Retirar
              </Button>
              <Button
                onClick={() => { setErrorOperacion(''); setTraslado({ feria_id: '', fecha: hoyISO(), motivo: '' }) }}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Trasladar de feria
              </Button>
            </div>
          ) : undefined
        }
      >
        {detalle && (
          <div className="space-y-5">
            {/* Expediente laboral */}
            <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Estado</p>
                <div className="mt-1">{badgeEstado(detalle.estado)}</div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Ingreso</p>
                <p className="mt-1 font-medium text-neutral-900">{dia(detalle.fecha_ingreso)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Feria actual</p>
                <p className="mt-1 font-medium text-neutral-900">
                  {detalle.feria_actual ? `${nombreFeria(detalle.feria_actual)} desde ${dia(detalle.feria_actual.desde)}` : '—'}
                </p>
              </div>
              {detalle.fecha_salida && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Salida</p>
                  <p className="mt-1 text-neutral-900">{dia(detalle.fecha_salida)} · {detalle.motivo_salida}</p>
                </div>
              )}
              {detalle.observaciones && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Observaciones</p>
                  <p className="mt-1 whitespace-pre-line text-neutral-700">{detalle.observaciones}</p>
                </div>
              )}
            </section>

            {/* Salud */}
            <section className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${detalle.salud.asignada ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
              <HeartPulse className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Servicio de salud</p>
                <p>{detalle.salud.detalle}. Lo descuenta y paga la feria.</p>
              </div>
            </section>

            {/* Prueba y expediente de ahorrista (HU-04) */}
            <section className="space-y-3 rounded-lg border border-neutral-200 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-neutral-900">Periodo de prueba ({detalle.prueba.meses} meses)</p>
                {badgePrueba(detalle)}
              </div>
              <p className="text-neutral-600">
                {detalle.prueba.dias_trabajados} dias trabajados.{' '}
                {detalle.prueba.cumplida
                  ? `Cumplio la prueba el ${dia(detalle.prueba.fin_prueba)}: puede inscribirse como ahorrista.`
                  : `Faltan ${detalle.prueba.dias_restantes} dias (termina el ${dia(detalle.prueba.fin_prueba)}).`}
              </p>
              {detalle.ahorrista.expedientes.length > 0 && (
                <p className="text-neutral-700">
                  Expedientes de ahorrista:{' '}
                  {detalle.ahorrista.expedientes.map((s) => `${s.codigo_socio} (${s.estado})`).join(' · ')}
                </p>
              )}
              {!detalle.ahorrista.tiene_expediente_activo && cedulaInscribible && hasPermission('socios', 'create') && (
                <Button variant="outline" size="sm" onClick={inscribirComoAhorrista}>
                  <UserCheck className="h-4 w-4" />
                  Inscribir como ahorrista
                </Button>
              )}
            </section>

            {/* Pagos de salud recibidos de la feria */}
            {pagosSalud && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Salud pagada por la feria
                </p>
                {pagosSalud.length === 0 ? (
                  <p className="text-sm text-neutral-500">Todavia no hay pagos de salud registrados.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                        <tr>
                          <th className="px-3 py-2">Periodo</th>
                          <th className="px-3 py-2">Feria</th>
                          <th className="px-3 py-2">Pagado el</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                          <th className="px-3 py-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {pagosSalud.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2">{p.periodo.etiqueta}</td>
                            <td className="px-3 py-2">{p.feria.codigo}</td>
                            <td className="px-3 py-2">{dia(p.pago.fecha_pago)}</td>
                            <td className="px-3 py-2 text-right">${Number(p.monto_usd).toFixed(2)}</td>
                            <td className="px-3 py-2">{p.estado === 'vigente' ? <Badge variant="success">Pagado</Badge> : <Badge variant="error">Anulado</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Historial de ferias (RF-FER-04) */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Historial de ferias
              </p>
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Feria</th>
                      <th className="px-3 py-2">Desde</th>
                      <th className="px-3 py-2">Hasta</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {detalle.ferias.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 font-medium text-neutral-900">{nombreFeria(a.feria)}</td>
                        <td className="px-3 py-2">{dia(a.fecha_inicio)}</td>
                        <td className="px-3 py-2">{a.fecha_fin ? dia(a.fecha_fin) : <Badge variant="success">Actual</Badge>}</td>
                        <td className="px-3 py-2 text-neutral-600">{a.motivo_cambio ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </Drawer>

      {/* ================= MODAL: ALTA ================= */}
      {altaAbierta && (
        <div className="fixed inset-0 z-[110] flex items-stretch justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
          <Card padding="none" className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-neutral-200 sm:h-auto sm:max-h-[calc(100vh-2rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Nuevo trabajador</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  No crea un expediente de ahorrista. Enter pasa al campo siguiente.
                </p>
              </div>
              <button onClick={() => setAltaAbierta(false)} aria-label="Cerrar" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5" onKeyDown={alEnter}>
              {/* Identificacion: lo primero, para no duplicar a nadie */}
              <div className="grid grid-cols-3 gap-3">
                <label className={labelClass}>
                  <span className="mb-1.5 block">Tipo</span>
                  <select
                    value={form.tipo_identificacion}
                    onChange={(e) => cambiarCampo('tipo_identificacion', e.target.value)}
                    className={controlClass}
                  >
                    {TIPOS_IDENTIFICACION.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className={`${labelClass} col-span-2`}>
                  <span className="mb-1.5 block">Numero de identificacion *</span>
                  <div className="relative">
                    <input
                      value={form.numero_identificacion}
                      onChange={(e) => cambiarCampo('numero_identificacion', e.target.value)}
                      onBlur={() => void consultarIdentificacion()}
                      autoFocus
                      className={controlClass}
                    />
                    {buscandoId && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />}
                  </div>
                </label>
              </div>

              {identificacion && (
                personaExistente ? (
                  <div className={`rounded-lg border px-4 py-3 text-sm ${trabajadorVigente ? 'border-red-200 bg-red-50 text-red-800' : 'border-sky-200 bg-sky-50 text-sky-900'}`}>
                    <p className="font-medium">
                      {trabajadorVigente
                        ? `Ya es trabajador: ${trabajadorVigente.codigo_trabajador} en ${trabajadorVigente.feria_actual?.codigo ?? 'sin feria'} (${trabajadorVigente.estado}).`
                        : 'Persona ya registrada: se reutilizan sus datos.'}
                    </p>
                    {personaExistente.socios.length > 0 && (
                      <p className="mt-1">
                        Ahorrista: {personaExistente.socios.map((s) => `${s.codigo_socio} (${s.estado})`).join(' · ')}
                      </p>
                    )}
                    {trabajadorVigente && <p className="mt-1">Para cambiarlo de feria abra su ficha y use Trasladar.</p>}
                  </div>
                ) : identificacion.socios_sin_persona.length > 0 ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    Ya existe como socio ({identificacion.socios_sin_persona.map((s) => s.codigo_socio).join(', ')}):
                    se toman sus datos. Reviselos antes de guardar.
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Identificacion nueva: complete los datos de la persona.</p>
                )
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span className="mb-1.5 block">Nombres *</span>
                  <input value={form.nombres} onChange={(e) => cambiarCampo('nombres', e.target.value)} readOnly={!!personaExistente} className={controlClass} />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Apellidos *</span>
                  <input value={form.apellidos} onChange={(e) => cambiarCampo('apellidos', e.target.value)} readOnly={!!personaExistente} className={controlClass} />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Sexo</span>
                  <select value={form.sexo} onChange={(e) => cambiarCampo('sexo', e.target.value)} disabled={!!personaExistente} className={controlClass}>
                    <option value="">Sin indicar</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </select>
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Fecha de nacimiento</span>
                  <input type="date" value={form.fecha_nacimiento} onChange={(e) => cambiarCampo('fecha_nacimiento', e.target.value)} readOnly={!!personaExistente} className={controlClass} />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Telefono</span>
                  <input value={form.telefono} onChange={(e) => cambiarCampo('telefono', e.target.value)} readOnly={!!personaExistente} className={controlClass} />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Direccion</span>
                  <input value={form.direccion} onChange={(e) => cambiarCampo('direccion', e.target.value)} readOnly={!!personaExistente} className={controlClass} />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  <span className="mb-1.5 block">Feria donde trabaja *</span>
                  <select value={form.feria_id} onChange={(e) => cambiarCampo('feria_id', e.target.value)} className={controlClass}>
                    <option value="">Seleccione la feria</option>
                    {feriasActivas.map((f) => (
                      <option key={f.id} value={f.id}>{nombreFeria(f)}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Fecha de ingreso *</span>
                  <input type="date" max={hoyISO()} value={form.fecha_ingreso} onChange={(e) => cambiarCampo('fecha_ingreso', e.target.value)} className={controlClass} />
                </label>
                <label className={labelClass}>
                  <span className="mb-1.5 block">Codigo de trabajador</span>
                  <input value={form.codigo_trabajador} onChange={(e) => cambiarCampo('codigo_trabajador', e.target.value)} placeholder="Automatico (T-000001)" className={controlClass} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  <span className="mb-1.5 block">Observaciones</span>
                  <textarea value={form.observaciones} onChange={(e) => cambiarCampo('observaciones', e.target.value)} rows={2} className={controlClass} />
                </label>
                <p className="flex items-center gap-2 text-sm text-sky-800 sm:col-span-2">
                  <HeartPulse className="h-4 w-4" />
                  Servicio de salud: asignado automaticamente por la feria.
                </p>
              </div>
            </div>

            <div className="border-t border-neutral-200 px-6 py-4">
              {errorAlta && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorAlta}
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setAltaAbierta(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button onClick={() => void guardarAlta()} disabled={guardando || buscandoId || !!trabajadorVigente}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Registrar trabajador
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================= MODAL: TRASLADO (HU-06) ================= */}
      {traslado && detalle && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card padding="none" className="w-full max-w-md overflow-hidden border-neutral-200">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-neutral-900">Trasladar de feria</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {detalle.codigo_trabajador} · hoy en {detalle.feria_actual ? nombreFeria(detalle.feria_actual) : 'ninguna feria'}
              </p>
            </div>
            <div className="space-y-4 px-6 py-5" onKeyDown={alEnter}>
              <label className={labelClass}>
                <span className="mb-1.5 block">Nueva feria *</span>
                <select value={traslado.feria_id} onChange={(e) => setTraslado({ ...traslado, feria_id: e.target.value })} autoFocus className={controlClass}>
                  <option value="">Seleccione la feria</option>
                  {feriasActivas.filter((f) => f.id !== detalle.feria_actual?.id).map((f) => (
                    <option key={f.id} value={f.id}>{nombreFeria(f)}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Fecha del traslado *</span>
                <input type="date" max={hoyISO()} min={detalle.feria_actual?.desde.slice(0, 10)} value={traslado.fecha} onChange={(e) => setTraslado({ ...traslado, fecha: e.target.value })} className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Motivo *</span>
                <textarea value={traslado.motivo} onChange={(e) => setTraslado({ ...traslado, motivo: e.target.value })} rows={3} maxLength={500} className={controlClass} />
              </label>
              <p className="text-xs text-neutral-500">
                La feria actual se cierra en esa fecha y la nueva empieza ese mismo dia. Los pagos anteriores conservan la feria original.
              </p>
              {errorOperacion && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorOperacion}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setTraslado(null)} disabled={procesando}>Cancelar</Button>
              <Button onClick={() => void confirmarTraslado()} disabled={procesando}>
                {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Confirmar traslado
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ================= MODAL: RETIRO ================= */}
      {retiro && detalle && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card padding="none" className="w-full max-w-md overflow-hidden border-neutral-200">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-neutral-900">Retirar trabajador</h2>
              <p className="mt-1 text-sm text-neutral-500">{detalle.codigo_trabajador} · {detalle.persona.apellidos}, {detalle.persona.nombres}</p>
            </div>
            <div className="space-y-4 px-6 py-5" onKeyDown={alEnter}>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Desde la fecha de salida deja de tener salud por la feria. Su expediente y su historial se conservan; no afecta su expediente de ahorrista.
              </div>
              <label className={labelClass}>
                <span className="mb-1.5 block">Fecha de salida *</span>
                <input type="date" max={hoyISO()} value={retiro.fecha_salida} onChange={(e) => setRetiro({ ...retiro, fecha_salida: e.target.value })} autoFocus className={controlClass} />
              </label>
              <label className={labelClass}>
                <span className="mb-1.5 block">Motivo *</span>
                <textarea value={retiro.motivo} onChange={(e) => setRetiro({ ...retiro, motivo: e.target.value })} rows={3} maxLength={500} className={controlClass} />
              </label>
              {errorOperacion && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorOperacion}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setRetiro(null)} disabled={procesando}>Cancelar</Button>
              <Button variant="danger" onClick={() => void confirmarRetiro()} disabled={procesando}>
                {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Confirmar retiro
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
