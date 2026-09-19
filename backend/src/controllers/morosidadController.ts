// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Morosidad del socio (Sprint F)
// ============================================
//
// Un solo endpoint que revisa el atraso de todos los socios y dice qué haría.
// Por defecto SIMULA: aplicar es una decisión explícita de quien lo corre, y
// queda en la auditoría. El retiro de la semana 41 no se aplica acá: se informa,
// porque hoy la cooperativa revisa esa lista a mano.

import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { registrarAuditoria } from '../services/auditoriaService';
import { revisarMorosidad, SEMANAS } from '../services/morosidadService';
import { atrasoPorSocio } from '../services/atrasoSociosService';
import { responderError } from '../utils/responderError';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { hoyDia, textoDia } from '../utils/fechaDia';

const prisma = new PrismaClient();

/** POST /api/morosidad/revisar  body: { aplicar?: boolean } */
export const revisarMorosidadSocios = async (req: Request, res: Response): Promise<void> => {
  try {
    const aplicar = req.body?.aplicar === true;

    const resultado = await prisma.$transaction(
      async (tx) => {
        const r = await revisarMorosidad(tx, { aplicar, usuarioId: req.user!.userId });
        if (aplicar) {
          await registrarAuditoria(tx, {
            req,
            accion: 'MOROSIDAD_SOCIOS',
            modulo: 'socios',
            despues: { ...r.totales, hasta: r.hasta.toISOString().slice(0, 10) },
          });
        }
        return r;
      },
      // Son miles de socios: el plazo por defecto de 5 segundos no alcanza
      { maxWait: 15_000, timeout: 180_000 }
    );

    res.json({
      success: true,
      data: resultado,
      message: aplicar
        ? `Morosidad aplicada: ${resultado.totales.suspender} suspendido(s), ${resultado.totales.reactivar} reactivado(s)`
        : 'Simulación: no se cambió nada',
    });
  } catch (error) {
    responderError(res, error, 'Error al revisar la morosidad');
  }
};

const reactivarSchema = z.object({
  socio_id: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(5, 'Escriba el motivo de la reactivación').max(500),
  /** Sólo la caja 99: levanta la suspensión antes de que se cumplan los días */
  forzar: z.boolean().optional().default(false),
});

/**
 * POST /api/morosidad/reactivar
 *
 * Levanta la suspensión de un socio a mano, con motivo. Dos reglas de la
 * cooperativa: los días de suspensión se cumplen aunque el socio pague, y en la
 * semana 41 ya no hay vuelta atrás. Adelantar el fin de la suspensión es una
 * excepción y la hace la caja 99.
 */
export const reactivarSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = reactivarSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }
    const { socio_id, motivo, forzar } = validacion.data;
    const hoy = hoyDia();

    const socio = await prisma.socio.findUnique({
      where: { id: socio_id },
      select: { id: true, codigo_socio: true, nombre: true, apellido: true, estado: true, suspendido_hasta: true },
    });
    if (!socio) throw new NotFoundError('Socio no encontrado');
    if (socio.estado !== 'suspendido') {
      throw new BadRequestError(`El socio ${socio.codigo_socio} está ${socio.estado}, no suspendido`);
    }

    const atraso = (await atrasoPorSocio(prisma)).find((a) => a.socio_id === socio_id);
    const semanas = atraso?.semanas_atraso ?? 0;
    if (semanas >= SEMANAS.retiro) {
      throw new BadRequestError(
        `El socio lleva ${semanas} semanas sin pagar: pasó la semana ${SEMANAS.retiro} y el acuerdo se pierde. No se reactiva.`
      );
    }

    const diasPendientes = socio.suspendido_hasta !== null && socio.suspendido_hasta > hoy;
    if (diasPendientes && !forzar) {
      throw new BadRequestError(
        `La suspensión corre hasta el ${textoDia(socio.suspendido_hasta!)} y los días se cumplen aunque pague. ` +
          'Adelantarlo lo hace la caja 99.'
      );
    }
    if (diasPendientes && !(await tienePermisoDeCaja99(req))) {
      throw new BadRequestError('Sólo la caja 99 puede levantar la suspensión antes de que se cumplan los días');
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const guardado = await tx.socio.update({
        where: { id: socio_id },
        data: { estado: 'activo', suspendido_desde: null, suspendido_hasta: null },
        select: { id: true, codigo_socio: true, nombre: true, apellido: true, estado: true },
      });
      await tx.historialEstadoSocio.create({
        data: {
          socio_id,
          estado_anterior: 'suspendido',
          estado_nuevo: 'activo',
          motivo: diasPendientes ? `${motivo} (se adelantó el fin de la suspensión)` : motivo,
          origen: 'manual',
          semanas_atraso: semanas,
          usuario_id: req.user!.userId,
        },
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'reactivar',
        modulo: 'socios',
        registro_id: socio_id,
        antes: { estado: 'suspendido', suspendido_hasta: socio.suspendido_hasta },
        despues: { estado: 'activo', motivo, semanas_atraso: semanas, adelantado: diasPendientes },
      });
      return guardado;
    });

    res.json({
      success: true,
      data: actualizado,
      message: `${actualizado.codigo_socio} quedó activo`,
    });
  } catch (error) {
    responderError(res, error, 'Error al reactivar el socio');
  }
};

/** GET /api/morosidad/historial?socio_id=&limit= */
export const historialMorosidad = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = req.query.socio_id ? Number(req.query.socio_id) : undefined;
    const limit = Math.min(Number(req.query.limit) || 200, 1000);

    const filas = await prisma.historialEstadoSocio.findMany({
      where: socioId ? { socio_id: socioId } : {},
      orderBy: { fecha: 'desc' },
      take: limit,
      include: {
        socio: { select: { codigo_socio: true, nombre: true, apellido: true, ubicacion: { select: { nombre: true } } } },
      },
    });

    // `historial_estado_socio` guarda el usuario por id, sin relación en el
    // esquema: se resuelven los nombres en una consulta aparte
    const ids = [...new Set(filas.map((f) => f.usuario_id).filter((id): id is number => id !== null))];
    const usuarios = ids.length
      ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, nombre_completo: true } })
      : [];
    const nombrePorUsuario = new Map(usuarios.map((u) => [u.id, u.nombre_completo || u.username]));

    res.json({
      success: true,
      data: filas.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        socio_id: f.socio_id,
        codigo_socio: f.socio.codigo_socio,
        socio: `${f.socio.apellido}, ${f.socio.nombre}`,
        feria: f.socio.ubicacion?.nombre ?? null,
        estado_anterior: f.estado_anterior,
        estado_nuevo: f.estado_nuevo,
        motivo: f.motivo,
        origen: f.origen,
        semanas_atraso: f.semanas_atraso,
        suspendido_hasta: f.suspendido_hasta,
        usuario: (f.usuario_id !== null ? nombrePorUsuario.get(f.usuario_id) : null) ?? 'Proceso automático',
      })),
      meta: { total: filas.length },
    });
  } catch (error) {
    responderError(res, error, 'Error al consultar el historial');
  }
};

/** La caja 99 es quien puede reversar días anteriores: mismo permiso */
const tienePermisoDeCaja99 = async (req: Request): Promise<boolean> => {
  const { tienePermiso } = await import('../middleware/authorize');
  return req.user ? tienePermiso(req.user.rolId, 'colecta', 'reversar_anterior') : false;
};
