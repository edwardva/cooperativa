/**
 * Script de backfill: número de acuerdo, número de contrato y fecha de retiro
 * para los acuerdos de funeraria ya migrados.
 *
 * El sistema viejo asignaba manualmente un "expediente"/"contrato" que el
 * importador original (4-import-funeraria.ts) no guardó en la base de datos
 * nueva. Este script recupera esos valores desde el CSV unificado y
 * completa únicamente los campos que estén vacíos (no pisa datos existentes
 * ni cambia el estado actual del acuerdo).
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, 'data', 'funeraria', 'acuerdos_funeraria_unificado.csv');

const stats = {
  total: 0,
  actualizados: 0,
  sin_beneficiario: 0,
  sin_acuerdo: 0,
  ya_completos: 0,
  numero_acuerdo_en_uso: 0,
  errores: 0,
};

function parsearFecha(fechaStr: string): Date | null {
  if (!fechaStr || fechaStr.trim() === '') return null;

  const [dia, mes, anio] = fechaStr.split('/');
  if (!dia || !mes || !anio) return null;

  const d = parseInt(dia);
  const m = parseInt(mes);
  const a = parseInt(anio);

  if (d < 1 || d > 31 || m < 1 || m > 12 || a < 1900 || a > 2100) return null;

  const fecha = new Date(a, m - 1, d);
  return isNaN(fecha.getTime()) ? null : fecha;
}

function leerCSV(): any[] {
  console.log('Leyendo CSV de acuerdos de funeraria...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`   ${records.length} registros leídos\n`);
  return records;
}

async function backfill(rows: any[]) {
  for (const row of rows) {
    stats.total++;

    const cedula = row.socio_cedula?.trim();
    const numeroAcuerdo = row.numero_acuerdo?.trim();
    const numeroContrato = row.numero_contrato?.trim();

    if (!cedula || !numeroAcuerdo) {
      stats.errores++;
      continue;
    }

    try {
      // El titular fue creado como Beneficiario con la cédula del socio
      const beneficiario = await prisma.beneficiario.findUnique({
        where: { cedula },
      });

      if (!beneficiario) {
        stats.sin_beneficiario++;
        continue;
      }

      const acuerdo = await prisma.acuerdoFuneraria.findFirst({
        where: { beneficiario_id: beneficiario.id },
        orderBy: { created_at: 'asc' },
      });

      if (!acuerdo) {
        stats.sin_acuerdo++;
        continue;
      }

      if (acuerdo.numero_acuerdo) {
        stats.ya_completos++;
        continue;
      }

      // Evitar violar la restricción unique si el número ya fue usado por otro acuerdo
      const numeroEnUso = await prisma.acuerdoFuneraria.findUnique({
        where: { numero_acuerdo: numeroAcuerdo },
      });

      if (numeroEnUso) {
        stats.numero_acuerdo_en_uso++;
        continue;
      }

      const fechaRetiro =
        acuerdo.estado === 'retirado' ? parsearFecha(row.fecha_retiro) : null;

      await prisma.acuerdoFuneraria.update({
        where: { id: acuerdo.id },
        data: {
          numero_acuerdo: numeroAcuerdo,
          numero_contrato: numeroContrato || null,
          ...(fechaRetiro && !acuerdo.fecha_retiro ? { fecha_retiro: fechaRetiro } : {}),
        },
      });

      stats.actualizados++;

      if (stats.actualizados % 500 === 0) {
        console.log(`   Progreso: ${stats.actualizados} acuerdos actualizados...`);
      }
    } catch (error: any) {
      stats.errores++;
      if (stats.errores <= 5) {
        console.error(`   Error en cédula ${cedula}:`, error.message);
      }
    }
  }
}

function mostrarEstadisticas() {
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE BACKFILL - NÚMERO DE ACUERDO FUNERARIA');
  console.log('='.repeat(60));
  console.log(`\nTotal filas en CSV:         ${stats.total}`);
  console.log(`Acuerdos actualizados:      ${stats.actualizados}`);
  console.log(`Ya tenían número:           ${stats.ya_completos}`);
  console.log(`Sin beneficiario asociado:  ${stats.sin_beneficiario}`);
  console.log(`Sin acuerdo asociado:       ${stats.sin_acuerdo}`);
  console.log(`Número ya usado (omitido):  ${stats.numero_acuerdo_en_uso}`);
  console.log(`Errores:                    ${stats.errores}`);
  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL: NÚMERO DE ACUERDO / CONTRATO / FECHA DE RETIRO');
  console.log('='.repeat(60) + '\n');

  try {
    const rows = leerCSV();
    await backfill(rows);
    mostrarEstadisticas();
  } catch (error: any) {
    console.error('\nError fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
