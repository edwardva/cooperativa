/**
 * Script 19: Asociar ferias/ubicaciones con todos los socios
 * - Extrae códigos de feria del sistema viejo
 * - Crea ubicaciones en la BD si no existen
 * - Asocia cada socio con su ubicación correspondiente
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SocioViejo {
  codigo: string;
  expediente: string;
  cedula: string;
  nombres: string;
  apellidos: string;
}

// Mapeo de códigos a nombres de ferias (basado en conocimiento común de cooperativas venezolanas)
const FERIAS_CONOCIDAS: Record<string, string> = {
  '01-00': 'Feria Principal Centro',
  '02-00': 'Feria Este',
  '03-00': 'Feria Oeste',
  '04-00': 'Feria Norte',
  '05-00': 'Feria Sur',
  '06-00': 'Feria Barquisimeto',
  '07-00': 'Feria Cabudare',
  '08-00': 'Feria Principal',
  '09-00': 'Feria El Ujano',
  '10-00': 'Feria Duaca',
  '50-00': 'Feria Especial A',
  '51-00': 'Feria Especial B',
  '52-00': 'Feria Especial C',
  '01-04': 'Feria Centro Anexo 4',
  '01-06': 'Feria Centro Anexo 6',
  '01-07': 'Feria Centro Anexo 7',
};

async function asociarUbicaciones() {
  console.log('🗺️  ASOCIACIÓN DE FERIAS/UBICACIONES CON SOCIOS');
  console.log('='.repeat(80));

  // Cargar datos del sistema viejo
  const dataPath = path.join(__dirname, 'data', 'socios_completo_ajax.json');
  const sociosViejos: SocioViejo[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`📂 Cargados ${sociosViejos.length.toLocaleString()} registros\n`);

  // Extraer códigos únicos de ferias
  const codigosFeria = new Map<string, number>();
  sociosViejos.forEach((s) => {
    const codigo = s.codigo?.trim();
    if (codigo) {
      codigosFeria.set(codigo, (codigosFeria.get(codigo) || 0) + 1);
    }
  });

  console.log('📊 Códigos de feria encontrados:');
  const feriasSorted = Array.from(codigosFeria.entries()).sort((a, b) => b[1] - a[1]);
  feriasSorted.forEach(([codigo, count]) => {
    console.log(`   ${codigo}: ${count.toLocaleString()} socios`);
  });
  console.log('');

  // ============================================
  // PASO 1: Crear ubicaciones en la BD
  // ============================================
  console.log('📍 Creando ubicaciones en la base de datos...\n');

  const ubicacionesMap = new Map<string, number>(); // codigo -> ubicacion_id

  for (const [codigo, count] of feriasSorted) {
    const nombre = FERIAS_CONOCIDAS[codigo] || `Feria ${codigo}`;

    try {
      // Buscar o crear ubicación
      let ubicacion = await prisma.ubicacion.findUnique({
        where: { codigo },
      });

      if (!ubicacion) {
        ubicacion = await prisma.ubicacion.create({
          data: {
            codigo,
            nombre,
            estado: true, // Boolean en vez de String
          },
        });
        console.log(`   ✅ Creada: ${codigo} - ${nombre}`);
      } else {
        console.log(`   ℹ️  Existe: ${codigo} - ${ubicacion.nombre}`);
      }

      ubicacionesMap.set(codigo, ubicacion.id);
    } catch (error: any) {
      console.error(`   ❌ Error creando ${codigo}:`, error.message);
    }
  }

  console.log(`\n✅ Total de ubicaciones: ${ubicacionesMap.size}\n`);

  // ============================================
  // PASO 2: Asociar socios con ubicaciones
  // ============================================
  console.log('🔗 Asociando socios con sus ubicaciones...\n');

  const stats = {
    total: 0,
    asociados: 0,
    sinCodigo: 0,
    codigoNoEncontrado: 0,
    errores: 0,
  };

  // Obtener todos los socios de la BD
  const sociosBD = await prisma.socio.findMany({
    select: {
      id: true,
      codigo_socio: true,
      cedula: true,
    },
  });

  console.log(`📊 Socios en BD: ${sociosBD.length.toLocaleString()}\n`);

  // Crear índice por código_socio para búsqueda rápida
  const sociosIndexExpediente = new Map<string, number>();
  sociosBD.forEach((s) => {
    sociosIndexExpediente.set(s.codigo_socio, s.id);
  });

  // Crear índice de códigos de feria por expediente del sistema viejo
  const feriasPorExpediente = new Map<string, string>();
  sociosViejos.forEach((s) => {
    const expediente = s.expediente?.trim();
    const codigo = s.codigo?.trim();
    if (expediente && codigo) {
      feriasPorExpediente.set(expediente, codigo);
    }
  });

  console.log('⚙️  Procesando asociaciones...\n');

  let procesados = 0;
  const batchSize = 1000;
  const updates: Array<{ id: number; ubicacion_id: number }> = [];

  for (const [expediente, codigoFeria] of feriasPorExpediente.entries()) {
    stats.total++;
    procesados++;

    // Buscar socio en BD por código_socio (que es el expediente)
    const socioId = sociosIndexExpediente.get(expediente);

    if (!socioId) {
      // El expediente del sistema viejo no está en la BD
      // (puede ser uno de los 6 omitidos)
      continue;
    }

    const ubicacionId = ubicacionesMap.get(codigoFeria);

    if (!ubicacionId) {
      stats.codigoNoEncontrado++;
      continue;
    }

    updates.push({ id: socioId, ubicacion_id: ubicacionId });

    // Procesar en lotes
    if (updates.length >= batchSize) {
      try {
        // Actualizar en lote
        for (const update of updates) {
          await prisma.socio.update({
            where: { id: update.id },
            data: { ubicacion_id: update.ubicacion_id },
          });
        }
        stats.asociados += updates.length;
        console.log(`   ✓ Procesados ${procesados.toLocaleString()} / ${stats.total.toLocaleString()}`);
        updates.length = 0; // Limpiar array
      } catch (error: any) {
        console.error(`   ❌ Error en lote:`, error.message);
        stats.errores += updates.length;
        updates.length = 0;
      }
    }
  }

  // Procesar registros restantes
  if (updates.length > 0) {
    try {
      for (const update of updates) {
        await prisma.socio.update({
          where: { id: update.id },
          data: { ubicacion_id: update.ubicacion_id },
        });
      }
      stats.asociados += updates.length;
      console.log(`   ✓ Procesados ${procesados.toLocaleString()} / ${stats.total.toLocaleString()}`);
    } catch (error: any) {
      console.error(`   ❌ Error en lote final:`, error.message);
      stats.errores += updates.length;
    }
  }

  // ============================================
  // REPORTE FINAL
  // ============================================
  console.log('\n\n📊 REPORTE DE ASOCIACIÓN');
  console.log('='.repeat(80));
  console.log(`Total de registros procesados: ${stats.total.toLocaleString()}`);
  console.log(`✅ Asociados exitosamente: ${stats.asociados.toLocaleString()}`);
  console.log(`⚠️  Sin código de feria: ${stats.sinCodigo.toLocaleString()}`);
  console.log(`⚠️  Código no encontrado: ${stats.codigoNoEncontrado.toLocaleString()}`);
  console.log(`❌ Errores: ${stats.errores.toLocaleString()}`);

  // Verificar distribución final
  console.log('\n\n📈 DISTRIBUCIÓN DE SOCIOS POR UBICACIÓN');
  console.log('─'.repeat(80));

  const distribucion = await prisma.socio.groupBy({
    by: ['ubicacion_id'],
    _count: true,
  });

  const sinUbicacion = await prisma.socio.count({
    where: { ubicacion_id: null },
  });

  for (const dist of distribucion) {
    if (dist.ubicacion_id) {
      const ubicacion = await prisma.ubicacion.findUnique({
        where: { id: dist.ubicacion_id },
      });
      console.log(`${ubicacion?.codigo} - ${ubicacion?.nombre}: ${dist._count.toLocaleString()} socios`);
    }
  }

  if (sinUbicacion > 0) {
    console.log(`\n⚠️  Sin ubicación asignada: ${sinUbicacion.toLocaleString()} socios`);
  }

  console.log('\n✅ Proceso completado');
}

// ============================================
// EJECUTAR
// ============================================

asociarUbicaciones()
  .catch((error) => {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
