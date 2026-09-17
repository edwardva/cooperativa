/**
 * ============================================
 * SINCRONIZAR PERMISOS DE ROLES
 * ============================================
 * Agrega a los roles YA EXISTENTES en la base los modulos de permisos que se
 * fueron sumando al sistema, sin tocar nada mas.
 *
 * Por que existe: `prisma/seed.ts` ademas de los roles crea socios, cuentas,
 * prestamos y acuerdos de PRUEBA con .create(). Correrlo sobre la base real
 * inyectaria datos ficticios entre los registros de produccion. Este script
 * solo toca la columna `permisos` de la tabla `roles`.
 *
 * Es idempotente: correrlo dos veces no cambia nada la segunda vez.
 *
 * Uso:
 *   npx tsx prisma/sincronizar-permisos.ts            (muestra que haria)
 *   npx tsx prisma/sincronizar-permisos.ts --aplicar  (lo aplica)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Permisos que debe tener cada rol por modulo. Solo se AGREGA lo que falte. */
const TODO = ['create', 'read', 'update', 'delete'];

/**
 * Permisos que debe tener cada rol por modulo. Solo se AGREGA lo que falte.
 *
 * La lista cubre TODOS los modulos que exigen las rutas del backend
 * (`grep -rho "authorize('[a-z_]*'" src/routes/`). Faltaba varios: admin no
 * tenia semanas_colecta, funeraria, impresion, tipos_cuenta ni tipos_prestamo,
 * asi que esas pantallas respondian 403 aunque el usuario fuera administrador.
 */
const PERMISOS_POR_ROL: Record<string, Record<string, string[]>> = {
  admin: {
    socios: TODO,
    ahorro: TODO,
    funeraria: TODO,
    salud: TODO,
    // La caja 99: única que reversa movimientos de días anteriores
    prestamos: [...TODO, 'approve', 'reversar_anterior'],
    colecta: [...TODO, 'reversar_anterior'],
    asambleas: TODO,
    semanas_colecta: TODO,
    tipos_cuenta: TODO,
    tipos_prestamo: TODO,
    ubicaciones: TODO,
    personas: TODO,
    trabajadores: TODO,
    salud_feria: TODO,
    auditoria: ['read'],
    impresion: ['create', 'read'],
    reportes: ['read', 'export'],
    parametros: ['read', 'update'],
    usuarios: TODO,
  },
  cajero: {
    socios: ['read'],
    // Los cajeros cobran y reversan abonos y colectas del día (confirmado)
    prestamos: ['read', 'update', 'delete'],
    ahorro: ['create', 'read'],
    funeraria: ['create', 'read', 'update'],
    salud: ['create', 'read', 'update'],
    colecta: ['create', 'read', 'delete'],
    asambleas: ['create', 'read'],
    semanas_colecta: ['read'],
    tipos_cuenta: ['read'],
    ubicaciones: ['read'],
    personas: ['read'],
    trabajadores: ['read'],
    salud_feria: ['create', 'read'],
    impresion: ['create', 'read'],
    reportes: ['read'],
  },
  analista: {
    socios: ['create', 'read', 'update'],
    ahorro: ['read'],
    funeraria: ['read'],
    salud: ['read'],
    prestamos: ['create', 'read', 'update'],
    colecta: ['read'],
    asambleas: ['read'],
    semanas_colecta: ['read'],
    tipos_cuenta: ['read'],
    tipos_prestamo: ['read'],
    ubicaciones: ['read'],
    personas: ['create', 'read', 'update'],
    trabajadores: ['create', 'read', 'update'],
    salud_feria: ['read'],
    reportes: ['read', 'export'],
  },
  supervisor: {
    socios: ['create', 'read', 'update'],
    ahorro: ['create', 'read', 'update'],
    funeraria: ['create', 'read', 'update'],
    salud: ['create', 'read', 'update'],
    colecta: TODO,
    asambleas: ['create', 'read', 'update'],
    semanas_colecta: ['create', 'read', 'update'],
    tipos_cuenta: ['read'],
    ubicaciones: ['read'],
    personas: ['create', 'read', 'update'],
    trabajadores: ['create', 'read', 'update'],
    salud_feria: ['create', 'read'],
    impresion: ['create', 'read'],
    reportes: ['read', 'export'],
  },
};

async function main() {
  const aplicar = process.argv.includes('--aplicar');

  const roles = await prisma.rol.findMany({ select: { id: true, nombre: true, permisos: true } });
  console.log(`Roles en la base: ${roles.map((r) => r.nombre).join(', ')}\n`);

  let cambios = 0;

  for (const rol of roles) {
    const deseados = PERMISOS_POR_ROL[rol.nombre];
    if (!deseados) {
      console.log(`- ${rol.nombre}: sin reglas definidas, se omite`);
      continue;
    }

    const actuales = (rol.permisos ?? {}) as Record<string, string[]>;
    const nuevos: Record<string, string[]> = { ...actuales };
    const agregados: string[] = [];

    for (const [modulo, acciones] of Object.entries(deseados)) {
      const yaTiene = new Set(actuales[modulo] ?? []);
      const faltantes = acciones.filter((a) => !yaTiene.has(a));
      if (faltantes.length > 0) {
        nuevos[modulo] = [...new Set([...(actuales[modulo] ?? []), ...acciones])];
        agregados.push(`${modulo}: +[${faltantes.join(', ')}]`);
      }
    }

    if (agregados.length === 0) {
      console.log(`- ${rol.nombre}: ya esta al dia`);
      continue;
    }

    cambios++;
    console.log(`- ${rol.nombre}: ${agregados.join('  ')}`);

    if (aplicar) {
      await prisma.rol.update({ where: { id: rol.id }, data: { permisos: nuevos } });
    }
  }

  console.log();
  if (cambios === 0) {
    console.log('Nada que hacer: todos los roles tienen los permisos.');
  } else if (aplicar) {
    console.log(`Aplicado sobre ${cambios} rol(es).`);
    console.log('IMPORTANTE: el middleware cachea permisos 5 minutos. Reinicie el backend');
    console.log('o espere ese lapso para que los usuarios vean el cambio.');
  } else {
    console.log(`${cambios} rol(es) por actualizar. Vuelva a correr con --aplicar para hacerlo.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
