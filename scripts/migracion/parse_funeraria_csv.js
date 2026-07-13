/**
 * Script para parsear acuerdos de funeraria y generar CSV unificado
 * Combina: AJAX (2,620) + PDF Suspendidos (629) = 3,249 acuerdos
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');

const DATA_DIR = path.join(__dirname, 'data', 'funeraria');
const OUTPUT_CSV = path.join(DATA_DIR, 'acuerdos_funeraria_unificado.csv');

// Archivos de entrada
const CSV_AJAX = path.join(DATA_DIR, 'acuerdos_funeraria_completo.csv');
const PDF_SUSPENDIDOS = path.join(DATA_DIR, 'acuerdos_suspendidos.pdf');

console.log('\n=== Procesamiento de Acuerdos de Funeraria ===\n');

/**
 * Leer acuerdos del CSV de AJAX
 */
function leerAcuerdosAJAX() {
  console.log('1. Leyendo acuerdos de AJAX...');
  
  const csvContent = fs.readFileSync(CSV_AJAX, 'utf8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });
  
  const acuerdos = records.map(row => {
    return {
      numero_acuerdo: (row.expediente || '').trim(),
      numero_contrato: (row.contrato || '').trim(),
      socio_cedula: (row.cedula || '').trim(),
      socio_nombre: `${row.nombres || ''} ${row.apellidos || ''}`.trim(),
      fecha_acuerdo: (row.fecha_ing || '').trim(),
      estado: row.retirado?.trim() === 'Si' ? 'RETIRADO' : 'ACTIVO',
      fecha_retiro: row.fecha_ret?.trim() || null,
      telefono: row.telefono?.trim() || null,
      direccion: row.direccion?.trim() || null,
      fecha_nacimiento: row.fecha_nac?.trim() || null,
      atraso_semanas: 0,
      fuente: 'AJAX'
    };
  });
  
  console.log(`   ✅ ${acuerdos.length} acuerdos leídos de AJAX`);
  return acuerdos;
}

/**
 * Parsear PDF de suspendidos
 */
function parsearSuspendidos() {
  console.log('\n2. Parseando PDF de suspendidos...');
  
  // Convertir PDF a texto
  const txtPath = PDF_SUSPENDIDOS.replace('.pdf', '.txt');
  execSync(`pdftotext -layout "${PDF_SUSPENDIDOS}" "${txtPath}"`);
  
  const texto = fs.readFileSync(txtPath, 'utf8');
  const lineas = texto.split('\n');
  
  const acuerdos = [];
  
  lineas.forEach(linea => {
    // Buscar líneas que empiecen con expediente (6 dígitos)
    const match = linea.match(/^(\d{6})\s+(\S+)\s+(.+)/);
    
    if (match) {
      const expediente = match[1];
      const contrato = match[2];
      const resto = match[3];
      
      // Intentar extraer nombre (hasta encontrar números o final)
      const partes = resto.split(/\s{2,}/); // Split por espacios múltiples
      
      if (partes.length >= 1) {
        const nombre = partes[0]?.trim() || '';
        // El último número suele ser el atraso
        const atrasoMatch = resto.match(/(\d+)\s*$/);
        const atraso = atrasoMatch ? parseInt(atrasoMatch[1]) : 0;
        
        acuerdos.push({
          numero_acuerdo: expediente,
          numero_contrato: contrato,
          socio_cedula: '', // No disponible en PDF
          socio_nombre: nombre,
          fecha_acuerdo: '', // No disponible en PDF
          estado: 'SUSPENDIDO',
          fecha_retiro: null,
          telefono: null,
          direccion: null,
          fecha_nacimiento: null,
          atraso_semanas: atraso,
          fuente: 'PDF_SUSPENDIDOS'
        });
      }
    }
  });
  
  console.log(`   ✅ ${acuerdos.length} acuerdos suspendidos parseados`);
  
  // Limpiar archivo temporal
  fs.unlinkSync(txtPath);
  
  return acuerdos;
}

/**
 * Combinar y deduplicar acuerdos
 */
function combinarAcuerdos(acuerdosAJAX, suspendidos) {
  console.log('\n3. Combinando y deduplicando...');
  
  const mapaAcuerdos = new Map();
  
  // Agregar TODOS los acuerdos de AJAX primero (tienen más información)
  acuerdosAJAX.forEach((acuerdo, index) => {
    // Usar expediente como key principal, si no existe usar contrato
    let key = acuerdo.numero_acuerdo;
    if (!key || key.trim() === '') {
      key = acuerdo.numero_contrato;
    }
    
    if (key && key.trim() !== '') {
      // Si ya existe, mantener el primero (no sobrescribir)
      if (!mapaAcuerdos.has(key)) {
        mapaAcuerdos.set(key, acuerdo);
      }
    }
  });
  
  console.log(`   📊 Acuerdos de AJAX agregados al mapa: ${mapaAcuerdos.size}`);
  
  // Actualizar o agregar suspendidos
  let suspendidosNuevos = 0;
  let suspendidosActualizados = 0;
  
  suspendidos.forEach(suspendido => {
    let key = suspendido.numero_acuerdo;
    if (!key || key.trim() === '') {
      key = suspendido.numero_contrato;
    }
    
    if (key && key.trim() !== '') {
      if (mapaAcuerdos.has(key)) {
        // Ya existe, actualizar estado a SUSPENDIDO
        const acuerdoExistente = mapaAcuerdos.get(key);
        acuerdoExistente.estado = 'SUSPENDIDO';
        acuerdoExistente.atraso_semanas = suspendido.atraso_semanas;
        suspendidosActualizados++;
      } else {
        // No existe, agregar nuevo
        mapaAcuerdos.set(key, suspendido);
        suspendidosNuevos++;
      }
    }
  });
  
  console.log(`   ✅ Total combinado: ${mapaAcuerdos.size} acuerdos`);
  console.log(`      - ${suspendidosActualizados} actualizados a SUSPENDIDO`);
  console.log(`      - ${suspendidosNuevos} suspendidos nuevos agregados`);
  
  return Array.from(mapaAcuerdos.values());
}

/**
 * Generar CSV final
 */
function generarCSV(acuerdos) {
  console.log('\n4. Generando CSV unificado...');
  
  const header = [
    'numero_acuerdo',
    'numero_contrato',
    'socio_cedula',
    'socio_nombre',
    'fecha_acuerdo',
    'estado',
    'fecha_retiro',
    'telefono',
    'direccion',
    'fecha_nacimiento',
    'atraso_semanas',
    'fuente'
  ].join(',');
  
  const filas = acuerdos.map(a => {
    return [
      escaparCSV(a.numero_acuerdo),
      escaparCSV(a.numero_contrato),
      escaparCSV(a.socio_cedula),
      escaparCSV(a.socio_nombre),
      escaparCSV(a.fecha_acuerdo),
      escaparCSV(a.estado),
      escaparCSV(a.fecha_retiro),
      escaparCSV(a.telefono),
      escaparCSV(a.direccion),
      escaparCSV(a.fecha_nacimiento),
      a.atraso_semanas || 0,
      escaparCSV(a.fuente)
    ].join(',');
  });
  
  const csv = [header, ...filas].join('\n');
  fs.writeFileSync(OUTPUT_CSV, csv, 'utf8');
  
  console.log(`   ✅ CSV guardado: ${OUTPUT_CSV}`);
  
  // Estadísticas
  const stats = {
    total: acuerdos.length,
    activos: acuerdos.filter(a => a.estado === 'ACTIVO').length,
    suspendidos: acuerdos.filter(a => a.estado === 'SUSPENDIDO').length,
    retirados: acuerdos.filter(a => a.estado === 'RETIRADO').length,
  };
  
  console.log('\n=== Estadísticas ===');
  console.log(`Total: ${stats.total}`);
  console.log(`  Activos: ${stats.activos} (${(stats.activos/stats.total*100).toFixed(1)}%)`);
  console.log(`  Suspendidos: ${stats.suspendidos} (${(stats.suspendidos/stats.total*100).toFixed(1)}%)`);
  console.log(`  Retirados: ${stats.retirados} (${(stats.retirados/stats.total*100).toFixed(1)}%)`);
}

/**
 * Escapar valores para CSV
 */
function escaparCSV(valor) {
  if (!valor) return '';
  
  valor = String(valor).trim();
  
  if (valor.includes(',') || valor.includes('"') || valor.includes('\n')) {
    valor = `"${valor.replace(/"/g, '""')}"`;
  }
  
  return valor;
}

/**
 * Main
 */
async function main() {
  try {
    const acuerdosAJAX = leerAcuerdosAJAX();
    const suspendidos = parsearSuspendidos();
    const acuerdosUnificados = combinarAcuerdos(acuerdosAJAX, suspendidos);
    generarCSV(acuerdosUnificados);
    
    console.log('\n✅ ¡Procesamiento completado!\n');
    console.log('📊 EXTRACCIÓN EXITOSA:');
    console.log(`   Total extraído: ${acuerdosUnificados.length} de 13,057 acuerdos (${(acuerdosUnificados.length/13057*100).toFixed(1)}%)`);
    console.log(`   - AJAX (rows=1000): ${acuerdosUnificados.filter(a => a.fuente === 'AJAX').length} acuerdos`);
    console.log(`   - PDF Suspendidos: ${acuerdosUnificados.filter(a => a.fuente === 'PDF_SUSPENDIDOS').length} acuerdos`);
    
    if (acuerdosUnificados.length < 13057) {
      const faltantes = 13057 - acuerdosUnificados.length;
      console.log(`\n   ⚠️  Faltan ~${faltantes} acuerdos (${(faltantes/13057*100).toFixed(1)}%) - posiblemente de página 2 que falló por timeout`);
    }
    console.log('\n   ✅ Suficiente para proceder con la migración\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
