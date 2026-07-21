import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SocioCSV {
  expediente: string;
  cedula: string;
  apellidos: string;
  nombres: string;
  codigo_feria: string;
  fecha_ingreso: string;
  retirado: string;
  direccion: string;
  telefono: string;
  telefono_movil: string;
  correo: string;
  delegado: string;
}

async function asociarFerias() {
  console.log('🏢 Iniciando asociación de ferias a socios...\n');

  try {
    // 1. Leer CSV
    console.log('📄 Leyendo CSV...');
    const csvPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records: SocioCSV[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    console.log(`✅ ${records.length} registros cargados\n`);

    // 2. Extraer códigos únicos de feria
    console.log('🔍 Analizando códigos de feria...');
    const codigosFeria = new Set<string>();
    records.forEach(record => {
      if (record.codigo_feria && record.codigo_feria.trim()) {
        codigosFeria.add(record.codigo_feria.trim());
      }
    });

    const codigosArray = Array.from(codigosFeria).sort();
    console.log(`✅ Encontrados ${codigosArray.length} códigos únicos de feria:`);
    codigosArray.forEach(codigo => console.log(`   - ${codigo}`));

    // 3. Crear ubicaciones faltantes
    console.log('\n🏗️  Creando ubicaciones...');
    const ubicacionesCreadas: Array<{ codigo: string; id: number; nombre: string }> = [];
    
    for (const codigoFeria of codigosArray) {
      // Verificar si ya existe
      let ubicacion = await prisma.ubicacion.findFirst({
        where: { codigo: codigoFeria }
      });

      if (!ubicacion) {
        // Crear nueva ubicación
        const nombre = `Feria ${codigoFeria}`;
        ubicacion = await prisma.ubicacion.create({
          data: {
            codigo: codigoFeria,
            nombre: nombre,
            direccion: null,
            telefono: null,
          }
        });
        console.log(`   ✅ Creada: ${codigoFeria} - ${nombre}`);
      } else {
        console.log(`   ⏭️  Ya existe: ${codigoFeria}`);
      }

      ubicacionesCreadas.push({
        codigo: codigoFeria,
        id: ubicacion.id,
        nombre: ubicacion.nombre
      });
    }

    // Crear mapa de código -> id
    const mapaUbicaciones = new Map<string, number>();
    ubicacionesCreadas.forEach(u => {
      mapaUbicaciones.set(u.codigo, u.id);
    });

    // 4. Actualizar socios con sus ubicaciones
    console.log('\n🔗 Asociando socios con ferias...');
    let actualizados = 0;
    let sinFeria = 0;
    let errores = 0;

    for (const record of records) {
      try {
        const expediente = record.expediente.trim();
        const codigoFeria = record.codigo_feria?.trim();

        if (!codigoFeria) {
          sinFeria++;
          continue;
        }

        const ubicacionId = mapaUbicaciones.get(codigoFeria);
        if (!ubicacionId) {
          console.log(`⚠️  Feria no encontrada: ${codigoFeria} para expediente ${expediente}`);
          errores++;
          continue;
        }

        // Actualizar socio
        await prisma.socio.updateMany({
          where: { codigo_socio: expediente },
          data: { ubicacion_id: ubicacionId }
        });

        actualizados++;

        if (actualizados % 1000 === 0) {
          console.log(`   Procesados: ${actualizados}...`);
        }

      } catch (error) {
        console.error(`❌ Error en expediente ${record.expediente}:`, error);
        errores++;
      }
    }

    // 5. Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE ASOCIACIÓN DE FERIAS');
    console.log('='.repeat(60));
    console.log(`✅ Socios actualizados: ${actualizados}`);
    console.log(`⚠️  Sin código de feria: ${sinFeria}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesado: ${records.length}`);
    console.log('='.repeat(60));

    // 6. Verificación final
    console.log('\n🔍 Verificando resultado...');
    const conUbicacion = await prisma.socio.count({ where: { ubicacion_id: { not: null } } });
    const sinUbicacion = await prisma.socio.count({ where: { ubicacion_id: null } });
    const totalUbicaciones = await prisma.ubicacion.count();

    console.log(`\n📊 Estado final:`);
    console.log(`   Total ubicaciones: ${totalUbicaciones}`);
    console.log(`   Socios con ubicación: ${conUbicacion}`);
    console.log(`   Socios sin ubicación: ${sinUbicacion}`);

    // Mostrar distribución por feria
    const porFeria = await prisma.socio.groupBy({
      by: ['ubicacion_id'],
      _count: true,
      where: { ubicacion_id: { not: null } }
    });

    console.log(`\n📍 Top 10 ferias por cantidad de socios:`);
    const feriasSorted = await Promise.all(
      porFeria.map(async (f) => {
        const ub = await prisma.ubicacion.findUnique({ where: { id: f.ubicacion_id! } });
        return { codigo: ub?.codigo, nombre: ub?.nombre, count: f._count };
      })
    );
    
    feriasSorted
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(f => {
        console.log(`   ${f.codigo}: ${f.count} socios`);
      });

  } catch (error) {
    console.error('\n❌ Error general:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
asociarFerias()
  .then(() => {
    console.log('\n✨ Proceso completado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
