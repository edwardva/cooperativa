/**
 * Script para extraer acuerdos de funeraria via AJAX del sistema viejo
 * Similar al approach de socios pero mejorado para pagination
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuración
const BASE_URL = 'cooptriunfo.org';
const BASE_PATH = '/sistemas/administrativo';
const USERNAME = 'caja1';
const PASSWORD = '9277864';

// Directorio de salida
const OUTPUT_DIR = path.join(__dirname, 'data', 'funeraria');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let sessionCookie = '';

/**
 * Hacer request HTTP
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ data, headers: res.headers, statusCode: res.statusCode });
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Login al sistema
 */
async function login() {
  console.log('1. Iniciando sesión...');
  
  const postData = `username=${USERNAME}&password=${PASSWORD}`;
  
  const options = {
    hostname: BASE_URL,
    port: 443,
    path: `${BASE_PATH}/checklogin.php`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const { data, headers } = await makeRequest(options, postData);
  
  try {
    const loginData = JSON.parse(data);
    
    if (loginData.errorMsg) {
      throw new Error(`Login failed: ${loginData.errorMsg}`);
    }
    
    // Extraer cookie de sesión
    if (headers['set-cookie']) {
      sessionCookie = headers['set-cookie']
        .map(cookie => cookie.split(';')[0])
        .join('; ');
    }
    
    console.log('✅ Login exitoso');
    return true;
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    return false;
  }
}

/**
 * Obtener acuerdos de funeraria paginados
 * Basado en el patrón de DataGrid de EasyUI que usa el sistema
 */
async function obtenerAcuerdos(page = 1, rows = 100) {
  const options = {
    hostname: BASE_URL,
    port: 443,
    path: `${BASE_PATH}/funeraria/consultar_acuerdos.php?page=${page}&rows=${rows}`,
    method: 'GET',
    headers: {
      'Cookie': sessionCookie,
      'Accept': 'application/json'
    }
  };
  
  try {
    const { data } = await makeRequest(options);
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error obteniendo página ${page}:`, error.message);
    return null;
  }
}

/**
 * Intentar diferentes endpoints AJAX
 */
async function buscarEndpointAJAX() {
  console.log('\n2. Buscando endpoint AJAX de acuerdos...');
  
  const endpoints = [
    '/funeraria/get.php',
    '/funeraria/consultar_acuerdos.php',
    '/funeraria/listar_acuerdos.php',
    '/funeraria/get_acuerdos.php',
    '/funeraria/acuerdos.php',
    '/funeraria/data_acuerdos.php',
    '/funeraria/ajax_acuerdos.php',
    '/funeraria/grid_acuerdos.php',
    '/otros/consultar_funeraria.php',
  ];
  
  for (const endpoint of endpoints) {
    process.stdout.write(`  Probando ${endpoint}... `);
    
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: `${BASE_PATH}${endpoint}?page=1&rows=10`,
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'application/json'
      }
    };
    
    try {
      const { data, statusCode } = await makeRequest(options);
      
      if (statusCode === 200 && data.length > 10) {
        try {
          const json = JSON.parse(data);
          if (json.total && json.rows) {
            console.log(`✅ ENCONTRADO! (${json.total} registros)`);
            return { endpoint, data: json };
          }
        } catch (e) {
          // No es JSON válido
        }
      }
      
      console.log('❌');
    } catch (error) {
      console.log('❌');
    }
  }
  
  return null;
}

/**
 * Extraer todos los acuerdos paginados
 */
async function extraerTodos(endpoint, totalRegistros) {
  console.log(`\n3. Extrayendo ${totalRegistros} acuerdos...`);
  
  const registrosPorPagina = 100;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
  const todosLosAcuerdos = [];
  
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    process.stdout.write(`  Página ${pagina}/${totalPaginas}... `);
    
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: `${BASE_PATH}${endpoint}?page=${pagina}&rows=${registrosPorPagina}`,
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'application/json'
      }
    };
    
    try {
      const { data } = await makeRequest(options);
      const json = JSON.parse(data);
      
      if (json.rows && json.rows.length > 0) {
        todosLosAcuerdos.push(...json.rows);
        console.log(`✅ ${json.rows.length} registros`);
      } else {
        console.log('⚠️  Sin datos');
      }
      
      // Pequeña pausa para no sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.log(`❌ ${error.message}`);
    }
  }
  
  return todosLosAcuerdos;
}

/**
 * Guardar a CSV
 */
function guardarCSV(acuerdos) {
  console.log('\n4. Guardando a CSV...');
  
  if (acuerdos.length === 0) {
    console.log('⚠️  No hay datos para guardar');
    return;
  }
  
  // Determinar todas las columnas disponibles
  const columnas = Object.keys(acuerdos[0]);
  
  // Crear CSV
  let csv = columnas.join(',') + '\n';
  
  acuerdos.forEach(acuerdo => {
    const fila = columnas.map(col => {
      let valor = acuerdo[col] || '';
      
      // Escapar comillas y comas
      if (typeof valor === 'string' && (valor.includes(',') || valor.includes('"'))) {
        valor = `"${valor.replace(/"/g, '""')}"`;
      }
      
      return valor;
    }).join(',');
    
    csv += fila + '\n';
  });
  
  // Guardar archivo
  const outputPath = path.join(OUTPUT_DIR, 'acuerdos_funeraria.csv');
  fs.writeFileSync(outputPath, csv, 'utf8');
  
  console.log(`✅ Archivo guardado: ${outputPath}`);
  console.log(`   Total registros: ${acuerdos.length}`);
}

/**
 * Main
 */
async function main() {
  console.log('\n=== Extracción de Acuerdos de Funeraria ===\n');
  
  // Login
  const loginOk = await login();
  if (!loginOk) {
    process.exit(1);
  }
  
  // Buscar endpoint AJAX
  const resultado = await buscarEndpointAJAX();
  
  if (!resultado) {
    console.log('\n❌ No se encontró endpoint AJAX válido');
    console.log('\nEsto significa que:');
    console.log('  1. El endpoint usa un nombre diferente');
    console.log('  2. Requiere parámetros específicos');
    console.log('  3. Los datos se cargan de otra manera\n');
    console.log('Necesitamos inspeccionar el Network tab del navegador para encontrar la URL correcta.\n');
    process.exit(1);
  }
  
  // Extraer todos los registros
  const acuerdos = await extraerTodos(resultado.endpoint, resultado.data.total);
  
  // Guardar CSV
  guardarCSV(acuerdos);
  
  console.log('\n✅ ¡Extracción completada!\n');
}

main().catch(console.error);
