/**
 * ============================================
 * SCRIPT DE ROLLBACK: SOCIOS
 * ============================================
 * Elimina todos los socios migrados en caso de error
 * 
 * ⚠️ ADVERTENCIA: Esta operación es DESTRUCTIVA
 * 
 * EJECUCIÓN:
 * cd scripts/migracion
 * npx tsx 4-rollback-socios.ts
 * ============================================
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

// ============================================
// CONFIRMACIÓN INTERACTIVA
// ============================================

function confirmar(pregunta: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question(pregunta + ' (escriba SI para confirmar): ', respuesta => {
      rl.close();
      resolve(respuesta.trim().toUpperCase() === 'SI');
    });
  });
}

// ============================================
// ROLLBACK
// ============================================

async function rollbackSocios() {
  console.log('⚠️  ═══════════════════════════════════════════════════════════');
  console.log('⚠️  ADVERTENCIA: OPERACIÓN DESTRUCTIVA');
  console.log('⚠️  ═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Esta operación eliminará:');
  console.log('  - Todos los socios migrados');
  console.log('  - Todos sus beneficiarios asociados');
  console.log('  - Todas las cuentas de ahorro asociadas');
  console.log('  - Todos los movimientos de ahorro asociados');
  console.log('');
  
  try {
    // Contar registros a eliminar
    const totalSocios = await prisma.socio.count();
    const totalBeneficiarios = await prisma.beneficiario.count();
    const totalCuentas = await prisma.cuentaAhorro.count();
    const totalMovimientos = await prisma.movimientoAhorro.count();
    
    console.log('Registros que serán eliminados:');
    console.log(`  📊 Socios: ${totalSocios}`);
    console.log(`  👥 Beneficiarios: ${totalBeneficiarios}`);
    console.log(`  💰 Cuentas de ahorro: ${totalCuentas}`);
    console.log(`  📈 Movimientos de ahorro: ${totalMovimientos}`);
    console.log('');
    
    // Primera confirmación
    const confirmacion1 = await confirmar('¿Está ABSOLUTAMENTE SEGURO de que desea continuar?');
    
    if (!confirmacion1) {
      console.log('\n✅ Operación cancelada por el usuario');
      return;
    }
    
    // Segunda confirmación con número aleatorio
    const numeroConfirmacion = Math.floor(Math.random() * 9000) + 1000;
    console.log(`\n⚠️  Para confirmar, escriba el número: ${numeroConfirmacion}`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const confirmacion2 = await new Promise<boolean>(resolve => {
      rl.question('Número de confirmación: ', respuesta => {
        rl.close();
        resolve(respuesta.trim() === String(numeroConfirmacion));
      });
    });
    
    if (!confirmacion2) {
      console.log('\n✅ Operación cancelada - Número incorrecto');
      return;
    }
    
    console.log('\n🔥 Iniciando rollback...\n');
    
    // Ejecutar rollback en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar movimientos de ahorro
      console.log('1/4 Eliminando movimientos de ahorro...');
      const movimientosEliminados = await tx.movimientoAhorro.deleteMany({});
      console.log(`   ✓ ${movimientosEliminados.count} movimientos eliminados`);
      
      // 2. Eliminar cuentas de ahorro
      console.log('2/4 Eliminando cuentas de ahorro...');
      const cuentasEliminadas = await tx.cuentaAhorro.deleteMany({});
      console.log(`   ✓ ${cuentasEliminadas.count} cuentas eliminadas`);
      
      // 3. Eliminar beneficiarios
      console.log('3/4 Eliminando beneficiarios...');
      const beneficiariosEliminados = await tx.beneficiario.deleteMany({});
      console.log(`   ✓ ${beneficiariosEliminados.count} beneficiarios eliminados`);
      
      // 4. Eliminar socios
      console.log('4/4 Eliminando socios...');
      const sociosEliminados = await tx.socio.deleteMany({});
      console.log(`   ✓ ${sociosEliminados.count} socios eliminados`);
    });
    
    console.log('\n✅ Rollback completado exitosamente');
    console.log('\n💡 Para restaurar datos de prueba, ejecute:');
    console.log('   cd backend && npm run db:seed');
    
  } catch (error) {
    console.error('\n❌ Error durante rollback:', error);
    throw error;
  }
}

// ============================================
// EJECUCIÓN
// ============================================

async function main() {
  try {
    await prisma.$connect();
    await rollbackSocios();
  } catch (error) {
    console.error('Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
