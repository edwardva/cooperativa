/**
 * Backfill de beneficiarios familiares para acuerdos de funeraria ACTIVOS.
 *
 * La migración original (4-import-funeraria.ts / 5-import-beneficiarios.ts)
 * solo trajo el listado de acuerdos (encabezado) del sistema viejo, pero
 * nunca el detalle de beneficiarios por acuerdo (grilla "dg1" / get_detalle.php
 * de cada contrato). Como resultado, casi todos los socios con acuerdo de
 * funeraria quedaron con un único beneficiario (el titular autogenerado) en
 * vez de su grupo familiar completo.
 *
 * Este script:
 *  1. Se autentica contra el sistema viejo (cooptriunfo.org).
 *  2. Descarga el listado completo de acuerdos (una sola solicitud) para
 *     mapear expediente -> número(s) de contrato.
 *  3. Para cada acuerdo ACTIVO de nuestra base de datos cuyo socio todavía
 *     solo tiene al titular como beneficiario, consulta el detalle de
 *     beneficiarios del contrato correspondiente y los inserta.
 *  4. Es reanudable: si se interrumpe y se vuelve a correr, los socios que
 *     ya quedaron con más de un beneficiario se saltan (no repite llamadas
 *     al sistema viejo para lo ya migrado).
 *
 * Uso:
 *   cd scripts/migracion
 *   npx tsx 21-backfill-beneficiarios-funeraria-legacy.ts
 *
 * Variables de entorno opcionales:
 *   LEGACY_USER, LEGACY_PASS  (por defecto: caja1 / 9277864)
 *   LEGACY_DELAY_MS           (pausa entre solicitudes al sistema viejo, por defecto 300ms)
 */

import { PrismaClient } from '../../backend/node_modules/@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const BASE_URL = 'https://cooptriunfo.org/sistemas/administrativo';
const USERNAME = process.env.LEGACY_USER || 'caja1';
const PASSWORD = process.env.LEGACY_PASS || '9277864';
const DELAY_MS = Number(process.env.LEGACY_DELAY_MS || 300);
const MAX_BENEFICIARIOS_POR_SOCIO = 9;

const LOG_DIR = path.join(__dirname, 'logs');
const FECHA = new Date().toISOString().slice(0, 10);
const REPORT_PATH = path.join(LOG_DIR, `backfill_beneficiarios_funeraria_${FECHA}.json`);
const CSV_BACKUP_PATH = path.join(__dirname, 'data', 'funeraria', `beneficiarios_detalle_scrape_${FECHA}.csv`);

let cookie = '';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function csvEscape(valor: string): string {
  const v = (valor ?? '').replace(/"/g, '""');
  return /[",\n]/.test(v) ? `"${v}"` : v;
}

async function login(): Promise<void> {
  const res1 = await fetch(`${BASE_URL}/index.php`);
  const setCookie1 = res1.headers.get('set-cookie');
  if (setCookie1) cookie = setCookie1.split(';')[0] ?? '';

  await fetch(`${BASE_URL}/checklogin.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ username: USERNAME, password: PASSWORD }),
  });

  const menu = await fetch(`${BASE_URL}/menu.php`, { headers: { Cookie: cookie } });
  const menuHtml = await menu.text();
  if (!menuHtml.includes('Funeraria')) {
    throw new Error('No fue posible autenticar contra el sistema viejo (verifica usuario/clave)');
  }
}

interface AcuerdoLegacyRow {
  contrato: string;
  expediente: string;
}

async function obtenerListadoCompleto(): Promise<AcuerdoLegacyRow[]> {
  const res = await fetch(`${BASE_URL}/funeraria/get.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ page: '1', rows: '20000' }),
  });
  const json = (await res.json()) as { total: string; rows: any[] };
  return (json.rows || [])
    .map((r) => ({ contrato: String(r.contrato || '').trim(), expediente: String(r.expediente || '').trim() }))
    .filter((r) => r.contrato && r.expediente);
}

interface BeneficiarioDetalle {
  cedula: string;
  apellidos: string;
  nombres: string;
  parentesco: string;
  fecha_nac: string;
  status: string;
}

async function obtenerBeneficiariosDetalle(contrato: string): Promise<BeneficiarioDetalle[]> {
  const url = `${BASE_URL}/funeraria/get_detalle.php?id=${encodeURIComponent(contrato)}`;
  const res = await fetch(url, { headers: { Cookie: cookie } });
  const json = (await res.json()) as { total: string; rows: any[] };
  return (json.rows || []).map((r) => ({
    // El sistema viejo a veces antepone V-/E- a la cédula; el sistema nuevo solo acepta dígitos.
    cedula: String(r.cedula || '').trim().replace(/[^0-9]/g, ''),
    apellidos: String(r.apellidos || '').trim(),
    nombres: String(r.nombres || '').trim(),
    parentesco: String(r.parentesco || '').trim(),
    fecha_nac: String(r.fecha_nac || '').trim(),
    status: String(r.status || '').trim(),
  }));
}

function parsearFechaDDMMYYYY(fecha: string): Date | null {
  if (!fecha) return null;
  const [d, m, a] = fecha.split('/');
  if (!d || !m || !a) return null;
  const fd = new Date(Number(a), Number(m) - 1, Number(d));
  return isNaN(fd.getTime()) ? null : fd;
}

async function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(CSV_BACKUP_PATH), { recursive: true });

  console.log('='.repeat(60));
  console.log('BACKFILL: BENEFICIARIOS DE FUNERARIA (ACUERDOS ACTIVOS)');
  console.log('='.repeat(60));

  console.log('\nAutenticando contra sistema viejo...');
  await login();
  console.log('   Autenticado correctamente.');

  console.log('\nDescargando listado completo de acuerdos del sistema viejo...');
  const listado = await obtenerListadoCompleto();
  console.log(`   ${listado.length} acuerdos encontrados en sistema viejo.`);

  const contratosPorExpediente = new Map<string, string[]>();
  for (const row of listado) {
    const arr = contratosPorExpediente.get(row.expediente) || [];
    arr.push(row.contrato);
    contratosPorExpediente.set(row.expediente, arr);
  }

  console.log('\nConsultando acuerdos activos en la base de datos nueva...');
  const acuerdos = await prisma.acuerdoFuneraria.findMany({
    where: { estado: 'activo' },
    include: {
      beneficiario: {
        include: {
          socio: { include: { _count: { select: { beneficiarios: true } } } },
        },
      },
    },
  });
  console.log(`   ${acuerdos.length} acuerdos activos encontrados.\n`);

  const limite = process.env.LEGACY_LIMIT ? Number(process.env.LEGACY_LIMIT) : undefined;
  const acuerdosAProcesar = limite ? acuerdos.slice(0, limite) : acuerdos;
  if (limite) {
    console.log(`   [LEGACY_LIMIT activo] Procesando solo los primeros ${acuerdosAProcesar.length} acuerdos.\n`);
  }

  const stats = {
    acuerdosTotal: acuerdosAProcesar.length,
    acuerdosYaMigrados: 0,
    acuerdosSinExpedienteLegacy: 0,
    acuerdosConsultados: 0,
    beneficiariosEncontrados: 0,
    beneficiariosInsertados: 0,
    beneficiariosDuplicados: 0,
    beneficiariosLimiteAlcanzado: 0,
    errores: 0,
  };

  const csvRows: string[] = [
    'codigo_socio,contrato,cedula,nombre,apellido,parentesco,fecha_nacimiento,estado_legacy,resultado',
  ];

  let procesados = 0;

  for (const acuerdo of acuerdosAProcesar) {
    procesados++;

    const socio = acuerdo.beneficiario?.socio;
    if (!socio) {
      stats.errores++;
      continue;
    }

    // Reanudable: si el socio ya tiene más de un beneficiario, ya se migró en una corrida previa.
    if (socio._count.beneficiarios > 1) {
      stats.acuerdosYaMigrados++;
      continue;
    }

    const contratos = contratosPorExpediente.get(socio.codigo_socio);
    if (!contratos || contratos.length === 0) {
      stats.acuerdosSinExpedienteLegacy++;
      continue;
    }

    for (const contrato of contratos) {
      let detalle: BeneficiarioDetalle[] = [];
      try {
        detalle = await obtenerBeneficiariosDetalle(contrato);
        stats.acuerdosConsultados++;
      } catch (err: any) {
        stats.errores++;
        console.error(`   Error consultando contrato ${contrato} (expediente ${socio.codigo_socio}): ${err.message}`);
        await sleep(DELAY_MS);
        continue;
      }

      for (const b of detalle) {
        if (!b.cedula) continue;
        stats.beneficiariosEncontrados++;

        try {
          const existente = await prisma.beneficiario.findUnique({ where: { cedula: b.cedula } });
          if (existente) {
            stats.beneficiariosDuplicados++;
            csvRows.push(
              [socio.codigo_socio, contrato, b.cedula, b.nombres, b.apellidos, b.parentesco, b.fecha_nac, b.status, 'duplicado']
                .map(csvEscape)
                .join(',')
            );
            continue;
          }

          const actuales = await prisma.beneficiario.count({ where: { socio_id: socio.id } });
          if (actuales >= MAX_BENEFICIARIOS_POR_SOCIO) {
            stats.beneficiariosLimiteAlcanzado++;
            csvRows.push(
              [socio.codigo_socio, contrato, b.cedula, b.nombres, b.apellidos, b.parentesco, b.fecha_nac, b.status, 'limite_alcanzado']
                .map(csvEscape)
                .join(',')
            );
            continue;
          }

          await prisma.beneficiario.create({
            data: {
              socio_id: socio.id,
              cedula: b.cedula,
              nombre: b.nombres || 'Sin nombre',
              apellido: b.apellidos || 'Sin apellido',
              fecha_nacimiento: parsearFechaDDMMYYYY(b.fecha_nac),
              parentesco: b.parentesco || 'Sin especificar',
              estado: b.status.toLowerCase().includes('fallec') ? 'fallecido' : 'activo',
            },
          });

          stats.beneficiariosInsertados++;
          csvRows.push(
            [socio.codigo_socio, contrato, b.cedula, b.nombres, b.apellidos, b.parentesco, b.fecha_nac, b.status, 'insertado']
              .map(csvEscape)
              .join(',')
          );
        } catch (err: any) {
          stats.errores++;
          csvRows.push(
            [socio.codigo_socio, contrato, b.cedula, b.nombres, b.apellidos, b.parentesco, b.fecha_nac, b.status, `error: ${err.message}`]
              .map(csvEscape)
              .join(',')
          );
        }
      }

      await sleep(DELAY_MS);
    }

    if (procesados % 100 === 0) {
      console.log(
        `Progreso: ${procesados}/${acuerdosAProcesar.length} acuerdos revisados | insertados hasta ahora: ${stats.beneficiariosInsertados}`
      );
      fs.writeFileSync(REPORT_PATH, JSON.stringify({ stats, procesados, completado: false }, null, 2));
      fs.writeFileSync(CSV_BACKUP_PATH, csvRows.join('\n'));
    }
  }

  fs.writeFileSync(CSV_BACKUP_PATH, csvRows.join('\n'));
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({ stats, procesados, completado: true, fecha: new Date().toISOString() }, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL COMPLETADO');
  console.log('='.repeat(60));
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nReporte:      ${REPORT_PATH}`);
  console.log(`Respaldo CSV: ${CSV_BACKUP_PATH}`);
}

main()
  .catch((err) => {
    console.error('\nError fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
