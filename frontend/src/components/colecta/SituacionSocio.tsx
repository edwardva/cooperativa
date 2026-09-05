/**
 * ============================================
 * COMPONENTE: situacion del socio en la colecta
 * ============================================
 *
 * Requisito 1 de la reunion: al consultar al socio hay que ver, POR SERVICIO,
 * hasta cuando esta pagado y cuanto debe — sin abrir otra ventana y sin una
 * fila por cada semana adeudada.
 *
 * Los dos datos que el cliente pidio no confundir van separados y rotulados:
 *
 *   "Ultimo pago"    -> la fecha en que el socio pago
 *   "Cubierto hasta" -> el ano y semana hasta el que quedo cubierto
 *
 * Son distintos: se puede pagar hoy diez semanas por adelantado.
 */

import { AlertTriangle, CalendarCheck, HeartPulse, Shield } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import type { ResumenServicio } from '../../services/colectaService'

interface Props {
  servicios: ResumenServicio[]
  /** Semana en curso, para mostrarla al lado y no confundir anos */
  semanaActualTexto: string
  tasa: number | null
}

const fecha = (valor: string | null): string =>
  valor ? new Date(valor).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin pagos'

const money = (valor: number, decimales = 2): string =>
  valor.toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

/** Estado con el color que le corresponde de un vistazo. */
const insignia = (servicio: ResumenServicio) => {
  if (servicio.estado === 'suspendido') return <Badge variant="error">Suspendido</Badge>
  if (servicio.semanas_pendientes > 0) {
    return (
      <Badge variant="warning">
        {servicio.semanas_pendientes} semana{servicio.semanas_pendientes === 1 ? '' : 's'} pendiente
        {servicio.semanas_pendientes === 1 ? '' : 's'}
      </Badge>
    )
  }
  if (servicio.semanas_adelantadas > 0) {
    return (
      <Badge variant="success">
        {servicio.semanas_adelantadas} semana{servicio.semanas_adelantadas === 1 ? '' : 's'} adelantada
        {servicio.semanas_adelantadas === 1 ? '' : 's'}
      </Badge>
    )
  }
  return <Badge variant="success">Al dia</Badge>
}

export function SituacionSocio({ servicios, semanaActualTexto, tasa }: Props) {
  if (servicios.length === 0) {
    return (
      <Card className="p-5 text-sm text-neutral-500">
        El socio no tiene servicios de funeraria ni de salud contratados.
      </Card>
    )
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-800">Situacion de los servicios</h3>
        </div>
        <span className="text-xs font-medium text-neutral-500">Semana en curso: {semanaActualTexto}</span>
      </div>

      <div className="divide-y divide-neutral-100">
        {servicios.map((servicio) => (
          <div key={`${servicio.servicio}-${servicio.referencia_id}`} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[200px]">
                <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                  {servicio.servicio === 'funeraria' ? (
                    <Shield className="h-4 w-4 text-indigo-600" />
                  ) : (
                    <HeartPulse className="h-4 w-4 text-rose-600" />
                  )}
                  {servicio.titulo}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {servicio.detalle}
                  {servicio.numero_acuerdo && ` · Acuerdo ${servicio.numero_acuerdo}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">{insignia(servicio)}</div>
            </div>

            {/* La rejilla de datos: cada uno rotulado, sin cifras amontonadas */}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Ultimo pago</dt>
                <dd className="text-sm font-medium text-neutral-800">
                  {fecha(servicio.fecha_ultimo_pago)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Cubierto hasta</dt>
                <dd className="text-sm font-semibold text-neutral-900">{servicio.pagado_hasta_texto}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Cuota semanal</dt>
                <dd className="text-sm font-medium text-neutral-800">
                  ${money(servicio.tarifa_semanal_usd)}
                  {tasa ? (
                    <span className="ml-1 text-xs text-neutral-500">
                      ({money(servicio.tarifa_semanal_usd * tasa)} Bs)
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Para ponerse al dia</dt>
                <dd className="text-sm font-medium text-neutral-800">
                  {servicio.semanas_pendientes > 0 ? `$${money(servicio.monto_al_dia_usd)}` : '—'}
                </dd>
              </div>
            </dl>

            {/*
              El estado guardado no coincide con lo que dice la cobertura. Es el
              caso que el personal marco como mal calculado en la demostracion:
              se avisa en vez de corregirlo en silencio.
            */}
            {servicio.requiere_revision && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Figura como <strong>{servicio.estado}</strong>, pero segun su cobertura deberia estar{' '}
                  <strong>{servicio.estado_calculado}</strong>. Conviene revisarlo.
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
