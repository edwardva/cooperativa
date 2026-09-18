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
import { estadosDeCuotas } from '../utils/amortizacion';
import { desbloquearAhorro } from './garantiaPrestamoService';

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

/**
 * Garantías después de cada abono (confirmado por la cooperativa, 2026-09-18).
 *
 * Los fiadores cubren la parte del saldo que no cubre el ahorro propio del
 * socio. A medida que el socio paga, sobra garantía y se libera DE A UNO, en el
 * orden elegido al otorgar el préstamo: primero todo lo del fiador 1, después
 * el 2. Cuando lo que debe es igual o menor que su ahorro propio, los fiadores
 * ya no tienen nada que ver. Al saldar se libera todo, también el ahorro
 * propio del socio y lo que puso de inicial con su ahorro.
 *
 * Un reverso que reabre la deuda no vuelve a bloquear nada: la cooperativa
 * confirmó que a los fiadores liberados no se les bloquea de nuevo.
 */
export const ajustarGarantias = async (
  tx: Prisma.TransactionClient,
  prestamoId: number,
  tasa: number
): Promise<void> => {
  const prestamo = await tx.prestamo.findUniqueOrThrow({
    where: { id: prestamoId },
    include: { fiadores: { where: { estado: 'activo' }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
  });
  const saldado = prestamo.estado === 'saldado';
  const propia = Number(prestamo.garantia_propia_usd);
  const necesaria = saldado ? 0 : Math.max(0, redondear(Number(prestamo.saldo_capital_usd) - propia));
  let sobra = redondear(prestamo.fiadores.reduce((a, f) => a + Number(f.monto_bloqueado_usd), 0) - necesaria);

  for (const fiador of prestamo.fiadores) {
    if (sobra <= 0) break;
    const bloqueado = Number(fiador.monto_bloqueado_usd);
    const liberar = Math.min(bloqueado, sobra);
    await desbloquearAhorro(tx, fiador.socio_id, liberar, tasa);
    const resto = redondear(bloqueado - liberar);
    await tx.fiador.update({
      where: { id: fiador.id },
      data: {
        monto_bloqueado_usd: resto,
        monto_bloqueado_bs: redondear(resto * tasa),
        ...(resto <= 0 ? { estado: 'liberado' as const, fecha_liberacion: new Date() } : {}),
      },
    });
    sobra = redondear(sobra - liberar);
  }

  if (saldado && !prestamo.garantias_liberadas) {
    const propioBloqueado = redondear(propia + Number(prestamo.inicial_ahorro_usd));
    await desbloquearAhorro(tx, prestamo.socio_id, propioBloqueado, tasa);
    await tx.prestamo.update({ where: { id: prestamoId }, data: { garantias_liberadas: true } });
  }
};
