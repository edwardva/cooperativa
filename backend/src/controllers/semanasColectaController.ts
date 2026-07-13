// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Semanas de Colecta (Gestión Tasa Semanal)
// ============================================

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN ZOD
// ============================================

const crearSemanaColectaSchema = z.object({
  semana: z.number().int().min(1).max(53),
  ano: z.number().int().min(2000).max(2100),
  tasa_usd_bs: z.number().positive(),
  meta_ahorro: z.number().nonnegative().optional(),
  meta_funeraria: z.number().nonnegative().optional(),
  meta_salud: z.number().nonnegative().optional(),
  fecha_inicio: z.string().transform((str) => new Date(str)),
  fecha_fin: z.string().transform((str) => new Date(str)),
  estado: z.boolean().optional(),
});

const actualizarSemanaColectaSchema = z.object({
  tasa_usd_bs: z.number().positive().optional(),
  meta_ahorro: z.number().nonnegative().optional(),
  meta_funeraria: z.number().nonnegative().optional(),
  meta_salud: z.number().nonnegative().optional(),
  fecha_inicio: z.string().transform((str) => new Date(str)).optional(),
  fecha_fin: z.string().transform((str) => new Date(str)).optional(),
  estado: z.boolean().optional(),
});

// ============================================
// FUNCIONES DEL CONTROLADOR
// ============================================

/**
 * Obtener todas las semanas de colecta con sus estadísticas
 */
export const obtenerSemanasColecta = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semanas = await prisma.semanaColecta.findMany({
      orderBy: [
        { ano: 'desc' },
        { semana: 'desc' }
      ],
      include: {
        _count: {
          select: {
            colectas: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: semanas,
      meta: {
        total: semanas.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener semanas activas (ordenadas por año y semana descendente)
 */
export const obtenerSemanasActivas = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semanas = await prisma.semanaColecta.findMany({
      where: {
        estado: true
      },
      orderBy: [
        { ano: 'desc' },
        { semana: 'desc' }
      ],
      include: {
        _count: {
          select: {
            colectas: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: semanas
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener semana de colecta por ID
 */
export const obtenerSemanaColectaPorId = async (
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
          message: 'ID de semana de colecta inválido'
        }
      });
      return;
    }

    const semana = await prisma.semanaColecta.findUnique({
      where: {
        id: parseInt(id, 10)
      },
      include: {
        _count: {
          select: {
            colectas: true
          }
        }
      }
    });

    if (!semana) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SEMANA_NOT_FOUND',
          message: 'Semana de colecta no encontrada'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: semana
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener semana actual (basada en la fecha actual)
 */
export const obtenerSemanaActual = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const hoy = new Date();
    
    const semana = await prisma.semanaColecta.findFirst({
      where: {
        fecha_inicio: {
          lte: hoy
        },
        fecha_fin: {
          gte: hoy
        },
        estado: true
      },
      include: {
        _count: {
          select: {
            colectas: true
          }
        }
      }
    });

    if (!semana) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SEMANA_ACTUAL_NOT_FOUND',
          message: 'No hay semana de colecta activa para la fecha actual'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: semana
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear nueva semana de colecta
 */
export const crearSemanaColecta = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = crearSemanaColectaSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data;

    // Verificar que no exista ya una semana con ese año y número de semana
    const semanaExistente = await prisma.semanaColecta.findUnique({
      where: {
        semana_ano: {
          semana: data.semana,
          ano: data.ano
        }
      }
    });

    if (semanaExistente) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SEMANA_DUPLICADA',
          message: `Ya existe una semana ${data.semana} para el año ${data.ano}`
        }
      });
      return;
    }

    const nuevaSemana = await prisma.semanaColecta.create({
      data: {
        semana: data.semana,
        ano: data.ano,
        tasa_usd_bs: data.tasa_usd_bs,
        meta_ahorro: data.meta_ahorro || 0,
        meta_funeraria: data.meta_funeraria || 0,
        meta_salud: data.meta_salud || 0,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        estado: data.estado ?? true,
      }
    });

    res.status(201).json({
      success: true,
      data: nuevaSemana
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar semana de colecta
 */
export const actualizarSemanaColecta = async (
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
          message: 'ID de semana de colecta inválido'
        }
      });
      return;
    }

    const validacion = actualizarSemanaColectaSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: validacion.error.errors
        }
      });
      return;
    }

    const data = validacion.data;

    const semanaActualizada = await prisma.semanaColecta.update({
      where: {
        id: parseInt(id, 10)
      },
      data: {
        tasa_usd_bs: data.tasa_usd_bs,
        meta_ahorro: data.meta_ahorro,
        meta_funeraria: data.meta_funeraria,
        meta_salud: data.meta_salud,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        estado: data.estado,
      }
    });

    res.json({
      success: true,
      data: semanaActualizada
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar (soft delete) semana de colecta
 */
export const eliminarSemanaColecta = async (
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
          message: 'ID de semana de colecta inválido'
        }
      });
      return;
    }

    // Verificar que la semana exista
    const semana = await prisma.semanaColecta.findUnique({
      where: {
        id: parseInt(id, 10)
      },
      include: {
        _count: {
          select: {
            colectas: true
          }
        }
      }
    });

    if (!semana) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SEMANA_NOT_FOUND',
          message: 'Semana de colecta no encontrada'
        }
      });
      return;
    }

    // Verificar que no tenga colectas asociadas
    if (semana._count.colectas > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SEMANA_CON_COLECTAS',
          message: `No se puede eliminar la semana porque tiene ${semana._count.colectas} colectas asociadas`
        }
      });
      return;
    }

    // Soft delete (cambiar estado a inactivo)
    const semanaEliminada = await prisma.semanaColecta.update({
      where: {
        id: parseInt(id, 10)
      },
      data: {
        estado: false
      }
    });

    res.json({
      success: true,
      data: semanaEliminada,
      message: 'Semana de colecta eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};
