/**
 * Script para truncar tabla de socios antes de importación
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function truncateSocios() {
  console.log('🗑️  Truncando tabla de socios...');
  
  try {
    // Contar registros actuales
    const count = await prisma.socio.count();
    console.log(`   Registros actuales: ${count.toLocaleString()}`);
    
    if (count > 0) {
      // Eliminar en cascada (esto también elimina beneficiarios, cuentas, etc.)
      await prisma.$executeRaw`TRUNCATE TABLE socios RESTART IDENTITY CASCADE;`;
      console.log('✅ Tabla truncada exitosamente');
    } else {
      console.log('✅ Tabla ya está vacía');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

truncateSocios();
