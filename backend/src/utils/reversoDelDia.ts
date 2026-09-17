// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Reversos de días anteriores
// ============================================
//
// Confirmado por la cooperativa: cualquier cajero reversa los cobros y abonos
// del día, explicando el motivo. Anular o modificar pagos de fechas pasadas lo
// hace sólo la "caja 99" (administración). En el sistema es la acción
// `reversar_anterior` del módulo, que tiene el rol admin.

import type { Request } from 'express';
import { ForbiddenError } from '../middleware/errorHandler';
import { tienePermiso } from '../middleware/authorize';

export const ACCION_REVERSAR_ANTERIOR = 'reversar_anterior';

/** El movimiento es de un día calendario anterior a hoy */
export const esDeDiaAnterior = (fecha: Date, hoy: Date = new Date()): boolean =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) <
  new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

export const exigirPermisoSiEsDeDiaAnterior = async (req: Request, modulo: string, fecha: Date): Promise<void> => {
  if (!esDeDiaAnterior(fecha)) return;
  if (await tienePermiso(req.user!.rolId, modulo, ACCION_REVERSAR_ANTERIOR)) return;
  throw new ForbiddenError(
    `El movimiento es del ${fecha.toLocaleDateString('es-VE')}. ` +
      'Los reversos de días anteriores los hace sólo la caja 99 (administración).'
  );
};
