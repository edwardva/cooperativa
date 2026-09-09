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

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
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
  PaqueteSemanal,
  PrevioCierre,
  ResumenDia,
  SocioColecta,
  TarifasColecta,
} from '../services/colectaService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'
import { MovimientosDelDia } from '../components/colecta/MovimientosDelDia'
import { SituacionSocio } from '../components/colecta/SituacionSocio'
import { PaqueteSemanalCard } from '../components/colecta/PaqueteSemanal'

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
  ({
    ahorro: 'Ahorro',
    funeraria: 'Funeraria',
    salud: 'Salud',
    prestamo: 'Prestamo',
  })[tipo]

const money = (valor: number, decimales = 2): string =>
  valor.toLocaleString('es-VE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

function OpcionesColecta({
  titulo,
  resumen,
  children,
}: {
  titulo: string
  resumen: string
  children: ReactNode
}) {
  return (
    <details className="group rounded-xl border border-neutral-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-neutral-900">{titulo}</span>
          <span className="mt-1 block text-xs text-neutral-500">{resumen}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-100 p-4">{children}</div>
    </details>
  )
}

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

  // --- Paquete semanal: lo calcula el backend con las tarifas de parametros ---
  const [paquete, setPaquete] = useState<PaqueteSemanal | null>(null)
  const [calculandoPaquete, setCalculandoPaquete] = useState(false)
  const [tarifas, setTarifas] = useState<TarifasColecta | null>(null)
  const [semanaActualTexto, setSemanaActualTexto] = useState('')

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
      // Tarifas de solo lectura y semana en curso: se muestran, no se editan
      setTarifas(respuesta.data.tarifas ?? null)
      setSemanaActualTexto(respuesta.data.semana_actual_texto ?? '')
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

  /**
   * Al elegir socio, las semanas arrancan en lo que hace falta para ponerlo al
   * dia. El importe NO se arma aqui: lo calcula el backend con las tarifas de
   * parametros, para que la pantalla y el cobro nunca discrepen.
   */
  const seleccionarSocio = (elegido: SocioColecta) => {
    setSocio(elegido)
    setCandidatos([])
    setAsambleaId('')
    setAdicionalAhorro('0')
    setReintegros({})
    // El carrito manual queda solo para lo voluntario: abonos a prestamo
    setLineas({})
    setPaquete(elegido.paquete_sugerido ?? null)

    setSemanas(Math.max(elegido.semanas_para_ponerse_al_dia || 1, 1))

    // El foco salta a "Semanas a cobrar": es lo unico que el cajero suele
    // corregir antes de cobrar, y evita tener que buscar el campo con el mouse
    window.setTimeout(() => {
      campoSemanas.current?.focus()
      campoSemanas.current?.select()
    }, 50)
  }

  /**
   * El desglose lo calcula el BACKEND cada vez que cambian las semanas o el
   * ahorro adicional.
   *
   * Antes la pantalla multiplicaba la cuota por las semanas por su cuenta. Eso
   * abre la puerta a que muestre un importe y cobre otro; ahora el numero que
   * ve el cajero sale del mismo calculo que ejecuta el cobro.
   */
  useEffect(() => {
    if (!socio) {
      setPaquete(null)
      return
    }

    let vigente = true
    // Pequena espera: el cajero teclea las semanas y no hace falta una
    // consulta por cada digito
    const temporizador = window.setTimeout(async () => {
      setCalculandoPaquete(true)
      try {
        const respuesta = await colectaService.calcularPaquete({
          socio_id: socio.id,
          semanas,
          ahorro_adicional_usd: parseFloat(adicionalAhorro) || 0,
        })
        if (!respuesta.success) throw new Error('No se pudo calcular el cobro')
        if (vigente) setPaquete(respuesta.data)
      } catch {
        if (vigente) {
          setPaquete(null)
          setError(
            'No se pudo actualizar el total. Cambie las semanas o busque de nuevo al asociado para reintentar.'
          )
        }
      } finally {
        if (vigente) setCalculandoPaquete(false)
      }
    }, 250)

    return () => {
      vigente = false
      window.clearTimeout(temporizador)
    }
  }, [socio, semanas, adicionalAhorro])

  const limpiar = () => {
    setTermino('')
    setSocio(null)
    setCandidatos([])
    setLineas({})
    setPaquete(null)
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
    setLineas((prev) => ({
      ...prev,
      [clave]: { ...(prev[clave] ?? { semanas: 1 }), monto_usd: valor },
    }))
  }

  const adicional = parseFloat(adicionalAhorro) || 0

  const totalReintegros = useMemo(
    () => Object.values(reintegros).reduce((acc, v) => acc + (parseFloat(v) || 0), 0),
    [reintegros]
  )

  /** Abonos a prestamo: lo unico que sigue siendo un carrito manual */
  const totalVoluntario = useMemo(
    () => Object.values(lineas).reduce((acc, l) => acc + (parseFloat(l.monto_usd) || 0), 0),
    [lineas]
  )

  // El paquete ya incluye el ahorro adicional: se le pasa al calcularlo, asi
  // que sumarlo aqui otra vez lo duplicaria.
  const totalPaquete = paquete?.totales.total_usd ?? 0

  const totalUsd = useMemo(
    () => totalPaquete + totalVoluntario + totalReintegros,
    [totalPaquete, totalVoluntario, totalReintegros]
  )
  const totalBs = useMemo(() => (tasa ? totalUsd * tasa : 0), [totalUsd, tasa])
  const cantidadLineas = (paquete?.renglones.length ?? 0) + Object.keys(lineas).length

  const cobrar = async () => {
    if (!socio || cantidadLineas === 0 || calculandoPaquete || !paquete || cobrando) return

    // El paquete semanal viaja completo: ahorro obligatorio (con el adicional
    // ya sumado) y TODOS los servicios contratados. El backend rechaza un
    // paquete parcial, asi que armarlo aqui a mano no tendria sentido.
    const detalles: DetalleColectaEnvio[] = (paquete?.renglones ?? [])
      .filter((r) => r.monto_usd > 0)
      .map((r) => ({
        servicio: r.servicio,
        referencia_id: r.referencia_id,
        monto_usd: r.monto_usd,
        ...(r.servicio !== 'ahorro' ? { semanas: r.semanas } : {}),
      }))

    // Abonos a prestamo: operacion voluntaria, aparte del paquete semanal
    for (const cobrable of socio.cobrables) {
      if (cobrable.tipo !== 'prestamo') continue
      const linea = lineas[claveCobrable(cobrable)]
      const monto = parseFloat(linea?.monto_usd ?? '') || 0
      if (monto > 0) {
        detalles.push({
          servicio: 'prestamo',
          referencia_id: cobrable.referencia_id,
          monto_usd: monto,
        })
      }
    }

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
        // Oficina del socio y canal presencial: alimentan el cuadre por
        // oficina y el consolidado (req. 9)
        ubicacion_id: socio.ubicacion?.id ?? null,
        canal: 'presencial',
        detalles,
        observaciones: observaciones || null,
      })
      if (!respuesta.success) throw new Error('No fue posible registrar la colecta')

      setRecibo(respuesta.data)
      setSocio(null)
      setLineas({})
      setPaquete(null)
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

  /**
   * Prestamos del socio. Es lo unico que queda como carrito manual: abonar es
   * una operacion VOLUNTARIA, separada de la obligacion de pagar juntos los
   * conceptos semanales de la colecta.
   */
  const prestamos = useMemo(
    () => (socio?.cobrables ?? []).filter((c) => c.tipo === 'prestamo'),
    [socio]
  )

  /** Cuentas de ahorro, con su saldo y sus ultimos movimientos */
  const cuentasAhorro = useMemo(
    () => (socio?.cobrables ?? []).filter((c) => c.tipo === 'ahorro'),
    [socio]
  )

  /** Acuerdos suspendidos: son los unicos que admiten un reintegro */
  const suspendidos = useMemo(
    () =>
      (socio?.cobrables ?? []).filter(
        (c) => (c.tipo === 'funeraria' || c.tipo === 'salud') && c.estado === 'suspendido'
      ),
    [socio]
  )

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
            Cobros y atención al asociado en un solo lugar.
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
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Cobrado hoy
            </p>
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
        {[
          { id: 'cobrar' as const, label: 'Cobrar', icon: SearchIcon },
          {
            id: 'movimientos' as const,
            label: 'Movimientos de hoy',
            icon: ListChecks,
          },
        ].map((item) => {
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
          <ol aria-label="Pasos del cobro" className="grid grid-cols-3 gap-2">
            {['Buscar asociado', 'Preparar cobro', 'Revisar y cobrar'].map((paso, index) => (
              <li
                key={paso}
                className={`flex items-center gap-2 rounded-xl px-3 py-3 text-xs sm:text-sm ${
                  (socio ? index > 0 : index === 0)
                    ? 'bg-primary-50 font-semibold text-primary-800'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">
                  {index + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
          {/* BUSCADOR: el punto de entrada unico */}
          <Card className="p-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-0 basis-64 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  aria-label="Cédula o número de expediente del asociado"
                  ref={campoBusqueda}
                  value={termino}
                  onChange={(e) => setTermino(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void buscar()
                    if (e.key === 'Escape') limpiar()
                  }}
                  placeholder="Cédula o número de expediente"
                  className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pl-12 pr-4 text-lg outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <Button
                onClick={() => void buscar()}
                disabled={buscando || !termino.trim() || cobrando}
                className="px-6"
              >
                {buscando ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                Buscar
              </Button>
              {(socio || candidatos.length > 0 || recibo) && (
                <Button variant="ghost" onClick={limpiar}>
                  <X className="h-4 w-4" />
                  Siguiente asociado
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Presione Enter para buscar · F2 para volver al buscador
            </p>
          </Card>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!socio && !recibo && !buscando && candidatos.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
              <Search className="mx-auto mb-4 h-8 w-8 text-primary-500" />
              <h2 className="text-lg font-semibold text-neutral-900">
                Comience por buscar al asociado
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                Consulte sus servicios, indique cuántas semanas desea pagar y revise el total antes
                de registrar el cobro.
              </p>
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
                      {recibo.socio?.apellido}, {recibo.socio?.nombre} ·{' '}
                      {recibo.socio?.codigo_socio}
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
                        {socio.ubicacion &&
                          ` · ${socio.ubicacion.direccion || socio.ubicacion.codigo}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {socio.alertas.socio_retirado && (
                        <Badge variant="error">Socio retirado</Badge>
                      )}
                      {socio.alertas.acuerdos_suspendidos > 0 && (
                        <Badge variant="warning">
                          {socio.alertas.acuerdos_suspendidos} acuerdo(s) suspendido(s)
                        </Badge>
                      )}
                      {socio.alertas.servicios_a_revisar > 0 && (
                        <Badge variant="warning">
                          {socio.alertas.servicios_a_revisar} servicio(s) a revisar
                        </Badge>
                      )}
                      {/* Fianzas: parte de su ahorro esta comprometida (req. 5) */}
                      {socio.alertas.ahorro_bloqueado_usd > 0 && (
                        <Badge variant="warning">
                          ${money(socio.alertas.ahorro_bloqueado_usd)} bloqueado por fianza
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>

                {/*
              Situacion por servicio: hasta cuando esta pagado cada uno, cuando
              pago por ultima vez y cuanto debe. Un resumen por servicio, no una
              fila por semana adeudada (req. 1).
            */}
                <OpcionesColecta
                  key={`situacion-${socio.id}`}
                  titulo="Estado y cobertura de los servicios"
                  resumen={`Última semana pagada: ${socio.ultima_semana_pagada_texto} · ${socio.atraso} semana(s) de atraso`}
                >
                  <SituacionSocio
                    servicios={socio.servicios ?? []}
                    semanaActualTexto={semanaActualTexto}
                    tasa={tasa}
                  />
                </OpcionesColecta>

                {/* PERIODO Y SEMANAS: el driver de todo el cobro */}
                <Card className="p-5">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    ¿Cuántas semanas desea pagar?
                  </h3>
                  <p className="mb-4 mt-1 text-sm text-neutral-500">
                    El ahorro obligatorio y los servicios contratados se calculan juntos.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
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
                    <Button variant="outline" onClick={() => setSemanas(1)}>
                      1 semana
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSemanas(Math.max(socio.semanas_para_ponerse_al_dia || 1, 1))
                      }
                    >
                      Poner al día · {Math.max(socio.semanas_para_ponerse_al_dia || 1, 1)}
                    </Button>
                  </div>
                  <div className="mt-4">
                    <OpcionesColecta
                      titulo="Período y referencia del recibo"
                      resumen={`Semana ${semanaCobro} de ${anoCobro}${referencia ? ` · Ref. ${referencia}` : ' · Referencia opcional'}`}
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                            onChange={(e) =>
                              setAnoCobro(Number(e.target.value) || new Date().getFullYear())
                            }
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
                    </OpcionesColecta>
                  </div>

                  <p className="mt-2 text-xs text-neutral-500">
                    Las semanas multiplican por igual el ahorro y cada servicio contratado. Arranca
                    en lo que hace falta para ponerlo al dia ({socio.semanas_para_ponerse_al_dia}{' '}
                    semana
                    {socio.semanas_para_ponerse_al_dia === 1 ? '' : 's'}).
                    {tarifas && (
                      <>
                        {' '}
                        Las semanas pendientes se suman a las adelantadas; la politica admite{' '}
                        {tarifas.max_semanas_adelanto} de adelanto.
                      </>
                    )}
                  </p>

                  {/* Tarifas vigentes, de SOLO LECTURA: se cambian en Parametros */}
                  {tarifas && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                      <span className="font-medium text-neutral-500">Tarifas semanales</span>
                      <span className="tabular-nums">Ahorro ${money(tarifas.ahorro_usd)}</span>
                      <span className="tabular-nums">
                        Funeraria ${money(tarifas.funeraria_usd)}
                      </span>
                      <span className="tabular-nums">Salud ${money(tarifas.salud_usd)}</span>
                      <span className="text-neutral-400">Se configuran en Parametros</span>
                    </div>
                  )}

                  {/* Asistencia a asamblea: la caja es donde se ve al socio */}
                  {asambleas.length > 0 && (
                    <label className="mt-4 block text-sm font-medium text-neutral-700">
                      <span className="mb-1.5 block">Asistio a la asamblea</span>
                      <select
                        value={asambleaId}
                        onChange={(e) =>
                          setAsambleaId(e.target.value === '' ? '' : Number(e.target.value))
                        }
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

                {/*
              DESGLOSE DEL COBRO SEMANAL

              Ya no hay casillas por servicio. El cliente fue explicito: los
              servicios contratados se pagan juntos con el ahorro obligatorio,
              y no se puede elegir pagar solo uno. Lo unico que decide el cajero
              es la cantidad de semanas; el importe lo calcula el backend.
            */}
                <PaqueteSemanalCard
                  paquete={paquete}
                  cargando={calculandoPaquete}
                  semanas={semanas}
                />

                {/* AHORRO: saldo, ahorro adicional y ultimos movimientos */}
                {cuentasAhorro.length > 0 && (
                  <OpcionesColecta
                    key={`Ahorro adicional y movimientos-${socio.id}`}
                    titulo="Ahorro adicional y movimientos"
                    resumen={` ${cuentasAhorro.length} cuenta(s) · ${adicional > 0 ? `$${money(adicional)} adicional incluido` : 'Opcional: agregar ahorro al cobro'}`}
                  >
                    <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
                      <Wallet className="h-4 w-4 text-primary-600" />
                      <h3 className="text-sm font-semibold text-neutral-800">Ahorro</h3>
                      <span className="text-xs text-neutral-500">({cuentasAhorro.length})</span>
                    </div>

                    <div className="flex flex-wrap items-end gap-3 border-b border-neutral-100 bg-neutral-50/40 px-5 py-3">
                      <label className="text-xs font-medium text-neutral-600">
                        <span className="mb-1 block">Ahorro adicional (USD)</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={adicionalAhorro}
                          onChange={(e) => setAdicionalAhorro(e.target.value)}
                          className="w-36 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                        />
                      </label>
                      <p className="pb-2 text-xs text-neutral-500">
                        Se suma al ahorro obligatorio de estas {semanas} semana(s). Sin tope de
                        monto.
                      </p>
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {cuentasAhorro.map((cuenta) => (
                        <div key={claveCobrable(cuenta)} className="px-5 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-neutral-900">
                                {cuenta.titulo}
                              </p>
                              <p className="text-xs text-neutral-500">{cuenta.detalle}</p>
                            </div>
                            <div className="text-right tabular-nums">
                              <p className="text-sm font-semibold text-neutral-900">
                                ${money(cuenta.saldo_usd ?? 0)}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {money(cuenta.saldo_bs ?? 0)} Bs
                              </p>
                              {(cuenta.bloqueado_usd ?? 0) > 0 && (
                                <p className="mt-1 text-xs text-amber-700">
                                  Disponible ${money(cuenta.disponible_usd ?? 0)} · $
                                  {money(cuenta.bloqueado_usd ?? 0)} en fianza
                                </p>
                              )}
                            </div>
                          </div>

                          {/*
                        La libreta, como la lee el personal en el sistema
                        actual: item, fecha, documento, importe y el saldo con
                        el que quedo la cuenta. El cajero digital se marca
                        aparte, que es lo que alli se ve como CAJ_DIG.
                      */}
                          {(cuenta.movimientos_recientes?.length ?? 0) > 0 && (
                            <div className="mt-3 overflow-x-auto border-t border-neutral-100 pt-2">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-[10px] uppercase tracking-wide text-neutral-400">
                                    <th className="py-1 pr-3 text-left font-medium">Item</th>
                                    <th className="py-1 pr-3 text-left font-medium">Fecha</th>
                                    <th className="py-1 pr-3 text-left font-medium">Doc.</th>
                                    <th className="py-1 pr-3 text-left font-medium">Tipo</th>
                                    <th className="py-1 pr-3 text-right font-medium">Monto Bs</th>
                                    <th className="py-1 text-right font-medium">Saldo Bs</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cuenta.movimientos_recientes!.map((m) => (
                                    <tr key={m.id} className="border-t border-neutral-50">
                                      <td className="py-1 pr-3 tabular-nums text-neutral-500">
                                        {m.item}
                                      </td>
                                      <td className="whitespace-nowrap py-1 pr-3 text-neutral-600">
                                        {new Date(m.fecha).toLocaleDateString('es-VE')}
                                      </td>
                                      <td className="whitespace-nowrap py-1 pr-3">
                                        {m.canal === 'digital' ? (
                                          <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">
                                            CAJ_DIG
                                          </span>
                                        ) : (
                                          <span className="text-neutral-500">{m.documento}</span>
                                        )}
                                      </td>
                                      <td className="py-1 pr-3 text-neutral-600">{m.tipo}</td>
                                      <td className="py-1 pr-3 text-right tabular-nums font-medium text-neutral-800">
                                        {money(m.monto_bs)}
                                      </td>
                                      <td className="py-1 text-right tabular-nums text-neutral-600">
                                        {money(m.saldo_bs)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </OpcionesColecta>
                )}

                {/* PRESTAMOS: abonar es voluntario y va aparte del paquete */}
                {prestamos.length > 0 && (
                  <OpcionesColecta
                    key={`Abonar a préstamos-${socio.id}`}
                    titulo="Abonar a préstamos"
                    resumen={`${prestamos.length} préstamo(s) · ${totalVoluntario > 0 ? `$${money(totalVoluntario)} en abonos incluidos` : 'Seleccione un préstamo para agregar un abono'}`}
                  >
                    <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-neutral-800">Prestamos</h3>
                      <span className="text-xs text-neutral-500">
                        ({prestamos.length}) · abono voluntario
                      </span>
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {prestamos.map((prestamo) => {
                        const clave = claveCobrable(prestamo)
                        const linea = lineas[clave]
                        const marcado = Boolean(linea)

                        return (
                          <div
                            key={clave}
                            className={`px-5 py-4 transition ${marcado ? 'bg-primary-50/40' : ''}`}
                          >
                            <div className="flex flex-wrap items-start gap-4">
                              <input
                                type="checkbox"
                                aria-label={`Agregar abono a ${prestamo.categoria ?? prestamo.titulo}, pagaré ${prestamo.numero_pagare ?? 'sin número'}`}
                                checked={marcado}
                                onChange={() => alternarLinea(prestamo)}
                                className="mt-1 h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                              />

                              <div className="min-w-[200px] flex-1">
                                <p className="text-sm font-medium text-neutral-900">
                                  {prestamo.categoria ?? prestamo.titulo}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                                  <span className="font-mono">{prestamo.numero_pagare ?? '—'}</span>
                                  {/* La moneda va aparte de la categoria: en el
                                  sistema actual son dos campos distintos, y eso
                                  resuelve la duda de si "divisa" era un tipo de
                                  prestamo (no lo es, es la moneda). */}
                                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700">
                                    {prestamo.moneda === 'USD' ? 'Divisas' : 'Bolivares'}
                                  </span>
                                  <span>
                                    Otorgado{' '}
                                    {prestamo.fecha_desembolso
                                      ? new Date(prestamo.fecha_desembolso).toLocaleDateString(
                                          'es-VE'
                                        )
                                      : '—'}
                                  </span>
                                  {/* El dato por el que hoy hay que abrir otra
                                  pantalla: cuando pago por ultima vez */}
                                  {prestamo.fecha_ultimo_abono ? (
                                    <span className="font-medium text-neutral-700">
                                      Ultimo abono{' '}
                                      {new Date(prestamo.fecha_ultimo_abono).toLocaleDateString(
                                        'es-VE'
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700">Sin abonos</span>
                                  )}
                                </div>

                                {/* Monto, abonado y saldo en LAS DOS monedas, como
                                en el sistema actual, y en columnas alineadas
                                para que no se amontonen ni se corten. */}
                                <div className="mt-2 overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="text-[10px] uppercase tracking-wide text-neutral-400">
                                        <th className="py-1 pr-3 text-left font-medium"></th>
                                        <th className="py-1 pr-4 text-right font-medium">Bs</th>
                                        <th className="py-1 text-right font-medium">USD</th>
                                      </tr>
                                    </thead>
                                    <tbody className="tabular-nums">
                                      <tr>
                                        <td className="py-0.5 pr-3 text-neutral-500">Monto</td>
                                        <td className="py-0.5 pr-4 text-right text-neutral-700">
                                          {money(prestamo.monto_original_bs ?? 0)}
                                        </td>
                                        <td className="py-0.5 text-right text-neutral-700">
                                          {money(prestamo.monto_original_usd ?? 0)}
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-0.5 pr-3 text-neutral-500">Abonado</td>
                                        <td className="py-0.5 pr-4 text-right text-neutral-700">
                                          {money(prestamo.abonado_bs ?? 0)}
                                        </td>
                                        <td className="py-0.5 text-right text-neutral-700">
                                          {money(prestamo.abonado_usd ?? 0)}
                                        </td>
                                      </tr>
                                      <tr className="border-t border-neutral-100">
                                        <td className="py-0.5 pr-3 font-medium text-neutral-700">
                                          Saldo
                                        </td>
                                        <td className="py-0.5 pr-4 text-right font-semibold text-neutral-900">
                                          {money(prestamo.saldo_bs ?? 0)}
                                        </td>
                                        <td className="py-0.5 text-right font-semibold text-neutral-900">
                                          {money(prestamo.saldo_usd ?? 0)}
                                        </td>
                                      </tr>
                                      {(prestamo.saldo_mora_usd ?? 0) > 0 && (
                                        <tr>
                                          <td className="py-0.5 pr-3 text-error-600">Mora</td>
                                          <td className="py-0.5 pr-4 text-right text-error-600">
                                            —
                                          </td>
                                          <td className="py-0.5 text-right font-medium text-error-600">
                                            {money(prestamo.saldo_mora_usd ?? 0)}
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {marcado && (
                                <div className="flex flex-wrap items-end gap-3">
                                  <label className="text-xs font-medium text-neutral-600">
                                    <span className="mb-1 block">Abono USD</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      value={linea!.monto_usd}
                                      onChange={(e) => cambiarMonto(prestamo, e.target.value)}
                                      className="w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                                    />
                                  </label>
                                  <div className="pb-2 text-xs tabular-nums text-neutral-500">
                                    = {money((parseFloat(linea!.monto_usd) || 0) * (tasa ?? 0))} Bs
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </OpcionesColecta>
                )}

                {/* REINTEGROS: solo tienen sentido en acuerdos suspendidos */}
                {suspendidos.length > 0 && (
                  <Card padding="none" className="overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-900">Acuerdos suspendidos</h3>
                    </div>

                    <div className="divide-y divide-neutral-100">
                      {suspendidos.map((cobrable) => {
                        const clave = claveCobrable(cobrable)
                        return (
                          <div key={clave} className="flex flex-wrap items-end gap-3 px-5 py-4">
                            <div className="min-w-[200px] flex-1">
                              <p className="text-sm font-medium text-neutral-900">
                                {etiquetaServicio(cobrable.tipo)} · {cobrable.titulo}
                              </p>
                              <p className="text-xs text-neutral-500">{cobrable.detalle}</p>
                            </div>
                            <label className="text-xs font-medium text-amber-900">
                              <span className="mb-1 block">Reintegro (USD)</span>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={reintegros[clave] ?? ''}
                                onChange={(e) =>
                                  setReintegros((prev) => ({
                                    ...prev,
                                    [clave]: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                className="w-32 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                              />
                            </label>
                            <p className="pb-2 text-xs text-amber-800">
                              Cargo por reactivar. No cubre semanas de atraso.
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
              </div>

              {/* Columna derecha: el total, siempre a la vista */}
              <div className="lg:sticky lg:top-20 lg:self-start">
                <Card className="p-5">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary-600" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      Revisar y cobrar
                    </h3>
                  </div>

                  <p className="mt-4 break-words text-3xl font-bold tabular-nums text-neutral-900">
                    ${money(totalUsd)}
                  </p>
                  <p className="mt-1 text-lg text-neutral-600">{money(totalBs)} Bs</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {cantidadLineas} concepto(s) · {semanas} semana(s) · tasa {money(tasa ?? 0, 4)}
                  </p>

                  {/*
                Desglose por concepto. Los subtotales de ahorro, funeraria y
                salud salen del paquete que calculo el backend, asi que la
                pantalla no puede mostrar un numero y cobrar otro.
              */}
                  <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
                    {paquete &&
                      (
                        [
                          ['ahorro', paquete.totales.ahorro_usd, paquete.totales.ahorro_bs],
                          [
                            'funeraria',
                            paquete.totales.funeraria_usd,
                            paquete.totales.funeraria_bs,
                          ],
                          ['salud', paquete.totales.salud_usd, paquete.totales.salud_bs],
                        ] as const
                      ).map(([tipo, usd, bs]) => {
                        if (usd === 0) return null
                        return (
                          <div key={tipo} className="rounded-lg bg-neutral-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                                {iconoServicio(tipo)}
                                {etiquetaServicio(tipo)}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                                ${money(usd)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                              {money(bs)} Bs · {semanas} semana(s)
                              {tipo === 'ahorro' && adicional > 0
                                ? ` · incluye $${money(adicional)} adicional`
                                : ''}
                            </p>
                          </div>
                        )
                      })}

                    {/* Abonos a prestamo: voluntarios, fuera del paquete semanal */}
                    {totalVoluntario > 0 && (
                      <div className="rounded-lg bg-neutral-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                            {iconoServicio('prestamo')}
                            {etiquetaServicio('prestamo')}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-neutral-900">
                            ${money(totalVoluntario)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">Abono voluntario</p>
                      </div>
                    )}

                    {totalReintegros > 0 && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-amber-900">Reintegros</span>
                          <span className="text-sm font-semibold tabular-nums text-amber-900">
                            ${money(totalReintegros)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-amber-700">
                          Reactivacion de acuerdos suspendidos
                        </p>
                      </div>
                    )}

                    {totalUsd === 0 && (
                      <p className="text-sm text-neutral-400">Indique las semanas a cobrar</p>
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
                    disabled={
                      !puedeCobrar || totalUsd <= 0 || cobrando || calculandoPaquete || !paquete
                    }
                    className="mt-4 w-full justify-center py-3 text-base"
                  >
                    {cobrando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Receipt className="h-5 w-5" />
                    )}
                    {cobrando
                      ? 'Registrando...'
                      : calculandoPaquete
                        ? 'Calculando total…'
                        : `Registrar cobro · $${money(totalUsd)}`}
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
                  {
                    label: 'Ahorro',
                    usd: previoCierre.totales.ahorro_usd,
                    bs: previoCierre.totales.ahorro_bs,
                  },
                  {
                    label: 'Funeraria',
                    usd: previoCierre.totales.funeraria_usd,
                    bs: previoCierre.totales.funeraria_bs,
                  },
                  {
                    label: 'Salud',
                    usd: previoCierre.totales.salud_usd,
                    bs: previoCierre.totales.salud_bs,
                  },
                ].map((fila) => (
                  <div
                    key={fila.label}
                    className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2.5"
                  >
                    <span className="text-sm text-neutral-700">{fila.label}</span>
                    <span className="text-sm font-medium text-neutral-900">
                      ${money(fila.usd)} <span className="text-neutral-400">·</span>{' '}
                      {money(fila.bs)} Bs
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
                <p>
                  El cierre no se puede deshacer. Las colectas siguientes contaran para el proximo
                  cierre.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setModalCierre(false)} disabled={cerrando}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmarCierre()} disabled={cerrando}>
                {cerrando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Confirmar cierre
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
