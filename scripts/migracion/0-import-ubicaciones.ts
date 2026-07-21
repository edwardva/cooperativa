#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT DE MIGRACIÓN: UBICACIONES/FERIAS
 * ============================================
 * 
 * Importa las ubicaciones (ferias) desde CSV al sistema nuevo.
 * Este script debe ejecutarse ANTES de importar socios.
 * 
 * Requisitos:
 * - Archivo: data/ubicaciones_export.csv
 * - Columnas: codigo,nombre,direccion,telefono,email,estado
 * 
 * Uso:
 *   npm run migrate:ubicaciones
 *   o
 *   tsx scripts/migracion/0-import-ubicaciones.ts
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface UbicacionCSV {
  codigo: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  estado: string;
}

async function main() {
  console.log('📍 MIGRACIÓN DE UBICACIONES/FERIAS');
  console.log('=====================================\n');

  // 1. Leer CSV
  const csvPath = path.join(__dirname, 'data', 'ubicaciones_export.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ ERROR: No se encuentra el archivo ubicaciones_export.csv');
    console.log('\n📝 Crea el archivo en: scripts/migracion/data/ubicaciones_export.csv');
    console.log('   Formato: codigo,nombre,direccion,telefono,email,estado');
    console.log('\n   Ejemplo:');
    console.log('   FERIA-01,Feria Central,Av. Principal,0212-1234567,central@coop.com,1');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as UbicacionCSV[];

  console.log(`📄 Archivo leído: ${records.length} ubicaciones encontradas\n`);

  // 2. Validar datos
  console.log('🔍 Validando datos...');
  
  const errores: string[] = [];
  const ubicacionesValidas: UbicacionCSV[] = [];

  records.forEach((row, index) => {
    const linea = index + 2; // +2 por header y 0-index

    // Validaciones
    if (!row.codigo || row.codigo.trim() === '') {
      errores.push(`Línea ${linea}: Código vacío`);
      return;
    }

    if (!row.nombre || row.nombre.trim() === '') {
      errores.push(`Línea ${linea}: Nombre vacío`);
      return;
    }

    // Limpiar y normalizar
    ubicacionesValidas.push({
      codigo: row.codigo.trim().toUpperCase(),
      nombre: row.nombre.trim(),
      direccion: row.direccion?.trim() || null,
      telefono: row.telefono?.trim() || null,
      email: row.email?.trim() || null,
      estado: row.estado?.trim() === '1' || row.estado?.trim().toLowerCase() === 'true' ? '1' : '0',
    });
  });

  if (errores.length > 0) {
    console.error('\n❌ ERRORES DE VALIDACIÓN:');
    errores.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log(`✅ ${ubicacionesValidas.length} ubicaciones válidas\n`);

  // 3. Verificar duplicados por código
  const codigosUnicos = new Set(ubicacionesValidas.map(u => u.codigo));
  if (codigosUnicos.size !== ubicacionesValidas.length) {
    console.error('❌ ERROR: Hay códigos de ubicación duplicados en el CSV');
    process.exit(1);
  }

  // 4. Importar a la base de datos
  console.log('💾 Importando ubicaciones...\n');

  let insertadas = 0;
  let actualizadas = 0;
  let erroresImport = 0;

  for (const ubicacion of ubicacionesValidas) {
    try {
      const existe = await prisma.ubicacion.findUnique({
        where: { codigo: ubicacion.codigo },
      });

      if (existe) {
        // Actualizar
        await prisma.ubicacion.update({
          where: { codigo: ubicacion.codigo },
          data: {
            nombre: ubicacion.nombre,
            direccion: ubicacion.direccion,
            telefono: ubicacion.telefono,
            estado: ubicacion.estado === '1',
          },
        });
        actualizadas++;
        console.log(`  🔄 Actualizada: ${ubicacion.codigo} - ${ubicacion.nombre}`);
      } else {
        // Insertar nueva
        await prisma.ubicacion.create({
          data: {
            codigo: ubicacion.codigo,
            nombre: ubicacion.nombre,
            direccion: ubicacion.direccion,
            telefono: ubicacion.telefono,
            estado: ubicacion.estado === '1',
          },
        });
        insertadas++;
        console.log(`  ✅ Insertada: ${ubicacion.codigo} - ${ubicacion.nombre}`);
      }
    } catch (error) {
      erroresImport++;
      console.error(`  ❌ Error en ${ubicacion.codigo}:`, error.message);
    }
  }

  // 5. Resumen final
  console.log('\n=====================================');
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('=====================================');
  console.log(`✅ Insertadas:    ${insertadas}`);
  console.log(`🔄 Actualizadas:  ${actualizadas}`);
  console.log(`❌ Errores:       ${erroresImport}`);
  console.log('=====================================\n');

  // 6. Verificar estado final
  const totalUbicaciones = await prisma.ubicacion.count();
  const ubicacionesActivas = await prisma.ubicacion.count({
    where: { estado: true },
  });

  console.log('📍 ESTADO FINAL:');
  console.log(`   Total ubicaciones: ${totalUbicaciones}`);
  console.log(`   Activas: ${ubicacionesActivas}`);
  console.log(`   Inactivas: ${totalUbicaciones - ubicacionesActivas}\n`);

  if (erroresImport === 0) {
    console.log('✅ Migración de ubicaciones completada exitosamente\n');
  } else {
    console.log('⚠️  Migración completada con errores. Revisar logs.\n');
  }
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR FATAL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
