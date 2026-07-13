/**
 * ============================================
 * CONTROLLER: PARÁMETROS DEL SISTEMA
 * ============================================
 * Gestión de configuraciones y parámetros operativos
 * de la cooperativa (tasa de cambio, semanas de suspensión, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearParametroSchema = z.object({
  clave: z.string().min(1).max(50),
  valor: z.string().min(1),
  descripcion: z.string().optional(),
  tipo_dato: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
});

const actualizarParametroSchema = z.object({
  valor: z.string().min(1),
  descripcion: z.string().optional(),
});

// ============================================
// CONTROLADORES
// ============================================

/**
 * GET /api/parametros
 * Obtener todos los parámetros del sistema
 */
export const obtenerParametros = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parametros = await prisma.parametroSistema.findMany({
      orderBy: { clave: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: parametros,
      meta: {
        total: parametros.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/parametros/:id
 * Obtener un parámetro por ID
 */
export const obtenerParametroPorId = async (
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

    const parametro = await prisma.parametroSistema.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!parametro) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Parámetro no encontrado',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: parametro,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/parametros/clave/:clave
 * Obtener un parámetro por su clave
 */
export const obtenerParametroPorClave = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { clave } = req.params;

    const parametro = await prisma.parametroSistema.findUnique({
      where: { clave },
    });

    if (!parametro) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Parámetro no encontrado',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: parametro,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/parametros
 * Crear un nuevo parámetro
 */
export const crearParametro = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = crearParametroSchema.safeParse(req.body);

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

    const parametro = await prisma.parametroSistema.create({
      data: {
        ...validacion.data,
        actualizado_por: (req as any).user?.id,
      },
    });

    res.status(201).json({
      success: true,
      data: parametro,
      message: 'Parámetro creado exitosamente',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Ya existe un parámetro con esa clave',
        },
      });
      return;
    }
    next(error);
  }
};

/**
 * PUT /api/parametros/:id
 * Actualizar un parámetro existente
 */
export const actualizarParametro = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const validacion = actualizarParametroSchema.safeParse(req.body);

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

    const parametroExistente = await prisma.parametroSistema.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!parametroExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Parámetro no encontrado',
        },
      });
      return;
    }

    const parametro = await prisma.parametroSistema.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...validacion.data,
        actualizado_por: (req as any).user?.id,
      },
    });

    res.status(200).json({
      success: true,
      data: parametro,
      message: 'Parámetro actualizado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/parametros/:id
 * Eliminar un parámetro
 */
export const eliminarParametro = async (
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

    const parametroExistente = await prisma.parametroSistema.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!parametroExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Parámetro no encontrado',
        },
      });
      return;
    }

    await prisma.parametroSistema.delete({
      where: { id: parseInt(id, 10) },
    });

    res.status(200).json({
      success: true,
      message: 'Parámetro eliminado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};
