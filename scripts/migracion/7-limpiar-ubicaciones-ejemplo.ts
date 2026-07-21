import { PrismaClient } from '../../backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function limpiarUbicacionesEjemplo() {
  console.log('🧹 Iniciando limpieza de ubicaciones de ejemplo...\n');

  // Códigos de ubicaciones a eliminar
  const codigosAEliminar = [
    'FER-CENT',
    'FER_ESTE',
    'FER-ESTE',
    'FER-NORTE',
    'FER-OESTE',
    'FER-SUR',
    'FER-PRINC',
    'FER-PRIN',
    'SUC001',
    'SUC-002',
    'SUC002'
  ];

  try {
    // 1. Verificar cuántos socios están asociados
    const ubicacionesConSocios = await prisma.ubicacion.findMany({
      where: {
        codigo: { in: codigosAEliminar }
      },
      include: {
        _count: {
          select: { socios: true }
        }
      }
    });

    console.log('📊 Ubicaciones a eliminar:');
    ubicacionesConSocios.forEach(ub => {
      console.log(`   ${ub.codigo.padEnd(12)} - ${ub.nombre.padEnd(40)} → ${ub._count.socios} socios`);
    });

    const totalSocios = ubicacionesConSocios.reduce((sum, ub) => sum + ub._count.socios, 0);
    console.log(`\n📍 Total de socios a desvincular: ${totalSocios}`);

    // 2. Desvincular socios (poner ubicacion_id = null)
    if (totalSocios > 0) {
      const resultDesvincular = await prisma.socio.updateMany({
        where: {
          ubicacion: {
            codigo: { in: codigosAEliminar }
          }
        },
        data: {
          ubicacion_id: null
        }
      });

      console.log(`✅ Desvinculados: ${resultDesvincular.count} socios\n`);
    }

    // 3. Eliminar ubicaciones
    const resultEliminar = await prisma.ubicacion.deleteMany({
      where: {
        codigo: { in: codigosAEliminar }
      }
    });

    console.log(`✅ Eliminadas: ${resultEliminar.count} ubicaciones\n`);

    // 4. Verificar ubicaciones restantes
    const ubicacionesRestantes = await prisma.ubicacion.findMany({
      orderBy: { codigo: 'asc' },
      include: {
        _count: {
          select: { socios: true }
        }
      }
    });

    console.log('📋 Ubicaciones restantes (ferias reales):');
    ubicacionesRestantes.forEach(ub => {
      console.log(`   ${ub.codigo.padEnd(10)} - ${ub.nombre.padEnd(50)} → ${ub._count.socios.toString().padStart(5)} socios`);
    });

    console.log(`\n✅ Total ubicaciones restantes: ${ubicacionesRestantes.length}`);
    console.log(`✅ Total socios con ubicación: ${ubicacionesRestantes.reduce((sum, ub) => sum + ub._count.socios, 0)}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

limpiarUbicacionesEjemplo()
  .then(() => {
    console.log('\n✅ Limpieza completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
