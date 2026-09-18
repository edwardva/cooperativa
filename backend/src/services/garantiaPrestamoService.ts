// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Ahorro que respalda un préstamo
// ============================================
//
// Confirmado por la cooperativa: el socio respalda con su propio ahorro, que
// queda bloqueado, y los fiadores cubren SÓLO la diferencia que le falta. Por
// eso el préstamo que el socio cubre con lo suyo se entrega directo y el resto
// espera la reunión de los martes.
//
// Bloquear no es retirar: el dinero sigue en la cuenta del socio, pero no se
// puede sacar ni usar para respaldar otro préstamo.

import type { Prisma, PrismaClient } from '@prisma/client';
import { BadRequestError } from '../middleware/errorHandler';
import { redondear } from './cobroSemanalService';

type Db = PrismaClient | Prisma.TransactionClient;

/** Ahorro que el socio puede usar: lo que tiene menos lo que ya está bloqueado */
export const ahorroLibre = async (db: Db, socioId: number): Promise<number> => {
  const cuentas = await db.cuentaAhorro.findMany({ where: { socio_id: socioId, estado: true } });
  return redondear(
    cuentas.reduce((a, c) => a + (Number(c.saldo_usd) - Number(c.monto_bloqueado_usd)), 0)
  );
};

/** Devuelve hasta `montoUsd` del ahorro bloqueado del socio. Dice cuánto liberó. */
export const desbloquearAhorro = async (
  db: Db,
  socioId: number,
  montoUsd: number,
  tasaCambio: number
): Promise<number> => {
  let porLiberar = redondear(montoUsd);
  if (porLiberar <= 0) return 0;

  const cuentas = await db.cuentaAhorro.findMany({
    where: { socio_id: socioId, monto_bloqueado_usd: { gt: 0 } },
    orderBy: { monto_bloqueado_usd: 'desc' },
  });
  for (const cuenta of cuentas) {
    if (porLiberar <= 0) break;
    const liberar = Math.min(Number(cuenta.monto_bloqueado_usd), porLiberar);
    const resto = redondear(Number(cuenta.monto_bloqueado_usd) - liberar);
    await db.cuentaAhorro.update({
      where: { id: cuenta.id },
      data: { monto_bloqueado_usd: resto, monto_bloqueado_bs: redondear(resto * tasaCambio) },
    });
    porLiberar = redondear(porLiberar - liberar);
  }
  return redondear(montoUsd - porLiberar);
};

/**
 * Bloquea `montoUsd` del ahorro del socio, cuenta por cuenta, empezando por la
 * de mayor saldo. Si entre la consulta y el bloqueo el ahorro bajó, falla en
 * vez de bloquear de menos: una garantía incompleta no se nota hasta que hay
 * que ejecutarla.
 */
export const bloquearAhorro = async (
  db: Db,
  socioId: number,
  montoUsd: number,
  tasaCambio: number,
  quien = 'socio'
): Promise<void> => {
  let porBloquear = redondear(montoUsd);
  if (porBloquear <= 0) return;

  const cuentas = await db.cuentaAhorro.findMany({
    where: { socio_id: socioId, estado: true },
    orderBy: { saldo_usd: 'desc' },
  });

  for (const cuenta of cuentas) {
    if (porBloquear <= 0) break;
    const libre = Number(cuenta.saldo_usd) - Number(cuenta.monto_bloqueado_usd);
    const bloquear = Math.min(libre, porBloquear);
    if (bloquear <= 0) continue;

    const nuevo = redondear(Number(cuenta.monto_bloqueado_usd) + bloquear);
    await db.cuentaAhorro.update({
      where: { id: cuenta.id },
      data: { monto_bloqueado_usd: nuevo, monto_bloqueado_bs: redondear(nuevo * tasaCambio) },
    });
    porBloquear = redondear(porBloquear - bloquear);
  }

  if (porBloquear > 0) {
    const socio = await db.socio.findUnique({ where: { id: socioId }, select: { codigo_socio: true } });
    throw new BadRequestError(
      `El ${quien} ${socio?.codigo_socio ?? socioId} ya no tiene ahorro libre suficiente: ` +
        `faltan $${porBloquear} por bloquear`
    );
  }
};
