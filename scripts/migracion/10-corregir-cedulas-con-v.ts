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

async function corregirCedulasConV() {
  console.log('🔧 Iniciando corrección de cédulas con prefijo V/V-...\n');

  try {
    // 1. Leer CSV original
    console.log('📄 Leyendo CSV original...');
    const csvPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records: SocioCSV[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Crear mapa de expediente -> estado original
    const mapaEstados = new Map<string, 'activo' | 'retirado'>();
    records.forEach(record => {
      const estado = record.retirado?.toLowerCase() === 'si' ? 'retirado' : 'activo';
      mapaEstados.set(record.expediente, estado);
    });

    console.log(`✅ CSV cargado: ${records.length} registros\n`);

    // 2. Buscar todos los registros con V/V- en la BD
    console.log('🔍 Buscando registros con prefijo V/V-...');
    const sociosConV = await prisma.socio.findMany({
      where: {
        OR: [
          { cedula: { startsWith: 'V-' } },
          { cedula: { startsWith: 'V' } },
          { cedula: { startsWith: 'v-' } },
          { cedula: { startsWith: 'v' } },
        ],
      },
      select: {
        id: true,
        codigo_socio: true,
        cedula: true,
        nombre: true,
        apellido: true,
        estado: true,
      },
    });

    console.log(`✅ Encontrados: ${sociosConV.length} registros\n`);

    if (sociosConV.length === 0) {
      console.log('✨ No hay registros para corregir. Todo listo!');
      return;
    }

    // 3. Procesar cada registro
    let actualizados = 0;
    let errores = 0;

    console.log('🔄 Corrigiendo registros...\n');

    for (const socio of sociosConV) {
      try {
        // Limpiar cédula (quitar V-, V, v-, v)
        let cedulaLimpia = socio.cedula;
        if (cedulaLimpia.startsWith('V-') || cedulaLimpia.startsWith('v-')) {
          cedulaLimpia = cedulaLimpia.substring(2);
        } else if (cedulaLimpia.startsWith('V') || cedulaLimpia.startsWith('v')) {
          cedulaLimpia = cedulaLimpia.substring(1);
        }

        // Verificar que la cédula limpia sea válida (solo números)
        if (!/^\d+$/.test(cedulaLimpia)) {
          console.log(`⚠️  Saltando ${socio.codigo_socio}: cédula limpia inválida (${cedulaLimpia})`);
          errores++;
          continue;
        }

        // Obtener estado correcto desde el CSV original
        const estadoCorrecto = mapaEstados.get(socio.codigo_socio) || 'activo';

        // Actualizar en la BD
        await prisma.socio.update({
          where: { id: socio.id },
          data: {
            cedula: cedulaLimpia,
            estado: estadoCorrecto,
            notas: null, // Limpiar notas de "IMPORTADO COMO INVALIDO"
          },
        });

        console.log(
          `✅ ${socio.codigo_socio}: ${socio.cedula} → ${cedulaLimpia} | Estado: ${estadoCorrecto}`
        );
        actualizados++;
      } catch (error) {
        console.error(`❌ Error en ${socio.codigo_socio}:`, error);
        errores++;
      }
    }

    // 4. Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE CORRECCIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Registros actualizados: ${actualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesado: ${sociosConV.length}`);
    console.log('='.repeat(60));

    // 5. Verificar estado final
    console.log('\n🔍 Verificando estado final...');
    const totalInvalidos = await prisma.socio.count({ where: { estado: 'invalido' } });
    const totalActivos = await prisma.socio.count({ where: { estado: 'activo' } });
    const totalRetirados = await prisma.socio.count({ where: { estado: 'retirado' } });

    console.log(`\n📊 Conteo final:`);
    console.log(`   Activos: ${totalActivos}`);
    console.log(`   Retirados: ${totalRetirados}`);
    console.log(`   Inválidos: ${totalInvalidos}`);

  } catch (error) {
    console.error('\n❌ Error general:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
corregirCedulasConV()
  .then(() => {
    console.log('\n✨ Proceso completado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
