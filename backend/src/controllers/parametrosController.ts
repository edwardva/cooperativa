/**
 * ============================================
 * CONTROLLER: PARÁMETROS DEL SISTEMA
 * ============================================
 * Gestión de configuraciones y parámetros operativos
 * de la cooperativa (tasa de cambio, semanas de suspensión, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { consultarTasaBcv, sincronizarTasa } from '../services/tasaCambioService';
import { logger } from '../utils/logger';

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

// ============================================
// TASA DE CAMBIO BCV
// ============================================

/**
 * GET /api/parametros/tasa
 *
 * Tasa vigente en el sistema más lo que reportan las fuentes ahora mismo, para
 * que se vea de un vistazo si está desactualizada.
 */
export const obtenerEstadoTasa = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [parametro, historico, enVivo] = await Promise.all([
      prisma.parametroSistema.findUnique({ where: { clave: 'TASA_CAMBIO_USD_BS' } }),
      prisma.historicoTasaCambio.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { tasa: true, fecha_vigencia: true, created_at: true },
      }),
      consultarTasaBcv(),
    ]);

    const vigente = parametro ? Number(parametro.valor) : null;
    const diferencia =
      vigente && enVivo ? Math.round(Math.abs((enVivo.tasa - vigente) / vigente) * 1000) / 10 : null;

    res.json({
      success: true,
      data: {
        vigente,
        actualizada_el: parametro?.updated_at ?? null,
        en_vivo: enVivo,
        // Si la fuente trae otro valor, conviene sincronizar
        desactualizada: Boolean(enVivo && vigente && enVivo.tasa !== vigente),
        diferencia_porcentaje: diferencia,
        historico,
      },
    });
  } catch (error) {
    logger.error('Error al obtener el estado de la tasa:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al obtener el estado de la tasa' },
    });
  }
};

/**
 * POST /api/parametros/tasa/sincronizar
 *
 * Fuerza la sincronización. Con `forzar: true` se salta la salvaguarda de
 * variación máxima, para cuando el BCV realmente pegó un salto grande y alguien
 * lo confirma a mano.
 */
export const sincronizarTasaBcv = async (req: Request, res: Response): Promise<void> => {
  try {
    const forzar = req.body?.forzar === true;
    const resultado = await sincronizarTasa(req.user?.userId, forzar);

    // Que no se haya aplicado no es un error: puede ser que no cambió o que la
    // salvaguarda la frenó. El motivo viene en la respuesta.
    res.json({ success: true, data: resultado });
  } catch (error) {
    logger.error('Error al sincronizar la tasa:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al sincronizar la tasa' },
    });
  }
};
