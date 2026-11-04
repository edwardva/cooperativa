/**
 * MULTAS POR INASISTENCIA A ASAMBLEA
 *
 * Confirmado por la cooperativa el 23/10: la multa se cobra aparte de la
 * colecta, en una opción propia del menú, donde también se cambia el monto.
 *
 *   - Debe la multa quien no fue a NINGUNA asamblea del año (cualquier fecha,
 *     cualquier sector). Se cobra apenas termina la última asamblea del año.
 *   - Al monto vigente, entera: no se paga en partes.
 *   - Se ve primero en bolívares y al lado, más chico y en verde, en dólares.
 *   - Si falta también al año siguiente, ya no hay otra multa: se retira.
 *   - El retirado que quiere volver paga aquí la multa antes de reactivarlo.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Gavel, Loader2, Printer, Search, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PrintableListado } from '../components/print/PrintableListado'
import * as multasService from '../services/multasService'
import type { FormaPagoMulta, MultaPagada, SocioMulta } from '../services/multasService'
import * as sociosService from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'

const money = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pad = (n: number) => String(n).padStart(2, '0')
const hoy = new Date()
const hoyISO = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`

const control =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100'

/** Bolívares grandes y en negrita; dólares al lado, chicos y en verde */
const MontoBs = ({ bs, usd, grande = false }: { bs: number | string; usd: number | string; grande?: boolean }) => (
  <span className="whitespace-nowrap">
    <span className={grande ? 'text-2xl font-extrabold text-neutral-900' : 'font-semibold text-neutral-900'}>
      Bs {money(bs)}
    </span>
    <span className={`ml-2 font-medium text-emerald-600 ${grande ? 'text-base' : 'text-xs'}`}>${money(usd)}</span>
  </span>
)

interface ACobrar {
  socio: SocioMulta
  ano: number
}

export default function MultasPage() {
  const { hasPermission } = usePermissions()
  const puedeCobrar = hasPermission('multas', 'create')
  const puedeReversar = hasPermission('multas', 'delete')
  const puedeCambiarMonto = hasPermission('multas', 'update')

  const [pestana, setPestana] = useState<'cobrar' | 'cobradas'>('cobrar')
  const [parametros, setParametros] = useState<multasService.Parametros | null>(null)
  const [error, setError] = useState('')

  // --- Por cobrar ---
  const [anos, setAnos] = useState<{ ano: number; ultima_asamblea: string }[]>([])
  const [ano, setAno] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [deudores, setDeudores] = useState<SocioMulta[]>([])
  const [cargando, setCargando] = useState(false)

  // --- Socio puntual (también retirados, para poder reactivarlos) ---
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [socioConsultado, setSocioConsultado] = useState<Awaited<ReturnType<typeof multasService.obtenerDeSocio>> | null>(null)

  // --- Cobro ---
  const [aCobrar, setACobrar] = useState<ACobrar | null>(null)
  const [cuentas, setCuentas] = useState<NonNullable<typeof socioConsultado>['socio']['cuentas_ahorro']>([])
  const [forma, setForma] = useState<FormaPagoMulta>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [cuentaId, setCuentaId] = useState<number | ''>('')
  const [observacion, setObservacion] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [errorCobro, setErrorCobro] = useState('')
  const [recibo, setRecibo] = useState<MultaPagada | null>(null)

  // --- Cobradas ---
  const [desde, setDesde] = useState(hoyISO)
  const [hasta, setHasta] = useState(hoyISO)
  const [pagos, setPagos] = useState<Awaited<ReturnType<typeof multasService.obtenerPagos>> | null>(null)

  // --- Monto ---
  const [editandoMonto, setEditandoMonto] = useState(false)
  const [nuevoMonto, setNuevoMonto] = useState('')

  const cargarParametros = useCallback(async () => {
    try {
      setParametros(await multasService.obtenerParametros())
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo leer el monto de la multa')
    }
  }, [])

  useEffect(() => {
    void cargarParametros()
    multasService
      .obtenerAnos()
      .then((a) => {
        setAnos(a)
        if (a[0]) setAno(a[0].ano)
      })
      .catch((err) => setError(getErrorMessage(err) || 'No se pudieron leer los años'))
  }, [cargarParametros])

  const cargarDeudores = useCallback(async () => {
    if (ano === null) return
    setCargando(true)
    setError('')
    try {
      const r = await multasService.obtenerDeudores({ ano, q: busqueda.trim() || undefined })
      setDeudores(r.deudores)
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo cargar quién debe la multa')
      setDeudores([])
    } finally {
      setCargando(false)
    }
  }, [ano, busqueda])

  useEffect(() => {
    if (pestana !== 'cobrar') return
    const t = window.setTimeout(() => void cargarDeudores(), 300)
    return () => window.clearTimeout(t)
  }, [cargarDeudores, pestana])

  const cargarPagos = useCallback(async () => {
    try {
      setPagos(await multasService.obtenerPagos({ desde, hasta }))
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudieron cargar las multas cobradas')
    }
  }, [desde, hasta])

  useEffect(() => {
    if (pestana === 'cobradas') void cargarPagos()
  }, [pestana, cargarPagos])

  const consultarSocio = async () => {
    const q = busquedaSocio.trim()
    if (!q) return
    setError('')
    setSocioConsultado(null)
    try {
      const r = await sociosService.obtenerSocios({ search: q, limit: 1 })
      const socio = r.data[0]
      if (!socio) {
        setError('No se encontró el socio')
        return
      }
      setSocioConsultado(await multasService.obtenerDeSocio(socio.id))
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo consultar el socio')
    }
  }

  const abrirCobro = async (socio: SocioMulta, anoMulta: number) => {
    setACobrar({ socio, ano: anoMulta })
    setForma('efectivo')
    setReferencia('')
    setCuentaId('')
    setObservacion('')
    setErrorCobro('')
    setCuentas([])
    try {
      const d = await multasService.obtenerDeSocio(socio.id)
      setCuentas(d.socio.cuentas_ahorro)
    } catch {
      // Sin cuentas sólo no se ofrece descontar del ahorro
    }
  }

  const confirmarCobro = async () => {
    if (!aCobrar) return
    if ((forma === 'transferencia' || forma === 'pago_movil') && !referencia.trim()) {
      setErrorCobro('Indique la referencia del pago')
      return
    }
    if (forma === 'ahorro' && cuentaId === '') {
      setErrorCobro('Elija la cuenta de la que se descuenta')
      return
    }
    setCobrando(true)
    setErrorCobro('')
    try {
      const multa = await multasService.cobrar({
        socio_id: aCobrar.socio.id,
        ano: aCobrar.ano,
        forma_pago: forma,
        referencia: referencia.trim() || null,
        cuenta_ahorro_id: forma === 'ahorro' ? Number(cuentaId) : null,
        observacion: observacion.trim() || null,
      })
      setRecibo({ ...multa, socio: multa.socio ?? aCobrar.socio })
      setACobrar(null)
      void cargarDeudores()
      if (socioConsultado?.socio.id === aCobrar.socio.id) {
        setSocioConsultado(await multasService.obtenerDeSocio(aCobrar.socio.id))
      }
    } catch (err) {
      setErrorCobro(getErrorMessage(err) || 'No se pudo cobrar la multa')
    } finally {
      setCobrando(false)
    }
  }

  const reversar = async (p: MultaPagada) => {
    const motivo = window.prompt(`Motivo para reversar la multa ${p.ano} de ${p.socio?.codigo_socio ?? ''}:`)
    if (!motivo || motivo.trim().length < 5) return
    try {
      await multasService.reversar(p.id, motivo.trim())
      void cargarPagos()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo reversar')
    }
  }

  const guardarMonto = async () => {
    const valor = Number(nuevoMonto.replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 0) {
      setError('Monto inválido')
      return
    }
    try {
      await multasService.cambiarMonto(valor)
      setEditandoMonto(false)
      await cargarParametros()
      void cargarDeudores()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo cambiar el monto')
    }
  }

  const sinMonto = parametros !== null && parametros.monto_usd <= 0
  const nombreForma = (f: string) => multasService.FORMAS_PAGO.find((x) => x.valor === f)?.texto ?? f

  return (
    <div className="space-y-6">
      {/* Recibo: es lo único que sale por la impresora */}
      {recibo && (
        <PrintableListado
          titulo={`Recibo de multa N° ${recibo.id}`}
          subtitulo="Multa por inasistencia a asamblea"
          filtros={[
            { label: 'Socio', value: `${recibo.socio?.apellido ?? ''}, ${recibo.socio?.nombre ?? ''}` },
            { label: 'Expediente', value: recibo.socio?.codigo_socio ?? '' },
            { label: 'Cédula', value: recibo.socio?.cedula ?? '' },
            { label: 'Fecha', value: new Date(recibo.fecha_pago).toLocaleString('es-VE') },
          ]}
          columnas={['Concepto', 'Forma de pago', 'Referencia', 'Bolívares', 'Dólares', 'Tasa']}
          filas={[[
            `Inasistencia a asamblea ${recibo.ano}`,
            nombreForma(recibo.forma_pago),
            recibo.referencia ?? '',
            `Bs ${money(recibo.monto_bs)}`,
            `$${money(recibo.monto_usd)}`,
            money(recibo.tasa_cambio),
          ]]}
          nota="Firma del socio: ______________________      Recibido por: ______________________"
        />
      )}

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-neutral-900">
            <Gavel className="h-7 w-7 text-primary-600" />
            Multas
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Inasistencia a asamblea: quien no fue a ninguna del año paga la multa, entera, apenas termina la última.
          </p>
        </div>

        <Card className="min-w-[16rem] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Multa vigente</p>
          {parametros && !editandoMonto && (
            <div className="mt-1 flex items-center gap-3">
              {sinMonto ? (
                <span className="text-sm font-semibold text-amber-700">Sin configurar</span>
              ) : (
                <MontoBs bs={parametros.monto_bs} usd={parametros.monto_usd} grande />
              )}
              {puedeCambiarMonto && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNuevoMonto(String(parametros.monto_usd))
                    setEditandoMonto(true)
                  }}
                >
                  Cambiar
                </Button>
              )}
            </div>
          )}
          {editandoMonto && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-neutral-600">$</span>
              <input value={nuevoMonto} onChange={(e) => setNuevoMonto(e.target.value)} className={`${control} w-28`} autoFocus />
              <Button size="sm" onClick={() => void guardarMonto()}>Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditandoMonto(false)}>Cancelar</Button>
            </div>
          )}
          {parametros && <p className="mt-1 text-xs text-neutral-500">Tasa del día: {money(parametros.tasa)} Bs/USD</p>}
        </Card>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError('')} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {recibo && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                Multa {recibo.ano} cobrada · <MontoBs bs={recibo.monto_bs} usd={recibo.monto_usd} />
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir recibo
              </Button>
              <Button variant="ghost" onClick={() => setRecibo(null)}>Cerrar</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2 border-b border-neutral-200 print:hidden">
        {([['cobrar', 'Por cobrar'], ['cobradas', 'Cobradas']] as const).map(([valor, texto]) => (
          <button
            key={valor}
            onClick={() => setPestana(valor)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              pestana === valor ? 'border-primary-500 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'cobrar' && (
        <div className="space-y-4 print:hidden">
          {/* Un socio puntual: sirve también para el retirado que quiere volver */}
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-neutral-800">Consultar un socio (incluye retirados)</p>
            <div className="flex gap-2">
              <input
                value={busquedaSocio}
                onChange={(e) => setBusquedaSocio(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void consultarSocio()}
                placeholder="Expediente, cédula o nombre"
                className={`${control} max-w-sm`}
              />
              <Button onClick={() => void consultarSocio()}>
                <Search className="h-4 w-4" />
                Consultar
              </Button>
            </div>
            {socioConsultado && (
              <div className="mt-3 rounded-lg border border-neutral-200 p-3 text-sm">
                <p className="font-semibold text-neutral-900">
                  {socioConsultado.socio.apellido}, {socioConsultado.socio.nombre} · Exp. {socioConsultado.socio.codigo_socio}
                  <span className="ml-2 text-xs font-normal text-neutral-500">({socioConsultado.socio.estado})</span>
                </p>
                {socioConsultado.anos_adeudados.length === 0 ? (
                  <p className="mt-1 text-emerald-700">No debe multas.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-red-700">Debe la multa de:</span>
                    {socioConsultado.anos_adeudados.map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        disabled={!puedeCobrar || sinMonto}
                        onClick={() => void abrirCobro(socioConsultado.socio, a)}
                      >
                        Cobrar {a}
                      </Button>
                    ))}
                  </div>
                )}
                {socioConsultado.socio.multas_asamblea.length > 0 && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Pagadas:{' '}
                    {socioConsultado.socio.multas_asamblea
                      .filter((m) => m.estado === 'pagada')
                      .map((m) => `${m.ano} (${new Date(m.fecha_pago).toLocaleDateString('es-VE')})`)
                      .join(', ') || 'ninguna'}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Año de la asamblea</span>
                <select
                  value={ano ?? ''}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className={`${control} w-40`}
                  disabled={anos.length === 0}
                >
                  {anos.length === 0 && <option value="">Sin asambleas terminadas</option>}
                  {anos.map((a) => (
                    <option key={a.ano} value={a.ano}>{a.ano}</option>
                  ))}
                </select>
              </label>
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Buscar</span>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Expediente, cédula o nombre"
                  className={control}
                />
              </label>
            </div>
            {sinMonto && (
              <p className="mt-3 text-sm text-amber-700">
                El monto de la multa no está configurado: no se puede cobrar hasta cargarlo.
              </p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            {cargando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Expediente</th>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3">Cédula</th>
                    <th className="px-4 py-3">Sector o feria</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Multa</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {deudores.map((d) => (
                    <tr key={d.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-mono text-primary-700">{d.codigo_socio}</td>
                      <td className="px-4 py-2 uppercase">{d.apellido}, {d.nombre}</td>
                      <td className="px-4 py-2">{d.cedula}</td>
                      <td className="px-4 py-2">{d.ubicacion ? d.ubicacion.direccion || d.ubicacion.nombre || d.ubicacion.codigo : ''}</td>
                      <td className="px-4 py-2 capitalize">{d.estado}</td>
                      <td className="px-4 py-2 text-right">
                        {parametros && <MontoBs bs={parametros.monto_bs} usd={parametros.monto_usd} />}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {puedeCobrar && ano !== null && (
                          <Button size="sm" disabled={sinMonto} onClick={() => void abrirCobro(d, ano)}>
                            Cobrar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {deudores.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                        {ano === null ? 'Todavía no hay asambleas terminadas.' : `Nadie debe la multa de ${ano}.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {deudores.length > 0 && parametros && (
              <p className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600">
                {deudores.length} socio(s) · Total por cobrar:{' '}
                <MontoBs bs={deudores.length * parametros.monto_bs} usd={deudores.length * parametros.monto_usd} />
              </p>
            )}
          </Card>
        </div>
      )}

      {pestana === 'cobradas' && (
        <div className="space-y-4 print:hidden">
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Desde</span>
              <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={control} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Hasta</span>
              <input type="date" value={hasta} min={desde} max={hoyISO} onChange={(e) => setHasta(e.target.value)} className={control} />
            </label>
            {pagos && (
              <p className="ml-auto text-sm text-neutral-600">
                {pagos.cantidad} cobrada(s) · <MontoBs bs={pagos.total_bs} usd={pagos.total_usd} />
              </p>
            )}
          </Card>
          <Card className="overflow-hidden p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Año</th>
                  <th className="px-4 py-3">Forma de pago</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(pagos?.pagos ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2">{p.id}</td>
                    <td className="px-4 py-2">{new Date(p.fecha_pago).toLocaleString('es-VE')}</td>
                    <td className="px-4 py-2 uppercase">
                      {p.socio?.apellido}, {p.socio?.nombre}
                      <span className="ml-1 text-xs normal-case text-neutral-500">{p.socio?.codigo_socio}</span>
                    </td>
                    <td className="px-4 py-2">{p.ano}</td>
                    <td className="px-4 py-2">
                      {nombreForma(p.forma_pago)}
                      {p.referencia ? <span className="ml-1 text-xs text-neutral-500">{p.referencia}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right"><MontoBs bs={p.monto_bs} usd={p.monto_usd} /></td>
                    <td className="px-4 py-2">
                      {p.estado === 'pagada' ? (
                        <span className="text-emerald-700">Pagada</span>
                      ) : (
                        <span className="text-red-600" title={p.motivo_reverso ?? ''}>Reversada</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setRecibo(p)}>Recibo</Button>
                        {puedeReversar && p.estado === 'pagada' && (
                          <Button size="sm" variant="ghost" onClick={() => void reversar(p)}>Reversar</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(pagos?.pagos.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">Sin multas cobradas en esas fechas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Cobro de una multa */}
      {aCobrar && parametros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Cobrar multa {aCobrar.ano}</h2>
                <p className="text-sm text-neutral-600 uppercase">
                  {aCobrar.socio.apellido}, {aCobrar.socio.nombre}
                  <span className="ml-2 normal-case text-neutral-500">Exp. {aCobrar.socio.codigo_socio}</span>
                </p>
              </div>
              <button onClick={() => setACobrar(null)} aria-label="Cerrar" className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Total a cobrar (completo)</p>
              <MontoBs bs={parametros.monto_bs} usd={parametros.monto_usd} grande />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Forma de pago</span>
                <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagoMulta)} className={control}>
                  {multasService.FORMAS_PAGO.filter((f) => f.valor !== 'ahorro' || cuentas.length > 0).map((f) => (
                    <option key={f.valor} value={f.valor}>{f.texto}</option>
                  ))}
                </select>
              </label>
              {forma === 'ahorro' ? (
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">Cuenta</span>
                  <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value === '' ? '' : Number(e.target.value))} className={control}>
                    <option value="">Elegir...</option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.numero_cuenta} · {c.tipo_cuenta.moneda === 'bs' ? `Bs ${money(c.saldo_bs)}` : `$${money(c.saldo_usd)}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">
                    Referencia{forma === 'transferencia' || forma === 'pago_movil' ? ' *' : ''}
                  </span>
                  <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={50} className={control} />
                </label>
              )}
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-neutral-700">Observación</span>
                <input value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={500} className={control} />
              </label>
            </div>

            {errorCobro && <p className="mt-3 text-sm text-red-600">{errorCobro}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setACobrar(null)} disabled={cobrando}>Cancelar</Button>
              <Button onClick={() => void confirmarCobro()} disabled={cobrando}>
                {cobrando ? 'Cobrando...' : 'Cobrar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
