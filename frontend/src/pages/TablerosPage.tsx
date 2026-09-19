import { useEffect, useState } from 'react'
import { BarChart3, Loader2, RefreshCw } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import {
  COLORES,
  GraficoBarras,
  GraficoBarrasHorizontales,
  GraficoLineas,
  comoDinero,
  comoNumero,
} from '../components/charts/Graficos'
import * as dashboardService from '../services/dashboardService'
import type { Indicadores } from '../services/dashboardService'
import { getErrorMessage } from '../services/api'
import { formatearFecha } from '../utils/formatters'

const NOMBRE_SERVICIO: Record<string, string> = {
  ahorro: 'Ahorro',
  funeraria: 'Funeraria',
  salud: 'Salud',
  prestamo: 'Préstamos',
}

/** Una cifra sola, sin gráfico: se lee de un vistazo */
const Cifra = ({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) => (
  <Card>
    <p className="text-xs uppercase tracking-wide text-neutral-500">{titulo}</p>
    <p className="mt-1 text-3xl font-semibold text-neutral-900">{valor}</p>
    {detalle && <p className="mt-1 text-xs text-neutral-500">{detalle}</p>}
  </Card>
)

/**
 * Tablero de indicadores: socios, ahorro, colecta, préstamos y atraso. Todo
 * sale de lo registrado, así que no puede discrepar de los reportes.
 */
export const TablerosPage = () => {
  const [datos, setDatos] = useState<Indicadores | null>(null)
  const [meses, setMeses] = useState(12)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = async (m: number) => {
    setCargando(true)
    setError(null)
    try {
      const r = await dashboardService.obtenerIndicadores(m)
      if (r.success) setDatos(r.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar(meses)
  }, [meses])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-neutral-900">
              <BarChart3 className="h-7 w-7 text-primary-600" />
              Tableros
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Cómo viene la cooperativa: socios, ahorro, cobros, préstamos y atraso.
              {datos && ` Al ${formatearFecha(datos.al)}.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[6, 12, 24].map((m) => (
              <button
                key={m}
                onClick={() => setMeses(m)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  meses === m
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {m} meses
              </button>
            ))}
            <Button variant="outline" onClick={() => void cargar(meses)} disabled={cargando}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {cargando && !datos ? (
        <div className="flex items-center justify-center gap-2 py-20 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Calculando indicadores…
        </div>
      ) : datos ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cifra
              titulo="Socios activos"
              valor={comoNumero(datos.socios.activos)}
              detalle={`${comoNumero(datos.socios.suspendidos)} suspendidos · ${comoNumero(
                datos.socios.retirados
              )} retirados`}
            />
            <Cifra
              titulo="Ahorro de los socios"
              valor={comoDinero(datos.ahorro.saldo_usd)}
              detalle={`${comoDinero(datos.ahorro.bloqueado_usd)} bloqueado en garantías · ${comoNumero(
                datos.ahorro.cuentas_activas
              )} cuentas`}
            />
            <Cifra
              titulo="Colecta de este mes"
              valor={comoDinero(datos.colecta.cobrado_mes_usd)}
              detalle="Sin contar lo reversado"
            />
            <Cifra
              titulo="Cartera de préstamos"
              valor={comoDinero(datos.prestamos.saldo_usd)}
              detalle={`${comoNumero(datos.prestamos.activos)} al día · ${comoNumero(
                datos.prestamos.morosos
              )} morosos · ${comoNumero(datos.prestamos.en_solicitud)} en solicitud`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold text-neutral-900">Socios nuevos por mes</h2>
              <p className="mb-3 text-sm text-neutral-500">Altas registradas en el sistema.</p>
              <GraficoLineas
                series={[{ nombre: 'Socios nuevos', color: COLORES.uno, puntos: datos.socios.altas_por_mes }]}
              />
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-neutral-900">Ahorro: lo que entra y lo que sale</h2>
              <p className="mb-3 text-sm text-neutral-500">Depósitos y retiros de cada mes, en dólares.</p>
              <GraficoLineas
                formato={comoDinero}
                series={[
                  { nombre: 'Depósitos', color: COLORES.uno, puntos: datos.ahorro.depositos_por_mes },
                  { nombre: 'Retiros', color: COLORES.dos, puntos: datos.ahorro.retiros_por_mes },
                ]}
              />
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-neutral-900">Colecta por semana</h2>
              <p className="mb-3 text-sm text-neutral-500">Últimas 12 semanas, por la fecha del cobro.</p>
              <GraficoBarras nombre="Cobrado" puntos={datos.colecta.por_semana_usd} formato={comoDinero} />
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-neutral-900">Préstamos otorgados por mes</h2>
              <p className="mb-3 text-sm text-neutral-500">Monto entregado, en dólares.</p>
              <GraficoLineas
                formato={comoDinero}
                series={[
                  { nombre: 'Otorgado', color: COLORES.uno, puntos: datos.prestamos.otorgado_por_mes_usd },
                ]}
              />
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-neutral-900">Colecta por servicio</h2>
              <p className="mb-3 text-sm text-neutral-500">
                Cobrado en los últimos {datos.meses} meses, servicio por servicio.
              </p>
              <GraficoBarrasHorizontales
                formato={comoDinero}
                puntos={datos.colecta.por_servicio_usd.map((p) => ({
                  ...p,
                  etiqueta: NOMBRE_SERVICIO[p.etiqueta] ?? p.etiqueta,
                }))}
              />
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-neutral-900">Socios atrasados</h2>
              <p className="mb-3 text-sm text-neutral-500">
                {comoNumero(datos.atraso.socios_con_atraso)} socios deben alguna semana. Cuanto más oscuro, más
                grave.
              </p>
              <GraficoBarrasHorizontales
                puntos={[...datos.atraso.por_nivel].reverse()}
                colores={[...COLORES.gravedad]}
              />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default TablerosPage
