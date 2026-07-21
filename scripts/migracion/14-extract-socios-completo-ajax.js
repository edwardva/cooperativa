/**
 * ============================================
 * EXTRACCIÓN COMPLETA DE SOCIOS DESDE AJAX
 * ============================================
 * 
 * Extrae TODOS los campos de socios incluyendo:
 * - sexo
 * - fecha_nac (fecha de nacimiento)
 * - autorizado (nombre del autorizado)
 * - autorizado_cedula
 * 
 * Basado en extract_funeraria_ajax_optimized.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'cooptriunfo.org';
const USERNAME = 'caja1';
const PASSWORD = '9277864';
const OUTPUT_DIR = path.join(__dirname, 'data');
const ROWS_PER_PAGE = 20; // EasyUI DataGrid usa 20 registros por página
const MAX_PAGES = 2000; // Límite de seguridad para evitar loops infinitos

console.log('\n=== Extracción Completa de Socios (Todos los Campos) ===\n');

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
 * Extraer una página de socios
 */
function extraerPagina(sessionCookie, page, rows) {
  return new Promise((resolve, reject) => {
    // EasyUI DataGrid usa POST (no GET) y envía page/rows como form data
    const postData = `page=${page}&rows=${rows}`;
    
    const options = {
      hostname: BASE_URL,
      path: '/sistemas/administrativo/socios/get.php',
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject(new Error(`Error al parsear JSON: ${error.message}\nData: ${data.substring(0, 500)}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Extraer todos los socios
 */
async function extraerTodosSocios() {
  try {
    // Login
    const sessionCookie = await login();
    
    let page = 1;
    let totalSocios = [];
    let totalRecords = 0;
    
    // Extraer primera página para obtener total de registros
    console.log(`📄 Extrayendo página ${page}...`);
    const primeraRespuesta = await extraerPagina(sessionCookie, page, ROWS_PER_PAGE);
    
    if (!primeraRespuesta.rows || !Array.isArray(primeraRespuesta.rows)) {
      throw new Error('Respuesta inesperada del servidor');
    }
    
    totalRecords = parseInt(primeraRespuesta.total || primeraRespuesta.records || 0);
    totalSocios.push(...primeraRespuesta.rows);
    
    console.log(`   ✓ Obtenidos ${primeraRespuesta.rows.length} registros`);
    console.log(`   Total en sistema: ${totalRecords}`);
    
    // Calcular páginas restantes
    const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);
    console.log(`   📊 Total páginas a extraer: ${totalPages}\n`);
    
    // Extraer páginas restantes
    for (page = 2; page <= totalPages && page <= MAX_PAGES; page++) {
      console.log(`📄 Extrayendo página ${page} de ${totalPages}...`);
      const respuesta = await extraerPagina(sessionCookie, page, ROWS_PER_PAGE);
      
      if (respuesta.rows && respuesta.rows.length > 0) {
        totalSocios.push(...respuesta.rows);
        console.log(`   ✓ Obtenidos ${respuesta.rows.length} registros`);
      } else {
        console.log(`   ⚠️  Página vacía, deteniendo extracción`);
        break;
      }
      
      // Pequeña pausa para no saturar el servidor
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n✅ Extracción completada: ${totalSocios.length} socios\n`);
    
    // Guardar JSON completo
    const jsonPath = path.join(OUTPUT_DIR, 'socios_completo_ajax.json');
    fs.writeFileSync(jsonPath, JSON.stringify(totalSocios, null, 2));
    console.log(`💾 JSON guardado: ${jsonPath}`);
    
    // Convertir a CSV
    convertirACSV(totalSocios);
    
    // Reporte de campos disponibles
    if (totalSocios.length > 0) {
      console.log('\n📋 Campos disponibles en la respuesta:');
      const primeraFila = totalSocios[0];
      Object.keys(primeraFila).forEach(key => {
        const valor = primeraFila[key];
        const tipo = typeof valor;
        console.log(`   - ${key}: ${tipo} (ejemplo: ${JSON.stringify(valor)})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Convertir JSON a CSV
 */
function convertirACSV(socios) {
  if (socios.length === 0) {
    console.log('⚠️  No hay datos para convertir a CSV');
    return;
  }
  
  // Determinar columnas (usar el primer registro)
  const columnas = Object.keys(socios[0]);
  
  // Crear header CSV
  let csv = columnas.join(',') + '\n';
  
  // Agregar filas
  socios.forEach(socio => {
    const fila = columnas.map(col => {
      const valor = socio[col];
      
      // Manejar valores nulos/undefined
      if (valor === null || valor === undefined) {
        return '';
      }
      
      // Escapar comillas y envolver en comillas si contiene comas
      const valorStr = String(valor);
      if (valorStr.includes(',') || valorStr.includes('"') || valorStr.includes('\n')) {
        return `"${valorStr.replace(/"/g, '""')}"`;
      }
      
      return valorStr;
    });
    
    csv += fila.join(',') + '\n';
  });
  
  // Guardar CSV
  const csvPath = path.join(OUTPUT_DIR, 'socios_completo_ajax.csv');
  fs.writeFileSync(csvPath, csv);
  console.log(`💾 CSV guardado: ${csvPath}`);
  console.log(`   Registros: ${socios.length}`);
  console.log(`   Columnas: ${columnas.length}`);
}

// Ejecutar
extraerTodosSocios();
