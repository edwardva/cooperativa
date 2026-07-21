#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT: IMPORTACIÓN COMPLETA DE TODOS LOS SOCIOS
 * ============================================
 * 
 * Importa TODOS los 18,164 registros del sistema viejo,
 * incluyendo activos y retirados.
 * 
 * Características:
 * - Permite cédulas duplicadas (un socio puede tener varios expedientes)
 * - Expediente DEBE ser único
 * - Mapea correctamente retirado: "Si" → estado='retirado', "No" → estado='activo'
 * - Asocia automáticamente con ferias
 * 
 * Uso:
 *   npm run import:completo
 * 
 * IMPORTANTE: Este script REEMPLAZA todos los socios existentes
 * ============================================
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
  retirado: string;  // "Si" o "No"
  direccion?: string;
  telefono?: string;
  telefono_movil?: string;
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
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Validaciones
function validarCedula(cedula: string): boolean {
  if (!cedula) return false;
  const cleaned = cedula.trim();
  if (cleaned.length < 5 || cleaned.length > 10) return false;
  if (!/^\d+$/.test(cleaned)) return false;
  if (/^0+$/.test(cleaned)) return false;
  return true;
}

function parsearFecha(fechaStr: string): Date | null {
  if (!fechaStr || fechaStr.trim() === '') return null;
  
  // Formato esperado: "DD/MM/YYYY"
  const partes = fechaStr.trim().split('/');
  if (partes.length !== 3) return null;
  
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1; // JavaScript meses 0-11
  const año = parseInt(partes[2], 10);
  
  if (isNaN(dia) || isNaN(mes) || isNaN(año)) return null;
  
  const fecha = new Date(año, mes, dia);
  
  // Validar que la fecha es válida
  if (isNaN(fecha.getTime())) return null;
  if (fecha.getFullYear() < 1900 || fecha.getFullYear() > 2026) return null;
  
  return fecha;
}

async function limpiarTablasSocios() {
  const tablas = [
    '"abonos_prestamo"',
    '"plan_pagos"',
    '"fiadores"',
    '"prestamos"',
    '"movimientos_ahorro"',
    '"cuentas_ahorro"',
    '"movimientos_funeraria"',
    '"acuerdos_funeraria"',
    '"movimientos_salud"',
    '"acuerdos_salud"',
    '"beneficiarios"',
    '"usuarios_digitales"',
    '"pagos_web"',
    '"detalle_colecta"',
    '"colecta"',
    '"socios"',
  ];

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablas.join(', ')} RESTART IDENTITY CASCADE`);
}

async function main() {
  log('\n═════════════════════════════════════════════════════════════════', 'cyan');
  log('🚀 IMPORTACIÓN COMPLETA DE TODOS LOS SOCIOS DEL SISTEMA VIEJO', 'cyan');
  log('═════════════════════════════════════════════════════════════════\n', 'cyan');

  // 1. Leer el CSV
  const csvPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');
  
  if (!fs.existsSync(csvPath)) {
    log('❌ ERROR: No se encontró el archivo socios_con_ferias.csv', 'red');
    log('   Ruta esperada: ' + csvPath, 'red');
    process.exit(1);
  }

  log('📄 Leyendo archivo CSV...', 'blue');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as SocioFeriaCSV[];

  log(`✅ ${records.length} registros leídos del CSV\n`, 'green');

  // 2. Cargar ubicaciones
  log('📍 Cargando ubicaciones...', 'blue');
  const ubicaciones = await prisma.ubicacion.findMany({
    select: { id: true, codigo: true },
  });

  const ubicacionMap = new Map<string, number>();
  ubicaciones.forEach(ub => {
    ubicacionMap.set(ub.codigo.trim(), ub.id);
  });

  log(`✅ ${ubicaciones.length} ubicaciones disponibles\n`, 'green');

  // 3. Estadísticas
  const stats = {
    total: records.length,
    activos: 0,
    retirados: 0,
    insertados: 0,
    errores: 0,
    cedula_invalida: 0,
    datos_incompletos: 0,
    expediente_duplicado: 0,
    ubicacion_no_encontrada: 0,
  };

  const errores: Array<{
    fila: number;
    expediente: string;
    cedula: string;
    razon: string;
  }> = [];

  // 4. Confirmar con el usuario
  log('⚠️  ADVERTENCIA: Este script eliminará TODOS los socios existentes', 'yellow');
  log('   y los reemplazará con los 18,164 registros del sistema viejo.\n', 'yellow');
  
  log('📊 Análisis del CSV:', 'cyan');
  const retiradosCount = records.filter(r => r.retirado?.trim().toLowerCase() === 'si').length;
  const activosCount = records.filter(r => r.retirado?.trim().toLowerCase() !== 'si').length;
  log(`   - Activos (retirado=No): ${activosCount}`, 'green');
  log(`   - Retirados (retirado=Si): ${retiradosCount}`, 'red');
  log(`   - Total: ${records.length}\n`, 'cyan');

  log('▶️  Comenzando importación en 3 segundos...\n', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 5. Eliminar restricción única de cédula si existe y limpiar tablas dependientes
  log('🗑️  Limpiando tablas dependientes...', 'yellow');
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "socios_cedula_key"');
  await limpiarTablasSocios();
  log('✅ Tablas limpias y cédula habilitada para repetirse\n', 'green');

  // 6. Importar todos los registros
  log('📥 Importando socios...', 'blue');
  const expedientesSet = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const fila = i + 2; // +2 porque CSV tiene header y empieza en línea 1

    try {
      // Validar cédula
      if (!validarCedula(record.cedula)) {
        stats.cedula_invalida++;
        errores.push({
          fila,
          expediente: record.expediente,
          cedula: record.cedula,
          razon: 'Cédula inválida',
        });
        continue;
      }

      // Validar datos mínimos
      if (!record.expediente || !record.nombres || !record.apellidos) {
        stats.datos_incompletos++;
        errores.push({
          fila,
          expediente: record.expediente || 'N/A',
          cedula: record.cedula,
          razon: 'Datos incompletos (expediente, nombres o apellidos vacíos)',
        });
        continue;
      }

      // Validar expediente único
      const expedienteKey = record.expediente.trim();
      if (expedientesSet.has(expedienteKey)) {
        stats.expediente_duplicado++;
        errores.push({
          fila,
          expediente: record.expediente,
          cedula: record.cedula,
          razon: `Expediente duplicado: ${expedienteKey}`,
        });
        continue;
      }
      expedientesSet.add(expedienteKey);

      // Determinar estado según campo "retirado"
      const esRetirado = record.retirado?.trim().toLowerCase() === 'si';
      const estado = esRetirado ? 'retirado' : 'activo';
      
      if (esRetirado) {
        stats.retirados++;
      } else {
        stats.activos++;
      }

      // Buscar ubicación (puede ser null)
      let ubicacion_id: number | null = null;
      if (record.codigo_feria && record.codigo_feria.trim() !== '') {
        const codigoFeria = record.codigo_feria.trim();
        ubicacion_id = ubicacionMap.get(codigoFeria) || null;
        
        if (!ubicacion_id) {
          stats.ubicacion_no_encontrada++;
          // No es error crítico, continuar sin ubicación
        }
      }

      // Parsear fecha de ingreso
      const fechaIngreso = parsearFecha(record.fecha_ingreso);
      if (!fechaIngreso) {
        errores.push({
          fila,
          expediente: record.expediente,
          cedula: record.cedula,
          razon: `Fecha de ingreso inválida: ${record.fecha_ingreso}`,
        });
        stats.errores++;
        continue;
      }

      // Determinar si es delegado
      const esDelegado = record.delegado?.trim().toLowerCase() === 'si';

      // Preparar teléfono (preferir móvil si existe)
      const telefono = record.telefono_movil?.trim() || record.telefono?.trim() || null;

      // Preparar email
      const email = record.correo?.trim();
      const emailFinal = email && email !== 'notiene' && email !== '0' && email.includes('@') 
        ? email 
        : null;

      // Insertar socio
      await prisma.socio.create({
        data: {
          codigo_socio: record.expediente.trim(),
          cedula: record.cedula.trim(),
          nombre: record.nombres.trim(),
          apellido: record.apellidos.trim(),
          fecha_inscripcion: fechaIngreso,
          estado,
          es_delegado: esDelegado,
          ubicacion_id,
          direccion: record.direccion?.trim() || null,
          telefono,
          email: emailFinal,
          // Campos opcionales sin datos en CSV
          fecha_nacimiento: null,
          autorizado_nombre: null,
          autorizado_cedula: null,
          notas: null,
          foto_url: null,
        },
      });

      stats.insertados++;

      // Progreso cada 500 registros
      if ((i + 1) % 500 === 0) {
        log(`   ⏳ Procesados ${i + 1}/${records.length} registros...`, 'blue');
      }

    } catch (error: any) {
      stats.errores++;
      errores.push({
        fila,
        expediente: record.expediente || 'N/A',
        cedula: record.cedula || 'N/A',
        razon: error.message || 'Error desconocido',
      });
    }
  }

  // 7. Resumen final
  log('\n═════════════════════════════════════════════════════════════════', 'cyan');
  log('📊 RESUMEN DE IMPORTACIÓN', 'cyan');
  log('═════════════════════════════════════════════════════════════════\n', 'cyan');

  log(`📄 Total registros en CSV:        ${stats.total}`, 'blue');
  log(`✅ Insertados exitosamente:       ${stats.insertados}`, 'green');
  log(`   - Activos:                     ${stats.activos}`, 'green');
  log(`   - Retirados:                   ${stats.retirados}`, 'red');
  log(`❌ Errores:                        ${stats.errores}`, 'red');
  log(`   - Cédula inválida:             ${stats.cedula_invalida}`, 'red');
  log(`   - Datos incompletos:           ${stats.datos_incompletos}`, 'red');
  log(`   - Expediente duplicado:        ${stats.expediente_duplicado}`, 'red');
  log(`⚠️  Ubicación no encontrada:       ${stats.ubicacion_no_encontrada}`, 'yellow');

  // 8. Verificar resultados en DB
  log('\n🔍 Verificando base de datos...', 'blue');
  const totalDB = await prisma.socio.count();
  const estadosDB = await prisma.socio.groupBy({
    by: ['estado'],
    _count: true,
  });

  log(`\n📊 Socios en base de datos: ${totalDB}`, 'cyan');
  estadosDB.forEach(e => {
    const color = e.estado === 'activo' ? 'green' : e.estado === 'retirado' ? 'red' : 'yellow';
    log(`   - ${e.estado}: ${e._count}`, color);
  });

  if (totalDB !== stats.total) {
    throw new Error(`La importación no cuadró: DB=${totalDB}, CSV=${stats.total}`);
  }

  // 9. Guardar reporte de errores
  if (errores.length > 0) {
    const reportPath = path.join(__dirname, 'data', 'ERRORES-IMPORTACION-COMPLETA.csv');
    const csvContent = [
      'fila,expediente,cedula,razon',
      ...errores.map(e => `${e.fila},"${e.expediente}","${e.cedula}","${e.razon}"`)
    ].join('\n');
    
    fs.writeFileSync(reportPath, csvContent, 'utf-8');
    log(`\n📄 Reporte de errores guardado en: ${reportPath}`, 'yellow');
  }

  log('\n✅ Importación completada!', 'green');
  log('═════════════════════════════════════════════════════════════════\n', 'cyan');
}

// Ejecutar
main()
  .catch(error => {
    log(`\n❌ Error fatal: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
