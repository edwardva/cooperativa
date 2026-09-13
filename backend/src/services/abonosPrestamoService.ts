// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Efectos de un abono sobre el préstamo
// ============================================
//
// Hay cuatro caminos que mueven lo abonado a un préstamo: el abono directo, el
// abono cobrado en colecta, y el reverso de cada uno. Cada uno repetía (o se
// olvidaba de) lo que viene después del abono: el abono de colecta saldaba el
// préstamo sin liberar a los fiadores y no marcaba ninguna cuota. Todo lo
// común vive aquí.

import type { Prisma } from '@prisma/client';
import { ConflictError } from '../middleware/errorHandler';
import { estadosDeCuotas } from '../utils/amortizacion';

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * Recalcula y escribe el estado de las cuotas desde los abonos no reversados
 * (ver `estadosDeCuotas`). Sólo toca las cuotas cuyo estado cambia, así que una
 * cuota que ya estaba pagada conserva su `fecha_pago` original.
 */
export const sincronizarCuotas = async (
  tx: Prisma.TransactionClient,
  prestamoId: number,
  hoy: Date = new Date()
): Promise<{ cuotas_pagadas: number }> => {
  const plan = await tx.planPago.findMany({
    where: { prestamo_id: prestamoId },
    orderBy: { numero_cuota: 'asc' },
  });

  const abonado = await tx.abonoPrestamo.aggregate({
    where: { prestamo_id: prestamoId, reversado: false },
    _sum: { aplicado_capital_usd: true, aplicado_interes_usd: true },
  });

  const aplicado =
    Number(abonado._sum.aplicado_capital_usd ?? 0) + Number(abonado._sum.aplicado_interes_usd ?? 0);

  const estados = new Map(
    estadosDeCuotas(
      plan.map((c) => ({
        numero_cuota: c.numero_cuota,
        monto_total_usd: Number(c.monto_total_usd),
        fecha_vencimiento: c.fecha_vencimiento,
      })),
      aplicado,
      hoy
    ).map((e) => [e.numero_cuota, e.estado])
  );

  let cuotasPagadas = 0;
  for (const cuota of plan) {
    const nuevo = estados.get(cuota.numero_cuota) ?? cuota.estado;
    if (nuevo === 'pagada') cuotasPagadas++;
    if (nuevo === cuota.estado) continue;

    await tx.planPago.update({
      where: { id: cuota.id },
      data: { estado: nuevo, fecha_pago: nuevo === 'pagada' ? hoy : null },
    });
  }

  return { cuotas_pagadas: cuotasPagadas };
};

/** Al saldarse el préstamo, los fiadores recuperan su ahorro bloqueado. */
export const liberarFiadores = async (
  tx: Prisma.TransactionClient,
  prestamoId: number,
  tasa: number
): Promise<void> => {
  const fiadores = await tx.fiador.findMany({ where: { prestamo_id: prestamoId, estado: 'activo' } });

  for (const fiador of fiadores) {
    let porLiberar = Number(fiador.monto_bloqueado_usd);
    const cuentas = await tx.cuentaAhorro.findMany({
      where: { socio_id: fiador.socio_id, monto_bloqueado_usd: { gt: 0 } },
    });
    for (const cuenta of cuentas) {
      if (porLiberar <= 0) break;
      const liberar = Math.min(Number(cuenta.monto_bloqueado_usd), porLiberar);
      const restanteBloqueado = redondear(Number(cuenta.monto_bloqueado_usd) - liberar);
      await tx.cuentaAhorro.update({
        where: { id: cuenta.id },
        data: {
          monto_bloqueado_usd: restanteBloqueado,
          monto_bloqueado_bs: redondear(restanteBloqueado * tasa),
        },
      });
      porLiberar = redondear(porLiberar - liberar);
    }

    await tx.fiador.update({
      where: { id: fiador.id },
      data: { estado: 'liberado', fecha_liberacion: new Date() },
    });
  }
};

/**
 * Un reverso sobre un préstamo SALDADO lo reabre. Si al saldarse los fiadores
 * ya recuperaron su ahorro, la deuda reabierta quedaría sin garantía — y
 * volver a bloquearles el ahorro puede ser imposible si ya lo retiraron. Se
 * rechaza y se pide un ajuste: es una decisión que tiene que tomar una persona.
 */
export const asegurarReversoConFiadores = async (
  tx: Prisma.TransactionClient,
  prestamo: { id: number; numero_prestamo: string; estado: string }
): Promise<void> => {
  if (prestamo.estado !== 'saldado') return;

  const liberados = await tx.fiador.count({ where: { prestamo_id: prestamo.id, estado: 'liberado' } });
  if (liberados === 0) return;

  throw new ConflictError(
    `El préstamo ${prestamo.numero_prestamo} quedó saldado y ${liberados} fiador(es) ya ` +
      'recuperaron su ahorro bloqueado. Reversar el pago dejaría la deuda sin garantía; ' +
      'corresponde un ajuste, no un reverso.'
  );
};
