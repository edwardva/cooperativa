#!/usr/bin/env node
/**
 * Script para combinar socios activos e inactivos en un solo CSV
 * Elimina duplicados por cedula (prioriza el más reciente)
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

console.log('🔄 Combinando socios activos e inactivos...\n');

const activosFile = path.join(__dirname, 'data/socios_activos_parsed.csv');
const inactivosFile = path.join(__dirname, 'data/socios_inactivos_parsed.csv');
const outputFile = path.join(__dirname, 'data/socios_combined.csv');

// Leer ambos archivos
const activosContent = fs.readFileSync(activosFile, 'utf-8');
const inactivosContent = fs.readFileSync(inactivosFile, 'utf-8');

// Parsear CSV
const activos = parse(activosContent, { columns: true, skip_empty_lines: true });
const inactivos = parse(inactivosContent, { columns: true, skip_empty_lines: true });

console.log(`📊 Socios activos: ${activos.length}`);
console.log(`📊 Socios inactivos: ${inactivos.length}`);
console.log(`📊 Total sin deduplicar: ${activos.length + inactivos.length}\n`);

// Combinar en un Map para eliminar duplicados por cedula
const sociosMap = new Map();

// Primero agregar activos (prioridad más baja)
for (const socio of activos) {
  if (socio.cedula && socio.cedula.trim()) {
    sociosMap.set(socio.cedula, socio);
  }
}

// Luego inactivos (prioridad más alta - sobrescribe si hay duplicados)
for (const socio of inactivos) {
  if (socio.cedula && socio.cedula.trim()) {
    sociosMap.set(socio.cedula, socio);
  }
}

const sociosCombinados = Array.from(sociosMap.values());

console.log(`✓ Total después de deduplicar: ${sociosCombinados.length}`);
console.log(`  Duplicados eliminados: ${activos.length + inactivos.length - sociosCombinados.length}\n`);

// Generar CSV con valores encerrados en comillas dobles (RFC 4180)
const headers = Object.keys(sociosCombinados[0]);
const csvLines = [headers.join(',')];

for (const socio of sociosCombinados) {
  const values = headers.map(h => {
    const value = socio[h] || '';
    // Encerrar en comillas y escapar comillas internas
    return `"${value.toString().replace(/"/g, '""')}"`;
  });
  csvLines.push(values.join(','));
}

const csv = csvLines.join('\n');
fs.writeFileSync(outputFile, csv);

console.log(`✓ Guardado en: ${outputFile}`);

// Estadísticas
const estadoStats = {};
for (const socio of sociosCombinados) {
  const estado = socio.estado || 'sin_estado';
  estadoStats[estado] = (estadoStats[estado] || 0) + 1;
}

console.log(`\n📈 Estadísticas por estado:`);
for (const [estado, count] of Object.entries(estadoStats)) {
  console.log(`  - ${estado}: ${count} (${(count/sociosCombinados.length*100).toFixed(1)}%)`);
}

console.log(`\nVista previa (primeros 5):`);
console.log(csvLines.slice(0, 6).join('\n'));
