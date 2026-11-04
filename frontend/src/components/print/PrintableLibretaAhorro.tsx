/**
 * ============================================
 * IMPRESION: libreta de ahorro
 * ============================================
 *
 * "Act. Libreta" y "Enc. Libreta" de Colecta Global en el sistema actual
 * (rep_act_lib.php y rep_enc_lib.php). Se imprime en HORIZONTAL: una fila por
 * movimiento, de izquierda a derecha. Las libretas nuevas traen el encabezado
 * de las columnas impreso de fabrica, tambien en horizontal, asi que aqui solo
 * van los datos (pedido del 03/11).
 *
 * Las medidas salen del PDF del sistema actual (hoja de 650 x 792 pt, letra de
 * 8 pt, 14,17 pt entre lineas) para que caiga en el mismo sitio de la libreta.
 * Si la libreta nueva no cuadra, se ajusta en GEOMETRIA y en COLUMNAS, nada mas.
 *
 * Mismo patron que PrintableReciboAhorro: portal a <body> y la clase
 * "print-portal-active" para que globals.css oculte #root al imprimir.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { LibretaAhorro } from '../../services/colectaService'

/** Todo en puntos (pt), como el PDF del sistema actual */
const GEOMETRIA = {
  ancho: 650,
  alto: 792,
  /** Linea base de la primera fila de movimientos, medida desde arriba */
  primeraFila: 792 - 739.99,
  paso: 14.17,
  filasPorPagina: 41,
  letra: 8,
  /** Encabezado del socio ("Enc. Libreta") */
  encabezado: { x: 31.19, primeraLinea: 792 - 469.5, letra: 12 },
}

type Renglon = LibretaAhorro['renglones'][number]

/**
 * Columnas: `x` es el borde izquierdo (texto) o el derecho (montos), igual
 * que las celdas del PDF viejo.
 */
const COLUMNAS: { x: number; alinear: 'izq' | 'der'; valor: (r: Renglon) => string }[] = [
  { x: 45.36, alinear: 'izq', valor: (r) => String(r.item) },
  { x: 56.7, alinear: 'izq', valor: (r) => fechaMovimiento(r.fecha) },
  { x: 113.39, alinear: 'izq', valor: (r) => r.tipo },
  { x: 178.59, alinear: 'der', valor: (r) => monto(r.ahorro_bs) },
  { x: 221.1, alinear: 'der', valor: (r) => monto(r.saldo_bs) },
  { x: 226.78, alinear: 'izq', valor: (r) => (r.semana ? String(r.semana).padStart(2, '0') : '') },
  { x: 289.14, alinear: 'der', valor: (r) => (r.funeraria_bs === null ? '' : monto(r.funeraria_bs)) },
  { x: 331.66, alinear: 'der', valor: (r) => (r.salud_bs === null ? '' : monto(r.salud_bs)) },
  { x: 385.5, alinear: 'der', valor: (r) => (r.hasta ? fecha(r.hasta) : '') },
]

/** Montos como en la libreta vieja: 1,179.25 */
const monto = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** dd/mm/aaaa de una fecha sin hora (hasta, ingreso): tal cual, sin zona horaria */
const fecha = (v: string | null): string => {
  if (!v) return ''
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** dd/mm/aaaa de un movimiento, en hora de Venezuela (a las 21:00 en UTC ya es otro dia) */
const fechaMovimiento = (v: string): string =>
  new Date(v).toLocaleDateString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

interface Props {
  libreta: LibretaAhorro
  /** movimientos: "Act. Libreta"; encabezado: "Enc. Libreta" */
  modo: 'movimientos' | 'encabezado'
}

/** Texto colocado en su punto exacto de la hoja */
const Texto = ({
  x,
  base,
  letra,
  alinear = 'izq',
  children,
}: {
  x: number
  base: number
  letra: number
  alinear?: 'izq' | 'der'
  children: string
}) => (
  <span
    style={{
      position: 'absolute',
      // La linea base va a `base`: se sube el alto de la letra
      top: `${base - letra}pt`,
      ...(alinear === 'izq' ? { left: `${x}pt` } : { right: `${GEOMETRIA.ancho - x}pt` }),
      fontSize: `${letra}pt`,
      lineHeight: `${letra}pt`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
)

export const PrintableLibretaAhorro = ({ libreta, modo }: Props) => {
  useEffect(() => {
    document.body.classList.add('print-portal-active')
    return () => document.body.classList.remove('print-portal-active')
  }, [])

  // Todo el historial desde el primer movimiento, partido en hojas
  const paginas: Renglon[][] = []
  for (let i = 0; i < libreta.renglones.length; i += GEOMETRIA.filasPorPagina) {
    paginas.push(libreta.renglones.slice(i, i + GEOMETRIA.filasPorPagina))
  }
  if (paginas.length === 0) paginas.push([])

  const e = libreta.encabezado
  const lineasEncabezado = [
    `Socio No:${e.socio}`,
    `Cuenta No:${e.cuenta}`,
    `Fecha Ing.${fecha(e.fecha_ingreso)}`,
    `Apellidos:${e.apellidos}`,
    `Nombres:${e.nombres}`,
    `Cedula:${e.cedula}`,
  ]

  return createPortal(
    <div className="libreta-print-host">
      <style>{`
        @media screen {
          .libreta-print-host { display: none; }
        }
        @media print {
          @page { size: ${GEOMETRIA.ancho}pt ${GEOMETRIA.alto}pt; margin: 0; }
          body > *:not(.libreta-print-host) { display: none !important; }
          .libreta-print-host {
            display: block;
            color: #000;
            background: #fff;
            font-family: Helvetica, Arial, sans-serif;
          }
          .libreta-hoja {
            position: relative;
            width: ${GEOMETRIA.ancho}pt;
            height: ${GEOMETRIA.alto}pt;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .libreta-hoja:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {modo === 'encabezado' ? (
        <div className="libreta-hoja">
          {lineasEncabezado.map((texto, i) => (
            <Texto
              key={i}
              x={GEOMETRIA.encabezado.x}
              base={GEOMETRIA.encabezado.primeraLinea + i * GEOMETRIA.paso}
              letra={GEOMETRIA.encabezado.letra}
            >
              {texto}
            </Texto>
          ))}
        </div>
      ) : (
        paginas.map((filas, p) => (
          <div key={p} className="libreta-hoja">
            {filas.map((r, i) =>
              COLUMNAS.map((c, j) => {
                const valor = c.valor(r)
                return valor ? (
                  <Texto
                    key={`${i}-${j}`}
                    x={c.x}
                    base={GEOMETRIA.primeraFila + i * GEOMETRIA.paso}
                    letra={GEOMETRIA.letra}
                    alinear={c.alinear}
                  >
                    {valor}
                  </Texto>
                ) : null
              })
            )}
          </div>
        ))
      )}
    </div>,
    document.body
  )
}
