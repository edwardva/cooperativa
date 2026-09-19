/**
 * ============================================
 * GRÁFICOS DEL TABLERO
 * ============================================
 * Dibujados a mano en SVG, sin librería: el despliegue no instala dependencias
 * nuevas, y estas tres formas alcanzan para lo que mira la junta.
 *
 * Reglas que siguen los tres: una sola escala por gráfico, trazos finos, la
 * grilla en gris claro para que no compita con los datos, y los números en
 * tinta neutra (el color identifica la serie, no el texto). Cada gráfico trae
 * abajo sus propios números, para quien no distingue los colores o quiere
 * copiarlos.
 */

import { useId } from 'react'

export interface Punto {
  etiqueta: string
  valor: number
}

export interface Serie {
  nombre: string
  color: string
  puntos: Punto[]
}

/** Dos series distinguibles también para quien no ve bien los colores */
export const COLORES = {
  uno: '#EA580C',
  dos: '#2563EB',
  /** Escala de un solo tono para lo que es "más grave = más oscuro" */
  gravedad: ['#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#991B1B'],
} as const

const TINTA = '#404040'
const TINTA_SUAVE = '#737373'
const GRILLA = '#E5E5E5'

export const comoDinero = (v: number) =>
  `$${v.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
export const comoNumero = (v: number) => v.toLocaleString('es-VE')

/** Marcas redondas de la escala: 4 líneas como mucho, para no ensuciar */
const escalaY = (maximo: number): number[] => {
  if (maximo <= 0) return [0, 1]
  const paso = Math.pow(10, Math.floor(Math.log10(maximo)))
  const redondeado = Math.ceil(maximo / paso) * paso
  return [0, redondeado / 2, redondeado]
}

/**
 * Cuando dos líneas terminan a la misma altura, sus nombres se pisan. Se
 * separan un renglón, la de arriba hacia arriba y la de abajo hacia abajo.
 */
const desplazamiento = (series: Serie[], indice: number, y: (v: number) => number): number => {
  const mio = y(series[indice]?.puntos.at(-1)?.valor ?? 0)
  const choca = series.some((otra, j) => j !== indice && Math.abs(y(otra.puntos.at(-1)?.valor ?? 0) - mio) < 14)
  if (!choca) return 0
  return indice === 0 ? -8 : 8
}

const Tabla = ({ series }: { series: Serie[] }) => (
  <details className="mt-3">
    <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-700">Ver los números</summary>
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1 pr-4 font-medium">Período</th>
            {series.map((s) => (
              <th key={s.nombre} className="py-1 pr-4 font-medium">
                {s.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series[0]?.puntos.map((p, i) => (
            <tr key={p.etiqueta} className="border-t border-neutral-100">
              <td className="py-1 pr-4 text-neutral-600">{p.etiqueta}</td>
              {series.map((s) => (
                <td key={s.nombre} className="py-1 pr-4 text-neutral-800">
                  {comoNumero(s.puntos[i]?.valor ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
)

/**
 * Líneas en el tiempo. Una serie no lleva leyenda (el título la nombra); con
 * dos, cada una va nombrada al final de su línea además de la leyenda.
 */
export const GraficoLineas = ({
  series,
  formato = comoNumero,
  alto = 200,
}: {
  series: Serie[]
  formato?: (v: number) => string
  alto?: number
}) => {
  const id = useId()
  const ancho = 640
  const margen = { arriba: 16, derecha: series.length > 1 ? 74 : 16, abajo: 28, izquierda: 58 }
  const puntos = series[0]?.puntos ?? []
  if (puntos.length === 0) return <p className="py-8 text-center text-sm text-neutral-500">Sin datos todavía.</p>

  const maximo = Math.max(...series.flatMap((s) => s.puntos.map((p) => p.valor)), 0)
  const marcas = escalaY(maximo)
  const tope = marcas[marcas.length - 1]!
  const anchoUtil = ancho - margen.izquierda - margen.derecha
  const altoUtil = alto - margen.arriba - margen.abajo
  const paso = Math.ceil(puntos.length / 8)
  const x = (i: number) => margen.izquierda + (puntos.length === 1 ? anchoUtil / 2 : (anchoUtil * i) / (puntos.length - 1))
  const y = (v: number) => margen.arriba + altoUtil - (tope === 0 ? 0 : (altoUtil * v) / tope)

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.nombre} className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-labelledby={id}>
        <title id={id}>{series.map((s) => s.nombre).join(' y ')}</title>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(m)} y2={y(m)} stroke={GRILLA} strokeWidth={1} />
            <text x={margen.izquierda - 8} y={y(m) + 4} textAnchor="end" fontSize={11} fill={TINTA_SUAVE}>
              {formato(m)}
            </text>
          </g>
        ))}
        {puntos.map((p, i) =>
          /* Una de cada tantas, más la última; la anterior a la última se salta
             para que no se encimen */
          (i % paso === 0 && i < puntos.length - 1 - paso / 2) || i === puntos.length - 1 ? (
            <text
              key={p.etiqueta}
              x={x(i)}
              y={alto - 8}
              /* La primera y la última se alinean hacia adentro: centradas se cortaban */
              textAnchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill={TINTA_SUAVE}
            >
              {p.etiqueta}
            </text>
          ) : null
        )}
        {series.map((s, indiceSerie) => (
          <g key={s.nombre}>
            <polyline
              points={s.puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.puntos.map((p, i) => (
              <circle key={p.etiqueta} cx={x(i)} cy={y(p.valor)} r={4} fill={s.color} stroke="#FFFFFF" strokeWidth={2}>
                <title>{`${p.etiqueta}: ${formato(p.valor)}`}</title>
              </circle>
            ))}
            {series.length > 1 && (
              <text
                x={x(s.puntos.length - 1) + 8}
                y={y(s.puntos[s.puntos.length - 1]?.valor ?? 0) + 4 + desplazamiento(series, indiceSerie, y)}
                fontSize={11}
                fill={TINTA}
              >
                {s.nombre}
              </text>
            )}
          </g>
        ))}
      </svg>
      <Tabla series={series} />
    </div>
  )
}

/** Barras verticales: una por período corto (las últimas semanas) */
export const GraficoBarras = ({
  puntos,
  color = COLORES.uno,
  formato = comoNumero,
  nombre,
  alto = 200,
}: {
  puntos: Punto[]
  color?: string
  formato?: (v: number) => string
  nombre: string
  alto?: number
}) => {
  const id = useId()
  const ancho = 640
  const margen = { arriba: 16, derecha: 16, abajo: 28, izquierda: 58 }
  if (puntos.length === 0) return <p className="py-8 text-center text-sm text-neutral-500">Sin datos todavía.</p>

  const marcas = escalaY(Math.max(...puntos.map((p) => p.valor), 0))
  const tope = marcas[marcas.length - 1]!
  const anchoUtil = ancho - margen.izquierda - margen.derecha
  const altoUtil = alto - margen.arriba - margen.abajo
  const paso = anchoUtil / puntos.length
  const anchoBarra = Math.max(6, paso - 6)
  const y = (v: number) => margen.arriba + altoUtil - (tope === 0 ? 0 : (altoUtil * v) / tope)

  return (
    <div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-labelledby={id}>
        <title id={id}>{nombre}</title>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(m)} y2={y(m)} stroke={GRILLA} strokeWidth={1} />
            <text x={margen.izquierda - 8} y={y(m) + 4} textAnchor="end" fontSize={11} fill={TINTA_SUAVE}>
              {formato(m)}
            </text>
          </g>
        ))}
        {puntos.map((p, i) => {
          const altura = Math.max(0, margen.arriba + altoUtil - y(p.valor))
          return (
            <g key={p.etiqueta}>
              <rect
                x={margen.izquierda + i * paso + (paso - anchoBarra) / 2}
                y={y(p.valor)}
                width={anchoBarra}
                height={altura}
                rx={4}
                fill={color}
              >
                <title>{`${p.etiqueta}: ${formato(p.valor)}`}</title>
              </rect>
              <text
                x={margen.izquierda + i * paso + paso / 2}
                y={alto - 8}
                textAnchor="middle"
                fontSize={11}
                fill={TINTA_SUAVE}
              >
                {p.etiqueta}
              </text>
            </g>
          )
        })}
      </svg>
      <Tabla series={[{ nombre, color, puntos }]} />
    </div>
  )
}

/** Barras horizontales: para categorías con nombre largo */
export const GraficoBarrasHorizontales = ({
  puntos,
  colores,
  formato = comoNumero,
}: {
  puntos: Punto[]
  colores?: string[]
  formato?: (v: number) => string
}) => {
  if (puntos.length === 0) return <p className="py-8 text-center text-sm text-neutral-500">Sin datos todavía.</p>
  const maximo = Math.max(...puntos.map((p) => p.valor), 1)

  return (
    <div className="space-y-3">
      {puntos.map((p, i) => (
        <div key={p.etiqueta}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-neutral-700">{p.etiqueta}</span>
            <span className="font-medium text-neutral-900">{formato(p.valor)}</span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-full bg-neutral-100">
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${Math.max(p.valor > 0 ? 2 : 0, (p.valor / maximo) * 100)}%`,
                background: colores?.[i] ?? COLORES.uno,
              }}
              title={`${p.etiqueta}: ${formato(p.valor)}`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
