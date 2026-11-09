/**
 * Ayudas de presentacion de la colecta. No calculan importes: solo deciden
 * como se muestra lo que ya mando el backend.
 */

import type { ResumenServicio } from '../../services/colectaService'

/**
 * dd/mm/aa (o dd/mm/aaaa) de una fecha.
 *
 * Una fecha SIN hora ("2026-11-08", el domingo hasta el que cubre una semana)
 * se muestra tal cual. Pasarla por `new Date()` la toma como medianoche UTC y
 * en Venezuela sale como el sabado anterior: la cooperativa veia vencer la
 * semana el sabado, cuando vence el domingo (observacion del 07/11).
 */
export const fechaCorta = (
  valor: string | null | undefined,
  anoCompleto = false
): string => {
  if (!valor) return ''
  // Tambien la columna de solo fecha que llega serializada como medianoche UTC
  // ("2027-01-17T00:00:00.000Z"): es un dia, no un instante
  const soloDia = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(valor)
  if (soloDia) {
    const [, a, m, d] = soloDia
    return `${d}/${m}/${anoCompleto ? a : a!.slice(2)}`
  }
  return new Date(valor).toLocaleDateString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: anoCompleto ? 'numeric' : '2-digit',
  })
}

export type ServicioAgrupado = ResumenServicio & {
  /** Personas que cubre el acuerdo (salud: titular + beneficiarios) */
  personas: number
}

/**
 * Salud se muestra por ACUERDO, no por persona.
 *
 * Un acuerdo de salud lo comparten el titular y hasta 8 beneficiarios, y en la
 * base hay una fila por persona. La cooperativa pidio verlo como funeraria:
 * "si tiene un solo acuerdo aparezca uno; si son dos aparezcan dos" (07/11).
 *
 * Del grupo se muestra la situacion mas atrasada, para no esconder una deuda.
 * Funeraria pasa sin cambios.
 */
export const agruparPorAcuerdo = (servicios: ResumenServicio[]): ServicioAgrupado[] => {
  const resultado: ServicioAgrupado[] = []
  const grupos = new Map<string, ServicioAgrupado>()

  for (const s of servicios) {
    if (s.servicio !== 'salud' || !s.numero_acuerdo) {
      resultado.push({ ...s, personas: 1 })
      continue
    }

    const previo = grupos.get(s.numero_acuerdo)
    if (!previo) {
      const nuevo = { ...s, personas: 1 }
      grupos.set(s.numero_acuerdo, nuevo)
      resultado.push(nuevo)
      continue
    }

    const suspendido = previo.estado === 'suspendido' || s.estado === 'suspendido'
    const revisar = previo.requiere_revision || s.requiere_revision
    const personas = previo.personas + 1
    if (s.semanas_pendientes > previo.semanas_pendientes) Object.assign(previo, s)
    previo.personas = personas
    if (suspendido) previo.estado = 'suspendido'
    previo.requiere_revision = revisar
  }

  return resultado
}
