import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function limpiarFeriasSeed() {
  console.log('🧹 Limpiando ferias del seed...\n');

  try {
    // Ferias del seed a eliminar
    const feriasSeed = ['FER-CENT', 'FER-ESTE', 'FER-NORTE', 'FER-OESTE', 'FER-SUR', 'FER-PRIN'];

    console.log('🔍 Buscando ferias del seed...');
    const ubicacionesSeed = await prisma.ubicacion.findMany({
      where: {
        codigo: { in: feriasSeed }
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        _count: {
          select: {
            socios: true
          }
        }
      }
    });

    console.log(`✅ Encontradas ${ubicacionesSeed.length} ferias del seed:\n`);
    ubicacionesSeed.forEach(u => {
      console.log(`   - ${u.codigo}: ${u.nombre} (${u._count.socios} socios)`);
    });

    if (ubicacionesSeed.length === 0) {
      console.log('\n✨ No hay ferias del seed para eliminar.');
      return;
    }

    // Obtener IDs de las ferias a eliminar
    const idsAEliminar = ubicacionesSeed.map(u => u.id);

    // 1. Quitar relaciones (poner ubicacion_id en null)
    console.log('\n🔗 Quitando relaciones de socios...');
    const resultado = await prisma.socio.updateMany({
      where: {
        ubicacion_id: { in: idsAEliminar }
      },
      data: {
        ubicacion_id: null
      }
    });

    console.log(`✅ ${resultado.count} socios desvinculados`);

    // 2. Eliminar ferias
    console.log('\n🗑️  Eliminando ferias del seed...');
    const eliminadas = await prisma.ubicacion.deleteMany({
      where: {
        codigo: { in: feriasSeed }
      }
    });

    console.log(`✅ ${eliminadas.count} ferias eliminadas`);

    // 3. Verificación final
    console.log('\n📊 Estado final:');
    const totalUbicaciones = await prisma.ubicacion.count();
    const ubicacionesRestantes = await prisma.ubicacion.findMany({
      select: { codigo: true, nombre: true },
      orderBy: { codigo: 'asc' }
    });

    console.log(`   Total ubicaciones restantes: ${totalUbicaciones}`);
    console.log('\n   Ferias reales:');
    ubicacionesRestantes.forEach(u => {
      console.log(`      - ${u.codigo}: ${u.nombre}`);
    });

    const sociosConUbicacion = await prisma.socio.count({ where: { ubicacion_id: { not: null } } });
    const sociosSinUbicacion = await prisma.socio.count({ where: { ubicacion_id: null } });

    console.log(`\n   Socios con ubicación: ${sociosConUbicacion}`);
    console.log(`   Socios sin ubicación: ${sociosSinUbicacion}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
limpiarFeriasSeed()
  .then(() => {
    console.log('\n✨ Limpieza completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
