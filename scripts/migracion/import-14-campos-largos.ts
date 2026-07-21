#!/usr/bin/env node
/**
 * Importa los 14 socios que fallaron por campo telefono muy largo
 * (Ahora el schema fue actualizado de VarChar(20) a VarChar(100))
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/cooperativa?schema=public'
    }
  }
});

const CSV_FILE = path.join(__dirname, 'data', 'socios_activos_parsed.csv');

// Cédulas de los 14 socios con error de BD (campo telefono muy largo)
const CEDULAS_OBJETIVO = [
  '15123456',
  '5936868',
  '7384422',
  '5429804',
  '4001220',
  '7300826',
  '10126105',
  '9601998',
  '6287754',
  '17196925',
  '18103536',
  '11428751',
  '18785942',
  '12704971',
];

interface SocioCSV {
  codigo_socio: string;
  cedula: string;
  apellido: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
  email?: string;
  estado: string;
  autorizado_nombre?: string;
  autorizado_cedula?: string;
  es_delegado?: string;
  ubicacion_codigo?: string;
  fecha_ingreso?: string;
  fecha_nacimiento?: string;
}

async function importar14Socios() {
  console.log('═'.repeat(70));
  console.log('📥 IMPORTACIÓN DE 14 SOCIOS CON TELÉFONOS LARGOS');
  console.log('═'.repeat(70));
  console.log('');

  let insertados = 0;
  let duplicados = 0;
  let errores = 0;

  try {
    // Leer CSV
    console.log(`📄 Leyendo: ${CSV_FILE}\n`);
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const socios: SocioCSV[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Filtrar solo los 14 objetivo
    const sociosObjetivo = socios.filter(s => CEDULAS_OBJETIVO.includes(s.cedula.trim()));

    console.log(`   Total a importar: ${sociosObjetivo.length}\n`);

    if (sociosObjetivo.length === 0) {
      console.log('⚠️  No se encontraron los registros objetivo en el CSV\n');
      return;
    }

    // Obtener ubicación por defecto
    const ubicacionDefault = await prisma.ubicacion.findFirst();
    if (!ubicacionDefault) {
      throw new Error('No hay ubicaciones disponibles');
    }

    console.log('⚙️  Procesando...\n');

    for (const socio of sociosObjetivo) {
      try {
        // Verificar duplicado
        const existente = await prisma.socio.findUnique({
          where: { cedula: socio.cedula.trim() },
        });

        if (existente) {
          console.log(`   ⚠️  Duplicado: ${socio.cedula} - ${socio.nombre} ${socio.apellido}`);
          duplicados++;
          continue;
        }

        // Preparar fechas
        const fechaIngreso = socio.fecha_ingreso && socio.fecha_ingreso.trim()
          ? new Date(socio.fecha_ingreso)
          : new Date('2020-01-01');

        const fechaNacimiento = socio.fecha_nacimiento && socio.fecha_nacimiento.trim()
          ? new Date(socio.fecha_nacimiento)
          : null;

        // Validar ubicación
        let ubicacionId = ubicacionDefault.id;
        if (socio.ubicacion_codigo && socio.ubicacion_codigo.trim()) {
          const ubicacion = await prisma.ubicacion.findFirst({
            where: { codigo: socio.ubicacion_codigo.trim() },
          });
          if (ubicacion) {
            ubicacionId = ubicacion.id;
          }
        }

        // Insertar
        await prisma.socio.create({
          data: {
            codigo_socio: socio.codigo_socio.trim(),
            cedula: socio.cedula.trim(),
            nombre: socio.nombre.trim(),
            apellido: socio.apellido.trim(),
            fecha_inscripcion: fechaIngreso,
            fecha_nacimiento: fechaNacimiento,
            direccion: socio.direccion?.trim() || null,
            telefono: socio.telefono?.trim() || null, // Ahora soporta hasta 100 caracteres
            email: socio.email?.trim() || null,
            estado: socio.estado?.trim() || 'activo',
            autorizado_nombre: socio.autorizado_nombre?.trim() || null,
            autorizado_cedula: socio.autorizado_cedula?.trim() || null,
            es_delegado: ['1', 'true', 't', 'yes', 'y', 'si', 's'].includes((socio.es_delegado || '').toLowerCase()),
            ubicacion: { connect: { id: ubicacionId } },
          },
        });

        insertados++;
        const telefonoInfo = socio.telefono ? ` (Tel: ${socio.telefono.length} chars)` : '';
        console.log(`   ✅ ${insertados}. ${socio.cedula} - ${socio.nombre} ${socio.apellido}${telefonoInfo}`);

      } catch (error: any) {
        console.error(`   ❌ Error: ${socio.cedula} - ${error.message}`);
        errores++;
      }
    }

    console.log('');
    console.log('═'.repeat(70));
    console.log('📊 RESULTADOS');
    console.log('═'.repeat(70));
    console.log(`Total procesados:    ${sociosObjetivo.length}`);
    console.log(`✅ Insertados:        ${insertados}`);
    console.log(`⚠️  Duplicados:        ${duplicados}`);
    console.log(`❌ Errores:           ${errores}`);
    console.log('═'.repeat(70));
    console.log('');

    // Verificar total final
    const totalSocios = await prisma.$queryRaw`SELECT COUNT(*) as count FROM socios`;
    console.log(`🎯 Total socios en BD: ${(totalSocios as any)[0].count}\n`);

    await prisma.$disconnect();

  } catch (error: any) {
    console.error('❌ Error fatal:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

importar14Socios()
  .then(() => {
    console.log('✅ Importación completada!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
