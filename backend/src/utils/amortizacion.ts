// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Cálculo de préstamos y plan de pagos
// ============================================
//
// El esquema del sistema nuevo define `cuota_semanal_usd` y una tabla
// `plan_pagos` con capital e interés desglosados por cuota, es decir
// AMORTIZACIÓN con cuota fija (sistema francés) sobre plazo en semanas.
//
// La tasa se guarda como ANUAL (`tasa_interes_anual`), así que se convierte a
// semanal dividiendo entre 52.

export interface CuotaPlan {
  numero_cuota: number;
  fecha_vencimiento: Date;
  monto_capital_usd: number;
  monto_interes_usd: number;
  monto_total_usd: number;
  /** Saldo de capital que queda DESPUÉS de pagar esta cuota */
  saldo_restante_usd: number;
}

export interface ResultadoAmortizacion {
  cuota_semanal_usd: number;
  total_interes_usd: number;
  total_a_pagar_usd: number;
  plan: CuotaPlan[];
}

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * Cuota fija del sistema francés:
 *
 *   cuota = C · i / (1 − (1 + i)^−n)
 *
 * con `i` = tasa semanal y `n` = plazo en semanas. Si la tasa es cero, la
 * cuota es el capital repartido en partes iguales.
 */
export const calcularCuotaSemanal = (
  capital: number,
  tasaAnualPorcentaje: number,
  plazoSemanas: number
): number => {
  if (plazoSemanas <= 0) throw new Error('El plazo debe ser mayor a cero');
  if (capital <= 0) throw new Error('El monto debe ser mayor a cero');

  const i = tasaAnualPorcentaje / 100 / 52;
  if (i === 0) return redondear(capital / plazoSemanas);

  const cuota = (capital * i) / (1 - Math.pow(1 + i, -plazoSemanas));
  return redondear(cuota);
};

/**
 * Genera el plan de pagos completo.
 *
 * La ÚLTIMA cuota absorbe el descuadre de los redondeos, de modo que la suma
 * del capital de todas las cuotas sea exactamente el monto prestado. Sin eso
 * el préstamo queda con un saldo residual de centavos que nunca se salda.
 */
export const generarPlanPagos = (
  capital: number,
  tasaAnualPorcentaje: number,
  plazoSemanas: number,
  fechaDesembolso: Date
): ResultadoAmortizacion => {
  const cuotaSemanal = calcularCuotaSemanal(capital, tasaAnualPorcentaje, plazoSemanas);
  const i = tasaAnualPorcentaje / 100 / 52;

  const plan: CuotaPlan[] = [];
  let saldo = capital;
  let totalInteres = 0;

  for (let n = 1; n <= plazoSemanas; n++) {
    const interes = redondear(saldo * i);
    let capitalCuota = redondear(cuotaSemanal - interes);

    // Última cuota: se lleva lo que quede para cerrar en cero exacto
    if (n === plazoSemanas) {
      capitalCuota = redondear(saldo);
    }

    saldo = redondear(saldo - capitalCuota);
    totalInteres = redondear(totalInteres + interes);

    const vencimiento = new Date(fechaDesembolso);
    vencimiento.setDate(vencimiento.getDate() + n * 7);

    plan.push({
      numero_cuota: n,
      fecha_vencimiento: vencimiento,
      monto_capital_usd: capitalCuota,
      monto_interes_usd: interes,
      monto_total_usd: redondear(capitalCuota + interes),
      saldo_restante_usd: Math.max(saldo, 0),
    });
  }

  return {
    cuota_semanal_usd: cuotaSemanal,
    total_interes_usd: totalInteres,
    total_a_pagar_usd: redondear(capital + totalInteres),
    plan,
  };
};

/**
 * Mora acumulada sobre las cuotas vencidas y no pagadas.
 *
 * Se cobra la tasa de mora MENSUAL prorrateada por los días de atraso de cada
 * cuota, sobre el monto de esa cuota.
 */
export const calcularMora = (
  cuotasVencidas: { monto_total_usd: number; fecha_vencimiento: Date }[],
  tasaMoraMensualPorcentaje: number,
  hasta: Date = new Date()
): number => {
  const tasaDiaria = tasaMoraMensualPorcentaje / 100 / 30;
  let mora = 0;

  for (const cuota of cuotasVencidas) {
    const dias = Math.floor(
      (hasta.getTime() - cuota.fecha_vencimiento.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dias > 0) {
      mora += cuota.monto_total_usd * tasaDiaria * dias;
    }
  }

  return redondear(mora);
};

/**
 * Distribuye un abono. El orden NO es arbitrario: primero mora, después
 * interés y por último capital. Aplicar al capital antes que al interés
 * abarataría el préstamo y descuadraría la contabilidad.
 */
export const distribuirAbono = (
  monto: number,
  saldoMora: number,
  saldoInteres: number,
  saldoCapital: number
): { mora: number; interes: number; capital: number; sobrante: number } => {
  let restante = redondear(monto);

  const mora = Math.min(restante, saldoMora);
  restante = redondear(restante - mora);

  const interes = Math.min(restante, saldoInteres);
  restante = redondear(restante - interes);

  const capital = Math.min(restante, saldoCapital);
  restante = redondear(restante - capital);

  return { mora, interes, capital, sobrante: restante };
};
