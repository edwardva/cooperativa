/**
 * ============================================
 * CONTROLLER: UBICACIONES/SUCURSALES
 * ============================================
 * Gestión de ubicaciones y sucursales de la cooperativa
 */

import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearUbicacionSchema = z.object({
  codigo: z.string().min(1).max(10),
  nombre: z.string().min(1).max(100),
  direccion: z.string().optional(),
  telefono: z.string().max(20).optional(),
  estado: z.boolean().default(true),
});

const actualizarUbicacionSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  direccion: z.string().optional(),
  telefono: z.string().max(20).optional(),
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
      include: {
        _count: {
          select: { socios: true },
        },
      },
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
      include: {
        _count: {
          select: { socios: true },
        },
      },
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

    const ubicacion = await prisma.ubicacion.create({
      data: validacion.data,
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

    const ubicacion = await prisma.ubicacion.update({
      where: { id: parseInt(id, 10) },
      data: validacion.data,
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
      include: {
        _count: {
          select: { socios: true },
        },
      },
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

    // Soft delete - cambiar estado a false
    await prisma.ubicacion.update({
      where: { id: parseInt(id, 10) },
      data: { estado: false },
    });

    res.status(200).json({
      success: true,
      message: 'Ubicación desactivada exitosamente',
    });
  } catch (error) {
    next(error);
  }
};
