/**
 * Convertir JSON extraído a CSV
 */

import fs from 'fs';
import path from 'path';

const jsonPath = '/tmp/socios_completo.json';
const csvPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');

console.log('📄 Leyendo JSON extraído...');
const content = fs.readFileSync(jsonPath, 'utf-8');
const data = JSON.parse(content);

console.log(`✅ ${data.total} socios cargados`);

// Headers
const headers = [
  'expediente',
  'cedula',
  'apellidos',
  'nombres',
  'codigo_feria',
  'fecha_ingreso',
  'retirado',
  'direccion',
  'telefono',
  'telefono_movil',
  'correo',
  'delegado'
].join(',');

// Rows
const rows = data.socios.map((s: any) => [
  `"${s.expediente || ''}"`,
  `"${(s.cedula || '').trim()}"`,
  `"${(s.apellidos || '').trim()}"`,
  `"${(s.nombres || '').trim()}"`,
  `"${(s.codigo || '').trim()}"`,
  `"${s.fecha_ing || ''}"`,
  `"${s.retirado || ''}"`,
  `"${(s.direccion || '').replace(/"/g, '""')}"`,
  `"${(s.telefono || '').trim()}"`,
  `"${(s.telefono_movil || '').trim()}"`,
  `"${(s.correo || '').trim()}"`,
  `"${s.delegado || ''}"`
].join(','));

const csv = [headers, ...rows].join('\n');

console.log('💾 Guardando CSV...');
fs.writeFileSync(csvPath, csv, 'utf-8');

const stats = fs.statSync(csvPath);
console.log(`\n✅ CSV guardado: ${csvPath}`);
console.log(`📊 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`📝 Registros: ${rows.length}`);

// Estadísticas
const feriaMap = new Map<string, number>();
let sinFeria = 0;

data.socios.forEach((s: any) => {
  const feria = (s.codigo || '').trim();
  if (feria) {
    feriaMap.set(feria, (feriaMap.get(feria) || 0) + 1);
  } else {
    sinFeria++;
  }
});

console.log('\n=====================================');
console.log('📊 ESTADÍSTICAS');
console.log('=====================================');
console.log(`📍 Ferias encontradas: ${feriaMap.size}`);
console.log(`⚠️  Sin feria: ${sinFeria}`);
console.log('\nDistribución:');
Array.from(feriaMap.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([codigo, count]) => {
    const porcentaje = ((count / data.total) * 100).toFixed(2);
    console.log(`   ${codigo.padEnd(10)} - ${String(count).padStart(5)} (${porcentaje}%)`);
  });
console.log('=====================================\n');
