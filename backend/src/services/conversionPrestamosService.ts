// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Conversión de los préstamos vigentes al cálculo nuevo
// ============================================
//
// La cooperativa pidió pasar los préstamos que ya están dados al cálculo
// confirmado (interés mensual por día sobre el saldo, cuotas de la tabla). Eso
// CAMBIA saldos, así que primero se informa y después se decide: este servicio
// no escribe nada, sólo compara.
//
// Cómo se recalcula un préstamo: se arranca del monto otorgado el día del
// desembolso y se recorren sus abonos vigentes en orden. Entre un abono y el
// siguiente corre el interés por día sobre el capital que quedaba; cada abono
// paga primero el interés corrido y después el capital. El sobrante de un abono
// que excede la deuda se anota, porque en el cálculo viejo ese dinero pagó un
// interés prefijado que ahora no existe.

import type { Prisma, PrismaClient } from '@prisma/client';
import { redondear } from './cobroSemanalService';
import { hoyDia } from '../utils/fechaDia';
import { interesDelPeriodo, tramoDelMonto } from '../utils/planPrestamo';

type Db = PrismaClient | Prisma.TransactionClient;

export interface AbonoParaConversion {
  fecha_abono: Date;
  monto_usd: number;
}

export interface EntradaConversion {
  monto_original_usd: number;
  fecha_desembolso: Date;
  tasa_mensual: number;
  abonos: AbonoParaConversion[];
}

export interface ResultadoConversion {
  saldo_capital_usd: number;
  saldo_interes_usd: number;
  deuda_total_usd: number;
  interes_corrido_usd: number;
  /** Lo abonado que excedió la deuda recalculada: en el cálculo viejo pagó interés prefijado */
  sobrante_usd: number;
  abonos_aplicados: number;
}

/** Recalcula un préstamo con el interés diario, desde el desembolso hasta hoy */
export const simularConversionPrestamo = (
  entrada: EntradaConversion,
  hasta: Date = hoyDia()
): ResultadoConversion => {
  let capital = redondear(entrada.monto_original_usd);
  let interes = 0;
  let interesCorrido = 0;
  let sobrante = 0;
  let fecha = entrada.fecha_desembolso;

  const abonos = [...entrada.abonos].sort((a, b) => a.fecha_abono.getTime() - b.fecha_abono.getTime());
  for (const abono of abonos) {
    const dias = Math.max(0, Math.floor((abono.fecha_abono.getTime() - fecha.getTime()) / 86_400_000));
    const nuevo = interesDelPeriodo(capital, entrada.tasa_mensual, dias);
    interes = redondear(interes + nuevo);
    interesCorrido = redondear(interesCorrido + nuevo);
    fecha = abono.fecha_abono > fecha ? abono.fecha_abono : fecha;

    let pago = redondear(abono.monto_usd);
    const aInteres = Math.min(pago, interes);
    interes = redondear(interes - aInteres);
    pago = redondear(pago - aInteres);
    const aCapital = Math.min(pago, capital);
    capital = redondear(capital - aCapital);
    pago = redondear(pago - aCapital);
    if (pago > 0) sobrante = redondear(sobrante + pago);
  }

  const diasFinales = Math.max(0, Math.floor((hasta.getTime() - fecha.getTime()) / 86_400_000));
  const ultimo = interesDelPeriodo(capital, entrada.tasa_mensual, diasFinales);
  interes = redondear(interes + ultimo);
  interesCorrido = redondear(interesCorrido + ultimo);

  return {
    saldo_capital_usd: capital,
    saldo_interes_usd: interes,
    deuda_total_usd: redondear(capital + interes),
    interes_corrido_usd: interesCorrido,
    sobrante_usd: sobrante,
    abonos_aplicados: abonos.length,
  };
};

export interface FilaConversion {
  numero_prestamo: string;
  codigo_socio: string;
  socio: string;
  tipo: string;
  monto_original_usd: number;
  fecha_desembolso: Date;
  abonado_usd: number;
  /** Lo que dice hoy el sistema */
  deuda_actual_usd: number;
  /** Lo que diría con el cálculo nuevo */
  deuda_nueva_usd: number;
  diferencia_usd: number;
  cuotas_actuales: number;
  cuotas_nuevas: number | null;
  observacion: string;
}

/**
 * Compara todos los préstamos que siguen con el cálculo viejo. No escribe nada:
 * es la lista para revisar con la cooperativa antes de convertir.
 */
export const conversionDePrestamos = async (db: Db, hasta: Date = hoyDia()) => {
  const prestamos = await db.prestamo.findMany({
    where: { estado: { in: ['activo', 'moroso'] }, interes_calculado_hasta: null },
    include: {
      socio: { select: { codigo_socio: true, nombre: true, apellido: true } },
      tipo_prestamo: { select: { nombre: true, tasa_interes_mensual: true, tasa_interes_anual: true } },
      abonos: { where: { reversado: false }, select: { fecha_abono: true, monto_usd: true } },
      plan_pagos: { select: { id: true } },
    },
    orderBy: { numero_prestamo: 'asc' },
  });

  const filas: FilaConversion[] = prestamos.map((p) => {
    const tasaMensual =
      Number(p.tipo_prestamo.tasa_interes_mensual) || redondear(Number(p.tipo_prestamo.tasa_interes_anual) / 12);
    const monto = Number(p.monto_original_usd);
    const nuevo = simularConversionPrestamo(
      {
        monto_original_usd: monto,
        fecha_desembolso: p.fecha_desembolso,
        tasa_mensual: tasaMensual,
        abonos: p.abonos.map((a) => ({ fecha_abono: a.fecha_abono, monto_usd: Number(a.monto_usd) })),
      },
      hasta
    );
    const actual = redondear(
      Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd)
    );
    const tramo = tramoDelMonto(monto);

    const avisos: string[] = [];
    if (!tramo) avisos.push('el monto queda fuera de la tabla: hay que decidir las cuotas a mano');
    if (nuevo.sobrante_usd > 0) avisos.push(`sobran $${nuevo.sobrante_usd} de lo abonado`);
    if (nuevo.deuda_total_usd === 0) avisos.push('con el cálculo nuevo ya estaría saldado');

    return {
      numero_prestamo: p.numero_prestamo,
      codigo_socio: p.socio.codigo_socio,
      socio: `${p.socio.apellido}, ${p.socio.nombre}`,
      tipo: p.tipo_prestamo.nombre,
      monto_original_usd: monto,
      fecha_desembolso: p.fecha_desembolso,
      abonado_usd: redondear(p.abonos.reduce((a, x) => a + Number(x.monto_usd), 0)),
      deuda_actual_usd: actual,
      deuda_nueva_usd: nuevo.deuda_total_usd,
      diferencia_usd: redondear(nuevo.deuda_total_usd - actual),
      cuotas_actuales: p.plan_pagos.length,
      cuotas_nuevas: tramo?.cuotas ?? null,
      observacion: avisos.join(' · '),
    };
  });

  const suma = (campo: keyof FilaConversion) =>
    redondear(filas.reduce((a, f) => a + (typeof f[campo] === 'number' ? (f[campo] as number) : 0), 0));

  return {
    hasta,
    filas,
    totales: {
      prestamos: filas.length,
      deuda_actual_usd: suma('deuda_actual_usd'),
      deuda_nueva_usd: suma('deuda_nueva_usd'),
      diferencia_usd: suma('diferencia_usd'),
      bajan: filas.filter((f) => f.diferencia_usd < -0.009).length,
      suben: filas.filter((f) => f.diferencia_usd > 0.009).length,
    },
  };
};
