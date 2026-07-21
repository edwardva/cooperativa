/**
 * Script de importación de Acuerdos de Salud
 * Importa acuerdos desde CSV unificado a PostgreSQL
 * Mismo patrón que 4-import-funeraria.ts
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, 'data', 'salud', 'acuerdos_salud_unificado.csv');

// Tipo de acuerdo de salud (único, igual que Funeraria General)
const TIPOS_ACUERDO = [
  {
    codigo: '01',
    nombre: 'Salud General',
    monto_usd: 30.0,
    estado: true,
  },
];

const stats = {
  total: 0,
  insertados: 0,
  socio_no_encontrado: 0,
  beneficiario_creado: 0,
  beneficiario_existente: 0,
  ya_existia: 0,
  errores: 0,
  por_estado: {
    activo: 0,
    suspendido: 0,
    retirado: 0,
  },
};

async function insertarTiposAcuerdo() {
  console.log('\n1. Insertando tipo de acuerdo de salud...');

  const tiposMap = new Map<string, number>();

  for (const tipo of TIPOS_ACUERDO) {
    const tipoCreado = await prisma.tipoAcuerdoSalud.upsert({
      where: { codigo: tipo.codigo },
      update: {
        nombre: tipo.nombre,
        monto_usd: tipo.monto_usd,
        estado: tipo.estado,
      },
      create: {
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        monto_usd: tipo.monto_usd,
        estado: tipo.estado,
      },
    });

    tiposMap.set(tipo.codigo, tipoCreado.id);
    console.log(`   ✅ Tipo ${tipo.codigo}: ${tipo.nombre} (ID: ${tipoCreado.id})`);
  }

  console.log(`   Total: ${tiposMap.size} tipos insertados\n`);
  return tiposMap;
}

function leerCSV(): any[] {
  console.log('2. Leyendo CSV de acuerdos...');

  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  console.log(`   ✅ ${records.length} registros leídos\n`);
  return records;
}

function parsearFecha(fechaStr: string): Date | null {
  if (!fechaStr || fechaStr.trim() === '') return null;

  try {
    const [dia, mes, anio] = fechaStr.split('/');
    if (!dia || !mes || !anio) return null;

    const d = parseInt(dia);
    const m = parseInt(mes);
    const a = parseInt(anio);

    if (d < 1 || d > 31 || m < 1 || m > 12 || a < 1900 || a > 2100) {
      return null;
    }

    const fecha = new Date(a, m - 1, d);

    if (isNaN(fecha.getTime())) return null;

    return fecha;
  } catch (e) {
    return null;
  }
}

function separarNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = nombreCompleto.trim().split(/\s+/);

  if (partes.length === 1) {
    return { nombre: partes[0], apellido: '' };
  } else if (partes.length === 2) {
    return { nombre: partes[0], apellido: partes[1] };
  } else {
    const mitad = Math.floor(partes.length / 2);
    return {
      nombre: partes.slice(0, mitad).join(' '),
      apellido: partes.slice(mitad).join(' '),
    };
  }
}

async function obtenerBeneficiario(
  socioId: number,
  socioCedula: string,
  socioNombre: string,
  telefono: string | null,
  fechaNac: Date | null
) {
  let beneficiario = await prisma.beneficiario.findUnique({
    where: { cedula: socioCedula },
  });

  if (beneficiario) {
    stats.beneficiario_existente++;
    return beneficiario.id;
  }

  const { nombre, apellido } = separarNombre(socioNombre);

  beneficiario = await prisma.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: socioCedula,
      nombre: nombre.substring(0, 100),
      apellido: apellido.substring(0, 100),
      fecha_nacimiento: fechaNac,
      parentesco: 'titular',
      telefono: telefono?.substring(0, 100) || null,
      estado: 'activo',
    },
  });

  stats.beneficiario_creado++;
  return beneficiario.id;
}

async function importarAcuerdos(acuerdos: any[], tiposMap: Map<string, number>) {
  console.log('3. Importando acuerdos de salud...\n');

  const tipoGeneralId = tiposMap.get('01')!;

  for (let i = 0; i < acuerdos.length; i++) {
    const row = acuerdos[i];
    stats.total++;

    try {
      const cedula = row.socio_cedula?.trim();
      if (!cedula || cedula === '') {
        stats.errores++;
        continue;
      }

      const socio = await prisma.socio.findUnique({
        where: { cedula: cedula },
      });

      if (!socio) {
        stats.socio_no_encontrado++;
        if (stats.socio_no_encontrado <= 10) {
          console.log(`   ⚠️  Socio no encontrado: ${cedula} - ${row.socio_nombre}`);
        }
        continue;
      }

      // Verificar si ya existe un acuerdo para este beneficiario (por cédula)
      const acuerdoExistente = await prisma.acuerdoSalud.findFirst({
        where: {
          beneficiario: {
            cedula: cedula,
          },
        },
      });

      if (acuerdoExistente) {
        stats.ya_existia++;
        continue;
      }

      const beneficiarioId = await obtenerBeneficiario(
        socio.id,
        cedula,
        row.socio_nombre?.trim() || '',
        row.telefono?.trim(),
        parsearFecha(row.fecha_nacimiento)
      );

      let estado: 'activo' | 'suspendido' | 'retirado' = 'activo';
      if (row.estado?.toLowerCase() === 'suspendido') {
        estado = 'suspendido';
      } else if (row.estado?.toLowerCase() === 'retirado') {
        estado = 'retirado';
      }

      stats.por_estado[estado]++;

      const fechaInicio = parsearFecha(row.fecha_acuerdo) || new Date();
      const fechaSuspension = estado === 'suspendido' ? new Date() : null;
      const semanasAtraso = parseInt(row.atraso_semanas) || 0;

      await prisma.acuerdoSalud.create({
        data: {
          beneficiario_id: beneficiarioId,
          tipo_acuerdo_id: tipoGeneralId,
          estado: estado,
          semanas_sin_pago: semanasAtraso,
          fecha_suspension: fechaSuspension,
          fecha_inicio: fechaInicio,
        },
      });

      stats.insertados++;

      if (stats.insertados % 500 === 0) {
        console.log(
          `   Progreso: ${stats.insertados}/${stats.total} (${((stats.insertados / stats.total) * 100).toFixed(1)}%)`
        );
      }
    } catch (error: any) {
      stats.errores++;
      if (stats.errores <= 5) {
        console.error(`   ❌ Error en registro ${i + 1}:`, error.message);
      }
    }
  }
}

function mostrarEstadisticas() {
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE IMPORTACIÓN - SALUD');
  console.log('='.repeat(60));

  console.log(`\nTotal procesados:        ${stats.total}`);
  console.log(`✅ Insertados:            ${stats.insertados} (${((stats.insertados / stats.total) * 100).toFixed(1)}%)`);
  console.log(`\nBeneficiarios:`);
  console.log(`   - Creados:             ${stats.beneficiario_creado}`);
  console.log(`   - Existentes:          ${stats.beneficiario_existente}`);

  console.log(`\nPor Estado:`);
  if (stats.insertados > 0) {
    console.log(`   - Activos:             ${stats.por_estado.activo} (${((stats.por_estado.activo / stats.insertados) * 100).toFixed(1)}%)`);
    console.log(`   - Suspendidos:         ${stats.por_estado.suspendido} (${((stats.por_estado.suspendido / stats.insertados) * 100).toFixed(1)}%)`);
    console.log(`   - Retirados:           ${stats.por_estado.retirado} (${((stats.por_estado.retirado / stats.insertados) * 100).toFixed(1)}%)`);
  }

  console.log(`\n⚠️  Socios no encontrados: ${stats.socio_no_encontrado} (${((stats.socio_no_encontrado / stats.total) * 100).toFixed(1)}%)`);
  console.log(`🔄 Ya existía acuerdo:    ${stats.ya_existia}`);
  console.log(`❌ Errores:               ${stats.errores}`);

  const tasaExito = ((stats.insertados / stats.total) * 100).toFixed(2);
  console.log(`\n📊 Tasa de éxito:         ${tasaExito}%`);

  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTACIÓN DE ACUERDOS DE SALUD');
  console.log('='.repeat(60));

  try {
    const tiposMap = await insertarTiposAcuerdo();
    const acuerdos = leerCSV();
    await importarAcuerdos(acuerdos, tiposMap);
    mostrarEstadisticas();
  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
