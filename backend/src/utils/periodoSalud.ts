// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Períodos del pago de salud por feria
// ============================================
//
// La cooperativa confirmó que la salud de los trabajadores se calcula por
// SEMANA y que la feria paga varias semanas juntas. Los meses se siguen
// soportando: la periodicidad vigente es un parámetro y cada período guardado
// lleva su tipo, así que cambiarla no altera los pagos ya hechos. Las semanas
// son las ISO del resto del sistema.
//
// Todas las fechas son columnas DATE: medianoche UTC.

import { aOrdinal, formatearPeriodo, lunesDeSemana, semanaDeFecha, semanasEnAno, sumarSemanas } from './calendarioSemanal';

export type TipoPeriodo = 'mensual' | 'semanal';

export interface PeriodoSaludRef {
  tipo: TipoPeriodo;
  anio: number;
  /** Mes (1-12) o semana ISO (1-53) */
  numero: number;
}

export interface RangoPeriodo extends PeriodoSaludRef {
  inicio: Date;
  fin: Date;
  etiqueta: string;
}

/** Tope de períodos en un solo pago: un año de semanas */
export const MAX_PERIODOS_POR_PAGO = 52;

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIA_MS = 86_400_000;

/** Mensaje de error, o null si el período es válido */
export const validarPeriodo = (p: PeriodoSaludRef): string | null => {
  if (!Number.isInteger(p.anio) || p.anio < 2000 || p.anio > 2100) return 'El año del período no es válido';
  if (!Number.isInteger(p.numero)) return 'Indique el mes o la semana del período';
  if (p.tipo === 'mensual') {
    return p.numero >= 1 && p.numero <= 12 ? null : 'El mes debe estar entre 1 y 12';
  }
  const semanas = semanasEnAno(p.anio);
  return p.numero >= 1 && p.numero <= semanas ? null : `El año ${p.anio} tiene ${semanas} semanas`;
};

export const etiquetaPeriodo = (p: PeriodoSaludRef): string =>
  p.tipo === 'mensual' ? `${MESES[p.numero - 1]} ${p.anio}` : formatearPeriodo({ ano: p.anio, semana: p.numero });

export const rangoPeriodo = (p: PeriodoSaludRef): RangoPeriodo => {
  const error = validarPeriodo(p);
  if (error) throw new Error(error);

  if (p.tipo === 'mensual') {
    return {
      ...p,
      inicio: new Date(Date.UTC(p.anio, p.numero - 1, 1)),
      // Día 0 del mes siguiente: el último del mes pedido
      fin: new Date(Date.UTC(p.anio, p.numero, 0)),
      etiqueta: etiquetaPeriodo(p),
    };
  }

  const lunes = lunesDeSemana(p.anio, p.numero);
  const inicio = new Date(Date.UTC(lunes.getUTCFullYear(), lunes.getUTCMonth(), lunes.getUTCDate()));
  return { ...p, inicio, fin: new Date(inicio.getTime() + 6 * DIA_MS), etiqueta: etiquetaPeriodo(p) };
};

/** Posición absoluta del período: dos períodos se restan sin ramas por cambio de año */
const ordinal = (p: PeriodoSaludRef): number =>
  p.tipo === 'mensual' ? p.anio * 12 + p.numero - 1 : aOrdinal({ ano: p.anio, semana: p.numero });

/** Los `cantidad` períodos seguidos que empiezan en `desde`, cruzando el año si hace falta */
export const periodosDesde = (desde: PeriodoSaludRef, cantidad: number): PeriodoSaludRef[] =>
  Array.from({ length: cantidad }, (_, i) => {
    if (desde.tipo === 'mensual') {
      const indice = ordinal(desde) + i;
      return { tipo: 'mensual' as const, anio: Math.floor(indice / 12), numero: (indice % 12) + 1 };
    }
    const s = sumarSemanas({ ano: desde.anio, semana: desde.numero }, i);
    return { tipo: 'semanal' as const, anio: s.ano, numero: s.semana };
  });

/** Períodos de `desde` a `hasta`, inclusive */
export const contarPeriodos = (desde: PeriodoSaludRef, hasta: PeriodoSaludRef): number =>
  ordinal(hasta) - ordinal(desde) + 1;

/** "S30/2026 a S38/2026 (9 semanas)"; si es un solo período, su etiqueta */
export const etiquetaRango = (desde: PeriodoSaludRef, hasta: PeriodoSaludRef): string => {
  const n = contarPeriodos(desde, hasta);
  if (n <= 1) return etiquetaPeriodo(desde);
  return `${etiquetaPeriodo(desde)} a ${etiquetaPeriodo(hasta)} (${n} ${desde.tipo === 'mensual' ? 'meses' : 'semanas'})`;
};

/** El período de ese tipo que contiene una fecha (por defecto, hoy) */
export const periodoQueContiene = (tipo: TipoPeriodo, fecha: Date = new Date()): PeriodoSaludRef => {
  if (tipo === 'mensual') return { tipo, anio: fecha.getFullYear(), numero: fecha.getMonth() + 1 };
  const semana = semanaDeFecha(fecha);
  return { tipo, anio: semana.ano, numero: semana.semana };
};

interface Asociacion {
  feria_id: number;
  fecha_inicio: Date;
  fecha_fin: Date | null;
}

/**
 * A qué feria le toca la salud de un trabajador en un período.
 *
 * Si trabajó en una sola feria dentro del período, a esa. Si lo trasladaron a
 * mitad de período, a la de su ÚLTIMA asignación dentro del período: así un
 * trabajador nunca aparece en dos ferias ni en ninguna. La cooperativa no fijó
 * esta regla; si decide otra, se cambia aquí.
 */
export const feriaDelPeriodo = (asociaciones: Asociacion[], rango: { inicio: Date; fin: Date }): number | null => {
  const solapadas = asociaciones.filter(
    (a) => a.fecha_inicio <= rango.fin && (a.fecha_fin === null || a.fecha_fin >= rango.inicio)
  );
  if (solapadas.length === 0) return null;
  return solapadas.reduce((ultima, a) => (a.fecha_inicio >= ultima.fecha_inicio ? a : ultima)).feria_id;
};
