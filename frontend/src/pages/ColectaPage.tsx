/**
 * ============================================
 * PAGE: COLECTA
 * ============================================
 * Rediseno del modulo de colecta del sistema viejo.
 *
 * Sistema viejo: hub de accesos que abria cada funcion en un iframe dentro de
 * una pestana. Se entraba por NUMERO DE CUENTA (01-08-00-121753) y habia una
 * pantalla por servicio, asi que un socio que pagaba ahorro + funeraria + salud
 * obligaba al cajero a repetir la busqueda tres veces en tres pantallas.
 *
 * Aca: una sola busqueda por cedula o expediente trae TODO lo cobrable del
 * socio; el cajero marca lo que paga, ve el total en USD y Bs en vivo, y cobra
 * todo con un boton. La caja se cierra desde la misma pantalla.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Wallet,
  Shield,
  HeartPulse,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Calculator,
  X,
  ArrowRight,
  Receipt,
  Lock,
  DollarSign,
  ListChecks,
  Search as SearchIcon,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import * as colectaService from '../services/colectaService'
import { numeroDeSemana } from '../services/semanasColectaService'
import type {
  AsambleaOpcion,
  Cobrable,
  DetalleColectaEnvio,
  Colecta,
  PrevioCierre,
  ResumenDia,
  SocioColecta,
} from '../services/colectaService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { MovimientosDelDia } from '../components/colecta/MovimientosDelDia'

const controlClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

/** Lo que el cajero marco para cobrar, por referencia del cobrable */
interface LineaCobro {
  monto_usd: string
  semanas: number
}

const claveCobrable = (c: Cobrable): string => `${c.tipo}-${c.referencia_id}`

const iconoServicio = (tipo: Cobrable['tipo']) => {
  if (tipo === 'ahorro') return <Wallet className="h-4 w-4 text-primary-600" />
  if (tipo === 'funeraria') return <Shield className="h-4 w-4 text-indigo-600" />
  if (tipo === 'prestamo') return <DollarSign className="h-4 w-4 text-emerald-600" />
  return <HeartPulse className="h-4 w-4 text-rose-600" />
}

const etiquetaServicio = (tipo: Cobrable['tipo']): string =>
  ({ ahorro: 'Ahorro', funeraria: 'Funeraria', salud: 'Salud', prestamo: 'Prestamo' })[tipo]

const money = (valor: number, decimales = 2): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

export default function ColectaPage() {
  const { hasPermission } = usePermissions()
  const puedeCobrar = hasPermission('colecta', 'create')

  const [pestana, setPestana] = useState<'cobrar' | 'movimientos'>('cobrar')

  // --- Busqueda ---
  const campoBusqueda = useRef<HTMLInputElement>(null)
  const campoSemanas = useRef<HTMLInputElement>(null)
  const botonCobrar = useRef<HTMLButtonElement>(null)
  const [termino, setTermino] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [tasa, setTasa] = useState<number | null>(null)
  const [candidatos, setCandidatos] = useState<SocioColecta[]>([])
  const [socio, setSocio] = useState<SocioColecta | null>(null)

  // --- Driver del cobro: las semanas multiplican los tres servicios ---
  const [semanas, setSemanas] = useState(1)
  const [semanaCobro, setSemanaCobro] = useState(() => numeroDeSemana(new Date()))
  const [anoCobro, setAnoCobro] = useState(() => new Date().getFullYear())
  const [referencia, setReferencia] = useState('')
  const [adicionalAhorro, setAdicionalAhorro] = useState('0')
  const [asambleas, setAsambleas] = useState<AsambleaOpcion[]>([])
  const [asambleaId, setAsambleaId] = useState<number | ''>('')

  // --- Reintegros: cargo por reactivar un acuerdo suspendido ---
  const [reintegros, setReintegros] = useState<Record<string, string>>({})

  // --- Carrito de cobro ---
  const [lineas, setLineas] = useState<Record<string, LineaCobro>>({})
  const [observaciones, setObservaciones] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [recibo, setRecibo] = useState<Colecta | null>(null)

  // --- Jornada ---
  const [resumenDia, setResumenDia] = useState<ResumenDia | null>(null)
  const [previoCierre, setPrevioCierre] = useState<PrevioCierre | null>(null)
  const [modalCierre, setModalCierre] = useState(false)
  const [obsCierre, setObsCierre] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const cargarResumen = useCallback(async () => {
    try {
      const [resp, previo] = await Promise.all([
        colectaService.listarColectas({ solo_mias: true }),
        colectaService.obtenerPrevioCierre(),
      ])
      if (resp.success) setResumenDia(resp.data.resumen)
      if (previo.success) setPrevioCierre(previo.data)
    } catch {
      // El resumen es informativo; su fallo no debe bloquear el cobro
    }
  }, [])

  useEffect(() => {
    void cargarResumen()
    campoBusqueda.current?.focus()
  }, [cargarResumen])

  // ============================================
  // BUSQUEDA
  // ============================================
  const buscar = async () => {
    const valor = termino.trim()
    if (!valor) return

    setBuscando(true)
    setError('')
    setCandidatos([])
    setSocio(null)
    setLineas({})
    setRecibo(null)

    try {
      const respuesta = await colectaService.buscarSocio(valor)
      if (!respuesta.success) throw new Error('No fue posible buscar')

      setTasa(respuesta.data.tasa)
      setAsambleas(respuesta.data.asambleas ?? [])
      const hallados = respuesta.data.encontrados

      if (hallados.length === 0) {
        setError(`No se encontro ningun socio con "${valor}"`)
      } else if (hallados.length === 1) {
        // Un solo resultado: se selecciona solo, sin un click extra
        seleccionarSocio(hallados[0]!)
      } else {
        setCandidatos(hallados)
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al buscar el socio')
    } finally {
      setBuscando(false)
    }
  }

  /** Al elegir socio se precargan los montos sugeridos de lo que esta atrasado. */
  const seleccionarSocio = (elegido: SocioColecta) => {
    setSocio(elegido)
    setCandidatos([])
    setAsambleaId('')
    setAdicionalAhorro('0')
    setReintegros({})

    // Las semanas a cobrar arrancan en el mayor atraso del socio: ponerse al
    // dia es el caso normal, y el cajero solo corrige si el socio paga otra cosa
    const semanasIniciales = Math.max(elegido.mayor_atraso || 1, 1)
    setSemanas(semanasIniciales)

    // Se premarcan los acuerdos con atraso; el monto lo calcula recalcularLineas
    const inicial: Record<string, LineaCobro> = {}
    for (const cobrable of elegido.cobrables) {
      if (cobrable.tipo === 'funeraria' || cobrable.tipo === 'salud') {
        if ((cobrable.semanas_sin_pago ?? 0) <= 0) continue
        inicial[claveCobrable(cobrable)] = {
          monto_usd: String(
            Math.round((cobrable.monto_semanal_usd ?? 0) * semanasIniciales * 100) / 100
          ),
          semanas: semanasIniciales,
        }
      }
    }
    setLineas(inicial)

    // El foco salta a "Semanas a cobrar": es lo unico que el cajero suele
    // corregir antes de cobrar, y evita tener que buscar el campo con el mouse
    window.setTimeout(() => {
      campoSemanas.current?.focus()
      campoSemanas.current?.select()
    }, 50)
  }

  /**
   * Al cambiar las semanas a cobrar se recalculan TODOS los renglones de
   * funeraria y salud. Es el comportamiento del sistema viejo: un solo campo
   * `sem` multiplica los tres servicios en vez de repetirlo por acuerdo.
   */
  useEffect(() => {
    if (!socio) return
    setLineas((prev) => {
      const copia = { ...prev }
      for (const cobrable of socio.cobrables) {
        const clave = claveCobrable(cobrable)
        // El préstamo no se multiplica por semanas: se abona un monto libre
        if (!copia[clave] || cobrable.tipo === 'ahorro' || cobrable.tipo === 'prestamo') continue
        const cuota = cobrable.monto_semanal_usd ?? 0
        copia[clave] = {
          semanas,
          monto_usd: cuota > 0 ? String(Math.round(cuota * semanas * 100) / 100) : copia[clave]!.monto_usd,
        }
      }
      return copia
    })
  }, [semanas, socio])

  const limpiar = () => {
    setTermino('')
    setSocio(null)
    setCandidatos([])
    setLineas({})
    setObservaciones('')
    setError('')
    setRecibo(null)
    campoBusqueda.current?.focus()
  }

  // ============================================
  // CARRITO
  // ============================================
  const alternarLinea = (cobrable: Cobrable) => {
    const clave = claveCobrable(cobrable)
    setLineas((prev) => {
      const copia = { ...prev }
      if (copia[clave]) {
        delete copia[clave]
      } else {
        const semanas = Math.max(cobrable.semanas_sin_pago ?? 0, 1)
        copia[clave] = {
          monto_usd: String(cobrable.monto_sugerido_usd ?? ''),
          semanas: cobrable.tipo === 'ahorro' ? 0 : semanas,
        }
      }
      return copia
    })
  }

  const cambiarMonto = (cobrable: Cobrable, valor: string) => {
    const clave = claveCobrable(cobrable)
    setLineas((prev) => ({ ...prev, [clave]: { ...(prev[clave] ?? { semanas: 1 }), monto_usd: valor } }))
  }

  /** En funeraria y salud se cobra por semanas: el monto se deriva de la cuota. */
  const cambiarSemanas = (cobrable: Cobrable, semanas: number) => {
    const clave = claveCobrable(cobrable)
    const cuota = cobrable.monto_semanal_usd ?? 0
    setLineas((prev) => ({
      ...prev,
      [clave]: {
        semanas,
        monto_usd: cuota > 0 ? String(Math.round(cuota * semanas * 100) / 100) : (prev[clave]?.monto_usd ?? ''),
      },
    }))
  }

  const adicional = parseFloat(adicionalAhorro) || 0

  // total = suma de renglones + adicional de ahorro (el `bs_adi` del original)
  const totalReintegros = useMemo(
    () => Object.values(reintegros).reduce((acc, v) => acc + (parseFloat(v) || 0), 0),
    [reintegros]
  )

  const totalUsd = useMemo(
    () =>
      Object.values(lineas).reduce((acc, l) => acc + (parseFloat(l.monto_usd) || 0), 0) +
      adicional +
      totalReintegros,
    [lineas, adicional, totalReintegros]
  )
  const totalBs = useMemo(() => (tasa ? totalUsd * tasa : 0), [totalUsd, tasa])
  const cantidadLineas = Object.keys(lineas).length

  const cobrar = async () => {
    if (!socio || cantidadLineas === 0) return

    const detalles: DetalleColectaEnvio[] = socio.cobrables
      .filter((c) => lineas[claveCobrable(c)])
      .map((c) => {
        const linea = lineas[claveCobrable(c)]!
        return {
          servicio: c.tipo as 'ahorro' | 'funeraria' | 'salud' | 'prestamo',
          referencia_id: c.referencia_id,
          monto_usd: parseFloat(linea.monto_usd) || 0,
          ...(c.tipo !== 'ahorro' && c.tipo !== 'prestamo' ? { semanas: linea.semanas } : {}),
        }
      })
      .filter((d) => d.monto_usd > 0)

    // Los reintegros viajan como renglones propios: no cubren semanas y
    // reactivan el acuerdo suspendido
    for (const cobrable of socio.cobrables) {
      const monto = parseFloat(reintegros[claveCobrable(cobrable)] ?? '') || 0
      if (monto > 0 && cobrable.tipo !== 'ahorro') {
        detalles.push({
          servicio: cobrable.tipo as 'funeraria' | 'salud',
          referencia_id: cobrable.referencia_id,
          monto_usd: monto,
          es_reintegro: true,
          concepto: 'Reintegro por reactivacion',
        })
      }
    }

    // El adicional de ahorro se suma al renglon de la primera cuenta marcada;
    // si no hay ninguna marcada pero si hay cuentas, se cobra sobre la primera
    if (adicional > 0) {
      const renglonAhorro = detalles.find((d) => d.servicio === 'ahorro')
      if (renglonAhorro) {
        renglonAhorro.monto_usd = Math.round((renglonAhorro.monto_usd + adicional) * 100) / 100
      } else {
        const cuenta = socio.cobrables.find((c) => c.tipo === 'ahorro')
        if (cuenta) {
          detalles.push({ servicio: 'ahorro', referencia_id: cuenta.referencia_id, monto_usd: adicional })
        }
      }
    }

    if (detalles.length === 0) {
      setError('Indique al menos un monto mayor a cero')
      return
    }

    setCobrando(true)
    setError('')
    try {
      const respuesta = await colectaService.registrarColecta({
        socio_id: socio.id,
        semanas,
        semana_cobro: semanaCobro,
        ano_cobro: anoCobro,
        referencia: referencia || null,
        asamblea_id: asambleaId === '' ? null : Number(asambleaId),
        detalles,
        observaciones: observaciones || null,
      })
      if (!respuesta.success) throw new Error('No fue posible registrar la colecta')

      setRecibo(respuesta.data)
      setSocio(null)
      setLineas({})
      setReferencia('')
      setAdicionalAhorro('0')
      setAsambleaId('')
      setReintegros({})
      setObservaciones('')
      setTermino('')
      await cargarResumen()
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al registrar la colecta')
    } finally {
      setCobrando(false)
    }
  }

  /**
   * Atajos de teclado. En una caja el mouse es el cuello de botella, asi que
   * el ciclo completo (buscar -> semanas -> cobrar) se hace sin soltarlo:
   *   F2         volver al buscador
   *   Ctrl+Enter cobrar
   *   Esc        limpiar y empezar de nuevo
   */
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (pestana !== 'cobrar') return

      if (e.key === 'F2') {
        e.preventDefault()
        campoBusqueda.current?.focus()
        campoBusqueda.current?.select()
        return
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (socio && totalUsd > 0 && !cobrando) void cobrar()
        return
      }

      // Esc no debe interferir mientras se escribe en un modal
      if (e.key === 'Escape' && !modalCierre) {
        limpiar()
      }
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  })

  // ============================================
  // CIERRE
  // ============================================
  const confirmarCierre = async () => {
    setCerrando(true)
    try {
      const respuesta = await colectaService.cerrarCaja(obsCierre || null)
      if (!respuesta.success) throw new Error('No fue posible cerrar la caja')
      setModalCierre(false)
      setObsCierre('')
      await cargarResumen()
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cerrar la caja')
    } finally {
      setCerrando(false)
    }
  }

  const cobrablesPorTipo = useMemo(() => {
    if (!socio) return []
    const orden: Cobrable['tipo'][] = ['ahorro', 'funeraria', 'salud', 'prestamo']
    return orden
      .map((tipo) => ({ tipo, items: socio.cobrables.filter((c) => c.tipo === tipo) }))
      .filter((g) => g.items.length > 0)
  }, [socio])

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-5">
      {/* ENCABEZADO + ESTADO DE LA JORNADA */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Colecta</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Busque al socio por cedula o expediente y cobre todos sus servicios de una vez.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tasa !== null && (
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tasa</p>
              <p className="text-sm font-semibold text-neutral-900">{money(tasa, 4)} Bs/USD</p>
            </div>
          )}
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Cobrado hoy</p>
            <p className="text-sm font-semibold text-neutral-900">
              ${money(resumenDia?.total_usd ?? 0)} · {resumenDia?.cantidad ?? 0} operaciones
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setModalCierre(true)}
            disabled={!previoCierre || previoCierre.cantidad_transacciones === 0}
          >
            <Lock className="h-4 w-4" />
            Cerrar caja
            {previoCierre && previoCierre.cantidad_transacciones > 0 && (
              <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                {previoCierre.cantidad_transacciones}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* PESTANAS: cobrar y lo cobrado hoy (con reverso) conviven en la misma pantalla */}
      <div className="flex gap-2 border-b border-neutral-200">
        {([
          { id: 'cobrar' as const, label: 'Cobrar', icon: SearchIcon },
          { id: 'movimientos' as const, label: 'Movimientos de hoy', icon: ListChecks },
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

      {pestana === 'movimientos' && <MovimientosDelDia onCambio={() => void cargarResumen()} />}

      {pestana === 'cobrar' && (
      <>
      {/* BUSCADOR: el punto de entrada unico */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              ref={campoBusqueda}
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void buscar()
                if (e.key === 'Escape') limpiar()
              }}
              placeholder="Cedula o numero de expediente..."
              className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pl-12 pr-4 text-lg outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <Button onClick={() => void buscar()} disabled={buscando} className="px-6">
            {buscando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            Buscar
          </Button>
          {(socio || candidatos.length > 0 || recibo) && (
            <Button variant="ghost" onClick={limpiar}>
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span>Ya no hace falta el numero de cuenta.</span>
          <span className="hidden sm:inline">·</span>
          <span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono">Enter</kbd>{' '}
            buscar
          </span>
          <span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono">F2</kbd>{' '}
            volver al buscador
          </span>
          <span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono">Ctrl+Enter</kbd>{' '}
            cobrar
          </span>
          <span>
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono">Esc</kbd>{' '}
            limpiar
          </span>
        </p>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* VARIOS EXPEDIENTES CON LA MISMA CEDULA */}
      {candidatos.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-neutral-700">
            {candidatos.length} expedientes con esa cedula. Elija cual:
          </p>
          <div className="space-y-2">
            {candidatos.map((c) => (
              <button
                key={c.id}
                onClick={() => seleccionarSocio(c)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-primary-400 hover:bg-primary-50/40"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {c.apellido}, {c.nombre}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {c.codigo_socio} · {c.estado} · {c.cobrables.length} servicio(s)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* RECIBO DE LA ULTIMA COLECTA */}
      {recibo && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="text-lg font-semibold text-emerald-900">
                  Colecta #{recibo.id} registrada
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  {recibo.socio?.apellido}, {recibo.socio?.nombre} · {recibo.socio?.codigo_socio}
                </p>
                <p className="mt-2 text-sm text-emerald-700">
                  {recibo.detalles.length} concepto(s) ·{' '}
                  <strong>${money(Number(recibo.monto_total_usd))}</strong> ·{' '}
                  {money(Number(recibo.monto_total_bs))} Bs
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir recibo
            </Button>
          </div>
        </Card>
      )}

      {/* FICHA DEL SOCIO + COBRABLES */}
      {socio && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Columna izquierda: lo cobrable */}
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">
                    {socio.apellido}, {socio.nombre}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Expediente {socio.codigo_socio} · C.I. {socio.cedula}
                    {socio.ubicacion && ` · ${socio.ubicacion.direccion || socio.ubicacion.codigo}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {socio.alertas.socio_retirado && <Badge variant="error">Socio retirado</Badge>}
                  {socio.alertas.acuerdos_suspendidos > 0 && (
                    <Badge variant="warning">
                      {socio.alertas.acuerdos_suspendidos} acuerdo(s) suspendido(s)
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* PERIODO Y SEMANAS: el driver de todo el cobro */}
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <label className="text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Semanas a cobrar *</span>
                  <input
                    type="number"
                    min={1}
                    max={104}
                    ref={campoSemanas}
                    value={semanas}
                    onChange={(e) => setSemanas(Math.max(1, Number(e.target.value) || 1))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        botonCobrar.current?.focus()
                      }
                    }}
                    className={`${controlClass} text-lg font-bold`}
                  />
                </label>
                <label className="text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Semana de cobro</span>
                  <input
                    type="number"
                    min={1}
                    max={53}
                    value={semanaCobro}
                    onChange={(e) => setSemanaCobro(Number(e.target.value) || 1)}
                    className={controlClass}
                  />
                </label>
                <label className="text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Ano de cobro</span>
                  <input
                    type="number"
                    min={2020}
                    max={2100}
                    value={anoCobro}
                    onChange={(e) => setAnoCobro(Number(e.target.value) || new Date().getFullYear())}
                    className={controlClass}
                  />
                </label>
                <label className="text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Referencia</span>
                  <input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="N° recibo"
                    className={controlClass}
                  />
                </label>
              </div>

              <p className="mt-2 text-xs text-neutral-500">
                Las semanas multiplican por igual funeraria y salud. Arranca en el mayor atraso del
                socio ({socio.mayor_atraso} semana{socio.mayor_atraso === 1 ? '' : 's'}).
              </p>

              {/* Asistencia a asamblea: la caja es donde se ve al socio */}
              {asambleas.length > 0 && (
                <label className="mt-4 block text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Asistio a la asamblea</span>
                  <select
                    value={asambleaId}
                    onChange={(e) => setAsambleaId(e.target.value === '' ? '' : Number(e.target.value))}
                    className={controlClass}
                  >
                    <option value="">No registrar asistencia</option>
                    {asambleas.map((a) => {
                      const yaAsistio = socio.asambleas_asistidas.includes(a.id)
                      return (
                        <option key={a.id} value={a.id} disabled={yaAsistio}>
                          {a.titulo} · {new Date(a.fecha).toLocaleDateString('es-VE')}
                          {yaAsistio ? ' (ya registrada)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
              )}
            </Card>

            {cobrablesPorTipo.length === 0 && (
              <Card className="p-8 text-center text-sm text-neutral-500">
                Este socio no tiene cuentas ni acuerdos activos para cobrar.
              </Card>
            )}

            {cobrablesPorTipo.map((grupo) => (
              <Card key={grupo.tipo} padding="none" className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
                  {iconoServicio(grupo.tipo)}
                  <h3 className="text-sm font-semibold text-neutral-800">{etiquetaServicio(grupo.tipo)}</h3>
                  <span className="text-xs text-neutral-500">({grupo.items.length})</span>
                </div>

                {grupo.tipo === 'ahorro' && (
                  <div className="flex flex-wrap items-end gap-3 border-b border-neutral-100 bg-neutral-50/40 px-5 py-3">
                    <label className="text-xs font-medium text-neutral-600">
                      <span className="mb-1 block">Ahorro adicional (USD)</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={adicionalAhorro}
                        onChange={(e) => setAdicionalAhorro(e.target.value)}
                        className="w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                      />
                    </label>
                    <p className="pb-2 text-xs text-neutral-500">
                      Monto extra sobre la cuota semanal (el campo "Adic" del sistema anterior).
                    </p>
                  </div>
                )}

                <div className="divide-y divide-neutral-100">
                  {grupo.items.map((cobrable) => {
                    const clave = claveCobrable(cobrable)
                    const linea = lineas[clave]
                    const marcado = Boolean(linea)
                    const atrasado = (cobrable.semanas_sin_pago ?? 0) > 0

                    return (
                      <div
                        key={clave}
                        className={`px-5 py-4 transition ${marcado ? 'bg-primary-50/40' : ''}`}
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarLinea(cobrable)}
                            className="mt-1 h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          />

                          <div className="min-w-[180px] flex-1">
                            <p className="text-sm font-medium text-neutral-900">{cobrable.titulo}</p>
                            <p className="text-xs text-neutral-500">{cobrable.detalle}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {cobrable.saldo_usd !== null && (
                                <span className="text-xs text-neutral-600">
                                  Saldo: ${money(cobrable.saldo_usd)}
                                </span>
                              )}
                              {atrasado && (
                                <Badge variant={cobrable.semanas_sin_pago! >= 5 ? 'error' : 'warning'}>
                                  {cobrable.semanas_sin_pago} semana(s) sin pago
                                </Badge>
                              )}
                              {cobrable.estado === 'suspendido' && <Badge variant="error">Suspendido</Badge>}
                            </div>
                          </div>

                          {marcado && (
                            <div className="flex flex-wrap items-end gap-3">
                              {cobrable.tipo !== 'ahorro' && cobrable.tipo !== 'prestamo' && (
                                <label className="text-xs font-medium text-neutral-600">
                                  <span className="mb-1 block">Semanas</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={linea!.semanas}
                                    onChange={(e) => cambiarSemanas(cobrable, Number(e.target.value) || 1)}
                                    className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                                  />
                                </label>
                              )}
                              <label className="text-xs font-medium text-neutral-600">
                                <span className="mb-1 block">Monto USD</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={linea!.monto_usd}
                                  onChange={(e) => cambiarMonto(cobrable, e.target.value)}
                                  className="w-28 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                                />
                              </label>
                              <div className="pb-2 text-xs text-neutral-500">
                                = {money((parseFloat(linea!.monto_usd) || 0) * (tasa ?? 0))} Bs
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Reintegro: solo tiene sentido en acuerdos suspendidos */}
                        {cobrable.estado === 'suspendido' && (
                          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <label className="text-xs font-medium text-amber-900">
                              <span className="mb-1 block">Reintegro (USD)</span>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={reintegros[clave] ?? ''}
                                onChange={(e) =>
                                  setReintegros((prev) => ({ ...prev, [clave]: e.target.value }))
                                }
                                placeholder="0.00"
                                className="w-28 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                              />
                            </label>
                            <p className="pb-2 text-xs text-amber-800">
                              Cargo por reactivar el acuerdo. No cubre semanas de atraso.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>

          {/* Columna derecha: el total, siempre a la vista */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Total a cobrar
                </h3>
              </div>

              <p className="mt-4 text-4xl font-bold text-neutral-900">${money(totalUsd)}</p>
              <p className="mt-1 text-lg text-neutral-600">{money(totalBs)} Bs</p>
              <p className="mt-1 text-xs text-neutral-500">
                {cantidadLineas} concepto(s) · {semanas} semana(s) · tasa {money(tasa ?? 0, 4)}
              </p>

              {/* Desglose por servicio, como la matriz de totales del sistema viejo */}
              <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
                {(['ahorro', 'funeraria', 'salud', 'prestamo'] as const).map((tipo) => {
                  const items = socio.cobrables.filter(
                    (c) => c.tipo === tipo && lineas[claveCobrable(c)]
                  )
                  const extra = tipo === 'ahorro' ? adicional : 0
                  // Los reintegros del servicio tambien suman a su subtotal
                  const reintegroServicio = socio.cobrables
                    .filter((c) => c.tipo === tipo)
                    .reduce((acc, c) => acc + (parseFloat(reintegros[claveCobrable(c)] ?? '') || 0), 0)
                  const subtotal =
                    items.reduce(
                      (acc, c) => acc + (parseFloat(lineas[claveCobrable(c)]!.monto_usd) || 0),
                      0
                    ) +
                    extra +
                    reintegroServicio
                  if (items.length === 0 && extra === 0 && reintegroServicio === 0) return null

                  return (
                    <div key={tipo} className="rounded-lg bg-neutral-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                          {iconoServicio(tipo)}
                          {etiquetaServicio(tipo)}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900">
                          ${money(subtotal)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {tipo === 'ahorro'
                          ? `${items.length} cuenta(s)${extra > 0 ? ` + $${money(extra)} adicional` : ''}`
                          : `${items.length} acuerdo(s) × ${semanas} semana(s)${
                              reintegroServicio > 0 ? ` + $${money(reintegroServicio)} reintegro` : ''
                            }`}
                      </p>
                    </div>
                  )
                })}
                {cantidadLineas === 0 && adicional === 0 && totalReintegros === 0 && (
                  <p className="text-sm text-neutral-400">Marque los servicios a cobrar</p>
                )}
              </div>

              <label className="mt-4 block text-xs font-medium text-neutral-600">
                <span className="mb-1 block">Observaciones</span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  className={`${controlClass} resize-y`}
                  placeholder="Opcional"
                />
              </label>

              <Button
                ref={botonCobrar}
                onClick={() => void cobrar()}
                disabled={!puedeCobrar || totalUsd <= 0 || cobrando}
                className="mt-4 w-full justify-center py-3 text-base"
              >
                {cobrando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Receipt className="h-5 w-5" />}
                {cobrando ? 'Registrando...' : `Cobrar $${money(totalUsd)}`}
              </Button>

              {!puedeCobrar && (
                <p className="mt-2 text-center text-xs text-neutral-500">
                  Su usuario no tiene permiso para cobrar
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      </>
      )}

      {/* MODAL: CIERRE DE CAJA */}
      {modalCierre && previoCierre && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card
            padding="none"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden border-neutral-200"
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Cerrar caja</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {previoCierre.cantidad_transacciones} operacion(es) desde el ultimo cierre
                </p>
              </div>
              <button
                onClick={() => setModalCierre(false)}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                {[
                  { label: 'Ahorro', usd: previoCierre.totales.ahorro_usd, bs: previoCierre.totales.ahorro_bs },
                  { label: 'Funeraria', usd: previoCierre.totales.funeraria_usd, bs: previoCierre.totales.funeraria_bs },
                  { label: 'Salud', usd: previoCierre.totales.salud_usd, bs: previoCierre.totales.salud_bs },
                ].map((fila) => (
                  <div key={fila.label} className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2.5">
                    <span className="text-sm text-neutral-700">{fila.label}</span>
                    <span className="text-sm font-medium text-neutral-900">
                      ${money(fila.usd)} <span className="text-neutral-400">·</span> {money(fila.bs)} Bs
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg border-2 border-primary-200 bg-primary-50 px-4 py-3">
                <span className="text-sm font-semibold text-primary-900">Total general</span>
                <span className="text-lg font-bold text-primary-900">
                  ${money(previoCierre.totales.total_usd)}
                </span>
              </div>
              <p className="text-right text-sm text-neutral-600">
                {money(previoCierre.totales.total_bs)} Bs
              </p>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Observaciones del cierre</span>
                <textarea
                  value={obsCierre}
                  onChange={(e) => setObsCierre(e.target.value)}
                  rows={3}
                  className={`${controlClass} resize-y`}
                  placeholder="Diferencias, novedades del turno..."
                />
              </label>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>El cierre no se puede deshacer. Las colectas siguientes contaran para el proximo cierre.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setModalCierre(false)} disabled={cerrando}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmarCierre()} disabled={cerrando}>
                {cerrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Confirmar cierre
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
