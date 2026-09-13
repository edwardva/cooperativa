// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Consulta de auditoría (FE-025, RF-SEG-03)
// ============================================
//
// Sólo lectura. Todo lo que escribe `registrarAuditoria` se consulta aquí por
// usuario, fecha, módulo y acción, con los valores anteriores y nuevos.

import type { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError } from '../middleware/errorHandler';
import { fechaDia } from '../utils/fechaDia';
import { responderError } from '../utils/responderError';

const prisma = new PrismaClient();

/** GET /api/auditoria?usuario=&modulo=&accion=&registro_id=&desde=&hasta=&page=&limit= */
export const listarAuditoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query;
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
    const where: Prisma.AuditLogWhereInput = {};
    const insensible = Prisma.QueryMode.insensitive;

    if (q.modulo) where.modulo = String(q.modulo);
    if (q.accion) where.accion = String(q.accion);
    if (q.registro_id) {
      const id = Number(q.registro_id);
      if (!Number.isInteger(id)) throw new BadRequestError('El registro debe ser un número');
      where.registro_id = id;
    }
    if (q.usuario) {
      const texto = String(q.usuario).trim();
      where.usuario = {
        OR: [
          { username: { contains: texto, mode: insensible } },
          { nombre_completo: { contains: texto, mode: insensible } },
        ],
      };
    }
    if (q.desde || q.hasta) {
      // Días locales: la auditoría guarda marcas de tiempo, no fechas
      if (q.desde) fechaDia(String(q.desde), 'Desde');
      if (q.hasta) fechaDia(String(q.hasta), 'Hasta');
      where.created_at = {
        ...(q.desde ? { gte: new Date(`${String(q.desde)}T00:00:00`) } : {}),
        ...(q.hasta ? { lte: new Date(`${String(q.hasta)}T23:59:59.999`) } : {}),
      };
    }

    const [total, registros] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { usuario: { select: { id: true, username: true, nombre_completo: true } } },
      }),
    ]);

    res.json({ success: true, data: registros, meta: { total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    responderError(res, error, 'Error al consultar la auditoría');
  }
};

/** GET /api/auditoria/opciones — módulos y acciones que existen, para los filtros */
export const opcionesAuditoria = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [modulos, acciones] = await Promise.all([
      prisma.auditLog.findMany({ distinct: ['modulo'], select: { modulo: true }, orderBy: { modulo: 'asc' } }),
      prisma.auditLog.findMany({ distinct: ['accion'], select: { accion: true }, orderBy: { accion: 'asc' } }),
    ]);
    res.json({ success: true, data: { modulos: modulos.map((m) => m.modulo), acciones: acciones.map((a) => a.accion) } });
  } catch (error) {
    responderError(res, error, 'Error al leer las opciones de auditoría');
  }
};
