/**
 * ============================================
 * CONTROLLER: TIPOS DE PRÉSTAMO
 * ============================================
 * Gestión de tipos de préstamo con tasas, plazos y requisitos
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearTipoPrestamoSchema = z.object({
  codigo: z.string().min(1).max(10),
  nombre: z.string().min(1).max(100),
  descripcion: z.string().optional(),
  tasa_interes_anual: z.number().min(0).max(100), // 0% a 100%
  tasa_mora_mensual: z.number().min(0).max(50).default(2.00), // 0% a 50%, default 2%
  plazo_maximo_semanas: z.number().int().min(1).max(260).default(52), // 1 semana a 5 años
  requiere_fiadores: z.boolean().default(true),
  estado: z.boolean().default(true),
});

const actualizarTipoPrestamoSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  descripcion: z.string().optional(),
  tasa_interes_anual: z.number().min(0).max(100).optional(),
  tasa_mora_mensual: z.number().min(0).max(50).optional(),
  plazo_maximo_semanas: z.number().int().min(1).max(260).optional(),
  requiere_fiadores: z.boolean().optional(),
  estado: z.boolean().optional(),
});

// ============================================
// CONTROLADORES
// ============================================

/**
 * GET /api/tipos-prestamo
 * Obtener todos los tipos de préstamo
 */
export const obtenerTiposPrestamo = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tiposPrestamo = await prisma.tipoPrestamo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { prestamos: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: tiposPrestamo,
      meta: {
        total: tiposPrestamo.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tipos-prestamo/activos
 * Obtener solo tipos de préstamo activos
 */
export const obtenerTiposPrestamoActivos = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tiposPrestamo = await prisma.tipoPrestamo.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: tiposPrestamo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tipos-prestamo/:id
 * Obtener un tipo de préstamo por ID
 */
export const obtenerTipoPrestamoPorId = async (
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

    const tipoPrestamo = await prisma.tipoPrestamo.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        _count: {
          select: { prestamos: true },
        },
      },
    });

    if (!tipoPrestamo) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tipo de préstamo no encontrado',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: tipoPrestamo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tipos-prestamo
 * Crear un nuevo tipo de préstamo
 */
export const crearTipoPrestamo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = crearTipoPrestamoSchema.safeParse(req.body);

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

    const tipoPrestamo = await prisma.tipoPrestamo.create({
      data: validacion.data,
    });

    res.status(201).json({
      success: true,
      data: tipoPrestamo,
      message: 'Tipo de préstamo creado exitosamente',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Ya existe un tipo de préstamo con ese código',
        },
      });
      return;
    }
    next(error);
  }
};

/**
 * PUT /api/tipos-prestamo/:id
 * Actualizar un tipo de préstamo existente
 */
export const actualizarTipoPrestamo = async (
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

    const validacion = actualizarTipoPrestamoSchema.safeParse(req.body);

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

    const tipoPrestamoExistente = await prisma.tipoPrestamo.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!tipoPrestamoExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tipo de préstamo no encontrado',
        },
      });
      return;
    }

    const tipoPrestamo = await prisma.tipoPrestamo.update({
      where: { id: parseInt(id, 10) },
      data: validacion.data,
    });

    res.status(200).json({
      success: true,
      data: tipoPrestamo,
      message: 'Tipo de préstamo actualizado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tipos-prestamo/:id
 * Desactivar un tipo de préstamo (soft delete)
 */
export const eliminarTipoPrestamo = async (
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

    const tipoPrestamoExistente = await prisma.tipoPrestamo.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        _count: {
          select: { prestamos: true },
        },
      },
    });

    if (!tipoPrestamoExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tipo de préstamo no encontrado',
        },
      });
      return;
    }

    // Verificar que no tenga préstamos asociados
    if (tipoPrestamoExistente._count.prestamos > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'HAS_DEPENDENCIES',
          message: `No se puede eliminar el tipo de préstamo porque tiene ${tipoPrestamoExistente._count.prestamos} préstamos asociados`,
        },
      });
      return;
    }

    // Soft delete - cambiar estado a false
    await prisma.tipoPrestamo.update({
      where: { id: parseInt(id, 10) },
      data: { estado: false },
    });

    res.status(200).json({
      success: true,
      message: 'Tipo de préstamo desactivado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};
