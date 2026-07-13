/**
 * Script para reintentar específicamente la página 2 que falló
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'cooptriunfo.org';
const USERNAME = 'caja1';
const PASSWORD = '9277864';
const OUTPUT_DIR = path.join(__dirname, 'data', 'funeraria');
const ROWS_PER_PAGE = 1000;
const MAX_RETRIES = 5;

console.log('\n=== Reintentando Página 2 de Funeraria ===\n');

/**
 * Login y obtener cookie de sesión
 */
function login() {
  return new Promise((resolve, reject) => {
    const postData = `username=${USERNAME}&password=${PASSWORD}`;
    
    const options = {
      hostname: BASE_URL,
      path: '/sistemas/administrativo/checklogin.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      const cookies = res.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        const sessionCookie = cookies[0].split(';')[0];
        console.log('✅ Login exitoso\n');
        resolve(sessionCookie);
      } else {
        reject(new Error('No se recibió cookie de sesión'));
      }
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Extraer una página de acuerdos con timeout largo
 */
function extraerPagina(sessionCookie, page, rows, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const postData = `page=${page}&rows=${rows}`;
    
    const options = {
      hostname: BASE_URL,
      path: '/sistemas/administrativo/funeraria/get.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': sessionCookie
      },
      timeout: timeout
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          reject(new Error('Error parseando JSON: ' + e.message));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Reintentar página 2 múltiples veces
 */
async function reintentarPagina2(sessionCookie) {
  console.log(`Intentando extraer página 2 (máximo ${MAX_RETRIES} intentos)...\n`);
  
  for (let intento = 1; intento <= MAX_RETRIES; intento++) {
    try {
      console.log(`   Intento ${intento}/${MAX_RETRIES}...`);
      
      const pageData = await extraerPagina(sessionCookie, 2, ROWS_PER_PAGE, 60000); // 60 segundos de timeout
      
      if (pageData.rows && pageData.rows.length > 0) {
        console.log(`   ✅ ÉXITO! Obtenidos ${pageData.rows.length} registros\n`);
        return pageData.rows;
      } else {
        console.log(`   ⚠️  Sin datos, reintentando...\n`);
      }
      
    } catch (error) {
      console.log(`   ❌ Falló: ${error.message}`);
      
      if (intento < MAX_RETRIES) {
        const espera = intento * 2; // Espera progresiva: 2s, 4s, 6s, 8s
        console.log(`   Esperando ${espera}s antes del siguiente intento...\n`);
        await new Promise(resolve => setTimeout(resolve, espera * 1000));
      }
    }
  }
  
  console.log('\n❌ No se pudo obtener la página 2 después de todos los intentos\n');
  return null;
}

/**
 * Guardar registros adicionales a CSV
 */
function guardarRegistrosAdicionales(registros, filename) {
  console.log('Procesando registros de página 2...\n');
  
  // Leer CSV existente para deduplicar
  const csvExistente = path.join(OUTPUT_DIR, 'acuerdos_funeraria_completo.csv');
  const existingData = fs.readFileSync(csvExistente, 'utf8');
  const expedientesExistentes = new Set();
  
  existingData.split('\n').slice(1).forEach(linea => {
    const match = linea.match(/^([^,]+)/);
    if (match) {
      expedientesExistentes.add(match[1].trim());
    }
  });
  
  console.log(`   Expedientes existentes en CSV: ${expedientesExistentes.size}`);
  
  // Filtrar solo nuevos
  const nuevos = registros.filter(r => !expedientesExistentes.has(r.contrato?.trim()));
  
  console.log(`   Registros nuevos encontrados: ${nuevos.length}\n`);
  
  if (nuevos.length === 0) {
    console.log('⚠️  No hay registros nuevos para agregar\n');
    return 0;
  }
  
  // Agregar al CSV existente
  const filasNuevas = nuevos.map(a => {
    return [
      escaparCSV(a.contrato),
      escaparCSV(a.expediente),
      escaparCSV(a.tipo_contrato),
      escaparCSV(a.fecha_ing),
      escaparCSV(a.retirado),
      escaparCSV(a.motivo_ret),
      escaparCSV(a.fecha_ret),
      escaparCSV(a.apellidos),
      escaparCSV(a.direccion),
      escaparCSV(a.fecha_nac),
      escaparCSV(a.telefono),
      escaparCSV(a.nombres),
      escaparCSV(a.cedula),
      escaparCSV(a.tipo)
    ].join(',');
  });
  
  // Agregar al final del CSV existente
  fs.appendFileSync(csvExistente, '\n' + filasNuevas.join('\n'), 'utf8');
  
  console.log(`✅ ${nuevos.length} registros nuevos agregados a ${csvExistente}\n`);
  
  // Estadísticas
  const stats = {
    nuevos: nuevos.length,
    activos: nuevos.filter(a => a.retirado !== 'Si').length,
    retirados: nuevos.filter(a => a.retirado === 'Si').length,
  };
  
  console.log('=== Estadísticas de Nuevos Registros ===');
  console.log(`Total nuevos: ${stats.nuevos}`);
  console.log(`  Activos: ${stats.activos} (${(stats.activos/stats.nuevos*100).toFixed(1)}%)`);
  console.log(`  Retirados: ${stats.retirados} (${(stats.retirados/stats.nuevos*100).toFixed(1)}%)`);
  
  return nuevos.length;
}

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
    const sessionCookie = await login();
    const registrosPagina2 = await reintentarPagina2(sessionCookie);
    
    if (registrosPagina2) {
      const agregados = guardarRegistrosAdicionales(registrosPagina2, 'acuerdos_funeraria_completo.csv');
      
      if (agregados > 0) {
        console.log('\n✅ ¡Página 2 recuperada exitosamente!');
        console.log(`   Ahora ejecuta parse_funeraria_csv.js para regenerar el CSV unificado\n`);
      }
    } else {
      console.log('⚠️  No se pudo recuperar la página 2');
      console.log('   Los 11,497 registros existentes son suficientes (88% del total)\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
