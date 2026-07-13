/**
 * ============================================
 * CONTROLLER: TIPOS DE CUENTA DE AHORRO
 * ============================================
 * Gestión de tipos de cuenta de ahorro (Ejemplo: Cuenta Juvenil, Programada, etc.)
 */

import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearTipoCuentaSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(1).max(100),
  descripcion: z.string().optional(),
  estado: z.boolean().default(true),
});

const actualizarTipoCuentaSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  descripcion: z.string().optional(),
  estado: z.boolean().optional(),
});

// ============================================
// CONTROLADORES
// ============================================

/**
 * GET /api/tipos-cuenta
 * Obtener todos los tipos de cuenta
 */
export const obtenerTiposCuenta = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tiposCuenta = await prisma.tipoCuentaAhorro.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { cuentas: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: tiposCuenta,
      meta: {
        total: tiposCuenta.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tipos-cuenta/activos
 * Obtener solo tipos de cuenta activos
 */
export const obtenerTiposCuentaActivos = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tiposCuenta = await prisma.tipoCuentaAhorro.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: tiposCuenta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tipos-cuenta/:id
 * Obtener un tipo de cuenta por ID
 */
export const obtenerTipoCuentaPorId = async (
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

    const tipoCuenta = await prisma.tipoCuentaAhorro.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        _count: {
          select: { cuentas: true },
        },
      },
    });

    if (!tipoCuenta) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tipo de cuenta no encontrado',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: tipoCuenta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tipos-cuenta
 * Crear un nuevo tipo de cuenta
 */
export const crearTipoCuenta = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = crearTipoCuentaSchema.safeParse(req.body);

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

    const tipoCuenta = await prisma.tipoCuentaAhorro.create({
      data: validacion.data,
    });

    res.status(201).json({
      success: true,
      data: tipoCuenta,
      message: 'Tipo de cuenta creado exitosamente',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Ya existe un tipo de cuenta con ese código',
        },
      });
      return;
    }
    next(error);
  }
};

/**
 * PUT /api/tipos-cuenta/:id
 * Actualizar un tipo de cuenta existente
 */
export const actualizarTipoCuenta = async (
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

    const validacion = actualizarTipoCuentaSchema.safeParse(req.body);

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

    const tipoCuentaExistente = await prisma.tipoCuentaAhorro.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!tipoCuentaExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tipo de cuenta no encontrado',
        },
      });
      return;
    }

    const tipoCuenta = await prisma.tipoCuentaAhorro.update({
      where: { id: parseInt(id, 10) },
      data: validacion.data,
    });

    res.status(200).json({
      success: true,
      data: tipoCuenta,
      message: 'Tipo de cuenta actualizado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tipos-cuenta/:id
 * Desactivar un tipo de cuenta (soft delete)
 */
export const eliminarTipoCuenta = async (
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

    const tipoCuentaExistente = await prisma.tipoCuentaAhorro.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        _count: {
          select: { cuentas: true },
        },
      },
    });

    if (!tipoCuentaExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Tipo de cuenta no encontrado',
        },
      });
      return;
    }

    // Verificar que no tenga cuentas asociadas
    if (tipoCuentaExistente._count.cuentas > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'HAS_DEPENDENCIES',
          message: `No se puede eliminar el tipo de cuenta porque tiene ${tipoCuentaExistente._count.cuentas} cuentas asociadas`,
        },
      });
      return;
    }

    // Soft delete - cambiar estado a false
    await prisma.tipoCuentaAhorro.update({
      where: { id: parseInt(id, 10) },
      data: { estado: false },
    });

    res.status(200).json({
      success: true,
      message: 'Tipo de cuenta desactivado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};
