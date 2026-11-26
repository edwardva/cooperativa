/**
 * Lo comun a las libretas que se imprimen (ahorro y prestamo): la medida de la
 * libreta, el texto colocado en su punto exacto y los formatos de la libreta
 * vieja. Las posiciones de cada libreta salen del PDF del sistema actual,
 * medidas desde la esquina de arriba a la izquierda.
 */

/** 1 mm en puntos */
const MM = 72 / 25.4

/** Medida de la libreta abierta, en pt (26/11: la hoja es la libreta misma) */
export const HOJA_LIBRETA = {
  /** Movimientos: libreta acostada, las dos caras de izquierda a derecha */
  movimientos: { ancho: 180 * MM, alto: 120 * MM },
  /** Encabezado: libreta parada, el lomo en horizontal */
  encabezado: { ancho: 120 * MM, alto: 180 * MM },
}

/** Montos como en la libreta vieja: 1,179.25 */
export const montoLibreta = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** dd/mm/aaaa de una fecha sin hora (hasta, ingreso): tal cual, sin zona horaria */
export const fechaLibreta = (v: string | null): string => {
  if (!v) return ''
  const [a, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** dd/mm/aaaa de un movimiento, en hora de Venezuela (a las 21:00 en UTC ya es otro dia) */
export const fechaMovimientoLibreta = (v: string): string =>
  new Date(v).toLocaleDateString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

/**
 * Texto colocado en su punto exacto de la hoja. `x` es el borde izquierdo, o
 * el derecho si se alinea a la derecha (los montos), como las celdas del PDF.
 */
export const TextoLibreta = ({
  x,
  base,
  letra,
  alinear = 'izq',
  anchoHoja,
  monoespaciada = false,
  children,
}: {
  x: number
  /** Linea base, medida desde arriba */
  base: number
  letra: number
  alinear?: 'izq' | 'der'
  anchoHoja: number
  /** Courier: el encabezado de la libreta de divisas */
  monoespaciada?: boolean
  children: string
}) => (
  <span
    style={{
      position: 'absolute',
      // La linea base va a `base`: se sube el alto de la letra
      top: `${base - letra}pt`,
      ...(alinear === 'izq' ? { left: `${x}pt` } : { right: `${anchoHoja - x}pt` }),
      fontSize: `${letra}pt`,
      lineHeight: `${letra}pt`,
      whiteSpace: 'nowrap',
      ...(monoespaciada ? { fontFamily: "'Courier New', Courier, monospace" } : {}),
    }}
  >
    {children}
  </span>
)

/** Estilos de la hoja: en la vista previa con su medida real, y al imprimir una por pagina */
export const estilosHojaLibreta = (hoja: { ancho: number; alto: number }): string => `
  @media screen {
    .libreta-print-host:not(.en-vista-previa) { display: none; }
    .libreta-print-host.en-vista-previa {
      color: #000;
      font-family: Helvetica, Arial, sans-serif;
    }
    .libreta-print-host.en-vista-previa .libreta-hoja {
      position: relative;
      width: ${hoja.ancho}pt;
      height: ${hoja.alto}pt;
      overflow: hidden;
      outline: 1px dashed #d4d4d4;
      margin-bottom: 24px;
    }
  }
  @media print {
    @page { size: ${hoja.ancho}pt ${hoja.alto}pt; margin: 0; }
    body > *:not(.libreta-print-host) { display: none !important; }
    .libreta-print-host {
      display: block;
      color: #000;
      background: #fff;
      font-family: Helvetica, Arial, sans-serif;
    }
    .libreta-hoja {
      position: relative;
      width: ${hoja.ancho}pt;
      height: ${hoja.alto}pt;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .libreta-hoja:last-child { page-break-after: auto; break-after: auto; }
  }
`
