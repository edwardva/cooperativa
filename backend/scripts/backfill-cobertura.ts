/**
 * ============================================
 * BACKFILL: cobertura por (año, semana)
 * ============================================
 *
 * Traduce el contador `semanas_sin_pago` de cada acuerdo a una cobertura
 * concreta: estar N semanas sin pagar equivale a estar cubierto hasta N semanas
 * antes de la actual.
 *
 * También rellena `fecha_ultimo_pago` desde el historial de movimientos, que es
 * el dato que el cliente pidió distinguir de "hasta cuándo quedó cubierto".
 *
 * Es idempotente: sólo toca acuerdos cuya cobertura todavía está vacía, así que
 * se puede correr varias veces sin pisar lo ya cobrado por el sistema nuevo.
 *
 *   npx tsx scripts/backfill-cobertura.ts           (simulación, no escribe)
 *   npx tsx scripts/backfill-cobertura.ts --aplicar (escribe)
 */

import { PrismaClient } from '@prisma/client';
import { semanaActual, sumarSemanas, formatearPeriodo } from '../src/utils/calendarioSemanal';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

async function ultimoPagoPorAcuerdo(servicio: 'funeraria' | 'salud') {
  const filas =
    servicio === 'funeraria'
      ? await prisma.movimientoFuneraria.groupBy({
          by: ['acuerdo_id'],
          where: { tipo_movimiento: 'pago' },
          _max: { fecha_movimiento: true },
        })
      : await prisma.movimientoSalud.groupBy({
          by: ['acuerdo_id'],
          where: { tipo_movimiento: 'pago' },
          _max: { fecha_movimiento: true },
        });

  return new Map(filas.map((f) => [f.acuerdo_id, f._max.fecha_movimiento]));
}

async function procesar(servicio: 'funeraria' | 'salud') {
  const actual = semanaActual();
  const ultimoPago = await ultimoPagoPorAcuerdo(servicio);

  const acuerdos =
    servicio === 'funeraria'
      ? await prisma.acuerdoFuneraria.findMany({
          where: { ano_pagado_hasta: null },
          select: { id: true, semanas_sin_pago: true, estado: true },
        })
      : await prisma.acuerdoSalud.findMany({
          where: { ano_pagado_hasta: null },
          select: { id: true, semanas_sin_pago: true, estado: true },
        });

  console.log(`\n${servicio.toUpperCase()}: ${acuerdos.length} acuerdo(s) sin cobertura`);
  if (acuerdos.length === 0) return 0;

  const muestra = acuerdos.slice(0, 5);
  for (const a of muestra) {
    const cobertura = sumarSemanas(actual, -a.semanas_sin_pago);
    console.log(
      `  #${a.id}  ${a.semanas_sin_pago} sem. sin pago  ->  cubierto hasta ${formatearPeriodo(cobertura)}`
    );
  }
  if (acuerdos.length > muestra.length) console.log(`  ... y ${acuerdos.length - muestra.length} más`);

  if (!APLICAR) return acuerdos.length;

  // Se agrupan por atraso: todos los acuerdos con el mismo contador comparten
  // cobertura, así que salen en un updateMany en vez de uno por fila.
  const porAtraso = new Map<number, number[]>();
  for (const a of acuerdos) {
    const lista = porAtraso.get(a.semanas_sin_pago) ?? [];
    lista.push(a.id);
    porAtraso.set(a.semanas_sin_pago, lista);
  }

  for (const [atraso, ids] of porAtraso) {
    const cobertura = sumarSemanas(actual, -atraso);
    const datos = {
      ano_pagado_hasta: cobertura.ano,
      semana_pagada_hasta: cobertura.semana,
    };
    if (servicio === 'funeraria') {
      await prisma.acuerdoFuneraria.updateMany({ where: { id: { in: ids } }, data: datos });
    } else {
      await prisma.acuerdoSalud.updateMany({ where: { id: { in: ids } }, data: datos });
    }
  }

  // La fecha del último pago sí es propia de cada acuerdo
  let conFecha = 0;
  for (const a of acuerdos) {
    const fecha = ultimoPago.get(a.id);
    if (!fecha) continue;
    if (servicio === 'funeraria') {
      await prisma.acuerdoFuneraria.update({ where: { id: a.id }, data: { fecha_ultimo_pago: fecha } });
    } else {
      await prisma.acuerdoSalud.update({ where: { id: a.id }, data: { fecha_ultimo_pago: fecha } });
    }
    conFecha++;
  }

  console.log(`  aplicado: ${acuerdos.length} cobertura(s), ${conFecha} fecha(s) de último pago`);
  return acuerdos.length;
}

(async () => {
  const actual = semanaActual();
  console.log('='.repeat(60));
  console.log(`Backfill de cobertura — semana actual ${formatearPeriodo(actual)}`);
  console.log(APLICAR ? 'MODO: aplicar' : 'MODO: simulación (use --aplicar para escribir)');
  console.log('='.repeat(60));

  const total = (await procesar('funeraria')) + (await procesar('salud'));

  console.log(`\nTotal: ${total} acuerdo(s)${APLICAR ? ' actualizados' : ' a actualizar'}`);
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
