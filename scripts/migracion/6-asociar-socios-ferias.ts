#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT: ASOCIAR SOCIOS CON FERIAS
 * ============================================
 * 
 * Asocia cada socio con su ubicación/feria correspondiente
 * usando el código de feria extraído del sistema viejo.
 * 
 * Requisitos:
 * - Archivo: data/socios_con_ferias.csv (generado con extract_socios_con_ferias.php)
 * - Ubicaciones ya importadas en la base de datos
 * - Socios ya importados en la base de datos
 * 
 * Uso:
 *   npm run asociar:ferias
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface SocioFeriaCSV {
  expediente: string;
  cedula: string;
  apellidos: string;
  nombres: string;
  codigo_feria: string;
  fecha_ingreso: string;
  retirado: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  delegado?: string;
}

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n🔗 ASOCIACIÓN DE SOCIOS CON FERIAS', 'cyan');
  log('=====================================\n', 'cyan');

  // 1. Leer el CSV
  const csvPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');
  
  if (!fs.existsSync(csvPath)) {
    log('❌ ERROR: No se encontró el archivo socios_con_ferias.csv', 'red');
    log('   Ruta esperada: ' + csvPath, 'red');
    log('\n📝 Instrucciones:', 'yellow');
    log('   1. Ejecuta extract_socios_con_ferias.php en el servidor viejo', 'yellow');
    log('   2. Descarga el archivo socios_con_ferias.csv', 'yellow');
    log('   3. Colócalo en: scripts/migracion/data/', 'yellow');
    log('   4. Vuelve a ejecutar este script\n', 'yellow');
    process.exit(1);
  }

  log('📄 Leyendo archivo CSV...', 'blue');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as SocioFeriaCSV[];

  log(`✅ ${records.length} registros leídos\n`, 'green');

  // 2. Cargar todas las ubicaciones
  log('📍 Cargando ubicaciones...', 'blue');
  const ubicaciones = await prisma.ubicacion.findMany({
    select: { id: true, codigo: true, nombre: true },
  });

  const ubicacionMap = new Map<string, number>();
  ubicaciones.forEach(ub => {
    ubicacionMap.set(ub.codigo.trim(), ub.id);
  });

  log(`✅ ${ubicaciones.length} ubicaciones cargadas\n`, 'green');

  // 3. Estadísticas
  let stats = {
    total: records.length,
    asociados: 0,
    sin_feria: 0,
    feria_no_encontrada: 0,
    socio_no_encontrado: 0,
    errores: 0,
  };

  const feriasNoEncontradas = new Set<string>();

  // 4. Procesar cada socio
  log('🔄 Asociando socios con ferias...\n', 'blue');

  for (const record of records) {
    const cedula = record.cedula?.trim();
    const codigoFeria = record.codigo_feria?.trim();

    if (!cedula) {
      stats.errores++;
      continue;
    }

    // Socio sin código de feria
    if (!codigoFeria) {
      stats.sin_feria++;
      continue;
    }

    // Buscar ubicación
    const ubicacionId = ubicacionMap.get(codigoFeria);
    
    if (!ubicacionId) {
      stats.feria_no_encontrada++;
      feriasNoEncontradas.add(codigoFeria);
      continue;
    }

    // Actualizar socio
    try {
      const result = await prisma.socio.updateMany({
        where: { cedula: cedula },
        data: { ubicacion_id: ubicacionId },
      });

      if (result.count > 0) {
        stats.asociados++;
        
        if (stats.asociados % 100 === 0) {
          process.stdout.write(`\r  ⏳ Procesados: ${stats.asociados}/${stats.total}`);
        }
      } else {
        stats.socio_no_encontrado++;
      }
    } catch (error) {
      stats.errores++;
      log(`❌ Error al actualizar socio ${cedula}: ${error}`, 'red');
    }
  }

  console.log('\n');

  // 5. Reporte final
  log('\n=====================================', 'cyan');
  log('📊 RESUMEN DE ASOCIACIÓN', 'cyan');
  log('=====================================', 'cyan');
  log(`✅ Socios asociados:      ${stats.asociados}`, 'green');
  log(`⚠️  Socios sin feria:      ${stats.sin_feria}`, 'yellow');
  log(`❌ Feria no encontrada:   ${stats.feria_no_encontrada}`, 'red');
  log(`❌ Socio no encontrado:   ${stats.socio_no_encontrado}`, 'red');
  log(`❌ Errores:               ${stats.errores}`, 'red');
  log(`📝 Total procesados:      ${stats.total}`, 'blue');
  log('=====================================\n', 'cyan');

  // 6. Mostrar ferias no encontradas
  if (feriasNoEncontradas.size > 0) {
    log('⚠️  CÓDIGOS DE FERIA NO ENCONTRADOS:', 'yellow');
    log('   (Estos códigos existen en el CSV pero no están en la base de datos)\n', 'yellow');
    
    feriasNoEncontradas.forEach(codigo => {
      log(`   - ${codigo}`, 'yellow');
    });
    
    log('\n💡 Solución: Verifica que todas las ferias estén importadas:', 'yellow');
    log('   npm run migrate:ubicaciones\n', 'yellow');
  }

  // 7. Estadísticas finales de la base de datos
  log('📍 VERIFICACIÓN FINAL:', 'cyan');
  
  const sociosConFeria = await prisma.socio.count({
    where: { ubicacion_id: { not: null } },
  });
  
  const sociosSinFeria = await prisma.socio.count({
    where: { ubicacion_id: null },
  });
  
  const totalSocios = await prisma.socio.count();
  
  log(`   Total socios en BD:        ${totalSocios}`, 'blue');
  log(`   ✅ Con feria asignada:      ${sociosConFeria} (${((sociosConFeria/totalSocios)*100).toFixed(1)}%)`, 'green');
  log(`   ⚠️  Sin feria asignada:     ${sociosSinFeria} (${((sociosSinFeria/totalSocios)*100).toFixed(1)}%)`, 'yellow');
  log('=====================================\n', 'cyan');

  // 8. Distribución por feria
  log('📊 DISTRIBUCIÓN POR FERIA:', 'cyan');
  log('=====================================', 'cyan');
  
  const distribucion = await prisma.socio.groupBy({
    by: ['ubicacion_id'],
    _count: true,
    where: { ubicacion_id: { not: null } },
  });

  for (const dist of distribucion) {
    const ubicacion = ubicaciones.find(u => u.id === dist.ubicacion_id);
    if (ubicacion) {
      const porcentaje = ((dist._count / sociosConFeria) * 100).toFixed(1);
      log(`   ${ubicacion.codigo.padEnd(10)} - ${dist._count.toString().padStart(5)} socios (${porcentaje}%)`, 'blue');
      log(`   ${ubicacion.nombre}`, 'reset');
    }
  }
  
  log('=====================================\n', 'cyan');

  log('✅ Asociación completada\n', 'green');
}

main()
  .catch((error) => {
    log('\n❌ Error durante la asociación:', 'red');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
