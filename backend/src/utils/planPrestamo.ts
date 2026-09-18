// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Préstamos: tabla de cuotas, inicial e interés diario
// ============================================
//
// Reglas confirmadas por la cooperativa (2026-09-16/17), que reemplazan a la
// cuota fija semanal del sistema francés:
//
//   - La CANTIDAD DE CUOTAS sale de una tabla por monto, igual para todos los
//     tipos (línea blanca, efectivo y gastos médicos).
//   - La INICIAL ("% de divisas en el fondo") se paga al llevarse el producto:
//     con ahorro en divisas, que queda bloqueado, en bolívares, o mezclando.
//   - Las cuotas reparten el SALDO DEUDOR que queda después de la inicial
//     (confirmado el 2026-09-18): con 1.000 hay 500 de inicial y los otros 500
//     se pagan en 24 cuotas. La columna "pagos x cuota" de la tabla, que dividía
//     el monto completo, no es la que se usa.
//   - El INTERÉS es mensual por tipo de préstamo (1,5% línea blanca, 1%
//     efectivo) y se calcula DIARIO sobre el saldo que se debe, así que pagar
//     antes abarata el préstamo y pagar tarde lo encarece.
//   - Las cuotas vencen cada 21 días desde la entrega.
//   - No hay recargo por atraso: a los 21 días de una cuota vencida el socio
//     recibe un aviso y a los 30 queda moroso.

/** Un tramo de la tabla: hasta `hasta` dólares, tantas cuotas y tanto de inicial */
export interface TramoPrestamo {
  desde: number;
  hasta: number;
  cuotas: number;
  /** Porcentaje del monto que se paga como inicial */
  inicial_porcentaje: number;
}

/** Tabla que pasó la cooperativa el 2026-09-17. Fuera de estos montos no se presta. */
export const TABLA_PRESTAMOS: TramoPrestamo[] = [
  { desde: 5, hasta: 25, cuotas: 1, inicial_porcentaje: 10 },
  { desde: 26, hasta: 50, cuotas: 2, inicial_porcentaje: 10 },
  { desde: 51, hasta: 120, cuotas: 5, inicial_porcentaje: 20 },
  { desde: 121, hasta: 220, cuotas: 6, inicial_porcentaje: 20 },
  { desde: 221, hasta: 320, cuotas: 8, inicial_porcentaje: 20 },
  { desde: 321, hasta: 420, cuotas: 10, inicial_porcentaje: 30 },
  { desde: 421, hasta: 520, cuotas: 13, inicial_porcentaje: 30 },
  { desde: 521, hasta: 620, cuotas: 15, inicial_porcentaje: 30 },
  { desde: 621, hasta: 720, cuotas: 18, inicial_porcentaje: 30 },
  { desde: 721, hasta: 1000, cuotas: 24, inicial_porcentaje: 50 },
  { desde: 1001, hasta: 2000, cuotas: 30, inicial_porcentaje: 50 },
];

export const DIAS_POR_CUOTA = 21;
export const DIAS_PARA_AVISO = 21;
export const DIAS_PARA_MOROSO = 30;

const DIA_MS = 86_400_000;
const redondear = (valor: number): number => Math.round(valor * 100) / 100;

/** Días completos entre dos fechas */
export const diasEntre = (desde: Date, hasta: Date): number =>
  Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS);

/** El tramo que le toca a un monto, o null si queda fuera de la tabla */
export const tramoDelMonto = (montoUsd: number): TramoPrestamo | null =>
  TABLA_PRESTAMOS.find((t) => montoUsd >= t.desde && montoUsd <= t.hasta) ?? null;

export interface CondicionesPrestamo {
  tramo: TramoPrestamo;
  cuotas: number;
  /** Capital de cada cuota; la última absorbe el redondeo */
  cuota_capital_usd: number;
  /** Se paga al llevarse el producto */
  inicial_usd: number;
  /** Saldo deudor que se paga en cuotas: el monto menos la inicial */
  financiado_usd: number;
}

/**
 * Condiciones de un monto: cuántas cuotas, cuánto de inicial y de cuánto es
 * cada cuota. Las cuotas reparten lo que queda después de la inicial.
 */
export const condicionesDelMonto = (montoUsd: number): CondicionesPrestamo => {
  const tramo = tramoDelMonto(montoUsd);
  if (!tramo) {
    const menor = TABLA_PRESTAMOS[0]!;
    const mayor = TABLA_PRESTAMOS[TABLA_PRESTAMOS.length - 1]!;
    throw new Error(`El monto $${montoUsd} está fuera de la tabla: va de $${menor.desde} a $${mayor.hasta}`);
  }
  const inicial = redondear((montoUsd * tramo.inicial_porcentaje) / 100);
  const financiado = redondear(montoUsd - inicial);
  return {
    tramo,
    cuotas: tramo.cuotas,
    cuota_capital_usd: redondear(financiado / tramo.cuotas),
    inicial_usd: inicial,
    financiado_usd: financiado,
  };
};

export interface CuotaProgramada {
  numero_cuota: number;
  fecha_vencimiento: Date;
  monto_capital_usd: number;
  /** Interés estimado si la cuota se paga el día que vence; el real se calcula por día */
  monto_interes_estimado_usd: number;
  monto_total_estimado_usd: number;
  saldo_restante_usd: number;
}

/**
 * Plan de cuotas: capital parejo y una cuota cada 21 días desde la entrega.
 *
 * El interés del plan es una ESTIMACIÓN, porque el real depende del día en que
 * se pague cada cuota. La última cuota se lleva el redondeo para que el capital
 * cierre exacto y el préstamo no quede con centavos que nunca se saldan.
 */
export const planDeCuotas = (
  financiadoUsd: number,
  cuotas: number,
  tasaMensualPorcentaje: number,
  fechaEntrega: Date,
  diasPorCuota: number = DIAS_POR_CUOTA
): CuotaProgramada[] => {
  if (cuotas <= 0) throw new Error('La cantidad de cuotas debe ser mayor a cero');
  if (financiadoUsd <= 0) throw new Error('El monto a financiar debe ser mayor a cero');

  const capitalCuota = redondear(financiadoUsd / cuotas);
  const plan: CuotaProgramada[] = [];
  let saldo = financiadoUsd;

  for (let n = 1; n <= cuotas; n++) {
    const capital = n === cuotas ? redondear(saldo) : capitalCuota;
    const interes = interesDelPeriodo(saldo, tasaMensualPorcentaje, diasPorCuota);
    saldo = redondear(saldo - capital);
    const vencimiento = new Date(fechaEntrega.getTime() + n * diasPorCuota * DIA_MS);
    plan.push({
      numero_cuota: n,
      fecha_vencimiento: vencimiento,
      monto_capital_usd: capital,
      monto_interes_estimado_usd: interes,
      monto_total_estimado_usd: redondear(capital + interes),
      saldo_restante_usd: Math.max(saldo, 0),
    });
  }

  return plan;
};

/** Interés de `dias` sobre un saldo, con la tasa mensual prorrateada a 30 días */
export const interesDelPeriodo = (
  saldoUsd: number,
  tasaMensualPorcentaje: number,
  dias: number
): number => {
  if (saldoUsd <= 0 || dias <= 0) return 0;
  return redondear((saldoUsd * (tasaMensualPorcentaje / 100) * dias) / 30);
};

/** Interés corrido entre dos fechas sobre el saldo que se debe */
export const interesAcumulado = (
  saldoUsd: number,
  tasaMensualPorcentaje: number,
  desde: Date,
  hasta: Date
): number => interesDelPeriodo(saldoUsd, tasaMensualPorcentaje, diasEntre(desde, hasta));

export type SituacionPago = 'al_dia' | 'con_aviso' | 'moroso';

export interface AtrasoPrestamo {
  situacion: SituacionPago;
  /** Días desde el vencimiento de la cuota impaga más vieja */
  dias_atraso: number;
  cuotas_vencidas: number;
}

/**
 * Situación del préstamo: sin recargo por atraso, sólo el aviso a los 21 días
 * de la cuota más vieja sin pagar y la mora a los 30 (confirmado).
 */
export const situacionDeAtraso = (
  cuotas: { fecha_vencimiento: Date; pagada: boolean }[],
  hoy: Date = new Date()
): AtrasoPrestamo => {
  const vencidas = cuotas
    .filter((c) => !c.pagada && c.fecha_vencimiento <= hoy)
    .sort((a, b) => a.fecha_vencimiento.getTime() - b.fecha_vencimiento.getTime());

  if (vencidas.length === 0) return { situacion: 'al_dia', dias_atraso: 0, cuotas_vencidas: 0 };

  const dias = diasEntre(vencidas[0]!.fecha_vencimiento, hoy);
  const situacion: SituacionPago =
    dias >= DIAS_PARA_MOROSO ? 'moroso' : dias >= DIAS_PARA_AVISO ? 'con_aviso' : 'al_dia';
  return { situacion, dias_atraso: Math.max(dias, 0), cuotas_vencidas: vencidas.length };
};
