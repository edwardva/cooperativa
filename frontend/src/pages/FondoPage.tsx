/**
 * FONDO DE LOS TRABAJADORES DE EL TRIUNFO
 *
 * Confirmado por la cooperativa el 24/10: fondo común de todos los
 * trabajadores. Entra lo que se consigue (ventas de pollo, queso, chucherías)
 * y sale como ayuda que no se devuelve, según el porcentaje del concepto (p.
 * ej. lentes 70 %). Lo autoriza el cajero; queda el historial de quién se lo
 * llevó, el motivo y el monto. En bolívares, con el $ al lado sólo como
 * referencia.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, HandCoins, Loader2, Plus, Printer, Search, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PrintableListado } from '../components/print/PrintableListado'
import * as fondoService from '../services/fondoService'
import type { BeneficiarioFondo, ConceptoFondo, MovimientoFondo, ParentescoFondo, ResumenFondo } from '../services/fondoService'
import * as sociosService from '../services/sociosService'
import type { Socio } from '../services/sociosService'
import { getErrorMessage } from '../services/api'
import { usePermissions } from '../store/authStore'

const money = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'))

const pad = (n: number) => String(n).padStart(2, '0')
const hoy = new Date()
const hoyISO = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
const inicioMes = `${hoyISO.slice(0, 8)}01`

const control =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100'
const etiqueta = 'mb-1 block text-sm font-medium text-neutral-700'

const nombreParentesco = (p: ParentescoFondo) => fondoService.PARENTESCOS.find((x) => x.valor === p)?.texto ?? p

/** Bolívares en negrita; el dólar chico y en verde, sólo de referencia */
const Bs = ({ bs, usd, grande = false }: { bs: number | string; usd?: number | string; grande?: boolean }) => (
  <span className="whitespace-nowrap">
    <span className={grande ? 'text-2xl font-extrabold text-neutral-900' : 'font-semibold text-neutral-900'}>Bs {money(bs)}</span>
    {usd !== undefined && (
      <span className={`ml-2 font-medium text-emerald-600 ${grande ? 'text-base' : 'text-xs'}`}>${money(usd)}</span>
    )}
  </span>
)

type Pestana = 'movimientos' | 'ingreso' | 'ayuda' | 'familiares' | 'conceptos'

/** Buscador de socio reutilizado en Ayuda y Familiares */
const BuscarSocio = ({ onElegir }: { onElegir: (s: Socio) => void }) => {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Socio[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const buscar = async () => {
    if (!q.trim()) return
    setBuscando(true)
    setError('')
    try {
      const r = await sociosService.obtenerSocios({ search: q.trim(), limit: 10 })
      setResultados(r.data)
      if (r.data.length === 0) setError('No se encontró el socio')
      if (r.data.length === 1 && r.data[0]) onElegir(r.data[0])
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo buscar')
    } finally {
      setBuscando(false)
    }
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void buscar()}
          placeholder="Expediente, cédula o nombre del trabajador"
          className={`${control} max-w-md`}
        />
        <Button onClick={() => void buscar()} disabled={buscando}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {resultados.length > 1 && (
        <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {resultados.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => {
                  onElegir(s)
                  setResultados([])
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
              >
                <span className="font-mono text-primary-700">{s.codigo_socio}</span>{' '}
                <span className="uppercase">{s.apellido}, {s.nombre}</span>{' '}
                <span className="text-neutral-500">C.I. {s.cedula} · {s.ubicacion?.codigo ?? 'sin sector'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FondoPage() {
  const { hasPermission } = usePermissions()
  const puedeRegistrar = hasPermission('fondo', 'create')
  const puedeEditar = hasPermission('fondo', 'update')
  const puedeReversar = hasPermission('fondo', 'delete')

  const [pestana, setPestana] = useState<Pestana>('movimientos')
  const [resumen, setResumen] = useState<ResumenFondo | null>(null)
  const [conceptos, setConceptos] = useState<ConceptoFondo[]>([])
  const [error, setError] = useState('')
  const [comprobante, setComprobante] = useState<MovimientoFondo | null>(null)

  const cargarResumen = useCallback(async () => {
    try {
      setResumen(await fondoService.obtenerResumen())
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo leer el saldo del fondo')
    }
  }, [])
  const cargarConceptos = useCallback(async () => {
    try {
      setConceptos(await fondoService.obtenerConceptos())
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudieron leer los conceptos')
    }
  }, [])

  useEffect(() => {
    void cargarResumen()
    void cargarConceptos()
  }, [cargarResumen, cargarConceptos])

  const usd = (bs: number) => (resumen && resumen.tasa > 0 ? bs / resumen.tasa : undefined)

  // ---------------------------------------------------------------- Movimientos
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoyISO)
  const [tipo, setTipo] = useState<'' | 'ingreso' | 'egreso'>('')
  const [movs, setMovs] = useState<Awaited<ReturnType<typeof fondoService.obtenerMovimientos>> | null>(null)
  const [cargandoMovs, setCargandoMovs] = useState(false)

  const cargarMovimientos = useCallback(async () => {
    setCargandoMovs(true)
    try {
      setMovs(await fondoService.obtenerMovimientos({ desde, hasta, tipo: tipo || undefined }))
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudieron cargar los movimientos')
    } finally {
      setCargandoMovs(false)
    }
  }, [desde, hasta, tipo])

  useEffect(() => {
    if (pestana === 'movimientos') void cargarMovimientos()
  }, [pestana, cargarMovimientos])

  const reversar = async (m: MovimientoFondo) => {
    const motivo = window.prompt(`Motivo para reversar el movimiento N° ${m.id}:`)
    if (!motivo || motivo.trim().length < 5) return
    try {
      await fondoService.reversar(m.id, motivo.trim())
      void cargarMovimientos()
      void cargarResumen()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo reversar')
    }
  }

  // ------------------------------------------------------------------- Ingreso
  const conceptosIngreso = conceptos.filter((c) => c.tipo === 'ingreso' && c.activo)
  const conceptosEgreso = conceptos.filter((c) => c.tipo === 'egreso' && c.activo)
  const [ing, setIng] = useState({ concepto_id: '', monto: '', entregado_por: '', referencia: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  const guardarIngreso = async () => {
    const monto = numero(ing.monto)
    if (!ing.concepto_id || !(monto > 0)) {
      setErrorForm('Elija el concepto y escriba el monto en bolívares')
      return
    }
    setGuardando(true)
    setErrorForm('')
    try {
      const m = await fondoService.registrarIngreso({
        concepto_id: Number(ing.concepto_id),
        monto_bs: monto,
        entregado_por: ing.entregado_por || null,
        referencia: ing.referencia || null,
        descripcion: ing.descripcion || null,
      })
      setComprobante(m)
      setIng({ concepto_id: ing.concepto_id, monto: '', entregado_por: '', referencia: '', descripcion: '' })
      void cargarResumen()
    } catch (err) {
      setErrorForm(getErrorMessage(err) || 'No se pudo registrar el ingreso')
    } finally {
      setGuardando(false)
    }
  }

  // -------------------------------------------------------------------- Ayuda
  const [socio, setSocio] = useState<Socio | null>(null)
  const [familiares, setFamiliares] = useState<BeneficiarioFondo[]>([])
  const [historial, setHistorial] = useState<MovimientoFondo[]>([])
  const [ayuda, setAyuda] = useState({ concepto_id: '', beneficiario_id: '', gasto: '', porcentaje: '', motivo: '' })

  const elegirSocio = async (s: Socio) => {
    setSocio(s)
    setErrorForm('')
    try {
      const [f, h] = await Promise.all([
        fondoService.obtenerBeneficiarios(s.id),
        fondoService.obtenerMovimientos({ socio_id: s.id, tipo: 'egreso' }),
      ])
      setFamiliares(f)
      setHistorial(h.movimientos)
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo cargar al trabajador')
    }
  }

  const conceptoAyuda = conceptosEgreso.find((c) => String(c.id) === ayuda.concepto_id)
  const porcentajeAyuda = ayuda.porcentaje !== '' ? numero(ayuda.porcentaje) : conceptoAyuda?.porcentaje != null ? Number(conceptoAyuda.porcentaje) : 100
  const gastoAyuda = numero(ayuda.gasto) || 0
  const cubreFondo = Math.round(((gastoAyuda * porcentajeAyuda) / 100) * 100) / 100
  const noEsTrabajador =
    !!socio && !!resumen && !resumen.sectores_trabajadores.includes((socio.ubicacion?.codigo ?? '').toUpperCase())

  const guardarAyuda = async () => {
    if (!socio || !ayuda.concepto_id || !(gastoAyuda > 0) || !ayuda.motivo.trim()) {
      setErrorForm('Elija el trabajador y el concepto, y escriba el monto del gasto y el motivo')
      return
    }
    setGuardando(true)
    setErrorForm('')
    try {
      const m = await fondoService.registrarEgreso({
        concepto_id: Number(ayuda.concepto_id),
        socio_id: socio.id,
        beneficiario_id: ayuda.beneficiario_id ? Number(ayuda.beneficiario_id) : null,
        gasto_total_bs: gastoAyuda,
        porcentaje: ayuda.porcentaje !== '' ? porcentajeAyuda : null,
        descripcion: ayuda.motivo.trim(),
      })
      setComprobante(m)
      setAyuda({ concepto_id: '', beneficiario_id: '', gasto: '', porcentaje: '', motivo: '' })
      void cargarResumen()
      void elegirSocio(socio)
    } catch (err) {
      setErrorForm(getErrorMessage(err) || 'No se pudo registrar la ayuda')
    } finally {
      setGuardando(false)
    }
  }

  // ---------------------------------------------------------------- Familiares
  const familiarVacio = { id: 0, cedula: '', nombre: '', apellido: '', parentesco: 'hijo' as ParentescoFondo, fecha_nacimiento: '', telefono: '' }
  const [editFam, setEditFam] = useState<typeof familiarVacio | null>(null)

  const guardarFamiliar = async () => {
    if (!socio || !editFam) return
    if (!editFam.nombre.trim() || !editFam.apellido.trim()) {
      setErrorForm('Escriba nombre y apellido')
      return
    }
    setGuardando(true)
    setErrorForm('')
    const datos = {
      cedula: editFam.cedula.trim() || null,
      nombre: editFam.nombre.trim(),
      apellido: editFam.apellido.trim(),
      parentesco: editFam.parentesco,
      fecha_nacimiento: editFam.fecha_nacimiento || null,
      telefono: editFam.telefono.trim() || null,
    }
    try {
      if (editFam.id) await fondoService.actualizarBeneficiario(editFam.id, datos)
      else await fondoService.crearBeneficiario({ socio_id: socio.id, ...datos })
      setEditFam(null)
      setFamiliares(await fondoService.obtenerBeneficiarios(socio.id))
    } catch (err) {
      setErrorForm(getErrorMessage(err) || 'No se pudo guardar el familiar')
    } finally {
      setGuardando(false)
    }
  }

  const bajaFamiliar = async (b: BeneficiarioFondo) => {
    if (!socio || !window.confirm(`¿Quitar a ${b.nombre} ${b.apellido} del fondo?`)) return
    try {
      await fondoService.darDeBajaBeneficiario(b.id)
      setFamiliares(await fondoService.obtenerBeneficiarios(socio.id))
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo quitar el familiar')
    }
  }

  // ----------------------------------------------------------------- Conceptos
  const [nuevoConcepto, setNuevoConcepto] = useState({ tipo: 'egreso' as 'ingreso' | 'egreso', nombre: '', porcentaje: '' })
  const guardarConcepto = async () => {
    if (!nuevoConcepto.nombre.trim()) return
    try {
      await fondoService.crearConcepto({
        tipo: nuevoConcepto.tipo,
        nombre: nuevoConcepto.nombre.trim(),
        porcentaje: nuevoConcepto.tipo === 'egreso' ? numero(nuevoConcepto.porcentaje) || 100 : null,
      })
      setNuevoConcepto({ ...nuevoConcepto, nombre: '', porcentaje: '' })
      void cargarConceptos()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo crear el concepto')
    }
  }
  const cambiarPorcentaje = async (c: ConceptoFondo) => {
    const valor = window.prompt(`Porcentaje que cubre el fondo para "${c.nombre}":`, String(c.porcentaje ?? 100))
    if (valor === null) return
    const n = numero(valor)
    if (!(n >= 1 && n <= 100)) {
      setError('El porcentaje debe estar entre 1 y 100')
      return
    }
    try {
      await fondoService.actualizarConcepto(c.id, { porcentaje: n })
      void cargarConceptos()
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo cambiar el porcentaje')
    }
  }

  // ---------------------------------------------------------------- Impresión
  const filasListado = useMemo(
    () =>
      (movs?.movimientos ?? []).map((m) => [
        String(m.id),
        new Date(m.fecha).toLocaleString('es-VE'),
        m.tipo === 'ingreso' ? 'Ingreso' : 'Ayuda',
        m.concepto.nombre,
        m.tipo === 'egreso' && m.socio ? `${m.socio.apellido}, ${m.socio.nombre}` : (m.entregado_por ?? ''),
        m.descripcion ?? '',
        `${m.tipo === 'egreso' ? '-' : ''}Bs ${money(m.monto_bs)}`,
        m.reversado ? 'Reversado' : '',
      ]),
    [movs]
  )

  const pestanas: [Pestana, string, boolean][] = [
    ['movimientos', 'Movimientos', true],
    ['ingreso', 'Registrar ingreso', puedeRegistrar],
    ['ayuda', 'Ayuda a un trabajador', puedeRegistrar],
    ['familiares', 'Familiares', true],
    ['conceptos', 'Conceptos y porcentajes', true],
  ]

  return (
    <div className="space-y-6">
      {/* Lo que sale por la impresora: el comprobante o el listado */}
      {comprobante ? (
        <PrintableListado
          titulo={`Fondo de trabajadores · ${comprobante.tipo === 'ingreso' ? 'Ingreso' : 'Ayuda'} N° ${comprobante.id}`}
          subtitulo={new Date(comprobante.fecha).toLocaleString('es-VE')}
          filtros={
            comprobante.tipo === 'ingreso'
              ? [
                  { label: 'Concepto', value: comprobante.concepto.nombre },
                  { label: 'Entregado por', value: comprobante.entregado_por ?? '' },
                  { label: 'Referencia', value: comprobante.referencia ?? '' },
                ]
              : [
                  { label: 'Trabajador', value: comprobante.socio ? `${comprobante.socio.apellido}, ${comprobante.socio.nombre} (Exp. ${comprobante.socio.codigo_socio})` : '' },
                  { label: 'Para', value: comprobante.beneficiario ? `${comprobante.beneficiario.nombre} ${comprobante.beneficiario.apellido} (${nombreParentesco(comprobante.beneficiario.parentesco)})` : 'El mismo trabajador' },
                  { label: 'Concepto', value: comprobante.concepto.nombre },
                  { label: 'Motivo', value: comprobante.descripcion ?? '' },
                ]
          }
          columnas={comprobante.tipo === 'ingreso' ? ['Monto Bs', 'Referencia $'] : ['Gasto total Bs', 'Cubre el fondo', 'Fondo Bs', 'A cargo del trabajador Bs', 'Referencia $']}
          filas={[
            comprobante.tipo === 'ingreso'
              ? [`Bs ${money(comprobante.monto_bs)}`, `$${money(comprobante.monto_usd)}`]
              : [
                  `Bs ${money(comprobante.gasto_total_bs)}`,
                  `${money(comprobante.porcentaje)} %`,
                  `Bs ${money(comprobante.monto_bs)}`,
                  `Bs ${money(comprobante.a_cargo_socio_bs)}`,
                  `$${money(comprobante.monto_usd)}`,
                ],
          ]}
          nota="Firma: ______________________      Entregado por (caja): ______________________"
        />
      ) : (
        <PrintableListado
          titulo="Fondo de los trabajadores de El Triunfo"
          subtitulo={movs ? `Movimientos del ${movs.desde.split('-').reverse().join('/')} al ${movs.hasta.split('-').reverse().join('/')}` : ''}
          filtros={[{ label: 'Tipo', value: tipo === 'ingreso' ? 'Ingresos' : tipo === 'egreso' ? 'Ayudas' : 'Todos' }]}
          resumenes={[
            { label: 'Ingresos', value: `Bs ${money(movs?.ingresos_bs)}` },
            { label: 'Ayudas', value: `Bs ${money(movs?.egresos_bs)}` },
            { label: 'Saldo del fondo', value: `Bs ${money(resumen?.saldo_bs)}` },
          ]}
          columnas={['N°', 'Fecha', 'Tipo', 'Concepto', 'Trabajador / Entregó', 'Motivo', 'Monto', 'Estado']}
          filas={filasListado}
        />
      )}

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-neutral-900">
            <HandCoins className="h-7 w-7 text-primary-600" />
            Fondo de trabajadores
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Fondo común de los trabajadores de El Triunfo: entra lo que se consigue y sale como ayuda.
          </p>
        </div>
        <Card className="min-w-[16rem] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Saldo del fondo</p>
          {resumen ? <Bs bs={resumen.saldo_bs} usd={resumen.saldo_usd} grande /> : <Loader2 className="h-5 w-5 animate-spin" />}
          {resumen && (
            <p className="mt-1 text-xs text-neutral-500">
              Entró Bs {money(resumen.ingresos_bs)} · salió Bs {money(resumen.egresos_bs)}
            </p>
          )}
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

      {comprobante && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {comprobante.tipo === 'ingreso' ? 'Ingreso' : 'Ayuda'} N° {comprobante.id} registrado ·{' '}
                <Bs bs={comprobante.monto_bs} usd={comprobante.monto_usd} />
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir comprobante
              </Button>
              <Button variant="ghost" onClick={() => setComprobante(null)}>Cerrar</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-1 border-b border-neutral-200 print:hidden">
        {pestanas.filter(([, , visible]) => visible).map(([valor, texto]) => (
          <button
            key={valor}
            onClick={() => {
              setPestana(valor)
              setErrorForm('')
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              pestana === valor ? 'border-primary-500 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="print:hidden">
        {pestana === 'movimientos' && (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <label className="text-sm">
                <span className={etiqueta}>Desde</span>
                <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={control} />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Hasta</span>
                <input type="date" value={hasta} min={desde} max={hoyISO} onChange={(e) => setHasta(e.target.value)} className={control} />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Tipo</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={control}>
                  <option value="">Todos</option>
                  <option value="ingreso">Ingresos</option>
                  <option value="egreso">Ayudas</option>
                </select>
              </label>
              <Button variant="outline" onClick={() => { setComprobante(null); setTimeout(() => window.print(), 50) }} className="ml-auto">
                <Printer className="h-4 w-4" />
                Imprimir listado
              </Button>
            </Card>
            {movs && (
              <p className="text-sm text-neutral-600">
                En el período: entró <Bs bs={movs.ingresos_bs} usd={usd(movs.ingresos_bs)} /> · salió{' '}
                <Bs bs={movs.egresos_bs} usd={usd(movs.egresos_bs)} />
              </p>
            )}
            <Card className="overflow-x-auto p-0">
              {cargandoMovs ? (
                <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">N°</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Concepto</th>
                      <th className="px-4 py-3">Trabajador / Entregó</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {(movs?.movimientos ?? []).map((m) => (
                      <tr key={m.id} className={`border-t border-neutral-100 ${m.reversado ? 'text-neutral-400 line-through' : ''}`}>
                        <td className="px-4 py-2">{m.id}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{new Date(m.fecha).toLocaleString('es-VE')}</td>
                        <td className="px-4 py-2">
                          <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${m.tipo === 'ingreso' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {m.tipo === 'ingreso' ? 'Ingreso' : 'Ayuda'}
                          </span>
                          {m.concepto.nombre}
                        </td>
                        <td className="px-4 py-2 uppercase">
                          {m.tipo === 'egreso' && m.socio ? (
                            <>
                              {m.socio.apellido}, {m.socio.nombre}
                              {m.beneficiario && (
                                <span className="block text-xs normal-case text-neutral-500">
                                  para {m.beneficiario.nombre} {m.beneficiario.apellido} ({nombreParentesco(m.beneficiario.parentesco)})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="normal-case">{m.entregado_por ?? ''}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-neutral-600">
                          {m.descripcion}
                          {m.tipo === 'egreso' && m.gasto_total_bs && (
                            <span className="block text-xs text-neutral-500">
                              Gasto Bs {money(m.gasto_total_bs)} · el fondo cubre {money(m.porcentaje)} %
                            </span>
                          )}
                          {m.reversado && <span className="block text-xs text-red-600 no-underline">Reversado: {m.motivo_reverso}</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={m.tipo === 'egreso' ? 'text-amber-700' : ''}>{m.tipo === 'egreso' ? '−' : ''}</span>
                          <Bs bs={m.monto_bs} usd={m.monto_usd} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setComprobante(m)}>Comprobante</Button>
                            {puedeReversar && !m.reversado && (
                              <Button size="sm" variant="ghost" onClick={() => void reversar(m)}>Reversar</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(movs?.movimientos.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">Sin movimientos en esas fechas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}

        {pestana === 'ingreso' && (
          <Card className="max-w-2xl p-6">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Registrar ingreso al fondo</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className={etiqueta}>Concepto *</span>
                <select value={ing.concepto_id} onChange={(e) => setIng({ ...ing, concepto_id: e.target.value })} className={control} autoFocus>
                  <option value="">Elegir...</option>
                  {conceptosIngreso.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Monto en bolívares *</span>
                <input value={ing.monto} onChange={(e) => setIng({ ...ing, monto: e.target.value })} inputMode="decimal" placeholder="0,00" className={control} />
                {numero(ing.monto) > 0 && usd(numero(ing.monto)) !== undefined && (
                  <span className="mt-1 block text-xs text-emerald-600">≈ ${money(usd(numero(ing.monto)))} de referencia</span>
                )}
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Entregado por</span>
                <input value={ing.entregado_por} onChange={(e) => setIng({ ...ing, entregado_por: e.target.value })} maxLength={100} className={control} />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Referencia</span>
                <input value={ing.referencia} onChange={(e) => setIng({ ...ing, referencia: e.target.value })} maxLength={50} className={control} />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className={etiqueta}>Descripción</span>
                <input value={ing.descripcion} onChange={(e) => setIng({ ...ing, descripcion: e.target.value })} maxLength={1000} placeholder="Ej.: venta de pollo del sábado" className={control} />
              </label>
            </div>
            {errorForm && <p className="mt-3 text-sm text-red-600">{errorForm}</p>}
            <div className="mt-5 flex justify-end">
              <Button onClick={() => void guardarIngreso()} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar ingreso'}</Button>
            </div>
          </Card>
        )}

        {pestana === 'ayuda' && (
          <div className="space-y-4">
            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold text-neutral-800">Trabajador que pide la ayuda</p>
              <BuscarSocio onElegir={(s) => void elegirSocio(s)} />
              {socio && (
                <div className="mt-3">
                  <p className="text-lg font-bold uppercase text-neutral-900">
                    {socio.apellido}, {socio.nombre}
                    <span className="ml-2 text-sm font-semibold normal-case text-neutral-500">Exp. {socio.codigo_socio} · C.I. {socio.cedula}</span>
                  </p>
                  {noEsTrabajador && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      No figura como trabajador de El Triunfo (sector {resumen?.sectores_trabajadores.join(', ')}). Verifique antes de dar la ayuda.
                    </p>
                  )}
                </div>
              )}
            </Card>

            {socio && (
              <Card className="max-w-3xl p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className={etiqueta}>Concepto *</span>
                    <select value={ayuda.concepto_id} onChange={(e) => setAyuda({ ...ayuda, concepto_id: e.target.value, porcentaje: '' })} className={control}>
                      <option value="">Elegir...</option>
                      {conceptosEgreso.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre} · cubre {money(c.porcentaje ?? 100)} %</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className={etiqueta}>Para</span>
                    <select value={ayuda.beneficiario_id} onChange={(e) => setAyuda({ ...ayuda, beneficiario_id: e.target.value })} className={control}>
                      <option value="">El mismo trabajador</option>
                      {familiares.map((f) => (
                        <option key={f.id} value={f.id}>{f.nombre} {f.apellido} ({nombreParentesco(f.parentesco)})</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className={etiqueta}>Monto total del gasto (Bs) *</span>
                    <input value={ayuda.gasto} onChange={(e) => setAyuda({ ...ayuda, gasto: e.target.value })} inputMode="decimal" placeholder="0,00" className={control} />
                  </label>
                  <label className="text-sm">
                    <span className={etiqueta}>Porcentaje que cubre el fondo</span>
                    <input
                      value={ayuda.porcentaje}
                      onChange={(e) => setAyuda({ ...ayuda, porcentaje: e.target.value })}
                      inputMode="decimal"
                      placeholder={conceptoAyuda ? `${money(conceptoAyuda.porcentaje ?? 100)} (del concepto)` : '100'}
                      className={control}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className={etiqueta}>Motivo *</span>
                    <input value={ayuda.motivo} onChange={(e) => setAyuda({ ...ayuda, motivo: e.target.value })} maxLength={1000} placeholder="Ej.: cristales para los lentes de la hija" className={control} />
                  </label>
                </div>
                {gastoAyuda > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-neutral-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-neutral-500">Entrega el fondo ({money(porcentajeAyuda)} %)</p>
                      <Bs bs={cubreFondo} usd={usd(cubreFondo)} grande />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-neutral-500">Pone el trabajador</p>
                      <Bs bs={gastoAyuda - cubreFondo} usd={usd(gastoAyuda - cubreFondo)} />
                    </div>
                    {resumen && cubreFondo > resumen.saldo_bs && (
                      <p className="text-sm text-red-600 sm:col-span-2">El fondo tiene Bs {money(resumen.saldo_bs)}: no alcanza para esta ayuda.</p>
                    )}
                  </div>
                )}
                {errorForm && <p className="mt-3 text-sm text-red-600">{errorForm}</p>}
                <div className="mt-5 flex justify-end">
                  <Button onClick={() => void guardarAyuda()} disabled={guardando}>{guardando ? 'Guardando...' : 'Entregar ayuda'}</Button>
                </div>
              </Card>
            )}

            {socio && (
              <Card className="p-4">
                <p className="mb-2 text-sm font-semibold text-neutral-800">Ayudas que ha recibido</p>
                {historial.length === 0 ? (
                  <p className="text-sm text-neutral-500">Todavía no ha recibido ayudas del fondo.</p>
                ) : (
                  <ul className="divide-y divide-neutral-100 text-sm">
                    {historial.map((h) => (
                      <li key={h.id} className={`flex flex-wrap justify-between gap-2 py-1.5 ${h.reversado ? 'text-neutral-400 line-through' : ''}`}>
                        <span>
                          {new Date(h.fecha).toLocaleDateString('es-VE')} · {h.concepto.nombre} · {h.descripcion}
                          {h.beneficiario ? ` (para ${h.beneficiario.nombre})` : ''}
                        </span>
                        <Bs bs={h.monto_bs} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        )}

        {pestana === 'familiares' && (
          <div className="space-y-4">
            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold text-neutral-800">Trabajador</p>
              <BuscarSocio onElegir={(s) => void elegirSocio(s)} />
              <p className="mt-2 text-xs text-neutral-500">
                Pueden estar en el fondo los padres, el cónyuge y los hijos, sin límite de edad. Un familiar puede estar en el fondo de dos trabajadores.
              </p>
            </Card>
            {socio && (
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-lg font-bold uppercase text-neutral-900">
                    {socio.apellido}, {socio.nombre}
                    <span className="ml-2 text-sm font-semibold normal-case text-neutral-500">Exp. {socio.codigo_socio}</span>
                  </p>
                  {puedeRegistrar && (
                    <Button size="sm" onClick={() => setEditFam({ ...familiarVacio })}>
                      <Plus className="h-4 w-4" />
                      Agregar familiar
                    </Button>
                  )}
                </div>
                {familiares.length === 0 ? (
                  <p className="text-sm text-neutral-500">No tiene familiares registrados en el fondo.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="py-2">Nombre</th>
                        <th className="py-2">Parentesco</th>
                        <th className="py-2">Cédula</th>
                        <th className="py-2">Nacimiento</th>
                        <th className="py-2">Teléfono</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {familiares.map((f) => (
                        <tr key={f.id} className="border-t border-neutral-100">
                          <td className="py-2 uppercase">{f.apellido}, {f.nombre}</td>
                          <td className="py-2">{nombreParentesco(f.parentesco)}</td>
                          <td className="py-2">{f.cedula ?? ''}</td>
                          <td className="py-2">{f.fecha_nacimiento ? f.fecha_nacimiento.slice(0, 10).split('-').reverse().join('/') : ''}</td>
                          <td className="py-2">{f.telefono ?? ''}</td>
                          <td className="py-2 text-right">
                            {puedeEditar && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setEditFam({
                                    id: f.id,
                                    cedula: f.cedula ?? '',
                                    nombre: f.nombre,
                                    apellido: f.apellido,
                                    parentesco: f.parentesco,
                                    fecha_nacimiento: f.fecha_nacimiento ? f.fecha_nacimiento.slice(0, 10) : '',
                                    telefono: f.telefono ?? '',
                                  })
                                }
                              >
                                Editar
                              </Button>
                            )}
                            {puedeReversar && (
                              <Button size="sm" variant="ghost" onClick={() => void bajaFamiliar(f)}>Quitar</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}
          </div>
        )}

        {pestana === 'conceptos' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(['egreso', 'ingreso'] as const).map((t) => (
              <Card key={t} className="p-4">
                <p className="mb-2 text-sm font-semibold text-neutral-800">
                  {t === 'egreso' ? 'Gastos que cubre el fondo (y en qué porcentaje)' : 'Orígenes de los ingresos'}
                </p>
                <ul className="divide-y divide-neutral-100 text-sm">
                  {conceptos.filter((c) => c.tipo === t).map((c) => (
                    <li key={c.id} className={`flex items-center justify-between gap-2 py-2 ${c.activo ? '' : 'text-neutral-400'}`}>
                      <span>
                        {c.nombre}
                        {t === 'egreso' && <span className="ml-2 font-semibold text-primary-700">{money(c.porcentaje ?? 100)} %</span>}
                        {!c.activo && <span className="ml-2 text-xs">(inactivo)</span>}
                      </span>
                      {puedeEditar && (
                        <span className="flex gap-1">
                          {t === 'egreso' && c.activo && (
                            <Button size="sm" variant="ghost" onClick={() => void cambiarPorcentaje(c)}>Porcentaje</Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void fondoService.actualizarConcepto(c.id, { activo: !c.activo }).then(cargarConceptos)}
                          >
                            {c.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            {puedeEditar && (
              <Card className="p-4 lg:col-span-2">
                <p className="mb-2 text-sm font-semibold text-neutral-800">Nuevo concepto</p>
                <div className="flex flex-wrap items-end gap-2">
                  <select value={nuevoConcepto.tipo} onChange={(e) => setNuevoConcepto({ ...nuevoConcepto, tipo: e.target.value as 'ingreso' | 'egreso' })} className={`${control} w-40`}>
                    <option value="egreso">Gasto</option>
                    <option value="ingreso">Ingreso</option>
                  </select>
                  <input value={nuevoConcepto.nombre} onChange={(e) => setNuevoConcepto({ ...nuevoConcepto, nombre: e.target.value })} placeholder="Nombre" maxLength={100} className={`${control} max-w-xs`} />
                  {nuevoConcepto.tipo === 'egreso' && (
                    <input value={nuevoConcepto.porcentaje} onChange={(e) => setNuevoConcepto({ ...nuevoConcepto, porcentaje: e.target.value })} placeholder="% que cubre" inputMode="decimal" className={`${control} w-32`} />
                  )}
                  <Button onClick={() => void guardarConcepto()}>
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Alta y edición de un familiar */}
      {editFam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">{editFam.id ? 'Editar familiar' : 'Agregar familiar al fondo'}</h2>
              <button onClick={() => setEditFam(null)} aria-label="Cerrar" className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className={etiqueta}>Nombre *</span>
                <input value={editFam.nombre} onChange={(e) => setEditFam({ ...editFam, nombre: e.target.value })} maxLength={100} className={control} autoFocus />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Apellido *</span>
                <input value={editFam.apellido} onChange={(e) => setEditFam({ ...editFam, apellido: e.target.value })} maxLength={100} className={control} />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Parentesco *</span>
                <select value={editFam.parentesco} onChange={(e) => setEditFam({ ...editFam, parentesco: e.target.value as ParentescoFondo })} className={control}>
                  {fondoService.PARENTESCOS.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Cédula</span>
                <input value={editFam.cedula} onChange={(e) => setEditFam({ ...editFam, cedula: e.target.value.replace(/\D/g, '') })} maxLength={11} className={control} />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Fecha de nacimiento</span>
                <input type="date" value={editFam.fecha_nacimiento} max={hoyISO} onChange={(e) => setEditFam({ ...editFam, fecha_nacimiento: e.target.value })} className={control} />
              </label>
              <label className="text-sm">
                <span className={etiqueta}>Teléfono</span>
                <input value={editFam.telefono} onChange={(e) => setEditFam({ ...editFam, telefono: e.target.value })} maxLength={100} className={control} />
              </label>
            </div>
            {errorForm && <p className="mt-3 text-sm text-red-600">{errorForm}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditFam(null)} disabled={guardando}>Cancelar</Button>
              <Button onClick={() => void guardarFamiliar()} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
