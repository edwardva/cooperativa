/**
 * Script OPTIMIZADO para extraer TODOS los acuerdos de funeraria
 * Usa rows=1000 para obtener más registros por página
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'cooptriunfo.org';
const USERNAME = 'caja1';
const PASSWORD = '9277864';
const OUTPUT_DIR = path.join(__dirname, 'data', 'funeraria');
const ROWS_PER_PAGE = 1000; // Aumentado a 1000

// Asegurar que existe el directorio
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('\n=== Extracción OPTIMIZADA de Acuerdos de Funeraria ===\n');

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
 * Extraer una página de acuerdos
 */
function extraerPagina(sessionCookie, page, rows) {
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
      }
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
    req.write(postData);
    req.end();
  });
}

/**
 * Extraer TODOS los acuerdos con paginación de 1000
 */
async function extraerTodos(sessionCookie) {
  console.log(`Extrayendo con ${ROWS_PER_PAGE} registros por página...\n`);
  
  // Primera petición para obtener el total
  const firstPage = await extraerPagina(sessionCookie, 1, ROWS_PER_PAGE);
  const totalRecords = firstPage.total;
  const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);
  
  console.log(`📊 Total de registros reportados: ${totalRecords}`);
  console.log(`📄 Total de páginas a extraer: ${totalPages}\n`);
  
  const todosLosAcuerdos = new Map(); // Usar Map para deduplicar
  
  // Agregar primera página
  if (firstPage.rows) {
    firstPage.rows.forEach(row => {
      const key = row.expediente || row.contrato;
      if (key && !todosLosAcuerdos.has(key)) {
        todosLosAcuerdos.set(key, row);
      }
    });
    console.log(`   Página 1: ${firstPage.rows.length} registros (${todosLosAcuerdos.size} únicos)`);
  }
  
  // Extraer páginas restantes
  for (let page = 2; page <= totalPages; page++) {
    try {
      const pageData = await extraerPagina(sessionCookie, page, ROWS_PER_PAGE);
      
      if (pageData.rows && pageData.rows.length > 0) {
        const antesCount = todosLosAcuerdos.size;
        
        pageData.rows.forEach(row => {
          const key = row.expediente || row.contrato;
          if (key && !todosLosAcuerdos.has(key)) {
            todosLosAcuerdos.set(key, row);
          }
        });
        
        const nuevos = todosLosAcuerdos.size - antesCount;
        console.log(`   Página ${page}: ${pageData.rows.length} registros (+${nuevos} únicos = ${todosLosAcuerdos.size} total)`);
      } else {
        console.log(`   Página ${page}: Sin datos, finalizando...`);
        break;
      }
      
      // Delay para no sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`   ❌ Error en página ${page}:`, error.message);
      // Continuar con siguiente página
    }
  }
  
  console.log(`\n✅ Extracción completada: ${todosLosAcuerdos.size} acuerdos únicos\n`);
  
  return Array.from(todosLosAcuerdos.values());
}

/**
 * Guardar a CSV
 */
function guardarCSV(acuerdos, filename) {
  console.log('Generando CSV...');
  
  const csvPath = path.join(OUTPUT_DIR, filename);
  
  // Header
  const header = [
    'contrato',
    'expediente',
    'tipo_contrato',
    'fecha_ing',
    'retirado',
    'motivo_ret',
    'fecha_ret',
    'apellidos',
    'direccion',
    'fecha_nac',
    'telefono',
    'nombres',
    'cedula',
    'tipo'
  ].join(',');
  
  // Filas
  const filas = acuerdos.map(a => {
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
  
  const csv = [header, ...filas].join('\n');
  fs.writeFileSync(csvPath, csv, 'utf8');
  
  console.log(`✅ CSV guardado: ${csvPath}`);
  console.log(`   Total registros: ${acuerdos.length}\n`);
  
  // Estadísticas
  const stats = {
    total: acuerdos.length,
    activos: acuerdos.filter(a => a.retirado !== 'Si').length,
    retirados: acuerdos.filter(a => a.retirado === 'Si').length,
  };
  
  console.log('=== Estadísticas ===');
  console.log(`Total: ${stats.total}`);
  console.log(`  Activos: ${stats.activos} (${(stats.activos/stats.total*100).toFixed(1)}%)`);
  console.log(`  Retirados: ${stats.retirados} (${(stats.retirados/stats.total*100).toFixed(1)}%)`);
  
  return csvPath;
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
    const acuerdos = await extraerTodos(sessionCookie);
    guardarCSV(acuerdos, 'acuerdos_funeraria_completo.csv');
    
    console.log('\n✅ ¡Extracción completa exitosa!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
