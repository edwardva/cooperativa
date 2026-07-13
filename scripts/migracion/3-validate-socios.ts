/**
 * ============================================
 * SCRIPT DE VALIDACIÓN: SOCIOS
 * ============================================
 * Valida la integridad de los datos migrados
 * 
 * EJECUCIÓN:
 * cd scripts/migracion
 * npx tsx 3-validate-socios.ts
 * ============================================
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ValidationResult {
  check: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

// ============================================
// VALIDACIONES
// ============================================

async function validarCantidadSocios() {
  console.log('📊 Validando cantidad de socios...');
  
  const total = await prisma.socio.count();
  const esperado = 9585; // Ajustar según datos reales
  
  if (total === esperado) {
    results.push({
      check: 'Cantidad de socios',
      status: 'OK',
      message: `${total} socios migrados correctamente`,
    });
  } else if (total > esperado * 0.95) {
    results.push({
      check: 'Cantidad de socios',
      status: 'WARNING',
      message: `${total} socios migrados (esperado: ${esperado})`,
      details: { migrados: total, esperado, diferencia: total - esperado },
    });
  } else {
    results.push({
      check: 'Cantidad de socios',
      status: 'ERROR',
      message: `Solo ${total} socios migrados (esperado: ${esperado})`,
      details: { migrados: total, esperado, faltantes: esperado - total },
    });
  }
}

async function validarCedulasUnicas() {
  console.log('🔍 Validando cédulas únicas...');
  
  const duplicados = await prisma.$queryRaw<Array<{ cedula: string; count: bigint }>>`
    SELECT cedula, COUNT(*) as count
    FROM socios
    GROUP BY cedula
    HAVING COUNT(*) > 1
  `;
  
  if (duplicados.length === 0) {
    results.push({
      check: 'Cédulas únicas',
      status: 'OK',
      message: 'No hay cédulas duplicadas',
    });
  } else {
    results.push({
      check: 'Cédulas únicas',
      status: 'ERROR',
      message: `${duplicados.length} cédulas duplicadas encontradas`,
      details: duplicados.map(d => ({ cedula: d.cedula, cantidad: Number(d.count) })),
    });
  }
}

async function validarCodigosSociosUnicos() {
  console.log('🔍 Validando códigos de socio únicos...');
  
  const duplicados = await prisma.$queryRaw<Array<{ codigo_socio: string; count: bigint }>>`
    SELECT codigo_socio, COUNT(*) as count
    FROM socios
    GROUP BY codigo_socio
    HAVING COUNT(*) > 1
  `;
  
  if (duplicados.length === 0) {
    results.push({
      check: 'Códigos de socio únicos',
      status: 'OK',
      message: 'No hay códigos de socio duplicados',
    });
  } else {
    results.push({
      check: 'Códigos de socio únicos',
      status: 'ERROR',
      message: `${duplicados.length} códigos de socio duplicados`,
      details: duplicados.map(d => ({ codigo: d.codigo_socio, cantidad: Number(d.count) })),
    });
  }
}

async function validarUbicacionesAsignadas() {
  console.log('📍 Validando ubicaciones asignadas...');
  
  const sinUbicacion = await prisma.socio.count({
    where: { ubicacion_id: null },
  });
  
  if (sinUbicacion === 0) {
    results.push({
      check: 'Ubicaciones asignadas',
      status: 'OK',
      message: 'Todos los socios tienen ubicación asignada',
    });
  } else {
    results.push({
      check: 'Ubicaciones asignadas',
      status: 'ERROR',
      message: `${sinUbicacion} socios sin ubicación asignada`,
    });
  }
}

async function validarEstados() {
  console.log('✅ Validando estados de socios...');
  
  const estadosValidos = ['activo', 'suspendido', 'inactivo', 'retirado'];
  
  const porEstado = await prisma.socio.groupBy({
    by: ['estado'],
    _count: true,
  });
  
  const estadosInvalidos = porEstado.filter(e => !estadosValidos.includes(e.estado));
  
  if (estadosInvalidos.length === 0) {
    results.push({
      check: 'Estados válidos',
      status: 'OK',
      message: 'Todos los socios tienen estados válidos',
      details: porEstado.map(e => ({ estado: e.estado, cantidad: e._count })),
    });
  } else {
    results.push({
      check: 'Estados válidos',
      status: 'ERROR',
      message: 'Socios con estados inválidos detectados',
      details: estadosInvalidos,
    });
  }
}

async function validarFechas() {
  console.log('📅 Validando fechas...');
  
  const fechasInvalidas = await prisma.socio.findMany({
    where: {
      OR: [
        { fecha_ingreso: { gt: new Date() } },
        { fecha_nacimiento: { gt: new Date() } },
        { 
          AND: [
            { fecha_nacimiento: { not: null } },
            { fecha_ingreso: { not: null } },
            // fecha_ingreso < fecha_nacimiento (imposible)
          ]
        }
      ],
    },
    select: {
      codigo_socio: true,
      cedula: true,
      nombre: true,
      apellido: true,
      fecha_ingreso: true,
      fecha_nacimiento: true,
    },
  });
  
  if (fechasInvalidas.length === 0) {
    results.push({
      check: 'Fechas válidas',
      status: 'OK',
      message: 'Todas las fechas son coherentes',
    });
  } else {
    results.push({
      check: 'Fechas válidas',
      status: 'WARNING',
      message: `${fechasInvalidas.length} socios con fechas incoherentes`,
      details: fechasInvalidas,
    });
  }
}

async function validarDatosContacto() {
  console.log('📞 Validando datos de contacto...');
  
  const sinTelefono = await prisma.socio.count({
    where: {
      OR: [
        { telefono: null },
        { telefono: '' },
      ],
    },
  });
  
  const sinEmail = await prisma.socio.count({
    where: {
      OR: [
        { email: null },
        { email: '' },
      ],
    },
  });
  
  if (sinTelefono < 100 && sinEmail < 100) {
    results.push({
      check: 'Datos de contacto',
      status: 'OK',
      message: 'Mayoría de socios tiene datos de contacto',
      details: { sin_telefono: sinTelefono, sin_email: sinEmail },
    });
  } else {
    results.push({
      check: 'Datos de contacto',
      status: 'WARNING',
      message: 'Muchos socios sin datos de contacto',
      details: { sin_telefono: sinTelefono, sin_email: sinEmail },
    });
  }
}

async function validarBeneficiarios() {
  console.log('👥 Validando beneficiarios...');
  
  const sociosConMasDe9 = await prisma.$queryRaw<Array<{ socio_id: number; count: bigint }>>`
    SELECT socio_id, COUNT(*) as count
    FROM beneficiarios
    WHERE deleted_at IS NULL
    GROUP BY socio_id
    HAVING COUNT(*) > 9
  `;
  
  if (sociosConMasDe9.length === 0) {
    results.push({
      check: 'Límite de beneficiarios',
      status: 'OK',
      message: 'Ningún socio supera el límite de 9 beneficiarios',
    });
  } else {
    results.push({
      check: 'Límite de beneficiarios',
      status: 'WARNING',
      message: `${sociosConMasDe9.length} socios con más de 9 beneficiarios`,
      details: sociosConMasDe9.map(s => ({ socio_id: s.socio_id, cantidad: Number(s.count) })),
    });
  }
}

async function validarIntegridadReferencial() {
  console.log('🔗 Validando integridad referencial...');
  
  // Socios con ubicaciones que no existen
  const ubicacionesInvalidas = await prisma.socio.findMany({
    where: {
      ubicacion: null,
    },
    include: {
      ubicacion: true,
    },
  });
  
  if (ubicacionesInvalidas.length === 0) {
    results.push({
      check: 'Integridad referencial',
      status: 'OK',
      message: 'Todas las referencias son válidas',
    });
  } else {
    results.push({
      check: 'Integridad referencial',
      status: 'ERROR',
      message: 'Referencias inválidas detectadas',
      details: { socios_con_ubicacion_invalida: ubicacionesInvalidas.length },
    });
  }
}

// ============================================
// GENERAR REPORTE
// ============================================

function generarReporte() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 REPORTE DE VALIDACIÓN');
  console.log('='.repeat(60));
  
  let totalOK = 0;
  let totalWarnings = 0;
  let totalErrors = 0;
  
  results.forEach(result => {
    const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`\n${icon} ${result.check}`);
    console.log(`   ${result.message}`);
    
    if (result.details && Object.keys(result.details).length < 5) {
      console.log(`   Detalles: ${JSON.stringify(result.details, null, 2)}`);
    }
    
    if (result.status === 'OK') totalOK++;
    else if (result.status === 'WARNING') totalWarnings++;
    else totalErrors++;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ OK: ${totalOK} | ⚠️  WARNINGS: ${totalWarnings} | ❌ ERRORS: ${totalErrors}`);
  console.log('='.repeat(60));
  
  // Guardar reporte JSON
  const reportPath = path.join(__dirname, 'logs', 'validation_report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        fecha: new Date().toISOString(),
        resumen: {
          total_checks: results.length,
          ok: totalOK,
          warnings: totalWarnings,
          errors: totalErrors,
        },
        resultados: results,
      },
      null,
      2
    )
  );
  
  console.log(`\n📄 Reporte guardado en: ${reportPath}\n`);
  
  // Retornar código de salida según resultado
  return totalErrors > 0 ? 1 : 0;
}

// ============================================
// EJECUCIÓN
// ============================================

async function main() {
  console.log('🚀 Iniciando validación de migración de socios...\n');
  
  try {
    await prisma.$connect();
    
    await validarCantidadSocios();
    await validarCedulasUnicas();
    await validarCodigosSociosUnicos();
    await validarUbicacionesAsignadas();
    await validarEstados();
    await validarFechas();
    await validarDatosContacto();
    await validarBeneficiarios();
    await validarIntegridadReferencial();
    
    const exitCode = generarReporte();
    
    await prisma.$disconnect();
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Error durante validación:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
