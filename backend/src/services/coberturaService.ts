// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Cobertura de los servicios por (año, semana)
// ============================================
//
// Requisitos 1, 3 y 8 de la reunión.
//
// Antes: cada acuerdo llevaba `semanas_sin_pago`, un contador que un job subía
// cada lunes y el cobro bajaba. Con eso no se puede responder lo que el cliente
// pide ver en pantalla — "hasta qué año y semana está pagado" — ni adelantar
// semanas, ni cruzar diciembre-enero.
//
// Ahora: el acuerdo guarda su COBERTURA, el par (año, semana) hasta el que
// quedó pagado. De ahí sale todo lo demás:
//
//   pendientes  = semanas entre la cobertura y la semana actual   (si es futura)
//   adelantadas = semanas entre la semana actual y la cobertura   (si es pasada)
//
// `semanas_sin_pago` se sigue escribiendo, derivado, porque lo leen los módulos
// de funeraria, salud y los reportes; deja de ser la fuente de verdad.

import {
  type Periodo,
  diferenciaSemanas,
  normalizarPeriodo,
  semanaActual,
  semanaDeFecha,
  sumarSemanas,
} from '../utils/calendarioSemanal';

/** Lo mínimo que hace falta de un acuerdo para calcular su situación. */
export interface AcuerdoConCobertura {
  ano_pagado_hasta: number | null;
  semana_pagada_hasta: number | null;
  fecha_ultimo_pago: Date | null;
  semanas_sin_pago: number;
  fecha_inicio: Date;
  estado: string;
}

/** Situación de un servicio, tal como se muestra en la pantalla de colecta. */
export interface SituacionServicio {
  /** Hasta qué (año, semana) está pagado */
  cobertura: Periodo | null;
  /** Cuándo se cobró por última vez — distinto de hasta cuándo cubre */
  fecha_ultimo_pago: Date | null;
  /** La semana que corre hoy, para mostrarla al lado y no confundir años */
  semana_actual: Periodo;
  semanas_pendientes: number;
  semanas_adelantadas: number;
  /** Lo que dicta la cobertura, independiente de lo que diga el campo `estado` */
  estado_calculado: 'vigente' | 'atrasado' | 'suspendido';
  /** Lo que hay guardado hoy en el acuerdo */
  estado_registrado: string;
  /** El guardado no coincide con el calculado: hay que revisarlo */
  requiere_revision: boolean;
}

/**
 * Cobertura del acuerdo.
 *
 * Si el acuerdo todavía no tiene cobertura cargada (dato viejo, o migración a
 * medias), se deduce del contador: estar `N` semanas sin pagar equivale a tener
 * cobertura hasta `N` semanas atrás. Así el módulo funciona sobre los datos
 * actuales sin esperar al backfill.
 */
export function coberturaDe(acuerdo: AcuerdoConCobertura, hoy?: Periodo): Periodo | null {
  if (acuerdo.ano_pagado_hasta !== null && acuerdo.semana_pagada_hasta !== null) {
    return normalizarPeriodo({
      ano: acuerdo.ano_pagado_hasta,
      semana: acuerdo.semana_pagada_hasta,
    });
  }

  const actual = hoy ?? semanaActual();
  return sumarSemanas(actual, -acuerdo.semanas_sin_pago);
}

/**
 * Cobertura inicial de un acuerdo recién creado: la semana ANTERIOR a su
 * arranque. Así la primera semana de vigencia ya cuenta como pendiente y el
 * socio no aparece cubierto sin haber pagado nada.
 */
export function coberturaInicial(fechaInicio: Date): Periodo {
  return sumarSemanas(semanaDeFecha(fechaInicio), -1);
}

/**
 * Situación completa del servicio.
 *
 * `umbralSuspension` viene de parámetros (el cliente no confirmó el número; las
 * menciones sueltas a seis o siete semanas NO se toman como regla).
 */
export function calcularSituacion(
  acuerdo: AcuerdoConCobertura,
  umbralSuspension: number,
  hoy?: Periodo
): SituacionServicio {
  const actual = hoy ?? semanaActual();
  const cobertura = coberturaDe(acuerdo, actual);

  // El signo separa los dos casos: cobertura pasada = debe; futura = adelantó
  const desfase = cobertura ? diferenciaSemanas(cobertura, actual) : 0;
  const pendientes = Math.max(0, desfase);
  const adelantadas = Math.max(0, -desfase);

  // Un acuerdo retirado no se recalcula: dejó de estar en curso
  const estadoCalculado: SituacionServicio['estado_calculado'] =
    acuerdo.estado === 'retirado'
      ? 'suspendido'
      : pendientes >= umbralSuspension && umbralSuspension > 0
        ? 'suspendido'
        : pendientes > 0
          ? 'atrasado'
          : 'vigente';

  // Sólo se contrasta lo comparable: 'atrasado' no es un estado guardado, así
  // que un acuerdo activo con atraso por debajo del umbral no está mal.
  const registradoEquivalente =
    acuerdo.estado === 'suspendido' ? 'suspendido' : 'vigente';
  const calculadoEquivalente = estadoCalculado === 'suspendido' ? 'suspendido' : 'vigente';

  return {
    cobertura,
    fecha_ultimo_pago: acuerdo.fecha_ultimo_pago,
    semana_actual: actual,
    semanas_pendientes: pendientes,
    semanas_adelantadas: adelantadas,
    estado_calculado: estadoCalculado,
    estado_registrado: acuerdo.estado,
    requiere_revision:
      acuerdo.estado !== 'retirado' && registradoEquivalente !== calculadoEquivalente,
  };
}

/**
 * Cobertura resultante de pagar `semanas` semanas. Es una suma sobre el
 * calendario, así que el cruce de año sale solo.
 */
export function aplicarPago(cobertura: Periodo, semanas: number): Periodo {
  return sumarSemanas(cobertura, semanas);
}

/**
 * Deshace un pago. El reverso usa la cobertura guardada en el detalle de la
 * colecta, no este cálculo; esto es el respaldo para datos viejos que no la
 * tienen.
 */
export function deshacerPago(cobertura: Periodo, semanas: number): Periodo {
  return sumarSemanas(cobertura, -semanas);
}

/**
 * Valor a escribir en `semanas_sin_pago`, derivado de la cobertura.
 *
 * Se mantiene poblado para no romper funeraria, salud ni los reportes, que lo
 * leen. Nunca se decide nada a partir de él.
 */
export function semanasSinPagoDerivadas(cobertura: Periodo, hoy?: Periodo): number {
  return Math.max(0, diferenciaSemanas(cobertura, hoy ?? semanaActual()));
}
