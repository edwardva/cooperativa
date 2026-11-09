/**
 * Distintivo del trabajador de El Triunfo (empleado de la cooperativa).
 *
 * La cooperativa pidio (09/11) que se reconozca de un vistazo en cualquier
 * pantalla donde aparezca el socio: el sector solo no basta y confunde. Es
 * distinto del "Trabajador de feria", que tiene su propio expediente.
 */

import { Building2 } from 'lucide-react'

interface Props {
  /** `compacto` para filas de tablas; el normal para cabeceras y fichas */
  compacto?: boolean
  className?: string
}

export const DistintivoTrabajadorTriunfo = ({ compacto = false, className = '' }: Props) => (
  <span
    title="Trabajador de la cooperativa El Triunfo"
    className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 font-semibold text-amber-900 ${
      compacto ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    } ${className}`}
  >
    <Building2 className={compacto ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    Trabajador El Triunfo
  </span>
)
