import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearSocioSchema = z.object({
  codigo_socio: z.string().min(1, 'Código de socio requerido').max(20),
  cedula: z.string().min(7, 'Cédula debe tener al menos 7 dígitos').max(11).regex(/^\d+$/, 'Cédula solo debe contener números'),
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
  apellido: z.string().min(2, 'Apellido debe tener al menos 2 caracteres').max(100),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email('Email inválido').max(100).optional().nullable().or(z.literal('')),
  fecha_inscripcion: z.string(),
  ubicacion_id: z.number().int().positive().optional().nullable(),
  autorizado_nombre: z.string().max(100).optional().nullable(),
  autorizado_cedula: z.string().max(11).regex(/^\d*$/, 'Cédula solo debe contener números').optional().nullable().or(z.literal('')),
  notas: z.string().optional().nullable(),
  foto_url: z.string().max(255).optional().nullable(),
  es_delegado: z.boolean().optional(),
});

const actualizarSocioSchema = z.object({
  codigo_socio: z.string().min(1).max(20).optional(),
  cedula: z.string().min(7).max(11).regex(/^\d+$/, 'Cédula solo debe contener números').optional(),
  nombre: z.string().min(2).max(100).optional(),
  apellido: z.string().min(2).max(100).optional(),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email('Email inválido').max(100).optional().nullable().or(z.literal('')),
  fecha_inscripcion: z.string().optional(),
  ubicacion_id: z.number().int().positive().optional().nullable(),
  autorizado_nombre: z.string().max(100).optional().nullable(),
  autorizado_cedula: z.string().max(11).regex(/^\d*$/).optional().nullable().or(z.literal('')),
  notas: z.string().optional().nullable(),
  foto_url: z.string().max(255).optional().nullable(),
  es_delegado: z.boolean().optional(),
  estado: z.enum(['activo', 'retirado', 'invalido']).optional(),
});

const agregarBeneficiarioSchema = z.object({
  cedula: z.string().min(7).max(11).regex(/^\d+$/, 'Cédula solo debe contener números'),
  nombre: z.string().min(2).max(100),
  apellido: z.string().min(2).max(100),
  fecha_nacimiento: z.string().optional().nullable(),
  parentesco: z.string().min(2).max(50),
  telefono: z.string().max(20).optional().nullable(),
});

const actualizarBeneficiarioSchema = agregarBeneficiarioSchema.extend({
  estado: z.enum(['activo', 'retirado']).optional(),
}).partial();

const retiroSocioSchema = z.object({
  fecha_retiro: z.string().min(1, 'Fecha de retiro requerida'),
  motivo_retiro: z.enum(['Socio', 'Voluntario', 'Art. 5']),
});

const contarAsociacionesSocio = async (socioId: number) => {
  const [beneficiarios, cuentasAhorro, prestamos, fiadores, colectas, usuarioDigital, auditorias] = await Promise.all([
    prisma.beneficiario.count({ where: { socio_id: socioId } }),
    prisma.cuentaAhorro.count({ where: { socio_id: socioId } }),
    prisma.prestamo.count({ where: { socio_id: socioId } }),
    prisma.fiador.count({ where: { socio_id: socioId } }),
    prisma.colecta.count({ where: { socio_id: socioId } }),
    prisma.usuarioDigital.count({ where: { socio_id: socioId } }),
    prisma.auditLog.count({
      where: {
        modulo: 'socios',
        registro_id: socioId,
      },
    }),
  ]);

  return {
    beneficiarios,
    cuentasAhorro,
    prestamos,
    fiadores,
    colectas,
    usuarioDigital,
    auditorias,
    total: beneficiarios + cuentasAhorro + prestamos + fiadores + colectas + usuarioDigital + auditorias,
  };
};

// ============================================
// CONTROLADORES - SOCIOS
// ============================================

/**
 * Obtener todos los socios con paginación y búsqueda optimizada
 * Query params: page, limit, search, estado, ubicacion_id
 * Búsqueda por: codigo_socio, cedula, nombre, apellido
 */
export const obtenerSocios = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || '';
    const estado = req.query.estado as string | undefined;
    const ubicacionId = req.query.ubicacion_id ? parseInt(req.query.ubicacion_id as string, 10) : undefined;

    const skip = (page - 1) * limit;

    // Construir filtros dinámicamente
    const where: any = {};

    // Filtro de búsqueda (codigo_socio, cedula, nombre, apellido)
    if (search) {
      where.OR = [
        { codigo_socio: { contains: search, mode: 'insensitive' } },
        { cedula: { contains: search } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por estado
    if (estado) {
      where.estado = estado;
    }

    // Filtro por ubicación
    if (ubicacionId) {
      where.ubicacion_id = ubicacionId;
    }

    // Obtener socios y conteo total
    const [socios, total] = await Promise.all([
      prisma.socio.findMany({
        where,
        skip,
        take: limit,
        include: {
          ubicacion: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              direccion: true,
            },
          },
          _count: {
            select: {
              beneficiarios: true,
              cuentas_ahorro: true,
              prestamos: true,
            },
          },
        },
        orderBy: [
          { estado: 'asc' }, // activo primero
          { apellido: 'asc' },
          { nombre: 'asc' },
        ],
      }),
      prisma.socio.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: socios,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Error al obtener socios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener socios',
      },
    });
  }
};

/**
 * Obtener un socio por ID
 */
export const obtenerSocioPorId = async (req: Request, res: Response): Promise<void> => {
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

    const socioId = parseInt(id, 10);

    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      include: {
        ubicacion: true,
        beneficiarios: {
          where: { estado: { not: 'retirado' } },
          orderBy: { created_at: 'asc' },
        },
        cuentas_ahorro: {
          include: {
            tipo_cuenta: true,
          },
        },
        _count: {
          select: {
            prestamos: true,
            prestamos_como_fiador: true,
          },
        },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: socio,
    });
  } catch (error) {
    logger.error('Error al obtener socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener socio',
      },
    });
  }
};

/**
 * Buscar socio rápido por cédula (para Colecta - Performance crítico)
 * GET /api/socios/buscar/:cedula
 */
export const buscarSocioPorCedula = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cedula } = req.params;

    if (!cedula) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CEDULA',
          message: 'Cédula inválida',
        },
      });
      return;
    }

    const socio = await prisma.socio.findFirst({
      where: { cedula },
      orderBy: [
        { estado: 'asc' },
        { codigo_socio: 'asc' },
      ],
      include: {
        ubicacion: {
          select: {
            nombre: true,
            direccion: true,
          },
        },
        cuentas_ahorro: {
          where: { estado: true },
          include: {
            tipo_cuenta: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    // Validar estado para colecta
    if (socio.estado !== 'activo') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SOCIO_INACTIVO',
          message: `Socio está ${socio.estado}`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: socio,
    });
  } catch (error) {
    logger.error('Error al buscar socio por cédula:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al buscar socio',
      },
    });
  }
};

/**
 * Crear un nuevo socio
 */
export const crearSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = crearSocioSchema.safeParse(req.body);

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

    const datos = validacion.data;

    // Validar código de socio único
    const codigoExistente = await prisma.socio.findUnique({
      where: { codigo_socio: datos.codigo_socio },
    });

    if (codigoExistente) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CODIGO_DUPLICADO',
          message: `El código de socio ${datos.codigo_socio} ya existe`,
        },
      });
      return;
    }

    // Validar ubicación si se proporciona
    if (datos.ubicacion_id) {
      const ubicacion = await prisma.ubicacion.findUnique({
        where: { id: datos.ubicacion_id },
      });

      if (!ubicacion) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UBICACION_NOT_FOUND',
            message: 'Ubicación no encontrada',
          },
        });
        return;
      }
    }

    // Crear socio
    const socio = await prisma.socio.create({
      data: {
        codigo_socio: datos.codigo_socio,
        cedula: datos.cedula,
        nombre: datos.nombre,
        apellido: datos.apellido,
        fecha_nacimiento: datos.fecha_nacimiento ? new Date(datos.fecha_nacimiento) : null,
        direccion: datos.direccion,
        telefono: datos.telefono,
        email: datos.email || null,
        fecha_inscripcion: new Date(datos.fecha_inscripcion),
        ubicacion_id: datos.ubicacion_id,
        autorizado_nombre: datos.autorizado_nombre,
        autorizado_cedula: datos.autorizado_cedula || null,
        notas: datos.notas,
        foto_url: datos.foto_url,
        es_delegado: datos.es_delegado || false,
      },
      include: {
        ubicacion: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'CREAR',
        modulo: 'socios',
        registro_id: socio.id,
        datos_despues: socio as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Socio creado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.status(201).json({
      success: true,
      data: socio,
    });
  } catch (error) {
    logger.error('Error al crear socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al crear socio',
      },
    });
  }
};

/**
 * Actualizar un socio
 */
export const actualizarSocio = async (req: Request, res: Response): Promise<void> => {
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

    const socioId = parseInt(id, 10);

    const validacion = actualizarSocioSchema.safeParse(req.body);

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

    const datos = validacion.data;

    // Verificar que el socio existe
    const socioExistente = await prisma.socio.findUnique({
      where: { id: socioId },
    });

    if (!socioExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    // Validar código de socio único si se está cambiando
    if (datos.codigo_socio && datos.codigo_socio !== socioExistente.codigo_socio) {
      const codigoExistente = await prisma.socio.findUnique({
        where: { codigo_socio: datos.codigo_socio },
      });

      if (codigoExistente) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CODIGO_DUPLICADO',
            message: `El código de socio ${datos.codigo_socio} ya existe`,
          },
        });
        return;
      }
    }

    // Validar ubicación si se proporciona
    if (datos.ubicacion_id) {
      const ubicacion = await prisma.ubicacion.findUnique({
        where: { id: datos.ubicacion_id },
      });

      if (!ubicacion) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UBICACION_NOT_FOUND',
            message: 'Ubicación no encontrada',
          },
        });
        return;
      }
    }

    // Preparar datos de actualización
    const datosActualizacion: any = { ...datos };
    if (datos.fecha_nacimiento) {
      datosActualizacion.fecha_nacimiento = new Date(datos.fecha_nacimiento);
    }
    if (datos.fecha_inscripcion) {
      datosActualizacion.fecha_inscripcion = new Date(datos.fecha_inscripcion);
    }
    if (datos.email === '') {
      datosActualizacion.email = null;
    }
    if (datos.autorizado_cedula === '') {
      datosActualizacion.autorizado_cedula = null;
    }

    // Actualizar socio
    const socio = await prisma.socio.update({
      where: { id: socioId },
      data: datosActualizacion,
      include: {
        ubicacion: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'ACTUALIZAR',
        modulo: 'socios',
        registro_id: socio.id,
        datos_antes: socioExistente as any,
        datos_despues: socio as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Socio actualizado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.json({
      success: true,
      data: socio,
    });
  } catch (error) {
    logger.error('Error al actualizar socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar socio',
      },
    });
  }
};

/**
 * Eliminar un socio solo si no tiene relaciones registradas
 */
export const eliminarSocio = async (req: Request, res: Response): Promise<void> => {
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

    const socioId = parseInt(id, 10);

    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      include: {
        _count: {
          select: {
            cuentas_ahorro: true,
            prestamos: true,
          },
        },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    const asociaciones = await contarAsociacionesSocio(socioId);

    if (asociaciones.total > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SOCIO_CON_ASOCIACIONES',
          message: 'El socio no puede eliminarse porque ya tiene relaciones o movimientos en el sistema',
          details: asociaciones,
        },
      });
      return;
    }

    const socioEliminado = await prisma.socio.delete({
      where: { id: socioId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'DELETE',
        modulo: 'socios',
        registro_id: socio.id,
        datos_antes: socio as any,
        datos_despues: socioEliminado as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Socio eliminado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.json({
      success: true,
      data: socioEliminado,
    });
  } catch (error) {
    logger.error('Error al eliminar socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al eliminar socio',
      },
    });
  }
};

/**
 * Retirar un socio con fecha y motivo
 */
export const retirarSocio = async (req: Request, res: Response): Promise<void> => {
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

    const socioId = parseInt(id, 10);
    const datos = retiroSocioSchema.parse(req.body);

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    if (socio.estado === 'retirado') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SOCIO_YA_RETIRADO',
          message: 'El socio ya está retirado',
        },
      });
      return;
    }

    const prestamosActivos = await prisma.prestamo.count({
      where: {
        socio_id: socioId,
        estado: { in: ['activo', 'moroso'] },
      },
    });

    if (prestamosActivos > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIENE_PRESTAMOS_ACTIVOS',
          message: `El socio tiene ${prestamosActivos} préstamo(s) activo(s)`,
        },
      });
      return;
    }

    const cuentasConSaldo = await prisma.cuentaAhorro.count({
      where: {
        socio_id: socioId,
        OR: [{ saldo_bs: { gt: 0 } }, { saldo_usd: { gt: 0 } }],
      },
    });

    if (cuentasConSaldo > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIENE_SALDO',
          message: `El socio tiene ${cuentasConSaldo} cuenta(s) con saldo`,
        },
      });
      return;
    }

    const notaRetiro = `[RETIRO] Fecha: ${datos.fecha_retiro} | Motivo: ${datos.motivo_retiro} | Usuario: ${req.user!.userId}`;
    const notasActualizadas = [socio.notas?.trim(), notaRetiro].filter(Boolean).join('\n');

    const socioActualizado = await prisma.socio.update({
      where: { id: socioId },
      data: {
        estado: 'retirado',
        notas: notasActualizadas,
      },
    });

    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'RETIRAR',
        modulo: 'socios',
        registro_id: socio.id,
        datos_antes: socio as any,
        datos_despues: socioActualizado as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Socio retirado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.json({
      success: true,
      data: socioActualizado,
    });
  } catch (error) {
    logger.error('Error al retirar socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al retirar socio',
      },
    });
  }
};

// ============================================
// CONTROLADORES - BENEFICIARIOS
// ============================================

/**
 * Obtener beneficiarios de un socio
 */
export const obtenerBeneficiarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId } = req.params;

    if (!socioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    const id = parseInt(socioId, 10);

    const beneficiarios = await prisma.beneficiario.findMany({
      where: {
        socio_id: id,
        estado: { not: 'retirado' },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    res.json({
      success: true,
      data: beneficiarios,
    });
  } catch (error) {
    logger.error('Error al obtener beneficiarios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener beneficiarios',
      },
    });
  }
};

/**
 * Agregar beneficiario a un socio
 */
export const agregarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId } = req.params;

    if (!socioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    const id = parseInt(socioId, 10);

    const validacion = agregarBeneficiarioSchema.safeParse(req.body);

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

    const datos = validacion.data;

    // Verificar que el socio existe
    const socio = await prisma.socio.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            beneficiarios: true,
          },
        },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    // Validar límite de 9 beneficiarios
    const beneficiariosActivos = await prisma.beneficiario.count({
      where: {
        socio_id: id,
        estado: { not: 'retirado' },
      },
    });

    if (beneficiariosActivos >= 9) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LIMITE_BENEFICIARIOS',
          message: 'Un socio no puede tener más de 9 beneficiarios activos',
        },
      });
      return;
    }

    // Validar cédula única
    const cedulaExistente = await prisma.beneficiario.findUnique({
      where: { cedula: datos.cedula },
    });

    if (cedulaExistente) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CEDULA_DUPLICADA',
          message: `La cédula ${datos.cedula} ya está registrada como beneficiario`,
        },
      });
      return;
    }

    // Crear beneficiario
    const beneficiario = await prisma.beneficiario.create({
      data: {
        socio_id: id,
        cedula: datos.cedula,
        nombre: datos.nombre,
        apellido: datos.apellido,
        fecha_nacimiento: datos.fecha_nacimiento ? new Date(datos.fecha_nacimiento) : null,
        parentesco: datos.parentesco,
        telefono: datos.telefono,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'CREAR',
        modulo: 'beneficiarios',
        registro_id: beneficiario.id,
        datos_despues: beneficiario as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Beneficiario agregado: ${beneficiario.nombre} ${beneficiario.apellido} al socio ${socio.codigo_socio}`);

    res.status(201).json({
      success: true,
      data: beneficiario,
    });
  } catch (error) {
    logger.error('Error al agregar beneficiario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al agregar beneficiario',
      },
    });
  }
};

/**
 * Actualizar beneficiario
 */
export const actualizarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId, beneficiarioId } = req.params;

    if (!socioId || !beneficiarioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'IDs inválidos',
        },
      });
      return;
    }

    const validacion = actualizarBeneficiarioSchema.safeParse(req.body);

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

    const datos = validacion.data;
    const id = parseInt(beneficiarioId, 10);

    // Verificar que el beneficiario existe y pertenece al socio
    const beneficiarioExistente = await prisma.beneficiario.findFirst({
      where: {
        id,
        socio_id: parseInt(socioId, 10),
      },
    });

    if (!beneficiarioExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BENEFICIARIO_NOT_FOUND',
          message: 'Beneficiario no encontrado',
        },
      });
      return;
    }

    // Validar cédula única si se está cambiando
    if (datos.cedula && datos.cedula !== beneficiarioExistente.cedula) {
      const cedulaExistente = await prisma.beneficiario.findUnique({
        where: { cedula: datos.cedula },
      });

      if (cedulaExistente) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CEDULA_DUPLICADA',
            message: `La cédula ${datos.cedula} ya está registrada como beneficiario`,
          },
        });
        return;
      }
    }

    // Preparar datos de actualización
    const datosActualizacion: any = { ...datos };
    if (datos.fecha_nacimiento) {
      datosActualizacion.fecha_nacimiento = new Date(datos.fecha_nacimiento);
    }

    // Actualizar beneficiario
    const beneficiario = await prisma.beneficiario.update({
      where: { id },
      data: datosActualizacion,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'ACTUALIZAR',
        modulo: 'beneficiarios',
        registro_id: beneficiario.id,
        datos_antes: beneficiarioExistente as any,
        datos_despues: beneficiario as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Beneficiario actualizado: ${beneficiario.nombre} ${beneficiario.apellido}`);

    res.json({
      success: true,
      data: beneficiario,
    });
  } catch (error) {
    logger.error('Error al actualizar beneficiario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar beneficiario',
      },
    });
  }
};

/**
 * Eliminar beneficiario (soft delete)
 */
export const eliminarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId, beneficiarioId } = req.params;

    if (!socioId || !beneficiarioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'IDs inválidos',
        },
      });
      return;
    }

    const id = parseInt(beneficiarioId, 10);

    // Verificar que el beneficiario existe y pertenece al socio
    const beneficiario = await prisma.beneficiario.findFirst({
      where: {
        id,
        socio_id: parseInt(socioId, 10),
      },
    });

    if (!beneficiario) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BENEFICIARIO_NOT_FOUND',
          message: 'Beneficiario no encontrado',
        },
      });
      return;
    }

    // Validar que no tenga acuerdos activos
    const [acuerdosFunerariaActivos, acuerdosSaludActivos] = await Promise.all([
      prisma.acuerdoFuneraria.count({
        where: {
          beneficiario_id: id,
          estado: { in: ['activo', 'suspendido'] },
        },
      }),
      prisma.acuerdoSalud.count({
        where: {
          beneficiario_id: id,
          estado: { in: ['activo', 'suspendido'] },
        },
      }),
    ]);

    if (acuerdosFunerariaActivos > 0 || acuerdosSaludActivos > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIENE_ACUERDOS_ACTIVOS',
          message: `El beneficiario tiene acuerdos activos (Funeraria: ${acuerdosFunerariaActivos}, Salud: ${acuerdosSaludActivos})`,
        },
      });
      return;
    }

    // Soft delete
    const beneficiarioActualizado = await prisma.beneficiario.update({
      where: { id },
      data: {
        estado: 'retirado',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        usuario_id: req.user!.userId,
        accion: 'ELIMINAR',
        modulo: 'beneficiarios',
        registro_id: beneficiario.id,
        datos_antes: beneficiario as any,
        datos_despues: beneficiarioActualizado as any,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
      },
    });

    logger.info(`Beneficiario eliminado (soft delete): ${beneficiario.nombre} ${beneficiario.apellido}`);

    res.json({
      success: true,
      data: beneficiarioActualizado,
    });
  } catch (error) {
    logger.error('Error al eliminar beneficiario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al eliminar beneficiario',
      },
    });
  }
};

// ============================================
// REPORTES Y ESTADÍSTICAS
// ============================================

/**
 * Obtener estadísticas generales de socios
 */
export const obtenerEstadisticasSocios = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalSocios,
      sociosActivos,
      sociosRetirados,
      sociosPorUbicacion,
      totalBeneficiarios,
    ] = await Promise.all([
      prisma.socio.count(),
      prisma.socio.count({ where: { estado: 'activo' } }),
      prisma.socio.count({ where: { estado: 'retirado' } }),
      prisma.socio.groupBy({
        by: ['ubicacion_id'],
        _count: true,
      }),
      prisma.beneficiario.count({ where: { estado: 'activo' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalSocios,
        sociosActivos,
        sociosRetirados,
        sociosPorUbicacion,
        totalBeneficiarios,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de socios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estadísticas',
      },
    });
  }
};
