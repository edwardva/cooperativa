/**
 * ============================================
 * Catálogo de tipos de préstamo
 * ============================================
 *
 * Las categorías reales que maneja la cooperativa, tomadas del catálogo del
 * sistema actual. Antes había un único "Préstamo Personal" de relleno, así que
 * en la pantalla de colecta los cuatro préstamos de un socio aparecían con el
 * mismo nombre y no se distinguía cuál era cuál.
 *
 * Cada tipo trae SU MONEDA: es lo que responde la duda de la reunión sobre si
 * "divisa" era una categoría de préstamo. No lo es — es un atributo de la
 * categoría, y el préstamo la hereda al otorgarse.
 *
 * Es idempotente: no pisa las tasas que la cooperativa haya ajustado.
 *
 *   npx tsx scripts/seed-tipos-prestamo.ts
 */

import { PrismaClient, Moneda } from '@prisma/client';

const prisma = new PrismaClient();

/** codigo, nombre, tasa anual, moneda, dias de mora */
const TIPOS: [string, string, number, Moneda, number][] = [
  ['01', 'Con fiador', 2.5, 'BS', 60],
  ['03', 'Medicamento', 1.5, 'BS', 60],
  ['04', 'Línea blanca', 1.5, 'USD', 30],
  ['05', 'Efectivo', 1.0, 'BS', 30],
  ['06', 'Largo plazo', 2.0, 'BS', 60],
  ['07', 'Mediano plazo', 2.0, 'BS', 60],
  ['08', 'Inventario', 2.5, 'BS', 60],
  ['09', 'Pre-pago', 2.5, 'BS', 60],
  ['10', 'Inv. computadoras', 2.5, 'BS', 60],
  ['11', 'Línea blanca 2', 1.0, 'USD', 60],
  ['12', 'Gastos médicos', 1.5, 'BS', 60],
];

(async () => {
  for (const [codigo, nombre, tasa, moneda] of TIPOS) {
    await prisma.tipoPrestamo.upsert({
      where: { codigo },
      // No se pisan las tasas ni las reglas que la cooperativa haya ajustado
      update: { moneda },
      create: {
        codigo,
        nombre,
        tasa_interes_anual: tasa,
        moneda,
        // Fiadores: el sistema actual no lo lleva por tipo. Se deja en falso y
        // la cooperativa lo marca donde corresponda, en vez de exigirlos en
        // todos por defecto.
        requiere_fiadores: false,
        plazo_maximo_semanas: 52,
      },
    });
    console.log(`  ${codigo}  ${nombre.padEnd(20)} ${moneda}`);
  }
  console.log(`\n${TIPOS.length} tipo(s) de préstamo verificados`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
