/**
 * ============================================
 * COMPONENTE: aviso de abono a prestamos
 * ============================================
 *
 * Confirmado por la cooperativa al probar el sistema:
 *
 *   "Cada 21 dias el socio debe ir a abonar a los prestamos, de lo contrario
 *    entra en morosidad; el mensaje de advertencia se debe mostrar a partir
 *    del dia 18 para ir informando."
 *
 * Se AVISA, no se bloquea. Quien decide si le cobra o no es el cajero, igual
 * que con el resto de las alertas del socio: el sistema pone el dato delante y
 * la decision sigue siendo de quien atiende.
 *
 * Los dos plazos vienen del backend, que los lee de parametros. Aqui no hay
 * ningun numero escrito: si la cooperativa cambia los 21 dias, cambia solo.
 */

import { AlertTriangle, CalendarClock } from 'lucide-react'
import type { AvisoAbonoPrestamo } from '../../services/colectaService'

interface Props {
  aviso: AvisoAbonoPrestamo | null
}

export const AvisoAbono = ({ aviso }: Props) => {
  if (!aviso) return null

  const { dias_sin_abonar, dias_limite, dias_restantes, vencido, prestamos_afectados } = aviso

  const cuantos =
    prestamos_afectados === 1 ? 'Un préstamo' : `${prestamos_afectados} préstamos`

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        vencido
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}
    >
      {vencido ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <div className="text-sm">
        {vencido ? (
          <p className="font-semibold">
            {cuantos} sin abonar desde hace {dias_sin_abonar} días: pasó el plazo de{' '}
            {dias_limite} y el socio está en morosidad.
          </p>
        ) : (
          <p className="font-semibold">
            {cuantos} sin abonar desde hace {dias_sin_abonar} días.{' '}
            {dias_restantes === 1
              ? 'Le queda 1 día'
              : `Le quedan ${dias_restantes} días`}{' '}
            antes de entrar en morosidad.
          </p>
        )}
        <p className="mt-0.5 opacity-90">
          Conviene recordarle que debe abonar cada {dias_limite} días.
        </p>
      </div>
    </div>
  )
}
