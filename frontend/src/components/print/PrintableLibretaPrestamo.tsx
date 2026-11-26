/**
 * ============================================
 * IMPRESION: libreta del prestamo
 * ============================================
 *
 * "Actualizar Libreta" y "Encabezado Libreta" del cobro de prestamos en el
 * sistema actual (colecta/prestamos/rep_act_lib_pre.php y rep_enc_lib_pre.php).
 * Una fila por abono, en bolivares y en dolares:
 *
 *   Numero  Id  Cuota  Fecha  Monto  Monto$  Abono  Abono$  Int  Int$  Saldo  Saldo$
 *
 * - La fila 0 es la entrega: Monto y Saldo son lo financiado (sin la inicial).
 * - Abono es lo que fue a capital; Int, el interes (y la mora, si hubo).
 * - Saldo$ es el capital que queda. Saldo en Bs va restando el abono en Bs
 *   desde lo entregado, como en la libreta vieja (no se recalcula a la tasa).
 * - Los abonos reversados no salen.
 *
 * Misma hoja que la de ahorro: la libreta abierta, 18 x 12 cm. Los titulos de
 * columna salen en la primera hoja, como en la libreta vieja; caben 16 filas
 * (la 0 y las cuotas 1 a 15) y la siguiente hoja sigue desde arriba.
 *
 * Las posiciones salen del PDF del sistema actual (letra de 8 pt, 14,17 pt
 * entre lineas). Si no cuadra, se ajusta en HOJA_LIBRETA (libretaComun),
 * GEOMETRIA y COLUMNAS, nada mas.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MarcoVistaPrevia } from './MarcoVistaPrevia'
import type { PrestamoDetalle } from '../../services/prestamosService'
import {
  HOJA_LIBRETA,
  TextoLibreta,
  estilosHojaLibreta,
  fechaLibreta,
  fechaMovimientoLibreta,
  montoLibreta,
} from './libretaComun'

/** Todo en puntos (pt), desde la esquina de arriba a la izquierda */
const GEOMETRIA = {
  /** Linea base de los titulos de columna */
  titulos: 792 - 745.66,
  /** Linea base de la fila 0 (la entrega) */
  primeraFila: 792 - 731.49,
  paso: 14.17,
  filasPorHoja: 16,
  letra: 8,
  /** Encabezado del socio ("Encabezado Libreta"): letra de 14 pt */
  encabezado: { x: 31.19, primeraLinea: 792 - 409.37, paso: 19.84, letra: 14 },
}

interface Renglon {
  numero: string
  item: number
  fecha: string
  monto_bs: number
  monto_usd: number
  abono_bs: number
  abono_usd: number
  interes_bs: number
  interes_usd: number
  saldo_bs: number
  saldo_usd: number
}

/** Titulos de columna: borde izquierdo de cada uno */
const TITULOS: [number, string][] = [
  [45.36, 'Numero'],
  [107.72, 'Fecha'],
  [167.69, 'Monto'],
  [205.76, 'Monto$'],
  [243.33, 'Abono'],
  [272.9, 'Abono$'],
  [319.93, 'Int'],
  [343.82, 'Int$'],
  [379.23, 'Saldo'],
  [421.75, 'Saldo'],
]

/** `x`: borde izquierdo (texto) o derecho (montos), como las celdas del PDF viejo */
const COLUMNAS: { x: number; alinear: 'izq' | 'der'; valor: (r: Renglon) => string }[] = [
  { x: 45.36, alinear: 'izq', valor: (r) => r.numero },
  // Id y cuota: el sistema actual repite el mismo correlativo
  { x: 79.37, alinear: 'izq', valor: (r) => String(r.item) },
  { x: 93.55, alinear: 'izq', valor: (r) => String(r.item) },
  { x: 107.72, alinear: 'izq', valor: (r) => r.fecha },
  { x: 189.92, alinear: 'der', valor: (r) => montoLibreta(r.monto_bs) },
  { x: 232.44, alinear: 'der', valor: (r) => montoLibreta(r.monto_usd) },
  { x: 266.46, alinear: 'der', valor: (r) => montoLibreta(r.abono_bs) },
  { x: 300.48, alinear: 'der', valor: (r) => montoLibreta(r.abono_usd) },
  { x: 328.83, alinear: 'der', valor: (r) => montoLibreta(r.interes_bs) },
  { x: 357.17, alinear: 'der', valor: (r) => montoLibreta(r.interes_usd) },
  { x: 399.69, alinear: 'der', valor: (r) => montoLibreta(r.saldo_bs) },
  { x: 442.2, alinear: 'der', valor: (r) => montoLibreta(r.saldo_usd) },
]

const n = (v: string | number | null | undefined): number => Number(v ?? 0)
const redondear = (v: number): number => Math.round(v * 100) / 100

/**
 * El numero cabe en 34 pt antes del Id. Los migrados traen el del sistema
 * actual (080366); los nuevos (PR-2026-00001) no caben y va el correlativo.
 */
const numeroCorto = (numero: string): string =>
  numero.length <= 7 ? numero : (numero.split('-').pop() ?? numero)

/** Las filas de la libreta: la entrega y despues cada abono vigente */
export const renglonesLibretaPrestamo = (p: PrestamoDetalle): Renglon[] => {
  const numero = numeroCorto(p.numero_prestamo)
  const financiadoUsd = redondear(n(p.monto_original_usd) - n(p.inicial_usd))
  const financiadoBs = redondear(financiadoUsd * n(p.tasa_cambio_inicial))

  const renglones: Renglon[] = [
    {
      numero,
      item: 0,
      fecha: fechaLibreta(p.fecha_desembolso),
      monto_bs: financiadoBs,
      monto_usd: financiadoUsd,
      abono_bs: 0,
      abono_usd: 0,
      interes_bs: 0,
      interes_usd: 0,
      saldo_bs: financiadoBs,
      saldo_usd: financiadoUsd,
    },
  ]

  let saldoBs = financiadoBs
  let saldoUsd = financiadoUsd
  const abonos = p.abonos
    .filter((a) => !a.reversado)
    .sort((a, b) => new Date(a.fecha_abono).getTime() - new Date(b.fecha_abono).getTime() || a.id - b.id)
  abonos.forEach((a, i) => {
    const abonoBs = n(a.aplicado_capital_bs)
    const abonoUsd = n(a.aplicado_capital_usd)
    saldoBs = redondear(saldoBs - abonoBs)
    saldoUsd = redondear(saldoUsd - abonoUsd)
    renglones.push({
      numero,
      item: i + 1,
      fecha: fechaMovimientoLibreta(a.fecha_abono),
      monto_bs: 0,
      monto_usd: 0,
      abono_bs: abonoBs,
      abono_usd: abonoUsd,
      interes_bs: redondear(n(a.aplicado_interes_bs) + n(a.aplicado_mora_bs)),
      interes_usd: redondear(n(a.aplicado_interes_usd) + n(a.aplicado_mora_usd)),
      saldo_bs: Math.max(saldoBs, 0),
      saldo_usd: Math.max(saldoUsd, 0),
    })
  })
  return renglones
}

interface Props {
  prestamo: PrestamoDetalle
  /** movimientos: "Actualizar Libreta"; encabezado: "Encabezado Libreta" */
  modo: 'movimientos' | 'encabezado'
  vistaPrevia?: boolean
  onCerrarVistaPrevia?: () => void
}

export const PrintableLibretaPrestamo = ({ prestamo, modo, vistaPrevia = false, onCerrarVistaPrevia }: Props) => {
  useEffect(() => {
    document.body.classList.add('print-portal-active')
    return () => document.body.classList.remove('print-portal-active')
  }, [])

  const hoja = HOJA_LIBRETA[modo]
  const renglones = renglonesLibretaPrestamo(prestamo)
  const paginas: Renglon[][] = []
  for (let i = 0; i < renglones.length; i += GEOMETRIA.filasPorHoja) {
    paginas.push(renglones.slice(i, i + GEOMETRIA.filasPorHoja))
  }

  const s = prestamo.socio
  const lineasEncabezado = [
    `Asociado:${s.codigo_socio}`,
    `Fecha_Ing:${fechaLibreta(s.fecha_inscripcion ?? null)}`,
    `Apellidos:${s.apellido.toUpperCase()}`,
    `Nombres:${s.nombre.toUpperCase()}`,
    `Cedula:${s.cedula}`,
  ]

  return createPortal(
    <div className={`libreta-print-host${vistaPrevia ? ' en-vista-previa' : ''}`}>
      <MarcoVistaPrevia
        activa={vistaPrevia}
        titulo={`Libreta del préstamo ${prestamo.numero_prestamo}: ${modo === 'encabezado' ? 'encabezado' : 'movimientos'}`}
        onCerrar={onCerrarVistaPrevia}
        anchoHoja={`calc(${hoja.ancho}pt + 64px)`}
      >
        <style>{estilosHojaLibreta(hoja)}</style>

        {modo === 'encabezado' ? (
          <div className="libreta-hoja">
            {lineasEncabezado.map((texto, i) => (
              <TextoLibreta
                key={i}
                x={GEOMETRIA.encabezado.x}
                base={GEOMETRIA.encabezado.primeraLinea + i * GEOMETRIA.encabezado.paso}
                letra={GEOMETRIA.encabezado.letra}
                anchoHoja={hoja.ancho}
              >
                {texto}
              </TextoLibreta>
            ))}
          </div>
        ) : (
          paginas.map((filas, p) => (
            <div key={p} className="libreta-hoja">
              {p === 0 &&
                TITULOS.map(([x, titulo]) => (
                  <TextoLibreta
                    key={`t-${x}`}
                    x={x}
                    base={GEOMETRIA.titulos}
                    letra={GEOMETRIA.letra}
                    anchoHoja={hoja.ancho}
                  >
                    {titulo}
                  </TextoLibreta>
                ))}
              {filas.map((r, i) =>
                COLUMNAS.map((c, j) => (
                  <TextoLibreta
                    key={`${i}-${j}`}
                    x={c.x}
                    base={GEOMETRIA.primeraFila + i * GEOMETRIA.paso}
                    letra={GEOMETRIA.letra}
                    alinear={c.alinear}
                    anchoHoja={hoja.ancho}
                  >
                    {c.valor(r)}
                  </TextoLibreta>
                ))
              )}
            </div>
          ))
        )}
      </MarcoVistaPrevia>
    </div>,
    document.body
  )
}
