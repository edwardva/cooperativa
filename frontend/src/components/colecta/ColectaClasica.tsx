/**
 * ============================================
 * COMPONENTE: colecta en disposicion CLASICA
 * ============================================
 *
 * La misma colecta, dispuesta como la pantalla "Colecta Global" del sistema
 * actual. Pedido por la cooperativa al probar:
 *
 *   "La vista muestra mucha informacion pero no les dice nada, se requiere que
 *    la vista sea toda la informacion junta de forma horizontal y no vertical,
 *    donde ellos vean todo del socio muy parecido a la vista del sistema
 *    actual y no tener que desplazarse tanto de forma vertical."
 *
 * Esto es SOLO presentacion: no calcula ni cobra nada. El estado, el paquete y
 * el registro del cobro siguen viviendo en ColectaPage, que es la unica que
 * escribe. Por eso las dos disposiciones no pueden divergir en lo que cobran:
 * comparten la misma logica y solo cambian de sitio las cosas.
 *
 * Lo que se respeta de la pantalla vieja, porque cada cosa salio en las
 * observaciones:
 *
 *   - Las cuatro tablas a la vez en rejilla 2x2, sin desplegables.
 *   - El REVERSO arriba, junto a Buscar ("ese reverso esta escondido").
 *   - `Adic:` en la fila de ahorro: un monto libre, que no depende de las
 *     semanas ("permitir que sea 0 semanas y permita escribir el monto").
 *   - La fila fija con Semana Cobro, Ano Cobro y Ult_sem siempre a la vista
 *     ("quieren que se vea siempre la semana en la que van").
 *   - Ahorros a la Vista NO lleva columna de dolares: es un producto en
 *     bolivares, igual que en el sistema actual.
 */

import { Printer, RotateCcw, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type {
  AsambleaOpcion,
  Cobrable,
  PaqueteSemanal,
  ResumenServicio,
  SocioColecta,
} from '../../services/colectaService'

interface Props {
  termino: string
  onTermino: (v: string) => void
  onBuscar: () => void
  buscando: boolean
  socio: SocioColecta | null

  semanas: number
  onSemanas: (n: number) => void
  semanaCobro: number
  anoCobro: number
  ultimaSemanaTexto: string

  referencia: string
  onReferencia: (v: string) => void
  asambleas: AsambleaOpcion[]
  asambleaId: number | ''
  /** Asamblea marcada y si fue (Sí) o no (No) */
  onAsamblea: (id: number | '', asistio?: boolean) => void
  asistioAsamblea: boolean

  adicionalAhorro: string
  onAdicionalAhorro: (v: string) => void

  paquete: PaqueteSemanal | null
  tasa: number | null
  totalUsd: number

  /** Lleva a los movimientos del dia, que es donde se reversa */
  onReverso: () => void
  onCobrar: () => void
  cobrando: boolean
  puedeCobrar: boolean
}

const money = (v: number | null | undefined, d = 2): string =>
  (v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d })

const dia = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''

/** Encabezado de tabla en el estilo denso de la pantalla vieja */
const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`border-b border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 ${
      right ? 'text-right' : 'text-left'
    }`}
  >
    {children}
  </th>
)

const Td = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-2 py-1 text-xs text-neutral-800 ${right ? 'text-right tabular-nums' : ''}`}>
    {children}
  </td>
)

/** Un panel con su titulo centrado encima, como los del sistema actual */
const Panel = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex min-h-0 flex-col">
    <p className="mb-1 text-center text-sm font-bold text-neutral-800">{titulo}</p>
    <div className="min-h-[9rem] overflow-auto rounded border border-neutral-300 bg-white">
      {children}
    </div>
  </div>
)

const Vacio = ({ columnas }: { columnas: number }) => (
  <tr>
    <td colSpan={columnas} className="px-2 py-6 text-center text-xs text-neutral-400">
      Sin registros
    </td>
  </tr>
)

/** Campo corto y rotulado, como los de la fila de totales */
const Campo = ({
  rotulo,
  children,
}: {
  rotulo: string
  children: React.ReactNode
}) => (
  <label className="flex items-center gap-1.5 text-sm text-neutral-700">
    <span className="whitespace-nowrap font-medium">{rotulo}</span>
    {children}
  </label>
)

const soloLectura =
  'w-24 rounded border border-neutral-300 bg-neutral-100 px-2 py-1 text-right text-sm tabular-nums text-neutral-700'

export const ColectaClasica = ({
  termino, onTermino, onBuscar, buscando, socio,
  semanas, onSemanas, semanaCobro, anoCobro, ultimaSemanaTexto,
  referencia, onReferencia, asambleas, asambleaId, onAsamblea, asistioAsamblea,
  adicionalAhorro, onAdicionalAhorro,
  paquete, tasa, totalUsd,
  onReverso, onCobrar, cobrando, puedeCobrar,
}: Props) => {
  const ahorros = socio?.cuentas_ahorro ?? []
  const prestamos = socio?.prestamos ?? []
  const servicios = socio?.servicios ?? []
  const funeraria = servicios.filter((s) => s.servicio === 'funeraria')
  const salud = servicios.filter((s) => s.servicio === 'salud')

  // Los movimientos de la libreta van todos juntos, como en la pantalla vieja:
  // alli la tabla es de la LIBRETA del socio, no de una cuenta en concreto
  const movimientos = ahorros.flatMap((c) =>
    (c.movimientos_recientes ?? []).map((m) => ({ ...m, cuenta: c }))
  )

  const subtotalDe = (tipo: string): number =>
    (paquete?.renglones ?? [])
      .filter((r) => r.servicio === tipo)
      .reduce((t, r) => t + r.monto_usd, 0)

  const adicional = Number(adicionalAhorro) || 0

  // Sí/No sobre la última asamblea ya hecha. Confirmado el 23/10: son en
  // marzo, así que antes de marzo el servidor manda las del año anterior y
  // desde marzo las del año en curso. Ir a cualquier fecha del año cuenta; el
  // "No" se guarda como inasistencia en su historial.
  const asamblea = asambleas[0] ?? null
  const asistida = asambleas.find((a) => socio?.asambleas_asistidas.includes(a.id)) ?? null
  const yaAsistio = asistida !== null
  const yaMarcadoNo = !!asamblea && !!socio?.asambleas_no_asistidas?.includes(asamblea.id)
  const valorAsamblea = yaAsistio ? 'si' : asambleaId === '' ? '' : asistioAsamblea ? 'si' : 'no'

  return (
    <div className="space-y-3">
      {/* ---- Barra de busqueda y acciones ----
          El nombre del socio a la izquierda y grande; los botones a la derecha,
          como en Funeraria y Salud (pedido del 15/10) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex min-w-[18rem] flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-neutral-800">Socio:</span>
          <Input
            value={termino}
            onChange={(e) => onTermino(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onBuscar()
              }
            }}
            placeholder="Expediente, cédula o nombre"
            className="w-full max-w-sm"
          />
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={onBuscar} disabled={buscando}>
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          {/* Siempre visible: en la pantalla nueva estaba dentro de otra
              pestaña, y por eso la cooperativa lo daba por escondido */}
          <Button variant="outline" onClick={onReverso}>
            <RotateCcw className="h-4 w-4" />
            Reverso
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Libreta
          </Button>
        </div>

        {socio && (
          <p className="w-full text-2xl font-bold leading-tight text-neutral-900">
            {socio.apellido}, {socio.nombre}
            <span className="ml-3 align-middle text-base font-semibold text-neutral-500">
              Exp. {socio.codigo_socio} · C.I. {socio.cedula}
            </span>
          </p>
        )}
        {/* Confirmado el 23/10: al retirado por inasistencia se le dice por qué
            cuando viene a hacer cualquier movimiento */}
        {socio?.alertas.socio_retirado && (
          <p className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {/inasistencia/i.test(socio.alertas.motivo_retiro ?? '')
              ? 'Este socio fue retirado por inasistencia a la asamblea. Para volver debe pagar la multa y lo reactiva la administración.'
              : `Este socio está retirado${socio.alertas.motivo_retiro ? ` (${socio.alertas.motivo_retiro})` : ''}.`}
          </p>
        )}
      </div>

      {/* ---- Asamblea y referencia ---- */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <Campo rotulo="Asistió a la Asamblea:">
          <select
            value={valorAsamblea}
            onChange={(e) => {
              const v = e.target.value
              if (!asamblea || v === '') onAsamblea('')
              else onAsamblea(asamblea.id, v === 'si')
            }}
            disabled={!asamblea || yaAsistio}
            className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
          >
            {/* Sin elegir no se guarda nada: así un cobro de rutina no deja un "No" por error */}
            <option value="">—</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
          <span className="text-xs text-neutral-500">
            {!asamblea
              ? 'No hay asamblea registrada este año'
              : asistida
                ? `Ya asistió este año: ${asistida.titulo} · ${new Date(asistida.fecha).toLocaleDateString('es-VE')}`
                : `${asamblea.titulo} · ${new Date(asamblea.fecha).toLocaleDateString('es-VE')}${yaMarcadoNo ? ' (ya consta que no asistió)' : ''}`}
          </span>
        </Campo>
        <Campo rotulo="Referencia:">
          <Input
            value={referencia}
            onChange={(e) => onReferencia(e.target.value)}
            className="w-40"
          />
        </Campo>
      </div>

      {/* ---- Rejilla 2x2: todo el socio a la vez ---- */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel titulo="Ahorros a la Vista">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50">
              <tr>
                <Th>Item</Th>
                <Th>Fecha</Th>
                <Th>Doc</Th>
                <Th>Tipo</Th>
                <Th right>Monto</Th>
                <Th right>Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <Vacio columnas={6} />
              ) : (
                movimientos.map((m) => (
                  <tr key={`${m.cuenta.referencia_id}-${m.id}`} className="odd:bg-neutral-50/60">
                    <Td>{m.item}</Td>
                    <Td>{dia(m.fecha)}</Td>
                    <Td>{m.documento}</Td>
                    <Td>{m.tipo}</Td>
                    {/* Sin columna de dólares: la cuenta a la vista es en bolívares */}
                    <Td right>{money(m.monto_bs)}</Td>
                    <Td right>{money(m.saldo_bs)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

        <Panel titulo="Prestamos">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50">
              <tr>
                <Th>No_prestamo</Th>
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th right>Monto</Th>
                <Th right>Monto$</Th>
                <Th right>Abo$</Th>
                <Th right>Saldo$</Th>
              </tr>
            </thead>
            <tbody>
              {prestamos.length === 0 ? (
                <Vacio columnas={7} />
              ) : (
                prestamos.map((p: Cobrable) => (
                  <tr key={p.referencia_id} className="odd:bg-neutral-50/60">
                    <Td>{p.numero_pagare ?? p.titulo}</Td>
                    <Td>{dia(p.fecha_desembolso)}</Td>
                    <Td>{p.categoria ?? ''}</Td>
                    <Td right>{money(p.monto_original_bs)}</Td>
                    <Td right>{money(p.monto_original_usd)}</Td>
                    <Td right>{money(p.abonado_usd)}</Td>
                    <Td right>{money(p.saldo_usd)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

        <Panel titulo="Funeraria">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50">
              <tr>
                <Th>Acuerdo</Th>
                <Th>Ano</Th>
                <Th>Sem</Th>
                <Th>Fecha</Th>
                <Th>Hasta</Th>
                <Th right>Atraso</Th>
                <Th>Suspendido</Th>
              </tr>
            </thead>
            <tbody>
              {funeraria.length === 0 ? (
                <Vacio columnas={7} />
              ) : (
                funeraria.map((s: ResumenServicio) => (
                  <tr key={s.referencia_id} className="odd:bg-neutral-50/60">
                    <Td>{s.numero_acuerdo ?? s.titulo}</Td>
                    <Td>{s.pagado_hasta?.ano ?? ''}</Td>
                    <Td>{s.pagado_hasta?.semana ?? ''}</Td>
                    <Td>{dia(s.fecha_ultimo_pago)}</Td>
                    <Td>{dia(s.pagado_hasta_fecha)}</Td>
                    <Td right>{s.semanas_pendientes}</Td>
                    <Td>{s.estado === 'suspendido' ? 'Sí' : ''}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

        <Panel titulo="Salud">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50">
              <tr>
                <Th>Opcion</Th>
                <Th>Ano</Th>
                <Th>Sem</Th>
                <Th>Fecha</Th>
                <Th>Hasta</Th>
                <Th right>Atraso</Th>
                <Th>Suspendido</Th>
              </tr>
            </thead>
            <tbody>
              {salud.length === 0 ? (
                <Vacio columnas={7} />
              ) : (
                salud.map((s: ResumenServicio) => (
                  <tr key={s.referencia_id} className="odd:bg-neutral-50/60">
                    <Td>{s.numero_acuerdo ?? s.titulo}</Td>
                    <Td>{s.pagado_hasta?.ano ?? ''}</Td>
                    <Td>{s.pagado_hasta?.semana ?? ''}</Td>
                    <Td>{dia(s.fecha_ultimo_pago)}</Td>
                    <Td>{dia(s.pagado_hasta_fecha)}</Td>
                    <Td right>{s.semanas_pendientes}</Td>
                    <Td>{s.estado === 'suspendido' ? 'Sí' : ''}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* ---- Fila fija del periodo: la semana en curso siempre a la vista ---- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
        <Campo rotulo="Semanas a Cobrar:">
          <Input
            type="number"
            min={0}
            value={semanas}
            onChange={(e) => onSemanas(Math.max(0, Number(e.target.value) || 0))}
            className="w-20"
          />
        </Campo>
        <Campo rotulo="Semana Cobro:">
          <input readOnly value={semanaCobro} className={soloLectura} />
        </Campo>
        <Campo rotulo="Ano Cobro:">
          <input readOnly value={anoCobro} className={soloLectura} />
        </Campo>
        <Campo rotulo="Ult_sem:">
          <input readOnly value={ultimaSemanaTexto} className={`${soloLectura} w-28`} />
        </Campo>
        <Campo rotulo="Atraso:">
          <input readOnly value={socio?.atraso ?? 0} className={`${soloLectura} w-16`} />
        </Campo>
        <Campo rotulo="Suspendido:">
          <input readOnly value={socio?.suspendido ?? 0} className={`${soloLectura} w-16`} />
        </Campo>
      </div>

      {/* ---- Totales por concepto ---- */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-3">
        <table className="w-full min-w-[40rem] border-collapse">
          <thead>
            <tr>
              <Th> </Th>
              <Th> </Th>
              <Th right>sub-total</Th>
              <Th right>Totales</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>
                <span className="font-semibold">Ahorro:</span>
              </Td>
              <Td>
                {/* El monto libre de ahorro: no depende de las semanas, puede ir
                    con 0 semanas a cobrar */}
                <Campo rotulo="Adic:">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={adicionalAhorro}
                    onChange={(e) => onAdicionalAhorro(e.target.value)}
                    className="w-28"
                  />
                </Campo>
              </Td>
              <Td right>{money(subtotalDe('ahorro'))}</Td>
              <Td right>{money(subtotalDe('ahorro') + adicional)}</Td>
            </tr>
            <tr>
              <Td>
                <span className="font-semibold">Funeraria:</span>
              </Td>
              <Td>
                <span className="text-xs text-neutral-500">
                  Cant: {socio?.cantidad_funeraria ?? 0}
                </span>
              </Td>
              <Td right>{money(subtotalDe('funeraria'))}</Td>
              <Td right>{money(subtotalDe('funeraria'))}</Td>
            </tr>
            <tr>
              <Td>
                <span className="font-semibold">Salud:</span>
              </Td>
              <Td>
                <span className="text-xs text-neutral-500">Cant: {socio?.cantidad_salud ?? 0}</span>
              </Td>
              <Td right>{money(subtotalDe('salud'))}</Td>
              <Td right>{money(subtotalDe('salud'))}</Td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- Total y envio ---- */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        {/* Bolívares primero, grandes y en negrita; los dólares al lado, más
            chicos y en verde (pedido del 15/10) */}
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-lg font-bold text-neutral-900">Total a Cobrar:</span>
          {tasa ? (
            <>
              <span className="text-3xl font-extrabold text-neutral-900 tabular-nums">
                Bs {money(totalUsd * tasa)}
              </span>
              <span className="text-base font-semibold text-emerald-600 tabular-nums">
                ${money(totalUsd)}
              </span>
            </>
          ) : (
            <span className="text-3xl font-extrabold text-emerald-600 tabular-nums">
              ${money(totalUsd)}
            </span>
          )}
        </div>
        <Button onClick={onCobrar} disabled={!puedeCobrar || totalUsd <= 0 || cobrando}>
          {cobrando ? 'Registrando...' : 'Enviar'}
        </Button>
      </div>
    </div>
  )
}
