// @ts-nocheck
/**
 * ============================================
 * CONTROLLER: FUNERARIA
 * ============================================
 * Gestión de acuerdos de funeraria
 * - CRUD de acuerdos
 * - Suspensión automática (6 semanas sin pago)
 * - Estadísticas y consultas
 */

import type { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearAcuerdoSchema = z.object({
  socio_id: z.number().int().positive(),
  tipo_acuerdo_id: z.number().int().positive(),
  beneficiario_id: z.number().int().positive().optional(),
  fecha_inicio: z.string().datetime().optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(['activo', 'suspendido', 'retirado']),
  motivo: z.string().max(500).optional(),
});

const listarAcuerdosSchema = z.object({
  estado: z.enum(['activo', 'suspendido', 'retirado']).optional(),
  tipo_acuerdo_id: z.number().int().positive().optional(),
  buscar: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(50),
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtener o crear beneficiario para un socio
 */
async function obtenerOCrearBeneficiario(socioId: number): Promise<number> {
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    throw new Error('Socio no encontrado');
  }

  // Buscar beneficiario existente con la cédula del socio
  let beneficiario = await prisma.beneficiario.findUnique({
    where: { cedula: socio.cedula },
  });

  if (beneficiario) {
    return beneficiario.id;
  }

  // Crear beneficiario (el socio es el beneficiario titular)
  const nombrePartes = socio.nombre.trim().split(/\s+/);
  const apellidoPartes = socio.apellido.trim().split(/\s+/);

  beneficiario = await prisma.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: socio.cedula,
      nombre: (nombrePartes[0] || 'Sin Nombre').substring(0, 100),
      apellido: apellidoPartes.join(' ').substring(0, 100),
      parentesco: 'titular',
      estado: 'activo',
    },
  });

  return beneficiario.id;
}

/**
 * Verificar semanas sin pago y actualizar estado
 * (No se usa actualmente, pero preparada para cuando se implemente MovimientoFuneraria)
 */
// @ts-ignore - Preparada para uso futuro
async function verificarSuspensionAutomatica(acuerdoId: number): Promise<void> {
  const acuerdo = await prisma.acuerdoFuneraria.findUnique({
    where: { id: acuerdoId },
    include: {
      beneficiario: {
        include: { socio: true },
      },
    },
  });

  if (!acuerdo || acuerdo.estado !== 'activo') {
    return;
  }

  // REGLA: Suspensión automática a las 6 semanas sin pago
  const SEMANAS_LIMITE = 6;

  if (acuerdo.semanas_sin_pago >= SEMANAS_LIMITE) {
    await prisma.acuerdoFuneraria.update({
      where: { id: acuerdoId },
      data: {
        estado: 'suspendido',
        fecha_suspension: new Date(),
      },
    });

    logger.info(`Acuerdo funeraria ${acuerdoId} suspendido automáticamente (${acuerdo.semanas_sin_pago} semanas sin pago)`);
  }
}

// ============================================
// ENDPOINTS: ACUERDOS DE FUNERARIA
// ============================================

/**
 * GET /api/funeraria/acuerdos
 * Listar todos los acuerdos con filtros y paginación
 */
export const listarAcuerdos = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = listarAcuerdosSchema.parse({
      estado: req.query.estado,
      tipo_acuerdo_id: req.query.tipo_acuerdo_id ? parseInt(req.query.tipo_acuerdo_id as string) : undefined,
      buscar: req.query.buscar,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    // Construir filtros WHERE
    const where: Prisma.AcuerdoFunerariaWhereInput = {};

    if (params.estado) {
      where.estado = params.estado;
    }

    if (params.tipo_acuerdo_id) {
      where.tipo_acuerdo_id = params.tipo_acuerdo_id;
    }

    // Búsqueda por nombre/cédula del socio
    if (params.buscar) {
      where.beneficiario = {
        OR: [
          { nombre: { contains: params.buscar, mode: 'insensitive' } },
          { apellido: { contains: params.buscar, mode: 'insensitive' } },
          { cedula: { contains: params.buscar } },
        ],
      };
    }

    // Paginación
    const skip = (params.page - 1) * params.limit;

    // Ejecutar consultas en paralelo
    const [acuerdos, total] = await Promise.all([
      prisma.acuerdoFuneraria.findMany({
        where,
        skip,
        take: params.limit,
        include: {
          beneficiario: {
            include: {
              socio: {
                select: {
                  id: true,
                  cedula: true,
                  nombre: true,
                  apellido: true,
                  codigo_socio: true,
                  estado: true,
                },
              },
            },
          },
          tipo_acuerdo: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              monto_usd: true,
            },
          },
        },
        orderBy: [
          { estado: 'asc' },
          { fecha_inicio: 'desc' },
        ],
      }),
      prisma.acuerdoFuneraria.count({ where }),
    ]);

    // Formatear respuesta
    const acuerdosFormateados = acuerdos.map((acuerdo) => ({
      id: acuerdo.id,
      beneficiario: {
        id: acuerdo.beneficiario.id,
        cedula: acuerdo.beneficiario.cedula,
        nombre_completo: `${acuerdo.beneficiario.nombre} ${acuerdo.beneficiario.apellido}`,
        parentesco: acuerdo.beneficiario.parentesco,
      },
      socio: acuerdo.beneficiario.socio ? {
        id: acuerdo.beneficiario.socio.id,
        codigo_socio: acuerdo.beneficiario.socio.codigo_socio,
        cedula: acuerdo.beneficiario.socio.cedula,
        nombre_completo: `${acuerdo.beneficiario.socio.nombre} ${acuerdo.beneficiario.socio.apellido}`,
        estado: acuerdo.beneficiario.socio.estado,
      } : null,
      tipo_acuerdo: {
        id: acuerdo.tipo_acuerdo.id,
        codigo: acuerdo.tipo_acuerdo.codigo,
        nombre: acuerdo.tipo_acuerdo.nombre,
        monto_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
      },
      estado: acuerdo.estado,
      semanas_sin_pago: acuerdo.semanas_sin_pago,
      fecha_suspension: acuerdo.fecha_suspension,
      fecha_inicio: acuerdo.fecha_inicio,
      created_at: acuerdo.created_at,
      updated_at: acuerdo.updated_at,
    }));

    res.json({
      success: true,
      data: acuerdosFormateados,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      },
    });

    logger.info(`Acuerdos funeraria listados: ${acuerdos.length} de ${total}`);
  } catch (error: any) {
    logger.error('Error al listar acuerdos funeraria:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Errores de validación',
          details: error.errors,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al listar acuerdos',
      },
    });
  }
};

/**
 * GET /api/funeraria/estadisticas
 * Obtener estadísticas generales de funeraria
 */
export const obtenerEstadisticas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalAcuerdos, porEstado, porTipo, proximosSuspender] = await Promise.all([
      // Total acuerdos
      prisma.acuerdoFuneraria.count(),

      // Por estado
      prisma.$queryRaw<Array<{ estado: string; cantidad: bigint }>>`
        SELECT estado, COUNT(*)::int as cantidad
        FROM acuerdos_funeraria
        GROUP BY estado
        ORDER BY cantidad DESC
      `,

      // Por tipo de acuerdo
      prisma.$queryRaw<Array<{ tipo_nombre: string; cantidad: bigint }>>`
        SELECT taf.nombre as tipo_nombre, COUNT(af.id)::int as cantidad
        FROM acuerdos_funeraria af
        JOIN tipos_acuerdo_funeraria taf ON af.tipo_acuerdo_id = taf.id
        GROUP BY taf.nombre
        ORDER BY cantidad DESC
      `,

      // Acuerdos próximos a suspender (5 semanas sin pago)
      prisma.acuerdoFuneraria.count({
        where: {
          estado: 'activo',
          semanas_sin_pago: {
            gte: 5,
            lt: 6,
          },
        },
      }),
    ]);

    // Formatear estadísticas por estado
    const estadoPorEstado = porEstado.reduce((acc, item) => {
      acc[item.estado] = Number(item.cantidad);
      return acc;
    }, {} as Record<string, number>);

    // Formatear estadísticas por tipo
    const estadosPorTipo = porTipo.map((item) => ({
      tipo: item.tipo_nombre,
      cantidad: Number(item.cantidad),
    }));

    res.json({
      success: true,
      data: {
        total_acuerdos: totalAcuerdos,
        por_estado: {
          activos: estadoPorEstado['activo'] || 0,
          suspendidos: estadoPorEstado['suspendido'] || 0,
          retirados: estadoPorEstado['retirado'] || 0,
        },
        por_tipo: estadosPorTipo,
        alertas: {
          proximos_suspender: proximosSuspender,
        },
      },
    });

    logger.info('Estadísticas funeraria obtenidas');
  } catch (error: any) {
    logger.error('Error al obtener estadísticas funeraria:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estadísticas',
      },
    });
  }
};

/**
 * GET /api/funeraria/acuerdos/socio/:socioId
 * Obtener acuerdos de funeraria de un socio específico
 */
export const obtenerAcuerdosPorSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(req.params.socioId!);

    if (isNaN(socioId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
    }

    // Verificar que el socio existe
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
    });

    if (!socio) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
    }

    // Obtener acuerdos del socio (a través de beneficiarios)
    const acuerdos = await prisma.acuerdoFuneraria.findMany({
      where: {
        beneficiario: {
          socio_id: socioId,
        },
      },
      include: {
        beneficiario: {
          select: {
            id: true,
            cedula: true,
            nombre: true,
            apellido: true,
            parentesco: true,
          },
        },
        tipo_acuerdo: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            monto_usd: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      data: acuerdos.map((acuerdo) => ({
        id: acuerdo.id,
        beneficiario: {
          id: acuerdo.beneficiario.id,
          cedula: acuerdo.beneficiario.cedula,
          nombre_completo: `${acuerdo.beneficiario.nombre} ${acuerdo.beneficiario.apellido}`,
          parentesco: acuerdo.beneficiario.parentesco,
        },
        tipo_acuerdo: {
          id: acuerdo.tipo_acuerdo.id,
          codigo: acuerdo.tipo_acuerdo.codigo,
          nombre: acuerdo.tipo_acuerdo.nombre,
          monto_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
        },
        estado: acuerdo.estado,
        semanas_sin_pago: acuerdo.semanas_sin_pago,
        fecha_suspension: acuerdo.fecha_suspension,
        fecha_inicio: acuerdo.fecha_inicio,
      })),
    });

    logger.info(`Acuerdos funeraria del socio ${socioId} obtenidos: ${acuerdos.length}`);
  } catch (error: any) {
    logger.error('Error al obtener acuerdos por socio:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener acuerdos del socio',
      },
    });
  }
};

/**
 * GET /api/funeraria/acuerdos/:id
 * Obtener detalle de un acuerdo específico
 */
export const obtenerAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);

    if (isNaN(acuerdoId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de acuerdo inválido',
        },
      });
    }

    const acuerdo = await prisma.acuerdoFuneraria.findUnique({
      where: { id: acuerdoId },
      include: {
        beneficiario: {
          include: {
            socio: {
              select: {
                id: true,
                cedula: true,
                codigo_socio: true,
                nombre: true,
                apellido: true,
                telefono: true,
                email: true,
                estado: true,
              },
            },
          },
        },
        tipo_acuerdo: true,
        movimientos: {
          orderBy: { fecha_movimiento: 'desc' },
          take: 10,
        },
      },
    });

    if (!acuerdo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACUERDO_NOT_FOUND',
          message: 'Acuerdo no encontrado',
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: acuerdo.id,
        beneficiario: {
          id: acuerdo.beneficiario.id,
          cedula: acuerdo.beneficiario.cedula,
          nombre: acuerdo.beneficiario.nombre,
          apellido: acuerdo.beneficiario.apellido,
          parentesco: acuerdo.beneficiario.parentesco,
          telefono: acuerdo.beneficiario.telefono,
        },
        socio: acuerdo.beneficiario.socio ? {
          id: acuerdo.beneficiario.socio.id,
          codigo_socio: acuerdo.beneficiario.socio.codigo_socio,
          cedula: acuerdo.beneficiario.socio.cedula,
          nombre_completo: `${acuerdo.beneficiario.socio.nombre} ${acuerdo.beneficiario.socio.apellido}`,
          telefono: acuerdo.beneficiario.socio.telefono,
          email: acuerdo.beneficiario.socio.email,
          estado: acuerdo.beneficiario.socio.estado,
        } : null,
        tipo_acuerdo: {
          id: acuerdo.tipo_acuerdo.id,
          codigo: acuerdo.tipo_acuerdo.codigo,
          nombre: acuerdo.tipo_acuerdo.nombre,
          monto_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
          ubicacion: acuerdo.tipo_acuerdo.ubicacion,
        },
        estado: acuerdo.estado,
        semanas_sin_pago: acuerdo.semanas_sin_pago,
        fecha_suspension: acuerdo.fecha_suspension,
        fecha_inicio: acuerdo.fecha_inicio,
        movimientos: acuerdo.movimientos.map((mov) => ({
          id: mov.id,
          fecha_movimiento: mov.fecha_movimiento,
          monto_usd: Number(mov.monto_usd),
          monto_bs: Number(mov.monto_bs),
        })),
        created_at: acuerdo.created_at,
        updated_at: acuerdo.updated_at,
      },
    });

    logger.info(`Detalle de acuerdo funeraria ${acuerdoId} obtenido`);
  } catch (error: any) {
    logger.error('Error al obtener acuerdo funeraria:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener acuerdo',
      },
    });
  }
};

/**
 * POST /api/funeraria/acuerdos
 * Crear nuevo acuerdo de funeraria
 */
export const crearAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = crearAcuerdoSchema.parse(req.body);

    // Verificar que el socio existe
    const socio = await prisma.socio.findUnique({
      where: { id: data.socio_id },
    });

    if (!socio) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
    }

    // Verificar que el tipo de acuerdo existe
    const tipoAcuerdo = await prisma.tipoAcuerdoFuneraria.findUnique({
      where: { id: data.tipo_acuerdo_id },
    });

    if (!tipoAcuerdo || !tipoAcuerdo.estado) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TIPO_ACUERDO_NOT_FOUND',
          message: 'Tipo de acuerdo no encontrado o inactivo',
        },
      });
    }

    // Obtener o crear beneficiario
    const beneficiarioId = data.beneficiario_id || await obtenerOCrearBeneficiario(data.socio_id);

    // Verificar que no existe un acuerdo activo para este beneficiario
    const acuerdoExistente = await prisma.acuerdoFuneraria.findFirst({
      where: {
        beneficiario_id: beneficiarioId,
        estado: {
          in: ['activo', 'suspendido'],
        },
      },
    });

    if (acuerdoExistente) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ACUERDO_ALREADY_EXISTS',
          message: 'El beneficiario ya tiene un acuerdo activo',
        },
      });
    }

    // Crear acuerdo
    const nuevoAcuerdo = await prisma.acuerdoFuneraria.create({
      data: {
        beneficiario_id: beneficiarioId,
        tipo_acuerdo_id: data.tipo_acuerdo_id,
        estado: 'activo',
        semanas_sin_pago: 0,
        fecha_inicio: data.fecha_inicio ? new Date(data.fecha_inicio) : new Date(),
      },
      include: {
        beneficiario: {
          include: {
            socio: true,
          },
        },
        tipo_acuerdo: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: (req as any).user?.userId || 1,
        accion: 'CREATE',
        modulo: 'funeraria',
        datos_despues: `Acuerdo creado: ${nuevoAcuerdo.id} - Socio: ${socio.nombre} ${socio.apellido}` as any,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: nuevoAcuerdo.id,
        beneficiario: {
          id: nuevoAcuerdo.beneficiario.id,
          nombre_completo: `${nuevoAcuerdo.beneficiario.nombre} ${nuevoAcuerdo.beneficiario.apellido}`,
        },
        socio: {
          id: nuevoAcuerdo.beneficiario.socio!.id,
          nombre_completo: `${nuevoAcuerdo.beneficiario.socio!.nombre} ${nuevoAcuerdo.beneficiario.socio!.apellido}`,
        },
        tipo_acuerdo: {
          nombre: nuevoAcuerdo.tipo_acuerdo.nombre,
          monto_usd: Number(nuevoAcuerdo.tipo_acuerdo.monto_usd),
        },
        estado: nuevoAcuerdo.estado,
        fecha_inicio: nuevoAcuerdo.fecha_inicio,
      },
    });

    logger.info(`Acuerdo funeraria ${nuevoAcuerdo.id} creado para socio ${data.socio_id}`);
  } catch (error: any) {
    logger.error('Error al crear acuerdo funeraria:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Errores de validación',
          details: error.errors,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al crear acuerdo',
      },
    });
  }
};

/**
 * PATCH /api/funeraria/acuerdos/:id/estado
 * Cambiar estado de un acuerdo (suspender/reactivar/retirar)
 */
export const cambiarEstado = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);
    const data = cambiarEstadoSchema.parse(req.body);

    if (isNaN(acuerdoId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de acuerdo inválido',
        },
      });
    }

    // Verificar que el acuerdo existe
    const acuerdoExistente = await prisma.acuerdoFuneraria.findUnique({
      where: { id: acuerdoId },
      include: {
        beneficiario: {
          include: { socio: true },
        },
      },
    });

    if (!acuerdoExistente) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACUERDO_NOT_FOUND',
          message: 'Acuerdo no encontrado',
        },
      });
    }

    // Validar transición de estado
    if (acuerdoExistente.estado === 'retirado') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'No se puede cambiar el estado de un acuerdo retirado',
        },
      });
    }

    // Preparar datos de actualización
    const updateData: Prisma.AcuerdoFunerariaUpdateInput = {
      estado: data.estado,
    };

    // Si se suspende, registrar fecha
    if (data.estado === 'suspendido' && acuerdoExistente.estado !== 'suspendido') {
      updateData.fecha_suspension = new Date();
    }

    // Si se reactiva, limpiar suspensión
    if (data.estado === 'activo' && acuerdoExistente.estado === 'suspendido') {
      updateData.fecha_suspension = null;
      updateData.semanas_sin_pago = 0;
    }

    // Actualizar acuerdo
    const acuerdoActualizado = await prisma.acuerdoFuneraria.update({
      where: { id: acuerdoId },
      data: updateData,
      include: {
        beneficiario: true,
        tipo_acuerdo: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: (req as any).user?.userId || 1,
        accion: 'UPDATE',
        modulo: 'funeraria',
        datos_despues: `Estado cambiado: ${acuerdoExistente.estado} → ${data.estado}. Acuerdo: ${acuerdoId}. Motivo: ${data.motivo || 'No especificado'}` as any,
      },
    });

    res.json({
      success: true,
      data: {
        id: acuerdoActualizado.id,
        estado_anterior: acuerdoExistente.estado,
        estado_nuevo: acuerdoActualizado.estado,
        fecha_suspension: acuerdoActualizado.fecha_suspension,
      },
    });

    logger.info(`Estado de acuerdo ${acuerdoId} cambiado: ${acuerdoExistente.estado} → ${data.estado}`);
  } catch (error: any) {
    logger.error('Error al cambiar estado de acuerdo:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Errores de validación',
          details: error.errors,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al cambiar estado',
      },
    });
  }
};

/**
 * POST /api/funeraria/verificar-suspensiones
 * Job para verificar y suspender automáticamente acuerdos con 6+ semanas sin pago
 */
export const verificarSuspensionesAutomaticas = async (req: Request, res: Response): Promise<void> => {
  try {
    // REGLA: Suspensión automática a las 6 semanas sin pago
    const SEMANAS_LIMITE = 6;

    // Buscar acuerdos activos con 6+ semanas sin pago
    const acuerdosASuspender = await prisma.acuerdoFuneraria.findMany({
      where: {
        estado: 'activo',
        semanas_sin_pago: {
          gte: SEMANAS_LIMITE,
        },
      },
      include: {
        beneficiario: {
          include: { socio: true },
        },
      },
    });

    const suspendidos: number[] = [];
    const errores: { id: number; error: string }[] = [];

    // Suspender cada acuerdo
    for (const acuerdo of acuerdosASuspender) {
      try {
        await prisma.acuerdoFuneraria.update({
          where: { id: acuerdo.id },
          data: {
            estado: 'suspendido',
            fecha_suspension: new Date(),
          },
        });

        suspendidos.push(acuerdo.id);

        // Audit log
        await prisma.auditLog.create({
          data: {
            usuario_id: (req as any).user?.userId || 1,
            accion: 'UPDATE',
            modulo: 'funeraria',
            datos_despues: `Suspensión automática: Acuerdo ${acuerdo.id}, ${acuerdo.semanas_sin_pago} semanas sin pago` as any,
          },
        });

        logger.info(`Acuerdo ${acuerdo.id} suspendido automáticamente (${acuerdo.semanas_sin_pago} semanas)`);
      } catch (err: any) {
        errores.push({ id: acuerdo.id, error: err.message });
        logger.error(`Error al suspender acuerdo ${acuerdo.id}:`, err);
      }
    }

    res.json({
      success: true,
      data: {
        total_revisados: acuerdosASuspender.length,
        total_suspendidos: suspendidos.length,
        acuerdos_suspendidos: suspendidos,
        errores: errores.length > 0 ? errores : undefined,
      },
    });

    logger.info(`Job suspensión automática: ${suspendidos.length} de ${acuerdosASuspender.length} suspendidos`);
  } catch (error: any) {
    logger.error('Error en verificación de suspensiones:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al verificar suspensiones',
      },
    });
  }
}
