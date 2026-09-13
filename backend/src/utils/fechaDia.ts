// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Fechas de día (columnas DATE)
// ============================================
//
// Una columna DATE se guarda y se lee como medianoche UTC. `new Date('2026-09-10')`
// ya lo hace, pero no valida: acepta '2026-02-31' y lo corre a marzo.

import { BadRequestError } from '../middleware/errorHandler';

/** 'AAAA-MM-DD' a medianoche UTC, rechazando fechas que no existen */
export const fechaDia = (texto: string, campo: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new BadRequestError(`${campo}: use el formato AAAA-MM-DD`);
  }
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  if (isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    throw new BadRequestError(`${campo}: la fecha ${texto} no existe`);
  }
  return fecha;
};

/** El día calendario local de hoy, como columna DATE */
export const hoyDia = (hoy: Date = new Date()): Date =>
  new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

export const textoDia = (fecha: Date): string => fecha.toISOString().slice(0, 10);
