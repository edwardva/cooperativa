import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Limpiar tablas en orden correcto (respetando foreign keys)
async function limpiarTablasSocios() {
  console.log('🗑️  Limpiando tablas de socios...\n');
  
  await prisma.$executeRaw`TRUNCATE TABLE abonos_prestamo CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE plan_pagos CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE fiadores CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE prestamos CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE cuentas_ahorro CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE beneficiarios CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE socios CASCADE`;
  
  // Resetear secuencias
  await prisma.$executeRaw`ALTER SEQUENCE socios_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE beneficiarios_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE cuentas_ahorro_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE prestamos_id_seq RESTART WITH 1`;
  
  console.log('✅ Tablas limpiadas correctamente\n');
}

// Validar cédula (relajado - solo verifica si es válida para estado activo)
function esValidaCedula(cedula: string): boolean {
  if (!cedula || cedula.trim() === '') return false;
  const clean = cedula.trim();
  // Solo validar que no tenga letras (excepto E- que es permitido en algunos casos)
  return /^\d+$/.test(clean) || /^E-\d+$/.test(clean);
}

// Limpiar cédula (quitar E- si existe)
function limpiarCedula(cedula: string): string {
  return cedula.replace(/^E-/, '');
}

// Parsear fecha DD/MM/YYYY
function parsearFecha(fechaStr: string): Date | null {
  if (!fechaStr) return null;
  const match = fechaStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dia, mes, anio] = match;
  return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
}

async function importarSocios() {
  console.log('📂 Leyendo CSV de socios...\n');
  
  const csvPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Total registros en CSV: ${records.length}\n`);
  console.log('🚀 Iniciando importación...\n');

  let importados = 0;
  let invalidos = 0;
  let errores = 0;
  const expedientesSet = new Set<string>();
  const motivosInvalidos: Record<string, number> = {};

  for (const record of records) {
    try {
      // Extraer y limpiar datos
      const expediente = (record.expediente || '').trim();
      const cedula = (record.cedula || '').trim();
      const apellidos = (record.apellidos || '').trim();
      const nombres = (record.nombres || '').trim();
      const fechaStr = (record.fecha_ingreso || '').trim();
      const retirado = (record.retirado || '').trim();
      const codigoFeria = (record.codigo_feria || '').trim();
      
      // Validaciones para determinar si es inválido
      let esInvalido = false;
      const motivos: string[] = [];
      
      // 1. Validar expediente único y obligatorio
      if (!expediente) {
        esInvalido = true;
        motivos.push('expediente_vacio');
      } else if (expedientesSet.has(expediente)) {
        esInvalido = true;
        motivos.push('expediente_duplicado');
      }
      
      // 2. Validar cédula (relajado)
      const cedulaValida = esValidaCedula(cedula);
      const cedulaLimpia = limpiarCedula(cedula);
      if (!cedulaValida) {
        esInvalido = true;
        motivos.push('cedula_invalida');
      } else if (cedulaLimpia.length < 5 || cedulaLimpia.length > 10) {
        esInvalido = true;
        motivos.push('cedula_longitud');
      } else if (/^0+$/.test(cedulaLimpia)) {
        esInvalido = true;
        motivos.push('cedula_ceros');
      }
      
      // 3. Validar nombres (obligatorio)
      if (!nombres) {
        esInvalido = true;
        motivos.push('nombres_vacio');
      }
      
      // 4. Validar apellidos (si está vacío, intentar separar de nombres)
      let apellidoFinal = apellidos;
      let nombreFinal = nombres;
      
      if (!apellidos && nombres) {
        // Intentar separar el nombre completo
        const partes = nombres.trim().split(/\s+/);
        if (partes.length >= 2) {
          apellidoFinal = partes.slice(-1).join(' ');
          nombreFinal = partes.slice(0, -1).join(' ');
        } else {
          esInvalido = true;
          motivos.push('apellidos_vacio');
        }
      }
      
      // 5. Validar fecha
      const fecha = parsearFecha(fechaStr);
      if (!fecha) {
        esInvalido = true;
        motivos.push('fecha_invalida');
      }
      
      // 6. Determinar estado basado en retirado y validez
      let estado: 'activo' | 'retirado' | 'invalido';
      if (esInvalido) {
        estado = 'invalido';
      } else if (retirado.toLowerCase() === 'si') {
        estado = 'retirado';
      } else {
        estado = 'activo';
      }
      
      // Si no hay expediente, no podemos importar
      if (!expediente) {
        console.log(`❌ Sin expediente - Saltando fila con CI: ${cedula || 'N/A'}`);
        errores++;
        continue;
      }
      
      // Preparar ubicación (si existe código de feria)
      let ubicacionId = null;
      if (codigoFeria) {
        const ubicacion = await prisma.ubicacion.findFirst({
          where: { codigo: codigoFeria }
        });
        if (ubicacion) {
          ubicacionId = ubicacion.id;
        }
      }
      
      // Crear socio
      await prisma.socio.create({
        data: {
          codigo_socio: expediente,
          cedula: cedulaLimpia || '0',
          nombre: nombreFinal || 'N/A',
          apellido: apellidoFinal || 'N/A',
          fecha_inscripcion: fecha || new Date('2000-01-01'),
          estado: estado,
          direccion: record.direccion || null,
          telefono: record.telefono || null,
          email: record.correo || null,
          ubicacion_id: ubicacionId,
          notas: esInvalido ? `IMPORTADO COMO INVALIDO: ${motivos.join(', ')}` : null,
        },
      });
      
      expedientesSet.add(expediente);
      
      if (esInvalido) {
        invalidos++;
        motivos.forEach(m => {
          motivosInvalidos[m] = (motivosInvalidos[m] || 0) + 1;
        });
      } else {
        importados++;
      }
      
      // Log cada 500 registros
      if ((importados + invalidos) % 500 === 0) {
        console.log(`⏳ Procesados: ${importados + invalidos} (${importados} válidos, ${invalidos} inválidos)`);
      }
      
    } catch (error) {
      errores++;
      console.error(`❌ Error al importar expediente ${record.expediente}:`, error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(80));
  console.log(`Total registros procesados: ${records.length}`);
  console.log(`✅ Importados con estado válido (activo/retirado): ${importados}`);
  console.log(`⚠️  Importados con estado INVALIDO: ${invalidos}`);
  console.log(`❌ Errores (no importados): ${errores}`);
  console.log('='.repeat(80));
  
  if (Object.keys(motivosInvalidos).length > 0) {
    console.log('\n📋 MOTIVOS DE INVALIDEZ:');
    Object.entries(motivosInvalidos)
      .sort((a, b) => b[1] - a[1])
      .forEach(([motivo, count]) => {
        console.log(`   - ${motivo}: ${count}`);
      });
  }
  
  // Verificar conteos en DB
  const sociosActivos = await prisma.socio.count({ where: { estado: 'activo' } });
  const sociosRetirados = await prisma.socio.count({ where: { estado: 'retirado' } });
  const sociosInvalidos = await prisma.socio.count({ where: { estado: 'invalido' } });
  
  console.log('\n📊 VERIFICACIÓN EN BASE DE DATOS:');
  console.log(`   - Activos: ${sociosActivos}`);
  console.log(`   - Retirados: ${sociosRetirados}`);
  console.log(`   - Inválidos: ${sociosInvalidos}`);
  console.log(`   - TOTAL: ${sociosActivos + sociosRetirados + sociosInvalidos}`);
}

async function main() {
  try {
    await limpiarTablasSocios();
    await importarSocios();
    
    console.log('\n✅ Importación completada exitosamente\n');
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
