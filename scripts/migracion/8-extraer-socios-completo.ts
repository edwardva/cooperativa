/**
 * Script para extraer TODOS los socios con sus ferias usando sesión persistente
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'cooptriunfo.org';
const LOGIN_PATH = '/sistemas/administrativo/login.php';
const GET_SOCIOS_PATH = '/sistemas/administrativo/socios/get.php';

interface Socio {
  expediente: string;
  cedula: string;
  apellidos: string;
  nombres: string;
  codigo: string; // Código de feria
  fecha_ing: string;
  retirado: string;
  direccion: string;
  telefono: string;
  telefono_movil: string;
  correo: string;
  delegado: string;
}

let sessionCookie = '';

/**
 * Hace login y obtiene la cookie de sesión
 */
function login(): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = 'txtUsuario=caja1&txtClave=9277864';

    const options = {
      hostname: BASE_URL,
      path: LOGIN_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      // Extraer cookies
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        sessionCookie = cookies.map(c => c.split(';')[0]).join('; ');
        console.log('✅ Cookie de sesión obtenida');
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
 * Fetch una página de socios
 */
function fetchPage(page: number, rows: number): Promise<{ total: string; rows: Socio[] }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `${GET_SOCIOS_PATH}?page=${page}&rows=${rows}`,
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'application/json'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject(new Error(`Error parseando JSON: ${error}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Extrae TODOS los socios usando paginación
 */
async function extractAllSocios(): Promise<Socio[]> {
  console.log('🔑 Iniciando sesión...');
  await login();

  const allSocios: Socio[] = [];
  const rowsPerPage = 1000; // Aumentado para reducir número de peticiones
  let currentPage = 1;
  let totalRegistros = 0;

  console.log('\n🔄 Extrayendo socios...\n');

  // Primera petición para obtener el total
  const firstPage = await fetchPage(1, rowsPerPage);
  totalRegistros = parseInt(firstPage.total);
  const totalPages = Math.ceil(totalRegistros / rowsPerPage);

  console.log(`📊 Total registros: ${totalRegistros}`);
  console.log(`📄 Total páginas: ${totalPages} (${rowsPerPage} registros/página)\n`);

  // Extraer todas las páginas
  for (let page = 1; page <= totalPages; page++) {
    try {
      const data = await fetchPage(page, rowsPerPage);

      if (!data.rows || data.rows.length === 0) {
        console.log(`⚠️  Página ${page}: Sin datos`);
        break;
      }

      console.log(`   📄 Página ${page}/${totalPages}: ${data.rows.length} socios extraídos`);
      allSocios.push(...data.rows);

      // Pausa breve para no sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error en página ${page}:`, error);
      // Continuar con la siguiente página
    }
  }

  return allSocios;
}

/**
 * Guarda los socios en CSV
 */
function saveToCSV(socios: Socio[], filename: string): void {
  const csvPath = path.join(__dirname, 'data', filename);
  
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
  const rows = socios.map(s => [
    `"${s.expediente}"`,
    `"${s.cedula?.trim() || ''}"`,
    `"${s.apellidos?.trim() || ''}"`,
    `"${s.nombres?.trim() || ''}"`,
    `"${s.codigo?.trim() || ''}"`,
    `"${s.fecha_ing || ''}"`,
    `"${s.retirado || ''}"`,
    `"${s.direccion?.replace(/"/g, '""') || ''}"`,
    `"${s.telefono?.trim() || ''}"`,
    `"${s.telefono_movil?.trim() || ''}"`,
    `"${s.correo?.trim() || ''}"`,
    `"${s.delegado || ''}"`,
  ].join(','));

  const csv = [headers, ...rows].join('\n');
  fs.writeFileSync(csvPath, csv, 'utf-8');

  console.log(`\n✅ CSV guardado: ${csvPath}`);
  console.log(`📊 Tamaño: ${(fs.statSync(csvPath).size / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Genera estadísticas
 */
function generateStats(socios: Socio[]): void {
  console.log('\n=====================================');
  console.log('📊 ESTADÍSTICAS DE EXTRACCIÓN');
  console.log('=====================================');

  console.log(`✅ Total socios extraídos: ${socios.length}`);

  // Por feria
  const feriaMap = new Map<string, number>();
  socios.forEach(s => {
    const feria = s.codigo?.trim() || 'SIN_FERIA';
    feriaMap.set(feria, (feriaMap.get(feria) || 0) + 1);
  });

  console.log(`\n📍 Ferias encontradas (${feriaMap.size}):`);
  Array.from(feriaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([codigo, count]) => {
      const porcentaje = ((count / socios.length) * 100).toFixed(2);
      console.log(`   ${codigo.padEnd(10)} - ${String(count).padStart(5)} socios (${porcentaje}%)`);
    });

  // Por estado
  const retirados = socios.filter(s => s.retirado?.toLowerCase() === 'si').length;
  const activos = socios.length - retirados;

  console.log(`\n👥 Por estado:`);
  console.log(`   ✅ Activos:   ${activos} (${((activos / socios.length) * 100).toFixed(2)}%)`);
  console.log(`   ❌ Retirados: ${retirados} (${((retirados / socios.length) * 100).toFixed(2)}%)`);

  console.log('=====================================\n');
}

/**
 * Main
 */
async function main() {
  try {
    console.log('🚀 EXTRACCIÓN COMPLETA DE SOCIOS CON FERIAS');
    console.log('==========================================\n');

    const socios = await extractAllSocios();

    if (socios.length === 0) {
      console.error('❌ No se extrajeron socios');
      process.exit(1);
    }

    generateStats(socios);
    saveToCSV(socios, 'socios_con_ferias.csv');

    console.log('✅ Extracción completada exitosamente\n');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
