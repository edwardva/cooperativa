import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface UbicacionCSV {
  codigo: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  estado: string;
}

async function actualizarDireccionesFerias() {
  console.log('🏢 Actualizando direcciones de ferias desde sistema viejo...\n');

  try {
    // 1. Leer CSV de ubicaciones
    console.log('📄 Leyendo archivo de ubicaciones...');
    const csvPath = path.join(__dirname, 'data', 'ubicaciones_export.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records: UbicacionCSV[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    console.log(`✅ ${records.length} ubicaciones encontradas en el CSV\n`);

    // 2. Mostrar información del CSV
    console.log('📋 Ferias del sistema viejo:');
    records.forEach(r => {
      console.log(`   ${r.codigo}: ${r.nombre}`);
      if (r.direccion) {
        console.log(`      Dirección: ${r.direccion}`);
      }
    });

    // 3. Actualizar ferias en la BD
    console.log('\n🔄 Actualizando ferias en la base de datos...\n');
    let actualizadas = 0;
    let noEncontradas = 0;

    for (const record of records) {
      try {
        const codigo = record.codigo.trim();
        // En el CSV, el campo "nombre" contiene la dirección real
        const direccion = record.nombre.trim();
        // Generar nombre descriptivo basado en el código
        const nombre = `Feria ${codigo}`;
        const telefono = record.telefono?.trim() || null;

        // Buscar feria en BD
        const feriaExistente = await prisma.ubicacion.findFirst({
          where: { codigo: codigo }
        });

        if (feriaExistente) {
          // Actualizar con datos del CSV
          await prisma.ubicacion.update({
            where: { id: feriaExistente.id },
            data: {
              nombre: nombre,
              direccion: direccion,
              telefono: telefono,
            }
          });

          console.log(`✅ ${codigo}: ${nombre}`);
          console.log(`   📍 ${direccion}`);
          actualizadas++;
        } else {
          console.log(`⚠️  Feria no encontrada en BD: ${codigo}`);
          noEncontradas++;
        }
      } catch (error) {
        console.error(`❌ Error actualizando ${record.codigo}:`, error);
      }
    }

    // 4. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE ACTUALIZACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Ferias actualizadas: ${actualizadas}`);
    console.log(`⚠️  No encontradas en BD: ${noEncontradas}`);
    console.log(`📋 Total en CSV: ${records.length}`);
    console.log('='.repeat(60));

    // 5. Verificar resultado
    console.log('\n🔍 Verificando ferias finales...\n');
    const feriasFinales = await prisma.ubicacion.findMany({
      orderBy: { codigo: 'asc' },
      include: {
        _count: {
          select: {
            socios: true
          }
        }
      }
    });

    console.log('📍 Ferias registradas:');
    feriasFinales.forEach(f => {
      console.log(`\n   ${f.codigo}: ${f.nombre}`);
      console.log(`   📍 Dirección: ${f.direccion || '(sin dirección)'}`);
      console.log(`   👥 Socios: ${f._count.socios}`);
      if (f.telefono) {
        console.log(`   📞 Teléfono: ${f.telefono}`);
      }
    });

    // Distribución por feria
    const conDireccion = feriasFinales.filter(f => f.direccion).length;
    const sinDireccion = feriasFinales.filter(f => !f.direccion).length;

    console.log(`\n📊 Distribución:`);
    console.log(`   Con dirección: ${conDireccion}`);
    console.log(`   Sin dirección: ${sinDireccion}`);

  } catch (error) {
    console.error('\n❌ Error general:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
actualizarDireccionesFerias()
  .then(() => {
    console.log('\n✨ Actualización completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
