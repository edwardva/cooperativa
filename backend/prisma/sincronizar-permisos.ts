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
import { PERMISOS_POR_ROL } from './permisos';

const prisma = new PrismaClient();

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
