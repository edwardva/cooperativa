/**
 * ============================================
 * CREAR USUARIO
 * ============================================
 * El sistema todavía no tiene pantalla de usuarios: este script da de alta uno
 * con el rol indicado. La clave se pasa por variable de entorno para que no
 * quede en el historial de comandos ni en el repositorio.
 *
 * Si el usuario ya existe no lo toca: no cambia su clave ni su rol.
 *
 * Uso:
 *   CLAVE='...' npx tsx prisma/crear-usuario.ts --usuario eneida --nombre "Eneida" --rol consulta
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from '../src/config';

const prisma = new PrismaClient();

const argumento = (nombre: string): string | undefined => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const usuario = argumento('usuario')?.trim();
  const nombre = argumento('nombre')?.trim();
  const rolNombre = argumento('rol')?.trim();
  const clave = process.env.CLAVE;

  if (!usuario || !nombre || !rolNombre || !clave) {
    throw new Error('Faltan datos: CLAVE=... --usuario --nombre --rol');
  }

  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  if (!rol) throw new Error(`No existe el rol "${rolNombre}"`);

  const existente = await prisma.usuario.findUnique({ where: { username: usuario } });
  if (existente) {
    console.log(`- ${usuario}: ya existe, no se modifica`);
    return;
  }

  await prisma.usuario.create({
    data: {
      username: usuario,
      nombre_completo: nombre,
      password_hash: await bcrypt.hash(clave, config.bcryptSaltRounds),
      rol_id: rol.id,
    },
  });
  console.log(`- ${usuario}: creado con el rol ${rol.nombre}`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
