/**
 * Script de importación de Acuerdos de Funeraria
 * Importa 12,472 acuerdos desde CSV unificado a PostgreSQL
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// Ruta al CSV unificado
const CSV_PATH = path.join(__dirname, 'data', 'funeraria', 'acuerdos_funeraria_unificado.csv');

// Tipos de acuerdo de funeraria
const TIPOS_ACUERDO = [
  {
    codigo: '01',
    nombre: 'Funeraria General',
    monto_usd: 50.00,
    ubicacion: null,
    estado: true
  }
];

// Contadores
const stats = {
  total: 0,
  insertados: 0,
  socio_no_encontrado: 0,
  beneficiario_creado: 0,
  beneficiario_existente: 0,
  errores: 0,
  por_estado: {
    activo: 0,
    suspendido: 0,
    retirado: 0
  }
};

/**
 * Insertar tipos de acuerdo de funeraria
 */
async function insertarTiposAcuerdo() {
  console.log('\n1. Insertando tipos de acuerdo de funeraria...');
  
  const tiposMap = new Map<string, number>();
  
  for (const tipo of TIPOS_ACUERDO) {
    const tipoCreado = await prisma.tipoAcuerdoFuneraria.upsert({
      where: { codigo: tipo.codigo },
      update: {
        nombre: tipo.nombre,
        monto_usd: tipo.monto_usd,
        ubicacion: tipo.ubicacion,
        estado: tipo.estado
      },
      create: {
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        monto_usd: tipo.monto_usd,
        ubicacion: tipo.ubicacion,
        estado: tipo.estado
      }
    });
    
    tiposMap.set(tipo.codigo, tipoCreado.id);
    console.log(`   ✅ Tipo ${tipo.codigo}: ${tipo.nombre} (ID: ${tipoCreado.id})`);
  }
  
  console.log(`   Total: ${tiposMap.size} tipos insertados\n`);
  return tiposMap;
}

/**
 * Leer CSV de acuerdos
 */
function leerCSV(): any[] {
  console.log('2. Leyendo CSV de acuerdos...');
  
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });
  
  console.log(`   ✅ ${records.length} registros leídos\n`);
  return records;
}

/**
 * Parsear fecha en formato DD/MM/YYYY
 */
function parsearFecha(fechaStr: string): Date | null {
  if (!fechaStr || fechaStr.trim() === '') return null;
  
  try {
    const [dia, mes, anio] = fechaStr.split('/');
    if (!dia || !mes || !anio) return null;
    
    // Validar valores
    const d = parseInt(dia);
    const m = parseInt(mes);
    const a = parseInt(anio);
    
    // Validar rangos (incluyendo año máximo)
    if (d < 1 || d > 31 || m < 1 || m > 12 || a < 1900 || a > 2100) {
      return null;
    }
    
    const fecha = new Date(a, m - 1, d);
    
    // Validar que la fecha sea válida
    if (isNaN(fecha.getTime())) return null;
    
    return fecha;
  } catch (e) {
    return null;
  }
}

/**
 * Separar nombre completo en nombre y apellido
 */
function separarNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = nombreCompleto.trim().split(/\s+/);
  
  if (partes.length === 1) {
    return { nombre: partes[0], apellido: '' };
  } else if (partes.length === 2) {
    return { nombre: partes[0], apellido: partes[1] };
  } else {
    // Asumir que primeras palabras son nombres y últimas son apellidos
    const mitad = Math.floor(partes.length / 2);
    return {
      nombre: partes.slice(0, mitad).join(' '),
      apellido: partes.slice(mitad).join(' ')
    };
  }
}

/**
 * Crear o buscar beneficiario
 */
async function obtenerBeneficiario(socioId: number, socioCedula: string, socioNombre: string, telefono: string | null, fechaNac: Date | null) {
  // Buscar beneficiario existente por cédula del socio
  let beneficiario = await prisma.beneficiario.findUnique({
    where: { cedula: socioCedula }
  });
  
  if (beneficiario) {
    stats.beneficiario_existente++;
    return beneficiario.id;
  }
  
  // Crear beneficiario (el socio es el beneficiario titular)
  const { nombre, apellido } = separarNombre(socioNombre);
  
  beneficiario = await prisma.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: socioCedula,
      nombre: nombre.substring(0, 100),
      apellido: apellido.substring(0, 100),
      fecha_nacimiento: fechaNac,
      parentesco: 'titular',
      telefono: telefono?.substring(0, 20) || null,
      estado: 'activo'
    }
  });
  
  stats.beneficiario_creado++;
  return beneficiario.id;
}

/**
 * Importar acuerdos
 */
async function importarAcuerdos(acuerdos: any[], tiposMap: Map<string, number>) {
  console.log('3. Importando acuerdos de funeraria...\n');
  
  const tipoGeneralId = tiposMap.get('01')!;
  
  for (let i = 0; i < acuerdos.length; i++) {
    const row = acuerdos[i];
    stats.total++;
    
    try {
      // Validar cédula
      const cedula = row.socio_cedula?.trim();
      if (!cedula || cedula === '') {
        stats.errores++;
        continue;
      }
      
      // Buscar socio por cédula
      const socio = await prisma.socio.findUnique({
        where: { cedula: cedula }
      });
      
      if (!socio) {
        stats.socio_no_encontrado++;
        if (stats.socio_no_encontrado <= 10) {
          console.log(`   ⚠️  Socio no encontrado: ${cedula} - ${row.socio_nombre}`);
        }
        continue;
      }
      
      // Verificar si ya existe el acuerdo (por número de acuerdo o contrato)
      const acuerdoExistente = await prisma.acuerdoFuneraria.findFirst({
        where: {
          beneficiario: {
            cedula: row.socio_cedula?.trim()
          }
        }
      });
      
      if (acuerdoExistente) {
        // Ya existe, no duplicar
        continue;
      }
      
      // Obtener o crear beneficiario
      const beneficiarioId = await obtenerBeneficiario(
        socio.id,
        row.socio_cedula?.trim() || '',
        row.socio_nombre?.trim() || '',
        row.telefono?.trim(),
        parsearFecha(row.fecha_nacimiento)
      );
      
      // Parsear estado
      let estado: 'activo' | 'suspendido' | 'retirado' = 'activo';
      if (row.estado?.toLowerCase() === 'suspendido') {
        estado = 'suspendido';
      } else if (row.estado?.toLowerCase() === 'retirado') {
        estado = 'retirado';
      }
      
      stats.por_estado[estado]++;
      
      // Parsear fechas
      const fechaInicio = parsearFecha(row.fecha_acuerdo) || new Date();
      const fechaSuspension = estado === 'suspendido' ? new Date() : null;
      const semanasAtraso = parseInt(row.atraso_semanas) || 0;
      
      // Crear acuerdo
      await prisma.acuerdoFuneraria.create({
        data: {
          beneficiario_id: beneficiarioId,
          tipo_acuerdo_id: tipoGeneralId,
          estado: estado,
          semanas_sin_pago: semanasAtraso,
          fecha_suspension: fechaSuspension,
          fecha_inicio: fechaInicio
        }
      });
      
      stats.insertados++;
      
      // Progreso
      if (stats.insertados % 500 === 0) {
        console.log(`   Progreso: ${stats.insertados}/${stats.total} (${((stats.insertados/stats.total)*100).toFixed(1)}%)`);
      }
      
    } catch (error: any) {
      stats.errores++;
      if (stats.errores <= 5) {
        console.error(`   ❌ Error en registro ${i + 1}:`, error.message);
      }
    }
  }
}

/**
 * Mostrar estadísticas finales
 */
function mostrarEstadisticas() {
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE IMPORTACIÓN - FUNERARIA');
  console.log('='.repeat(60));
  
  console.log(`\nTotal procesados:        ${stats.total}`);
  console.log(`✅ Insertados:            ${stats.insertados} (${((stats.insertados/stats.total)*100).toFixed(1)}%)`);
  console.log(`\nBeneficiarios:`);
  console.log(`   - Creados:             ${stats.beneficiario_creado}`);
  console.log(`   - Existentes:          ${stats.beneficiario_existente}`);
  
  console.log(`\nPor Estado:`);
  console.log(`   - Activos:             ${stats.por_estado.activo} (${((stats.por_estado.activo/stats.insertados)*100).toFixed(1)}%)`);
  console.log(`   - Suspendidos:         ${stats.por_estado.suspendido} (${((stats.por_estado.suspendido/stats.insertados)*100).toFixed(1)}%)`);
  console.log(`   - Retirados:           ${stats.por_estado.retirado} (${((stats.por_estado.retirado/stats.insertados)*100).toFixed(1)}%)`);
  
  console.log(`\n⚠️  Socios no encontrados: ${stats.socio_no_encontrado} (${((stats.socio_no_encontrado/stats.total)*100).toFixed(1)}%)`);
  console.log(`❌ Errores:               ${stats.errores}`);
  
  const tasaExito = ((stats.insertados / stats.total) * 100).toFixed(2);
  console.log(`\n📊 Tasa de éxito:         ${tasaExito}%`);
  
  if (parseFloat(tasaExito) > 90) {
    console.log('\n✅ ¡Importación exitosa!');
  } else if (parseFloat(tasaExito) > 80) {
    console.log('\n⚠️  Importación completada con advertencias');
  } else {
    console.log('\n❌ Importación con problemas - revisar logs');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTACIÓN DE ACUERDOS DE FUNERARIA');
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
