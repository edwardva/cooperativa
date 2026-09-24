// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLADOR
// Usuarios del sistema
// ============================================
//
// Hasta ahora los usuarios se creaban por consola con `prisma/crear-usuario.ts`,
// así que la cooperativa dependía de nosotros para dar de alta un cajero o
// cambiarle la clave a alguien. Esto es lo mismo, desde la pantalla.
//
// Reglas: la clave nunca se devuelve ni se puede leer; se guarda cifrada y, si
// alguien la olvida, se restablece. Nadie puede cambiarse su propio rol ni
// desactivarse a sí mismo, para que no quede el sistema sin administrador.

import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { config } from '../config';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';

/** Lo que se devuelve de un usuario: nunca el hash de la clave */
const CAMPOS = {
  id: true,
  username: true,
  nombre_completo: true,
  email: true,
  estado: true,
  ultimo_acceso: true,
  created_at: true,
  rol: { select: { id: true, nombre: true, descripcion: true } },
} satisfies Prisma.UsuarioSelect;

const CLAVE_MINIMA = 8;

const vacioANulo = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const crearUsuarioSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'El usuario solo admite letras, números, punto, guion y guion bajo'),
  nombre_completo: z.string().trim().min(3, 'El nombre es obligatorio').max(150),
  email: z.preprocess(vacioANulo, z.string().email('El correo no es válido').max(100).nullable().optional()),
  rol_id: z.coerce.number().int().positive(),
  password: z.string().min(CLAVE_MINIMA, `La clave debe tener al menos ${CLAVE_MINIMA} caracteres`),
});

const actualizarUsuarioSchema = z.object({
  nombre_completo: z.string().trim().min(3).max(150).optional(),
  email: z.preprocess(vacioANulo, z.string().email('El correo no es válido').max(100).nullable().optional()),
  rol_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
});

const claveSchema = z.object({
  password: z.string().min(CLAVE_MINIMA, `La clave debe tener al menos ${CLAVE_MINIMA} caracteres`),
});

const datosInvalidos = (res: Response, error: z.ZodError): void => {
  res.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: error.errors },
  });
};

/** GET /api/usuarios */
export const listarUsuarios = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuarios = await prisma.usuario.findMany({ select: CAMPOS, orderBy: { username: 'asc' } });
    res.json({ success: true, data: usuarios, meta: { total: usuarios.length } });
  } catch (error) {
    next(error);
  }
};

/** GET /api/usuarios/roles — para el selector de la pantalla */
export const listarRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.rol.findMany({
      select: { id: true, nombre: true, descripcion: true, permisos: true, _count: { select: { usuarios: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json({
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        usuarios: r._count.usuarios,
        modulos: Object.keys((r.permisos ?? {}) as Record<string, unknown>).sort(),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/usuarios */
export const crearUsuario = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validacion = crearUsuarioSchema.safeParse(req.body);
    if (!validacion.success) return datosInvalidos(res, validacion.error);
    const datos = validacion.data;
    const username = datos.username.toLowerCase();

    const rol = await prisma.rol.findUnique({ where: { id: datos.rol_id } });
    if (!rol) throw new NotFoundError('El rol indicado no existe');

    const repetido = await prisma.usuario.findUnique({ where: { username } });
    if (repetido) throw new ConflictError(`Ya existe el usuario "${username}"`);

    const usuario = await prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: {
          username,
          nombre_completo: datos.nombre_completo,
          email: datos.email ?? null,
          password_hash: await bcrypt.hash(datos.password, config.bcryptSaltRounds),
          rol_id: datos.rol_id,
        },
        select: CAMPOS,
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'crear',
        modulo: 'usuarios',
        registro_id: creado.id,
        despues: { username: creado.username, nombre_completo: creado.nombre_completo, rol: rol.nombre },
      });
      return creado;
    });

    res.status(201).json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/usuarios/:id */
export const actualizarUsuario = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const validacion = actualizarUsuarioSchema.safeParse(req.body);
    if (!validacion.success) return datosInvalidos(res, validacion.error);
    const datos = validacion.data;

    const actual = await prisma.usuario.findUnique({ where: { id }, select: CAMPOS });
    if (!actual) throw new NotFoundError('Usuario no encontrado');

    const esUnoMismo = req.user?.userId === id;
    if (esUnoMismo && datos.rol_id && datos.rol_id !== actual.rol.id) {
      throw new BadRequestError('No puede cambiarse su propio rol: pídaselo a otro administrador');
    }
    if (esUnoMismo && datos.estado === 'inactivo') {
      throw new BadRequestError('No puede desactivar su propio usuario');
    }

    if (datos.rol_id) {
      const rol = await prisma.rol.findUnique({ where: { id: datos.rol_id } });
      if (!rol) throw new NotFoundError('El rol indicado no existe');
      // El último administrador activo no puede quedarse sin el rol
      if (actual.rol.nombre === 'admin' && rol.nombre !== 'admin') await exigirOtroAdmin(id);
    }
    if (datos.estado === 'inactivo' && actual.rol.nombre === 'admin') await exigirOtroAdmin(id);

    const usuario = await prisma.$transaction(async (tx) => {
      const guardado = await tx.usuario.update({
        where: { id },
        data: {
          ...(datos.nombre_completo !== undefined ? { nombre_completo: datos.nombre_completo } : {}),
          ...(datos.email !== undefined ? { email: datos.email ?? null } : {}),
          ...(datos.rol_id !== undefined ? { rol_id: datos.rol_id } : {}),
          ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
        },
        select: CAMPOS,
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'actualizar',
        modulo: 'usuarios',
        registro_id: id,
        antes: { nombre_completo: actual.nombre_completo, email: actual.email, rol: actual.rol.nombre, estado: actual.estado },
        despues: { nombre_completo: guardado.nombre_completo, email: guardado.email, rol: guardado.rol.nombre, estado: guardado.estado },
      });
      return guardado;
    });

    res.json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

/** POST /api/usuarios/:id/clave — restablecer la clave de otro usuario */
export const restablecerClave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const validacion = claveSchema.safeParse(req.body);
    if (!validacion.success) return datosInvalidos(res, validacion.error);

    const usuario = await prisma.usuario.findUnique({ where: { id }, select: { id: true, username: true } });
    if (!usuario) throw new NotFoundError('Usuario no encontrado');

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: { password_hash: await bcrypt.hash(validacion.data.password, config.bcryptSaltRounds) },
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'restablecer_clave',
        modulo: 'usuarios',
        registro_id: id,
        despues: { username: usuario.username },
      });
    });

    res.json({ success: true, data: { message: `Clave restablecida para ${usuario.username}` } });
  } catch (error) {
    next(error);
  }
};

/** Impide dejar el sistema sin ningún administrador activo */
const exigirOtroAdmin = async (excepto: number): Promise<void> => {
  const otros = await prisma.usuario.count({
    where: { id: { not: excepto }, estado: 'activo', rol: { nombre: 'admin' } },
  });
  if (otros === 0) {
    throw new BadRequestError('Es el único administrador activo: primero déle ese rol a otro usuario');
  }
};
