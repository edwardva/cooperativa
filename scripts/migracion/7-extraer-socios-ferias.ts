#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT: EXTRAER SOCIOS CON FERIAS VÍA ENDPOINT
 * ============================================
 * 
 * Extrae TODOS los socios del sistema viejo haciendo peticiones
 * al endpoint get.php del sistema viejo.
 * 
 * Uso:
 *   npm run extraer:socios
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fetchPage(page: number, rows: number): Promise<any> {
  const url = `https://cooptriunfo.org/sistemas/administrativo/socios/get.php?page=${page}&rows=${rows}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  log('\n🔄 EXTRACCIÓN DE SOCIOS CON FERIAS', 'cyan');
  log('====================================\n', 'cyan');

  const allSocios: any[] = [];
  const rowsPerPage = 500;
  let currentPage = 1;
  let total = 0;

  log('📡 Conectando al sistema viejo...', 'blue');

  // Primera petición para obtener el total
  const firstPage = await fetchPage(1, rowsPerPage);
  total = parseInt(firstPage.total);
  
  log(`✅ Total de socios en sistema viejo: ${total}\n`, 'green');

  // Calcular número de páginas
  const totalPages = Math.ceil(total / rowsPerPage);
  
  log(`📄 Páginas a procesar: ${totalPages}`, 'blue');
  log(`📦 Registros por página: ${rowsPerPage}\n`, 'blue');

  // Extraer todas las páginas
  for (let page = 1; page <= totalPages; page++) {
    try {
      const pageData = await fetchPage(page, rowsPerPage);
      
      if (pageData.rows && pageData.rows.length > 0) {
        allSocios.push(...pageData.rows);
        process.stdout.write(`\r  ⏳ Progreso: ${page}/${totalPages} páginas (${allSocios.length}/${total} socios)`);
      }
      
      // Pequeña pausa para no sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      log(`\n❌ Error en página ${page}: ${error}`, 'red');
    }
  }

  console.log('\n');

  log(`✅ Extracción completada: ${allSocios.length} socios\n`, 'green');

  // Convertir a CSV
  log('📝 Generando archivo CSV...', 'blue');
  
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
  ];

  const csvRows = [headers.join(',')];

  for (const socio of allSocios) {
    const row = [
      (socio.expediente || '').trim(),
      (socio.cedula || '').trim(),
      (socio.apellidos || '').trim(),
      (socio.nombres || '').trim(),
      (socio.codigo || '').trim(), // ← CÓDIGO DE FERIA
      (socio.fecha_ing || '').trim(),
      (socio.retirado || '').trim(),
      (socio.direccion || '').trim(),
      (socio.telefono || '').trim(),
      (socio.telefono_movil || '').trim(),
      (socio.correo || '').trim(),
      (socio.delegado || '').trim()
    ].map(value => {
      // Escapar comillas
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });

    csvRows.push(row.join(','));
  }

  const csv = '\ufeff' + csvRows.join('\n'); // BOM para UTF-8

  // Guardar archivo
  const outputPath = path.join(__dirname, 'data', 'socios_con_ferias.csv');
  fs.writeFileSync(outputPath, csv, 'utf-8');

  log(`✅ Archivo guardado: ${outputPath}\n`, 'green');

  // Estadísticas
  log('====================================', 'cyan');
  log('📊 ESTADÍSTICAS', 'cyan');
  log('====================================', 'cyan');
  log(`Total registros:      ${allSocios.length}`, 'blue');
  log(`Tamaño del archivo:   ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`, 'blue');
  
  // Contar socios por feria
  const porFeria: Record<string, number> = {};
  let sinFeria = 0;
  
  for (const socio of allSocios) {
    const codigo = (socio.codigo || '').trim();
    if (codigo) {
      porFeria[codigo] = (porFeria[codigo] || 0) + 1;
    } else {
      sinFeria++;
    }
  }

  log(`\nSocios con feria:     ${allSocios.length - sinFeria}`, 'green');
  log(`Socios sin feria:     ${sinFeria}`, 'yellow');
  
  log(`\n📍 Ferias encontradas (${Object.keys(porFeria).length}):`, 'cyan');
  
  const feriasOrdenadas = Object.entries(porFeria)
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [codigo, cantidad] of feriasOrdenadas) {
    log(`   ${codigo.padEnd(10)} - ${cantidad.toString().padStart(5)} socios`, 'blue');
  }
  
  log('\n====================================', 'cyan');
  log('\n✅ Extracción completada exitosamente\n', 'green');
  
  log('📝 Siguiente paso:', 'yellow');
  log('   npm run asociar:ferias\n', 'yellow');
}

main()
  .catch((error) => {
    log('\n❌ Error durante la extracción:', 'red');
    console.error(error);
    process.exit(1);
  });
