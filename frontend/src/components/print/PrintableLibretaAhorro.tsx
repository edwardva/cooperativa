/**
 * ============================================
 * IMPRESION: libreta de ahorro
 * ============================================
 *
 * "Act. Libreta" y "Enc. Libreta" de Colecta Global en el sistema actual
 * (rep_act_lib.php y rep_enc_lib.php). Una fila por movimiento con el ahorro,
 * la funeraria y la salud del mismo cobro, todo en bolivares. Las libretas
 * nuevas traen el encabezado de las columnas impreso de fabrica, asi que aqui
 * solo van los datos (pedido del 03/11).
 *
 * La hoja es la libreta misma (26/11): abierta mide 18 x 12 cm. Los movimientos
 * van a lo largo de las dos caras (18 cm de ancho) y caben 17 por hoja, con el
 * Id de 1 a 17 en cada una, como en el sistema actual. El encabezado del socio
 * se imprime con la libreta parada (12 cm de ancho), en la cara de abajo.
 *
 * Ahorro en divisas (26/11) tiene su propia libreta: "Actualizar Libreta" y
 * "Encabezado Libreta" de Movimientos de Ahorro (rep_act_lib_aho.php y
 * rep_enc_lib_aho.php). Va en dolares, con la libreta parada (12 x 18 cm) y
 * siguiendo las columnas de fabrica: Id, Fecha, Tipo, Deposito, Retiro y
 * Saldo, en letra de 9 pt. Caben 14 renglones en la cara de arriba y 13 en la
 * de abajo, con dos lineas en blanco por el lomo; el Id no vuelve a 1.
 *
 * Las posiciones salen del PDF del sistema actual (letra de 8 pt, 14,17 pt
 * entre lineas), medidas desde la esquina de arriba a la izquierda: la libreta
 * entraba alli en la hoja vieja, asi que cae en el mismo sitio. Si no cuadra,
 * se ajusta en HOJA_LIBRETA (libretaComun), GEOMETRIA y COLUMNAS, nada mas.
 *
 * Mismo patron que PrintableReciboAhorro: portal a <body> y la clase
 * "print-portal-active" para que globals.css oculte #root al imprimir.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MarcoVistaPrevia } from './MarcoVistaPrevia'
import type { LibretaAhorro } from '../../services/colectaService'
import {
  HOJA_LIBRETA as HOJA,
  TextoLibreta as Texto,
  estilosHojaLibreta,
  fechaLibreta as fecha,
  fechaMovimientoLibreta as fechaMovimiento,
  montoLibreta as monto,
} from './libretaComun'

/** Todo en puntos (pt), desde la esquina de arriba a la izquierda */
const GEOMETRIA = {
  /**
   * Linea base de la fila 1. La linea de antes (37,84 pt) es la de los
   * titulos de columna, que en las libretas nuevas ya vienen impresos.
   */
  primeraFila: 792 - 739.99,
  paso: 14.17,
  /** Renglones por hoja de la libreta (Id 1 a 17) */
  filasPorHoja: 17,
  letra: 8,
  /** Encabezado del socio ("Enc. Libreta") */
  encabezado: { x: 31.19, primeraLinea: 792 - 469.5, letra: 12 },
}

type Renglon = LibretaAhorro['renglones'][number]

/** `x` es el borde izquierdo (texto) o el derecho (montos), como las celdas del PDF viejo */
type Columna = { x: number; alinear: 'izq' | 'der'; valor: (r: Renglon) => string }

/** Libreta de Ahorro en divisas */
const DIVISAS = {
  letra: 9,
  paso: 14.17,
  /** Linea base de la fila 1, en la cara de arriba */
  primeraFila: 792 - 734.02,
  /** Linea base de la fila 15, ya pasado el lomo */
  primeraFilaAbajo: 792 - 507.25,
  filasArriba: 14,
  filasPorHoja: 27,
  // El encabezado va en el mismo sitio que el de bolivares, pero en Courier
}

/** Linea base del renglon `i` (0 a 26) de la hoja de divisas */
const baseDivisas = (i: number): number =>
  i < DIVISAS.filasArriba
    ? DIVISAS.primeraFila + i * DIVISAS.paso
    : DIVISAS.primeraFilaAbajo + (i - DIVISAS.filasArriba) * DIVISAS.paso

const COLUMNAS_DIVISAS: Columna[] = [
  { x: 31.19, alinear: 'izq', valor: (r) => String(r.item) },
  { x: 59.53, alinear: 'izq', valor: (r) => fechaMovimiento(r.fecha) },
  { x: 116.22, alinear: 'izq', valor: (r) => r.tipo },
  { x: 181.42, alinear: 'der', valor: (r) => monto(r.es_salida ? 0 : Math.abs(r.ahorro_usd)) },
  { x: 223.94, alinear: 'der', valor: (r) => monto(r.es_salida ? Math.abs(r.ahorro_usd) : 0) },
  { x: 266.46, alinear: 'der', valor: (r) => monto(r.saldo_usd) },
]

/** Suspension como en la libreta vieja: 0 si quedo activo, dd-mm-aaaa si no */
const suspension = (r: Renglon, v: string | null): string =>
  r.funeraria_bs === null && r.salud_bs === null ? '' : v ? fecha(v).replace(/\//g, '-') : '0'

/**
 * Columnas: `x` es el borde izquierdo (texto) o el derecho (montos), igual
 * que las celdas del PDF viejo.
 */
const COLUMNAS: Columna[] = [
  // Id dentro de la hoja: vuelve a 1 en cada hoja de la libreta
  { x: 45.36, alinear: 'izq', valor: (r) => String(((r.item - 1) % GEOMETRIA.filasPorHoja) + 1) },
  { x: 56.7, alinear: 'izq', valor: (r) => fechaMovimiento(r.fecha) },
  { x: 113.39, alinear: 'izq', valor: (r) => r.tipo },
  { x: 178.59, alinear: 'der', valor: (r) => monto(r.ahorro_bs) },
  { x: 221.1, alinear: 'der', valor: (r) => monto(r.saldo_bs) },
  { x: 226.78, alinear: 'izq', valor: (r) => (r.semana ? String(r.semana).padStart(2, '0') : '') },
  { x: 289.14, alinear: 'der', valor: (r) => (r.funeraria_bs === null ? '' : monto(r.funeraria_bs)) },
  { x: 331.66, alinear: 'der', valor: (r) => (r.salud_bs === null ? '' : monto(r.salud_bs)) },
  { x: 385.5, alinear: 'der', valor: (r) => (r.hasta ? fecha(r.hasta) : '') },
  { x: 433.71, alinear: 'der', valor: (r) => suspension(r, r.susp_funeraria) },
  { x: 476.23, alinear: 'der', valor: (r) => suspension(r, r.susp_salud) },
]

interface Props {
  libreta: LibretaAhorro
  /** movimientos: "Act. Libreta"; encabezado: "Enc. Libreta" */
  modo: 'movimientos' | 'encabezado'
  /** Muestra la hoja en pantalla con Imprimir y Cerrar antes de imprimir (16/11) */
  vistaPrevia?: boolean
  onCerrarVistaPrevia?: () => void
}

export const PrintableLibretaAhorro = ({ libreta, modo, vistaPrevia = false, onCerrarVistaPrevia }: Props) => {
  useEffect(() => {
    document.body.classList.add('print-portal-active')
    return () => document.body.classList.remove('print-portal-active')
  }, [])

  const e = libreta.encabezado
  const divisas = e.moneda === 'usd'

  // Todo el historial desde el primer movimiento, partido en hojas
  const filasPorHoja = divisas ? DIVISAS.filasPorHoja : GEOMETRIA.filasPorHoja
  const paginas: Renglon[][] = []
  for (let i = 0; i < libreta.renglones.length; i += filasPorHoja) {
    paginas.push(libreta.renglones.slice(i, i + filasPorHoja))
  }
  if (paginas.length === 0) paginas.push([])

  // La de divisas va siempre con la libreta parada
  const hoja = divisas ? HOJA.encabezado : HOJA[modo]
  const columnas = divisas ? COLUMNAS_DIVISAS : COLUMNAS
  const letra = divisas ? DIVISAS.letra : GEOMETRIA.letra
  const baseFila = (i: number): number =>
    divisas ? baseDivisas(i) : GEOMETRIA.primeraFila + i * GEOMETRIA.paso

  // Los dos encabezados del sistema actual se escriben distinto
  const lineasEncabezado = divisas
    ? [
        `Socio No:${e.socio}`,
        `Cuenta_No:${e.cuenta}`,
        `Fecha_Ing:${fecha(e.fecha_apertura)}`,
        `Apellidos:${e.apellidos}`,
        `Nombres:${e.nombres}`,
        `Cedula:${e.cedula}`,
      ]
    : [
        `Socio No:${e.socio}`,
        `Cuenta No:${e.cuenta}`,
        `Fecha Ing.${fecha(e.fecha_ingreso)}`,
        `Apellidos:${e.apellidos}`,
        `Nombres:${e.nombres}`,
        `Cedula:${e.cedula}`,
      ]

  return createPortal(
    <div className={`libreta-print-host${vistaPrevia ? ' en-vista-previa' : ''}`}>
      <MarcoVistaPrevia
        activa={vistaPrevia}
        titulo={`Libreta${divisas ? ' de divisas' : ''}: ${modo === 'encabezado' ? 'encabezado' : 'movimientos'}`}
        onCerrar={onCerrarVistaPrevia}
        anchoHoja={`calc(${hoja.ancho}pt + 64px)`}
      >
      <style>{estilosHojaLibreta(hoja)}</style>

      {modo === 'encabezado' ? (
        <div className="libreta-hoja">
          {lineasEncabezado.map((texto, i) => (
            <Texto
              key={i}
              x={GEOMETRIA.encabezado.x}
              base={GEOMETRIA.encabezado.primeraLinea + i * GEOMETRIA.paso}
              letra={GEOMETRIA.encabezado.letra}
              anchoHoja={hoja.ancho}
              monoespaciada={divisas}
            >
              {texto}
            </Texto>
          ))}
        </div>
      ) : (
        paginas.map((filas, p) => (
          <div key={p} className="libreta-hoja">
            {filas.map((r, i) =>
              columnas.map((c, j) => {
                const valor = c.valor(r)
                return valor ? (
                  <Texto
                    key={`${i}-${j}`}
                    x={c.x}
                    base={baseFila(i)}
                    letra={letra}
                    alinear={c.alinear}
                    anchoHoja={hoja.ancho}
                  >
                    {valor}
                  </Texto>
                ) : null
              })
            )}
          </div>
        ))
      )}
      </MarcoVistaPrevia>
    </div>,
    document.body
  )
}
