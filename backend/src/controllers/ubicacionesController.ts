/**
 * ============================================
 * CONTROLLER: UBICACIONES/SUCURSALES
 * ============================================
 * Gestión de ubicaciones y sucursales de la cooperativa
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { registrarAuditoria } from '../services/auditoriaService';

/**
 * Trabajadores activos de la feria: asociación abierta y expediente activo.
 * Es el número que pide HU-05 y el que bloquea desactivar la feria.
 */
const conteos = {
  _count: {
    select: {
      socios: true,
      trabajadores: { where: { fecha_fin: null, trabajador: { estado: 'activo' as const } } },
    },
  },
};

const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearUbicacionSchema = z.object({
  codigo: z.string().trim().min(1, 'El código es obligatorio').max(10),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  ubicacion: textoOpcional(150),
  direccion: textoOpcional(1000),
  responsable: textoOpcional(100),
  telefono: textoOpcional(20),
  observaciones: textoOpcional(2000),
  estado: z.boolean().default(true),
});

// El código no se cambia: identifica a la feria en reportes e historiales
const actualizarUbicacionSchema = crearUbicacionSchema.omit({ codigo: true, estado: true }).partial().extend({
  estado: z.boolean().optional(),
});

// ============================================
// CONTROLADORES
// ============================================

/**
 * GET /api/ubicaciones
 * Obtener todas las ubicaciones
 */
export const obtenerUbicaciones = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ubicaciones = await prisma.ubicacion.findMany({
      orderBy: { nombre: 'asc' },
      include: conteos,
    });

    res.status(200).json({
      success: true,
      data: ubicaciones,
      meta: {
        total: ubicaciones.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ubicaciones/activas
 * Obtener solo ubicaciones activas
 */
export const obtenerUbicacionesActivas = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ubicaciones = await prisma.ubicacion.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: ubicaciones,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ubicaciones/:id
 * Obtener una ubicación por ID
 */
export const obtenerUbicacionPorId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID inválido',
        },
      });
      return;
    }

    const ubicacion = await prisma.ubicacion.findUnique({
      where: { id: parseInt(id, 10) },
      include: conteos,
    });

    if (!ubicacion) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ubicación no encontrada',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: ubicacion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ubicaciones
 * Crear una nueva ubicación
 */
export const crearUbicacion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = crearUbicacionSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const ubicacion = await prisma.$transaction(async (tx) => {
      const ubicacion = await tx.ubicacion.create({
        data: validacion.data,
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'CREAR',
        modulo: 'ubicaciones',
        registro_id: ubicacion.id,
        despues: ubicacion,
      });

      return ubicacion;
    });

    res.status(201).json({
      success: true,
      data: ubicacion,
      message: 'Ubicación creada exitosamente',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Ya existe una ubicación con ese código',
        },
      });
      return;
    }
    next(error);
  }
};

/**
 * PUT /api/ubicaciones/:id
 * Actualizar una ubicación existente
 */
export const actualizarUbicacion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID inválido',
        },
      });
      return;
    }

    const validacion = actualizarUbicacionSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const ubicacionExistente = await prisma.ubicacion.findUnique({
      where: { id: parseInt(id, 10) },
      include: conteos,
    });

    if (!ubicacionExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ubicación no encontrada',
        },
      });
      return;
    }

    // Desactivar con trabajadores adentro los dejaría fuera del cálculo de
    // salud sin que nadie lo decida: primero se trasladan o se retiran
    const activos = ubicacionExistente._count.trabajadores;
    if (validacion.data.estado === false && ubicacionExistente.estado && activos > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'HAS_DEPENDENCIES',
          message: `La feria ${ubicacionExistente.codigo} tiene ${activos} trabajador(es) activo(s). Trasládelos o retírelos antes de desactivarla.`,
        },
      });
      return;
    }

    const { _count: _conteo, ...antes } = ubicacionExistente;
    const ubicacion = await prisma.$transaction(async (tx) => {
      const ubicacion = await tx.ubicacion.update({
        where: { id: parseInt(id, 10) },
        data: validacion.data,
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'ACTUALIZAR',
        modulo: 'ubicaciones',
        registro_id: ubicacion.id,
        antes,
        despues: ubicacion,
      });

      return ubicacion;
    });

    res.status(200).json({
      success: true,
      data: ubicacion,
      message: 'Ubicación actualizada exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ubicaciones/:id
 * Eliminar una ubicación (soft delete - cambiar estado)
 */
export const eliminarUbicacion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID inválido',
        },
      });
      return;
    }

    const ubicacionExistente = await prisma.ubicacion.findUnique({
      where: { id: parseInt(id, 10) },
      include: conteos,
    });

    if (!ubicacionExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ubicación no encontrada',
        },
      });
      return;
    }

    // Verificar que no tenga socios asociados
    if (ubicacionExistente._count.socios > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'HAS_DEPENDENCIES',
          message: `No se puede eliminar la ubicación porque tiene ${ubicacionExistente._count.socios} socios asociados`,
        },
      });
      return;
    }

    if (ubicacionExistente._count.trabajadores > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'HAS_DEPENDENCIES',
          message: `No se puede desactivar: tiene ${ubicacionExistente._count.trabajadores} trabajador(es) activo(s)`,
        },
      });
      return;
    }

    // Soft delete - cambiar estado a false
    await prisma.$transaction(async (tx) => {
      await tx.ubicacion.update({
        where: { id: parseInt(id, 10) },
        data: { estado: false },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'DESACTIVAR',
        modulo: 'ubicaciones',
        registro_id: ubicacionExistente.id,
      });
    });

    res.status(200).json({
      success: true,
      message: 'Ubicación desactivada exitosamente',
    });
  } catch (error) {
    next(error);
  }
};
