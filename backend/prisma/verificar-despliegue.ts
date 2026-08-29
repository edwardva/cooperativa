/**
 * ============================================
 * VERIFICADOR DE DESPLIEGUE
 * ============================================
 * Se corre EN EL SERVIDOR despues de desplegar. Revisa las cuatro cosas que
 * hacen fallar los modulos aunque el codigo este bien subido:
 *
 *   1. Migraciones aplicadas (tablas y columnas que el codigo espera)
 *   2. Permisos de los roles (el middleware devuelve 403 sin ellos)
 *   3. GRANTs de PostgreSQL (el rol de la app debe poder leer las tablas nuevas)
 *   4. Parametros minimos (sin tasa no se puede cobrar)
 *
 * Solo LEE. No modifica nada.
 *
 * Uso:  npx tsx prisma/verificar-despliegue.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ok = (t: string) => console.log(`  \x1b[32mOK\x1b[0m    ${t}`);
const mal = (t: string) => console.log(`  \x1b[31mFALLA\x1b[0m ${t}`);
const aviso = (t: string) => console.log(`  \x1b[33mAVISO\x1b[0m ${t}`);

let fallas = 0;

/** Tablas y columnas que el codigo actual necesita si o si. */
const REQUERIDO: { tabla: string; columnas: string[]; para: string }[] = [
  { tabla: 'asambleas', columnas: ['id', 'titulo', 'ano'], para: 'modulo Asambleas' },
  { tabla: 'asistencias_asamblea', columnas: ['asamblea_id', 'socio_id'], para: 'asistencia y reporte anual' },
  { tabla: 'colecta', columnas: ['semanas_cobradas', 'semana_cobro', 'ano_cobro', 'referencia'], para: 'registrar colecta' },
  { tabla: 'colecta', columnas: ['reversada', 'fecha_reverso', 'motivo_reverso'], para: 'reverso y cierre de caja' },
  { tabla: 'socios', columnas: ['codigo_social'], para: 'dashboard y ficha de socio' },
  { tabla: 'acuerdos_funeraria', columnas: ['numero_acuerdo', 'fecha_retiro'], para: 'modulo Funeraria' },
  { tabla: 'prestamos', columnas: ['numero_prestamo', 'cuota_semanal_usd'], para: 'modulo Prestamos' },
  { tabla: 'plan_pagos', columnas: ['numero_cuota', 'monto_total_usd'], para: 'plan de pagos' },
];

/** Modulos que exigen las rutas del backend. */
const MODULOS = ['socios', 'ahorro', 'funeraria', 'salud', 'prestamos', 'colecta',
  'asambleas', 'semanas_colecta', 'tipos_cuenta', 'tipos_prestamo', 'ubicaciones',
  'impresion', 'reportes', 'parametros'];

async function main() {
  console.log('\n============================================');
  console.log(' VERIFICACION DE DESPLIEGUE');
  console.log('============================================\n');

  // ---------- 1. ESQUEMA ----------
  console.log('1. ESQUEMA (migraciones aplicadas)\n');
  for (const req of REQUERIDO) {
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      req.tabla
    );

    if (cols.length === 0) {
      mal(`falta la tabla "${req.tabla}"  (${req.para})`);
      fallas++;
      continue;
    }

    const presentes = new Set(cols.map((c) => c.column_name));
    const faltan = req.columnas.filter((c) => !presentes.has(c));
    if (faltan.length > 0) {
      mal(`"${req.tabla}" sin columnas: ${faltan.join(', ')}  (${req.para})`);
      fallas++;
    } else {
      ok(`${req.tabla}: ${req.columnas.join(', ')}`);
    }
  }

  const migraciones = await prisma.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null }[]>(
    `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5`
  ).catch(() => []);
  console.log(`\n  Ultimas migraciones aplicadas:`);
  if (migraciones.length === 0) console.log('    (ninguna registrada)');
  migraciones.forEach((m) => console.log(`    ${m.migration_name}`));

  // ---------- 2. PERMISOS ----------
  console.log('\n2. PERMISOS DE ROLES\n');
  const roles = await prisma.rol.findMany({ select: { nombre: true, permisos: true } });
  for (const rol of roles) {
    const tiene = Object.keys((rol.permisos ?? {}) as Record<string, string[]>);
    const faltan = MODULOS.filter((m) => !tiene.includes(m));
    if (rol.nombre === 'admin' && faltan.length > 0) {
      mal(`admin sin permisos de: ${faltan.join(', ')}  -> esas pantallas dan 403`);
      fallas++;
    } else if (faltan.length > 0) {
      aviso(`${rol.nombre} sin: ${faltan.join(', ')}`);
    } else {
      ok(`${rol.nombre}: todos los modulos`);
    }
  }
  if (roles.some((r) => !((r.permisos ?? {}) as any).colecta)) {
    mal('NINGUN rol tiene permiso "colecta" -> el modulo responde 403 completo');
    fallas++;
  }

  // ---------- 3. GRANTS DE POSTGRES ----------
  console.log('\n3. PERMISOS DE POSTGRESQL\n');
  const usuario = await prisma.$queryRawUnsafe<{ current_user: string }[]>(`SELECT current_user`);
  const rolApp = usuario[0]!.current_user;
  console.log(`  La app se conecta como: ${rolApp}\n`);

  const tablasClave = ['colecta', 'detalle_colecta', 'asambleas', 'asistencias_asamblea',
    'prestamos', 'plan_pagos', 'abonos_prestamo', 'cierre_caja'];
  for (const t of tablasClave) {
    const existe = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, t
    );
    if (Number(existe[0]!.n) === 0) { mal(`tabla "${t}" no existe`); fallas++; continue; }

    const puede = await prisma.$queryRawUnsafe<{ s: boolean; i: boolean }[]>(
      `SELECT has_table_privilege($1, 'public.' || $2, 'SELECT') AS s,
              has_table_privilege($1, 'public.' || $2, 'INSERT') AS i`, rolApp, t
    );
    if (puede[0]!.s && puede[0]!.i) ok(`${t}: lectura y escritura`);
    else { mal(`${t}: sin permisos (SELECT=${puede[0]!.s}, INSERT=${puede[0]!.i}) -> error 42501`); fallas++; }
  }

  // ---------- 4. PARAMETROS ----------
  console.log('\n4. PARAMETROS MINIMOS\n');
  const tasa = await prisma.parametroSistema.findUnique({ where: { clave: 'TASA_CAMBIO_USD_BS' } });
  if (tasa && Number(tasa.valor) > 0) ok(`TASA_CAMBIO_USD_BS = ${tasa.valor}`);
  else { mal('sin TASA_CAMBIO_USD_BS -> la colecta no puede cobrar'); fallas++; }

  const tipos = await prisma.tipoCuentaAhorro.count();
  const tiposFun = await prisma.tipoAcuerdoFuneraria.count();
  console.log(`  tipos de cuenta: ${tipos} | tipos de acuerdo funeraria: ${tiposFun}`);

  // ---------- RESUMEN ----------
  console.log('\n============================================');
  if (fallas === 0) {
    console.log(' \x1b[32mTodo en orden.\x1b[0m El despliegue esta completo.');
  } else {
    console.log(` \x1b[31m${fallas} problema(s).\x1b[0m Ver los pasos de correccion:`);
    console.log('');
    console.log('   Migraciones:  npx prisma migrate deploy   (como el dueno de las tablas)');
    console.log('   Permisos:     npx tsx prisma/sincronizar-permisos.ts --aplicar');
    console.log('   GRANTs:       ver docs/DESPLIEGUE.md, seccion PostgreSQL');
    console.log('   Reiniciar el backend despues (el cache de permisos dura 5 minutos)');
  }
  console.log('============================================\n');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
