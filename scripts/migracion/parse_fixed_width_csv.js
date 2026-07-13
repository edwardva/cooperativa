#!/usr/bin/env node
/**
 * Script para parsear el CSV de espacios fijos a CSV real
 */

const fs = require('fs');
const path = require('path');

// Leer argumentos de línea de comandos o usar defaults
const inputFile = process.argv[2] || path.join(__dirname, 'data/socios_export.csv');
const outputFile = process.argv[3] || path.join(__dirname, 'data/socios_export_parsed.csv');

console.log('📄 Parseando CSV de espacios fijos...\n');
console.log(`  Input:  ${inputFile}`);
console.log(`  Output: ${outputFile}\n`);

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

// Saltar las dos primeras líneas (título y header)
const dataLines = lines.slice(2).filter(line => line.trim());

const socios = [];

for (const line of dataLines) {
  // Remover comillas dobles
  const cleaned = line.replace(/"/g, '');
  
  // Parsear usando espacios múltiples como delimitador (más robusto)
  // "100040       T.DE CARUCI RAMONA                        2530615    0"
  // Split por 2+ espacios consecutivos
  const parts = cleaned.split(/\s{2,}/).filter(p => p.trim());
  
  if (parts.length < 3) continue; // Saltar líneas malformadas
  
  const expediente = parts[0].trim();
  const nombreCompleto = parts[1].trim();
  const cedula = parts[2].trim().replace(/[,\.]/g, ''); // Eliminar comas y puntos de la cédula
  const telefono = parts[3] ? parts[3].trim() : '';
  
  if (expediente && cedula) {
    // Separar apellido y nombre (formato: APELLIDO NOMBRE)
    const partes = nombreCompleto.split(/\s+/);
    const apellido = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
    const nombre = partes.slice(Math.ceil(partes.length / 2)).join(' ');
    
    socios.push({
      codigo_socio: expediente,
      cedula: cedula,
      apellido: apellido || nombreCompleto,
      nombre: nombre || '',
      telefono: telefono === '0' ? '' : telefono,
      fecha_ingreso: '', // No está en este reporte
      ubicacion_codigo: '', // No está en este reporte
      estado: 'activo', // Asumir activo por defecto
      email: '',
      delegado: '0',
      autorizado_nombre: '',
      autorizado_cedula: ''
    });
  }
}

// Escribir CSV real
const headers = Object.keys(socios[0]);
const csvLines = [headers.join(',')];

for (const socio of socios) {
  const values = headers.map(h => {
    const val = socio[h] || '';
    // Escapar comas y comillas
    if (val.includes(',') || val.includes('"')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  });
  csvLines.push(values.join(','));
}

fs.writeFileSync(outputFile, csvLines.join('\n'), 'utf-8');

console.log(`✓ ${socios.length} socios parseados`);
console.log(`✓ Guardado en: ${outputFile}\n`);
console.log('Vista previa:');
console.log(csvLines.slice(0, 6).join('\n'));
console.log('\n⚠️  NOTA: Este reporte NO incluye ubicacion_codigo ni fecha_ingreso');
console.log('   Necesitarás obtener otro reporte o completar manualmente.');
