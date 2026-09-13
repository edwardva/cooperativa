// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Forma común de los reportes de fase 2
// ============================================
//
// Cada reporte se arma UNA vez como título + columnas + filas + totales, y de
// ese mismo objeto salen la vista en pantalla, el Excel y el PDF. Así los
// totales no pueden diferir entre los tres (QA-019).

import { diferenciaSemanas, sumarSemanas, type Periodo } from './calendarioSemanal';

export type Celda = string | number | null;

export interface Reporte {
  clave: string;
  titulo: string;
  subtitulo?: string;
  columnas: string[];
  filas: Celda[][];
  totales: { etiqueta: string; valor: Celda }[];
}

/** Filas para Excel y PDF: los datos, una fila vacía y los totales en las dos primeras columnas */
export const filasParaExportar = (reporte: Reporte): Celda[][] => {
  const ancho = reporte.columnas.length;
  const completar = (fila: Celda[]): Celda[] => [...fila, ...Array<Celda>(Math.max(0, ancho - fila.length)).fill('')];
  if (reporte.totales.length === 0) return reporte.filas;
  return [...reporte.filas, completar([]), ...reporte.totales.map((t) => completar([t.etiqueta, t.valor]))];
};

export const nombreArchivo = (clave: string, formato: 'excel' | 'pdf', fecha: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dia = `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
  return `${clave}-${dia}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
};

/**
 * Semanas adelantadas de un renglón de colecta (RF-REP-05).
 *
 * El renglón dejó el servicio cubierto desde `antes + 1` hasta `despues`.
 * Adelantadas son las que quedaron por DELANTE de la semana en que se cobró;
 * un pago que sólo pone al día no adelanta nada y no entra al reporte.
 */
export const adelantoDelRenglon = (
  semanaDelCobro: Periodo,
  antes: Periodo,
  despues: Periodo
): { desde: Periodo; hasta: Periodo; adelantadas: number } | null => {
  const adelantadas = diferenciaSemanas(semanaDelCobro, despues);
  if (adelantadas <= 0) return null;
  return { desde: sumarSemanas(antes, 1), hasta: despues, adelantadas };
};
