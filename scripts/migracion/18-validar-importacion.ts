/**
 * Script para validar la importación de socios
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function validarImportacion() {
  console.log('🔍 VALIDACIÓN DE IMPORTACIÓN DE SOCIOS\n');
  
  try {
    // Conteo total
    const total = await prisma.socio.count();
    console.log(`📊 Total de socios: ${total.toLocaleString()}\n`);
    
    // Por estado
    const activos = await prisma.socio.count({ where: { estado: 'activo' } });
    const retirados = await prisma.socio.count({ where: { estado: 'retirado' } });
    const invalidos = await prisma.socio.count({ where: { estado: 'invalido' } });
    
    console.log('Por estado:');
    console.log(`  ✅ Activos: ${activos.toLocaleString()}`);
    console.log(`  🚪 Retirados: ${retirados.toLocaleString()}`);
    console.log(`  ❌ Inválidos: ${invalidos.toLocaleString()}\n`);
    
    // Cédulas temporales
    const temporales = await prisma.socio.count({
      where: { cedula: { startsWith: 'TEMP' } }
    });
    console.log(`🆔 Cédulas temporales: ${temporales.toLocaleString()}\n`);
    
    // Cédulas duplicadas (misma cédula, diferentes expedientes)
    const duplicados = await prisma.$queryRaw`
      SELECT cedula, COUNT(*) as total
      FROM socios
      WHERE cedula NOT LIKE 'TEMP%'
      GROUP BY cedula
      HAVING COUNT(*) > 1
      ORDER BY total DESC
      LIMIT 10;
    `;
    
    console.log('🔄 Cédulas con múltiples expedientes (top 10):');
    for (const dup of duplicados as any[]) {
      console.log(`  CI ${dup.cedula}: ${dup.total} expedientes`);
    }
    
    // Delegados
    const delegados = await prisma.socio.count({ where: { es_delegado: true } });
    console.log(`\n👥 Delegados: ${delegados.toLocaleString()}`);
    
    // Sin email
    const sinEmail = await prisma.socio.count({ where: { email: null } });
    console.log(`📧 Sin correo: ${sinEmail.toLocaleString()}`);
    
    // Sin teléfono
    const sinTelefono = await prisma.socio.count({ where: { telefono: null } });
    console.log(`📞 Sin teléfono: ${sinTelefono.toLocaleString()}`);
    
    console.log('\n✅ Validación completada');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

validarImportacion();
