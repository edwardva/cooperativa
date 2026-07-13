#!/usr/bin/env node
/**
 * Script para parsear el CSV de socios INACTIVOS (formato diferente)
 */

const fs = require('fs');
const path = require('path');

// Leer argumentos de línea de comandos
const inputFile = process.argv[2] || path.join(__dirname, 'data/socios_inactivos_2026-07-12_061538.csv');
const outputFile = process.argv[3] || path.join(__dirname, 'data/socios_inactivos_parsed.csv');

console.log('📄 Parseando CSV de socios INACTIVOS...\n');
console.log(`  Input:  ${inputFile}`);
console.log(`  Output: ${outputFile}\n`);

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

// Saltar las dos primeras líneas (título y header)
// Header: "No. Cuenta        Apellidos y Nombres                       Cedula     Dias Ult Mov"
const dataLines = lines.slice(2).filter(line => line.trim());

const socios = [];

for (const line of dataLines) {
  // Remover comillas dobles si existen
  const cleaned = line.replace(/"/g, '');
  
  // Parsear usando espacios múltiples como delimitador (más robusto)
  // "01-01-00-100338   CALLES GIMENEZ CIRILO ANTONIO             404396     1370   11/10/2022"
  // Split por 2+ espacios consecutivos
  const parts = cleaned.split(/\s{2,}/).filter(p => p.trim());
  
  if (parts.length < 3) continue; // Saltar líneas malformadas
  
  const noCuenta = parts[0].trim();
  const nombreCompleto = parts[1].trim();
  const cedula = parts[2].trim().replace(/[,\.]/g, ''); // Eliminar comas y puntos de la cédula
  const diasUltMov = parts[3] ? parts[3].trim() : '';
  
  if (noCuenta && cedula) {
    // Separar apellido y nombre (formato: APELLIDO NOMBRE)
    const partes = nombreCompleto.split(/\s+/);
    const apellido = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
    const nombre = partes.slice(Math.ceil(partes.length / 2)).join(' ');
    
    // Extraer código socio del No. Cuenta (formato: 01-01-00-100338 -> 100338)
    const codigoSocio = noCuenta.split('-').pop() || noCuenta;
    
    socios.push({
      codigo_socio: codigoSocio,
      cedula: cedula,
      apellido: apellido,
      nombre: nombre,
      telefono: '', // No hay teléfono en reporte de inactivos
      fecha_ingreso: '',
      ubicacion_codigo: '',
      estado: 'inactivo', // Marcar como inactivo
      email: '',
      delegado: '0',
      autorizado_nombre: '',
      autorizado_cedula: ''
    });
  }
}

// Generar CSV
const headers = Object.keys(socios[0]);
const csvLines = [headers.join(',')];

for (const socio of socios) {
  const values = headers.map(h => socio[h] || '');
  csvLines.push(values.join(','));
}

const csv = csvLines.join('\n');
fs.writeFileSync(outputFile, csv);

console.log(`✓ ${socios.length} socios inactivos parseados`);
console.log(`✓ Guardado en: ${outputFile}\n`);

// Mostrar vista previa
console.log('Vista previa:');
console.log(csvLines.slice(0, 6).join('\n'));

console.log(`\n⚠️  NOTA: Este reporte NO incluye ubicacion_codigo ni fecha_ingreso`);
console.log(`   Estado establecido automáticamente como 'inactivo'`);
