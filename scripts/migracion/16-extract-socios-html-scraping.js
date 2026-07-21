/**
 * ============================================
 * EXTRACCIÓN DE SOCIOS VÍA HTML SCRAPING
 * ============================================
 * 
 * El endpoint AJAX no pagina correctamente (devuelve siempre los mismos 10 registros).
 * Esta versión hace scraping del HTML del listado de socios.
 * 
 * Extrae TODOS los campos incluyendo:
 * - sexo
 * - fecha_nac (fecha de nacimiento)
 * - autorizado (nombre del autorizado)
 * - autorizado_cedula
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'cooptriunfo.org';
const USERNAME = 'caja1';
const PASSWORD = '9277864';
const OUTPUT_DIR = path.join(__dirname, 'data');
const MAX_PAGES = 2000; // Límite de seguridad

console.log('\n=== Extracción de Socios vía HTML Scraping ===\n');

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
 * Obtener una página HTML del listado de socios
 */
function obtenerPaginaHTML(sessionCookie, page) {
  return new Promise((resolve, reject) => {
    // Primero intentamos con la URL típica de jqGrid
    const path = `/sistemas/administrativo/socios/index.php?page=${page}`;
    
    const options = {
      hostname: BASE_URL,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Parsear tabla HTML para extraer socios
 * Esta es una función simple que busca patrones comunes en tablas HTML
 */
function parsearTablaHTML(html) {
  const socios = [];
  
  // Buscar todas las filas de la tabla (tr con clase row0 o row1, común en jqGrid)
  const regexFilas = /<tr[^>]*class="[^"]*(?:row0|row1|ui-row-ltr)[^"]*"[^>]*>(.*?)<\/tr>/gs;
  const filas = html.match(regexFilas) || [];
  
  console.log(`   📊 Encontradas ${filas.length} filas en el HTML`);
  
  filas.forEach((fila, index) => {
    try {
      // Extraer todas las celdas (td)
      const regexCeldas = /<td[^>]*>(.*?)<\/td>/gs;
      const celdas = [];
      let match;
      
      while ((match = regexCeldas.exec(fila)) !== null) {
        // Limpiar HTML tags
        let contenido = match[1]
          .replace(/<[^>]+>/g, '') // Remover tags HTML
          .replace(/&nbsp;/g, ' ') // Reemplazar nbsp
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        
        celdas.push(contenido);
      }
      
      // Si tenemos suficientes celdas, intentar extraer los datos
      // Orden típico en jqGrid de socios: apellidos, nombres, cedula, expediente, etc.
      if (celdas.length >= 4) {
        const socio = {
          apellidos: celdas[0] || '',
          nombres: celdas[1] || '',
          cedula: celdas[2] || '',
          expediente: celdas[3] || '',
          // Los demás campos pueden variar según el orden de las columnas
          sexo: celdas[4] || '',
          fecha_nac: celdas[5] || '',
          telefono: celdas[6] || '',
          direccion: celdas[7] || '',
          autorizado: celdas[8] || '',
          autorizado_cedula: celdas[9] || '',
        };
        
        // Solo agregar si tiene al menos cédula o expediente
        if (socio.cedula || socio.expediente) {
          socios.push(socio);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error parseando fila ${index}: ${error.message}`);
    }
  });
  
  return socios;
}

/**
 * Método alternativo: buscar el JSON embebido en el HTML
 * A veces jqGrid incluye los datos en formato JSON dentro de un script tag
 */
function buscarJSONEnHTML(html) {
  // Buscar patrones como: var data = [{...}]
  const regexJSON = /var\s+(?:data|gridData|rows)\s*=\s*(\[[\s\S]*?\]);/g;
  let match;
  
  while ((match = regexJSON.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   📦 Encontrados ${data.length} registros en JSON embebido`);
        return data;
      }
    } catch (error) {
      // No es JSON válido, continuar
    }
  }
  
  return null;
}

/**
 * Explorar la estructura de la primera página
 */
async function explorarEstructura() {
  try {
    console.log('🔍 Explorando estructura de la página de socios...\n');
    
    const sessionCookie = await login();
    
    // Obtener primera página
    const html = await obtenerPaginaHTML(sessionCookie, 1);
    
    // Guardar HTML para inspección manual
    const htmlPath = path.join(OUTPUT_DIR, 'socios_page1_sample.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`💾 HTML de muestra guardado en: ${htmlPath}`);
    console.log(`   Tamaño: ${(html.length / 1024).toFixed(2)} KB\n`);
    
    // Intentar buscar JSON embebido
    const jsonData = buscarJSONEnHTML(html);
    if (jsonData) {
      console.log('✅ Se encontró JSON embebido en el HTML');
      console.log('   Primer registro:');
      console.log(JSON.stringify(jsonData[0], null, 2));
      return { method: 'json', data: jsonData };
    }
    
    // Intentar parsear tabla HTML
    const socios = parsearTablaHTML(html);
    if (socios.length > 0) {
      console.log('✅ Se pudo parsear la tabla HTML');
      console.log('   Primer registro:');
      console.log(JSON.stringify(socios[0], null, 2));
      return { method: 'html', data: socios };
    }
    
    // Si no funcionó ninguno, mostrar info para debug
    console.log('⚠️  No se pudo extraer datos automáticamente');
    console.log('   Por favor revisa el archivo HTML guardado para identificar la estructura');
    console.log('   Buscando patrones...\n');
    
    // Buscar grid container
    if (html.includes('jqGrid') || html.includes('ui-jqgrid')) {
      console.log('   ✓ Detectado: jqGrid');
    }
    if (html.includes('table') || html.includes('TABLE')) {
      console.log('   ✓ Detectado: Tabla HTML');
    }
    
    // Buscar el ID del grid
    const gridMatch = html.match(/id=["']([^"']*grid[^"']*)["']/i);
    if (gridMatch) {
      console.log(`   ✓ Grid ID encontrado: ${gridMatch[1]}`);
    }
    
    return { method: 'manual', data: null };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar exploración
explorarEstructura().then(result => {
  if (result.method === 'manual') {
    console.log('\n📋 SIGUIENTE PASO:');
    console.log('   1. Abre el archivo HTML guardado en data/socios_page1_sample.html');
    console.log('   2. Identifica la estructura de la tabla o grid');
    console.log('   3. Comparte esa información para ajustar el script de extracción');
  } else {
    console.log('\n✅ Estructura identificada. Listo para extraer todos los socios.');
  }
});
