// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Interés de préstamo corrido por día
// ============================================
//
// Confirmado por la cooperativa: el interés es mensual por tipo de préstamo
// (1,5% línea blanca, 1% efectivo) y se calcula A DIARIO sobre el saldo que se
// debe. Así, pagar antes abarata el préstamo y pagar tarde lo encarece, que es
// lo contrario del plan francés con interés prefijado que había.
//
// El interés NO se recalcula desde cero: se va acumulando en `saldo_interes_usd`
// y `interes_calculado_hasta` dice hasta qué día está corrido. Sin esa marca el
// préstamo es de los anteriores al cambio y conserva su interés prefijado, hasta
// que se convierta con el informe que revisa la cooperativa.

import type { Prisma, PrismaClient } from '@prisma/client';
import { redondear } from './cobroSemanalService';
import { hoyDia } from '../utils/fechaDia';
import { interesDelPeriodo, diasEntre } from '../utils/planPrestamo';

type Db = PrismaClient | Prisma.TransactionClient;

/** Lo mínimo del préstamo para correr el interés */
export interface PrestamoParaInteres {
  id: number;
  saldo_capital_usd: Prisma.Decimal | number;
  saldo_interes_usd: Prisma.Decimal | number;
  tasa_interes_mensual: Prisma.Decimal | number;
  interes_calculado_hasta: Date | null;
  tasa_cambio_inicial: Prisma.Decimal | number;
  estado: string;
}

/** Los préstamos anteriores al cálculo nuevo no tienen la marca y no se tocan */
export const usaInteresDiario = (p: { interes_calculado_hasta: Date | null }): boolean =>
  p.interes_calculado_hasta !== null;

/** Interés corrido desde la última vez que se calculó hasta `hasta`, sin guardarlo */
export const interesCorrido = (p: PrestamoParaInteres, hasta: Date = hoyDia()): number => {
  if (!usaInteresDiario(p) || p.estado === 'saldado' || p.estado === 'cancelado') return 0;
  const dias = diasEntre(p.interes_calculado_hasta!, hasta);
  if (dias <= 0) return 0;
  return interesDelPeriodo(Number(p.saldo_capital_usd), Number(p.tasa_interes_mensual), dias);
};

/** Saldos del préstamo con el interés corrido hasta hoy, sin guardarlo */
export const saldosAlDia = (p: PrestamoParaInteres, hasta: Date = hoyDia()) => {
  const nuevo = interesCorrido(p, hasta);
  const interes = redondear(Number(p.saldo_interes_usd) + nuevo);
  return {
    interes_nuevo_usd: nuevo,
    saldo_capital_usd: redondear(Number(p.saldo_capital_usd)),
    saldo_interes_usd: interes,
    deuda_total_usd: redondear(Number(p.saldo_capital_usd) + interes),
  };
};

/**
 * Suma el interés corrido y deja la marca en `hasta`. Se llama ANTES de aplicar
 * un abono y al consultar el préstamo, siempre dentro de la transacción que ya
 * bloqueó al socio: dos abonos simultáneos cobrarían el mismo interés dos veces.
 */
export const ponerInteresAlDia = async (
  db: Db,
  prestamo: PrestamoParaInteres,
  hasta: Date = hoyDia()
): Promise<{ saldo_interes_usd: number; interes_nuevo_usd: number }> => {
  const saldos = saldosAlDia(prestamo, hasta);
  if (!usaInteresDiario(prestamo) || saldos.interes_nuevo_usd === 0) {
    return { saldo_interes_usd: redondear(Number(prestamo.saldo_interes_usd)), interes_nuevo_usd: 0 };
  }

  const tasaCambio = Number(prestamo.tasa_cambio_inicial);
  await db.prestamo.update({
    where: { id: prestamo.id },
    data: {
      saldo_interes_usd: saldos.saldo_interes_usd,
      saldo_interes_bs: redondear(saldos.saldo_interes_usd * tasaCambio),
      interes_calculado_hasta: hasta,
    },
  });

  return { saldo_interes_usd: saldos.saldo_interes_usd, interes_nuevo_usd: saldos.interes_nuevo_usd };
};
