/**
 * ============================================
 * SCRIPT DE IMPORTACIÓN: SOCIOS
 * ============================================
 * Importa socios desde CSV al nuevo sistema
 * 
 * PREREQUISITOS:
 * 1. Archivos CSV en scripts/migracion/data/
 * 2. Base de datos nueva inicializada
 * 3. Migración de ubicaciones completada
 * 
 * EJECUCIÓN:
 * cd scripts/migracion
 * npx tsx 2-import-socios.ts
 * ============================================
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

// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  dataDir: path.join(__dirname, 'data'),
  logDir: path.join(__dirname, 'logs'),
  batchSize: 100, // Registros por lote
  dryRun: false, // true = no insertar, solo validar
};

interface SocioCSV {
  codigo_socio: string;
  cedula: string;
  apellido: string;
  nombre: string;
  fecha_ingreso: string;
  fecha_nacimiento: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  estado: 'activo' | 'suspendido' | 'inactivo' | 'retirado';
  autorizado_nombre?: string;
  autorizado_cedula?: string;
  ubicacion_codigo: string;
  es_delegado?: string;
  notas?: string;
  fecha_retiro?: string;
  motivo_retiro?: string;
}

interface MigrationStats {
  total: number;
  insertados: number;
  duplicados: number;
  errores: number;
  advertencias: number;
}

// ============================================
// UTILIDADES
// ============================================

function initLogs() {
  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }
}

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  const logFile = path.join(CONFIG.logDir, `migration_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
}

function logError(message: string, error: any) {
  const errorMessage = `${message}: ${error.message}\n${error.stack}\n`;
  log(errorMessage, 'error');
  
  const errorFile = path.join(CONFIG.logDir, 'errors.log');
  fs.appendFileSync(errorFile, `[${new Date().toISOString()}] ${errorMessage}\n`);
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 't', 'yes', 'y', 'si', 's'].includes(value.toLowerCase());
}

// ============================================
// VALIDACIONES
// ============================================

async function validarUbicacion(codigo: string): Promise<number | null> {
  const ubicacion = await prisma.ubicacion.findFirst({
    where: { codigo },
  });
  
  if (!ubicacion) {
    log(`Ubicación no encontrada: ${codigo}`, 'warn');
    return null;
  }
  
  return ubicacion.id;
}

async function validarCedulaUnica(cedula: string): Promise<boolean> {
  const existente = await prisma.socio.findUnique({
    where: { cedula },
  });
  
  return !existente;
}

async function validarCodigoSocioUnico(codigo: string): Promise<boolean> {
  const existente = await prisma.socio.findFirst({
    where: { codigo_socio: codigo },
  });
  
  return !existente;
}

// ============================================
// IMPORTACIÓN
// ============================================

async function importarSocios() {
  log('='.repeat(60));
  log('INICIANDO IMPORTACIÓN DE SOCIOS');
  log('='.repeat(60));
  
  const stats: MigrationStats = {
    total: 0,
    insertados: 0,
    duplicados: 0,
    errores: 0,
    advertencias: 0,
  };
  
  try {
    // Leer archivo CSV
    const csvPath = path.join(CONFIG.dataDir, 'socios_combined.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo no encontrado: ${csvPath}`);
    }
    
    log(`Leyendo archivo: ${csvPath}`);
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const socios: SocioCSV[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    stats.total = socios.length;
    log(`Total de socios a importar: ${stats.total}`);
    
    if (CONFIG.dryRun) {
      log('MODO DRY RUN: No se insertarán datos', 'warn');
    }
    
    // Procesar en lotes
    for (let i = 0; i < socios.length; i += CONFIG.batchSize) {
      const lote = socios.slice(i, i + CONFIG.batchSize);
      log(`Procesando lote ${Math.floor(i / CONFIG.batchSize) + 1} (${lote.length} socios)...`);
      
      for (const socioData of lote) {
        try {
          // Validar cédula única
          const cedulaUnica = await validarCedulaUnica(socioData.cedula);
          if (!cedulaUnica) {
            log(`Cédula duplicada: ${socioData.cedula} (${socioData.nombre} ${socioData.apellido})`, 'warn');
            stats.duplicados++;
            continue;
          }
          
          // Validar código socio único
          const codigoUnico = await validarCodigoSocioUnico(socioData.codigo_socio);
          if (!codigoUnico) {
            log(`Código de socio duplicado: ${socioData.codigo_socio}`, 'warn');
            stats.duplicados++;
            continue;
          }
          
          // Validar ubicación
          const ubicacionId = await validarUbicacion(socioData.ubicacion_codigo);
          if (!ubicacionId) {
            log(`Socio sin ubicación válida: ${socioData.cedula}`, 'warn');
            stats.advertencias++;
            // Usar ubicación por defecto (primera disponible)
            const ubicacionDefault = await prisma.ubicacion.findFirst();
            if (!ubicacionDefault) {
              throw new Error('No hay ubicaciones disponibles en el sistema');
            }
          }
          
          // Preparar datos
          // Si fecha_ingreso está vacía, usar fecha actual como defecto
          const fechaIngreso = socioData.fecha_ingreso && socioData.fecha_ingreso.trim() 
            ? new Date(socioData.fecha_ingreso) 
            : new Date('2020-01-01'); // Fecha por defecto si no hay datos
          
          // Si fecha_nacimiento está vacía, usar null
          const fechaNacimiento = socioData.fecha_nacimiento && socioData.fecha_nacimiento.trim()
            ? new Date(socioData.fecha_nacimiento)
            : null;
          
          const socioNuevo: any = {
            codigo_socio: socioData.codigo_socio,
            cedula: socioData.cedula,
            nombre: socioData.nombre,
            apellido: socioData.apellido,
            fecha_inscripcion: fechaIngreso,
            fecha_nacimiento: fechaNacimiento,
            direccion: socioData.direccion || null,
            telefono: socioData.telefono || null,
            email: socioData.email || null,
            estado: socioData.estado || 'activo',
            autorizado_nombre: socioData.autorizado_nombre || null,
            autorizado_cedula: socioData.autorizado_cedula || null,
            es_delegado: parseBoolean(socioData.es_delegado),
            notas: socioData.notas || null,
          };
          
          // Agregar ubicación si existe
          if (ubicacionId) {
            socioNuevo.ubicacion = { connect: { id: ubicacionId } };
          }
          
          // Insertar si no es dry run
          if (!CONFIG.dryRun) {
            await prisma.socio.create({
              data: socioNuevo,
            });
          }
          
          stats.insertados++;
          
          if (stats.insertados % 100 === 0) {
            log(`Progreso: ${stats.insertados}/${stats.total} socios importados`);
          }
          
        } catch (error: any) {
          logError(`Error al importar socio ${socioData.cedula}`, error);
          stats.errores++;
        }
      }
    }
    
    // Generar reporte
    log('='.repeat(60));
    log('IMPORTACIÓN COMPLETADA');
    log('='.repeat(60));
    log(`Total socios en CSV: ${stats.total}`);
    log(`Socios insertados: ${stats.insertados}`);
    log(`Duplicados omitidos: ${stats.duplicados}`);
    log(`Advertencias: ${stats.advertencias}`);
    log(`Errores: ${stats.errores}`);
    log('='.repeat(60));
    
    // Guardar reporte JSON
    const reportPath = path.join(CONFIG.logDir, 'migration_report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          fecha: new Date().toISOString(),
          tipo: 'socios',
          stats,
          config: CONFIG,
        },
        null,
        2
      )
    );
    
    log(`Reporte guardado en: ${reportPath}`);
    
  } catch (error: any) {
    logError('Error fatal en importación', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================
// EJECUCIÓN
// ============================================

async function main() {
  initLogs();
  
  // Verificar conexión a BD
  try {
    await prisma.$connect();
    log('✓ Conexión a base de datos establecida');
  } catch (error) {
    logError('Error al conectar a la base de datos', error);
    process.exit(1);
  }
  
  // Confirmar antes de proceder
  if (!CONFIG.dryRun) {
    log('ADVERTENCIA: Esta operación insertará datos en la base de datos.', 'warn');
    log('Presiona Ctrl+C para cancelar o espera 5 segundos para continuar...', 'warn');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  await importarSocios();
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  logError('Unhandled rejection', error);
  process.exit(1);
});

// Ejecutar
main()
  .then(() => {
    log('✓ Script finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    logError('Script finalizado con errores', error);
    process.exit(1);
  });
