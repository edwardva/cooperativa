/**
 * ============================================
 * SCRIPT DE IMPORTACIÓN: BENEFICIARIOS
 * ============================================
 * Importa beneficiarios desde CSV al nuevo sistema
 * 
 * PREREQUISITOS:
 * 1. Migración de socios completada
 * 2. Archivo beneficiarios_export.csv en data/
 * 
 * EJECUCIÓN:
 * cd scripts/migracion
 * npx tsx 5-import-beneficiarios.ts
 * ============================================
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  dataDir: path.join(__dirname, 'data'),
  logDir: path.join(__dirname, 'logs'),
  batchSize: 100,
  dryRun: false,
};

interface BeneficiarioCSV {
  socio_codigo_socio: string;
  cedula: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  parentesco: string;
  telefono?: string;
  direccion?: string;
  porcentaje: string;
  estado?: string;
}

interface MigrationStats {
  total: number;
  insertados: number;
  socioNoEncontrado: number;
  errores: number;
  advertencias: number;
}

// ============================================
// UTILIDADES
// ============================================

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  const logFile = path.join(CONFIG.logDir, `migration_beneficiarios_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
}

function logError(message: string, error: any) {
  const errorMessage = `${message}: ${error.message}\n${error.stack}\n`;
  log(errorMessage, 'error');
  
  const errorFile = path.join(CONFIG.logDir, 'errors.log');
  fs.appendFileSync(errorFile, `[${new Date().toISOString()}] ${errorMessage}\n`);
}

// ============================================
// VALIDACIONES
// ============================================

async function buscarSocio(codigoSocio: string): Promise<number | null> {
  const socio = await prisma.socio.findFirst({
    where: { codigo_socio: codigoSocio },
  });
  
  if (!socio) {
    log(`Socio no encontrado: ${codigoSocio}`, 'warn');
    return null;
  }
  
  return socio.id;
}

async function contarBeneficiariosSocio(socioId: number): Promise<number> {
  return await prisma.beneficiario.count({
    where: {
      socio_id: socioId,
      deleted_at: null,
    },
  });
}

// ============================================
// IMPORTACIÓN
// ============================================

async function importarBeneficiarios() {
  log('='.repeat(60));
  log('INICIANDO IMPORTACIÓN DE BENEFICIARIOS');
  log('='.repeat(60));
  
  const stats: MigrationStats = {
    total: 0,
    insertados: 0,
    socioNoEncontrado: 0,
    errores: 0,
    advertencias: 0,
  };
  
  try {
    // Leer archivo CSV
    const csvPath = path.join(CONFIG.dataDir, 'beneficiarios_export.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo no encontrado: ${csvPath}`);
    }
    
    log(`Leyendo archivo: ${csvPath}`);
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const beneficiarios: BeneficiarioCSV[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    stats.total = beneficiarios.length;
    log(`Total de beneficiarios a importar: ${stats.total}`);
    
    if (CONFIG.dryRun) {
      log('MODO DRY RUN: No se insertarán datos', 'warn');
    }
    
    // Procesar en lotes
    for (let i = 0; i < beneficiarios.length; i += CONFIG.batchSize) {
      const lote = beneficiarios.slice(i, i + CONFIG.batchSize);
      log(`Procesando lote ${Math.floor(i / CONFIG.batchSize) + 1} (${lote.length} beneficiarios)...`);
      
      for (const beneficiarioData of lote) {
        try {
          // Buscar socio
          const socioId = await buscarSocio(beneficiarioData.socio_codigo_socio);
          
          if (!socioId) {
            stats.socioNoEncontrado++;
            continue;
          }
          
          // Validar límite de 9 beneficiarios
          const cantidadActual = await contarBeneficiariosSocio(socioId);
          
          if (cantidadActual >= 9) {
            log(`Socio ${beneficiarioData.socio_codigo_socio} ya tiene 9 beneficiarios`, 'warn');
            stats.advertencias++;
            continue;
          }
          
          // Preparar datos
          const beneficiarioNuevo = {
            socio_id: socioId,
            cedula: beneficiarioData.cedula,
            nombre: beneficiarioData.nombre,
            apellido: beneficiarioData.apellido,
            fecha_nacimiento: new Date(beneficiarioData.fecha_nacimiento),
            parentesco: beneficiarioData.parentesco,
            telefono: beneficiarioData.telefono || null,
            direccion: beneficiarioData.direccion || null,
            porcentaje: parseFloat(beneficiarioData.porcentaje) || 0,
          };
          
          // Insertar si no es dry run
          if (!CONFIG.dryRun) {
            await prisma.beneficiario.create({
              data: beneficiarioNuevo,
            });
          }
          
          stats.insertados++;
          
          if (stats.insertados % 100 === 0) {
            log(`Progreso: ${stats.insertados}/${stats.total} beneficiarios importados`);
          }
          
        } catch (error: any) {
          logError(`Error al importar beneficiario ${beneficiarioData.cedula}`, error);
          stats.errores++;
        }
      }
    }
    
    // Generar reporte
    log('='.repeat(60));
    log('IMPORTACIÓN COMPLETADA');
    log('='.repeat(60));
    log(`Total beneficiarios en CSV: ${stats.total}`);
    log(`Beneficiarios insertados: ${stats.insertados}`);
    log(`Socios no encontrados: ${stats.socioNoEncontrado}`);
    log(`Advertencias: ${stats.advertencias}`);
    log(`Errores: ${stats.errores}`);
    log('='.repeat(60));
    
    // Guardar reporte JSON
    const reportPath = path.join(CONFIG.logDir, 'migration_beneficiarios_report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          fecha: new Date().toISOString(),
          tipo: 'beneficiarios',
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
  
  await importarBeneficiarios();
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
