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

export type EstadoCuotaCalculado = 'pendiente' | 'pagada' | 'vencida';

/**
 * Estado de cada cuota según lo abonado VIGENTE, acumulado.
 *
 * Antes cada abono marcaba cuotas por su cuenta y sólo si él solo cubría una
 * cuota completa: dos medios pagos dejaban la cuota pendiente para siempre, el
 * abono cobrado en caja no marcaba ninguna, y un reverso no tenía forma de
 * saber qué cuotas desmarcar. Recalcular desde el total resuelve las tres
 * cosas, y da lo mismo en qué orden llegaron los abonos.
 *
 * Lo abonado a mora no cuenta: la mora es un recargo aparte, no paga cuotas.
 */
export const estadosDeCuotas = (
  cuotas: { numero_cuota: number; monto_total_usd: number; fecha_vencimiento: Date }[],
  aplicadoACuotasUsd: number,
  hoy: Date = new Date()
): { numero_cuota: number; estado: EstadoCuotaCalculado }[] => {
  let disponible = redondear(aplicadoACuotasUsd);
  let cubriendo = true;

  return [...cuotas]
    .sort((a, b) => a.numero_cuota - b.numero_cuota)
    .map((cuota) => {
      // Misma tolerancia de un centavo que usaba el marcado por abono
      if (cubriendo && disponible + 0.009 >= cuota.monto_total_usd) {
        disponible = redondear(disponible - cuota.monto_total_usd);
        return { numero_cuota: cuota.numero_cuota, estado: 'pagada' as const };
      }
      // Las cuotas se pagan en orden: la primera que no alcanza corta la cadena
      cubriendo = false;
      return {
        numero_cuota: cuota.numero_cuota,
        estado: cuota.fecha_vencimiento < hoy ? ('vencida' as const) : ('pendiente' as const),
      };
    });
};
