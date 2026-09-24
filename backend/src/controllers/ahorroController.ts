/**
 * ============================================
 * CONTROLLER: AHORRO
 * ============================================
 * Gestión de cuentas de ahorro y movimientos
 * - Apertura de cuentas
 * - Depósitos y retiros
 * - Consulta de movimientos
 * - Saldos dual-currency (USD + Bs)
 */

import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ConflictError, BadRequestError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { bloquearSocio } from '../utils/bloqueos';

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const aperturaCuentaSchema = z.object({
  socio_id: z.number().int().positive(),
  tipo_cuenta_id: z.number().int().positive(),
  monto_inicial_usd: z.number().nonnegative().optional().default(0),
});

const movimientoSchema = z.object({
  cuenta_id: z.number().int().positive(),
  tipo_movimiento: z.enum(['deposito', 'retiro']),
  monto_usd: z.number().positive(),
  concepto: z.string().optional(),
  referencia: z.string().max(50).optional(),
});

const consultaMovimientosSchema = z.object({
  cuenta_id: z.coerce.number().int().positive().optional(),
  socio_id: z.coerce.number().int().positive().optional(),
  tipo_cuenta_id: z.coerce.number().int().positive().optional(),
  tipo_movimiento: z.enum(['deposito', 'retiro']).optional(),
  fecha_desde: z.string().datetime().optional(),
  fecha_hasta: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtener la tasa de cambio actual
 */
async function obtenerTasaActual(): Promise<number> {
  // Buscar la semana de colecta activa actual
  const semanaActual = await prisma.semanaColecta.findFirst({
    where: {
      estado: true,
    },
    orderBy: { created_at: 'desc' },
  });

  if (!semanaActual) {
    throw new Error('No hay semana de colecta activa. Configure la tasa de cambio.');
  }

  return Number(semanaActual.tasa_usd_bs);
}

/**
 * Genera el número de cuenta siguiendo el formato del sistema viejo.
 *
 * Formato: TIPO-FERIA-EXPEDIENTE  (ej: 01-08-00-121753)
 *   - TIPO       01  = código del tipo de cuenta (CUENTA A LA VISTA)
 *   - FERIA      08-00 = código de la ubicación; ya trae un guion interno,
 *                por eso el número completo tiene 4 segmentos y no 3
 *   - EXPEDIENTE 121753 = codigo_socio del titular
 *
 * El último segmento NO es un correlativo: es el expediente del socio.
 * Verificado contra los datos reales: 18.315 de 18.317 cuentas migradas
 * terminan exactamente en el codigo_socio de su titular.
 */
async function generarNumeroCuenta(tipoCuentaId: number, socioId: number): Promise<string> {
  const tipoCuenta = await prisma.tipoCuentaAhorro.findUnique({
    where: { id: tipoCuentaId },
  });

  if (!tipoCuenta) {
    throw new Error('Tipo de cuenta no encontrado');
  }

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { ubicacion: true },
  });

  if (!socio) {
    throw new Error('Socio no encontrado');
  }

  if (!socio.ubicacion) {
    throw new BadRequestError('El socio no tiene feria asignada; no es posible formar el número de cuenta');
  }

  const numeroCuenta = `${tipoCuenta.codigo}-${socio.ubicacion.codigo}-${socio.codigo_socio}`;

  // Al derivarse del expediente, el número es determinista: si ya existe es
  // porque el socio YA tiene una cuenta de este tipo en esta feria. Antes esto
  // se resolvía incrementando un correlativo, lo que producía cuentas cuyo
  // último segmento no correspondía a ningún expediente.
  const existente = await prisma.cuentaAhorro.findUnique({
    where: { numero_cuenta: numeroCuenta },
  });

  if (existente) {
    throw new ConflictError(
      `El socio ${socio.codigo_socio} ya tiene una cuenta ${tipoCuenta.nombre} en esta feria (${numeroCuenta})`
    );
  }

  return numeroCuenta;
}

// ============================================
// ENDPOINTS: CUENTAS DE AHORRO
// ============================================

/**
 * GET /api/ahorro/cuentas
 * Listar todas las cuentas de ahorro con filtros
 */
export const listarCuentas = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      socio_id,
      tipo_cuenta_id,
      ubicacion_id,
      estado,
      busqueda,
      page = 1,
      limit = 50,
    } = req.query;

    const where: Prisma.CuentaAhorroWhereInput = {};

    if (socio_id) where.socio_id = Number(socio_id);
    if (tipo_cuenta_id) where.tipo_cuenta_id = Number(tipo_cuenta_id);
    
    // Filtro por feria/ubicación
    if (ubicacion_id) {
      where.socio = {
        ubicacion_id: Number(ubicacion_id),
      };
    }
    
    if (estado !== undefined) where.estado = estado === 'true';
    
    if (busqueda) {
      where.OR = [
        { numero_cuenta: { contains: String(busqueda), mode: 'insensitive' } },
        { socio: { codigo_socio: { contains: String(busqueda), mode: 'insensitive' } } },
        { socio: { cedula: { contains: String(busqueda), mode: 'insensitive' } } },
        { socio: { nombre: { contains: String(busqueda), mode: 'insensitive' } } },
        { socio: { apellido: { contains: String(busqueda), mode: 'insensitive' } } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [cuentas, total] = await Promise.all([
      prisma.cuentaAhorro.findMany({
        where,
        skip,
        take,
        include: {
          socio: {
            select: {
              id: true,
              codigo_socio: true,
              cedula: true,
              nombre: true,
              apellido: true,
              estado: true,
            },
          },
          tipo_cuenta: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              descripcion: true,
            },
          },
          _count: {
            select: { movimientos: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.cuentaAhorro.count({ where }),
    ]);

    res.json({
      success: true,
      data: cuentas,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error al listar cuentas de ahorro:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al listar cuentas de ahorro',
      },
    });
  }
};

/**
 * GET /api/ahorro/cuentas/socio/:socioId
 * Obtener todas las cuentas de un socio
 */
export const obtenerCuentasPorSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(req.params.socioId!);

    if (isNaN(socioId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    // Verificar que el socio existe
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true,
        codigo_socio: true,
        nombre: true,
        apellido: true,
        estado: true,
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

    const cuentas = await prisma.cuentaAhorro.findMany({
      where: { socio_id: socioId },
      include: {
        tipo_cuenta: true,
        _count: {
          select: { movimientos: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Calcular totales
    const totales = {
      total_usd: cuentas.reduce((sum, c) => sum + Number(c.saldo_usd), 0),
      total_bs: cuentas.reduce((sum, c) => sum + Number(c.saldo_bs), 0),
      total_bloqueado_usd: cuentas.reduce((sum, c) => sum + Number(c.monto_bloqueado_usd), 0),
      total_bloqueado_bs: cuentas.reduce((sum, c) => sum + Number(c.monto_bloqueado_bs), 0),
    };

    res.json({
      success: true,
      data: {
        socio,
        cuentas,
        totales,
      },
    });
  } catch (error) {
    logger.error('Error al obtener cuentas del socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener cuentas del socio',
      },
    });
  }
};

/**
 * GET /api/ahorro/cuentas/:id
 * Obtener detalle de una cuenta
 */
export const obtenerCuenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const cuentaId = parseInt(req.params.id!);

    if (isNaN(cuentaId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de cuenta inválido',
        },
      });
      return;
    }

    const cuenta = await prisma.cuentaAhorro.findUnique({
      where: { id: cuentaId },
      include: {
        socio: {
          select: {
            id: true,
            codigo_socio: true,
            cedula: true,
            nombre: true,
            apellido: true,
            telefono: true,
            estado: true,
          },
        },
        tipo_cuenta: true,
        _count: {
          select: { movimientos: true },
        },
      },
    });

    if (!cuenta) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CUENTA_NOT_FOUND',
          message: 'Cuenta no encontrada',
        },
      });
      return;
    }

    // Obtener últimos 10 movimientos
    const ultimosMovimientos = await prisma.movimientoAhorro.findMany({
      where: { cuenta_id: cuentaId },
      orderBy: { fecha_movimiento: 'desc' },
      take: 10,
    });

    // Calcular saldo disponible
    const saldoDisponibleUsd = Number(cuenta.saldo_usd) - Number(cuenta.monto_bloqueado_usd);
    const saldoDisponibleBs = Number(cuenta.saldo_bs) - Number(cuenta.monto_bloqueado_bs);

    res.json({
      success: true,
      data: {
        ...cuenta,
        saldo_disponible_usd: saldoDisponibleUsd,
        saldo_disponible_bs: saldoDisponibleBs,
        ultimos_movimientos: ultimosMovimientos,
      },
    });
  } catch (error) {
    logger.error('Error al obtener cuenta:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener cuenta',
      },
    });
  }
};

/**
 * GET /api/ahorro/tipos-cuenta
 * Listar tipos de cuenta activos
 */
export const listarTiposCuenta = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tipos = await prisma.tipoCuentaAhorro.findMany({
      where: { estado: true },
      orderBy: { codigo: 'asc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
      },
    });

    res.json({
      success: true,
      data: tipos,
    });
  } catch (error) {
    logger.error('Error al listar tipos de cuenta:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al listar tipos de cuenta',
      },
    });
  }
};

/**
 * GET /api/ahorro/tipos-cuenta/todos
 * Listar TODOS los tipos de cuenta (incluyendo inactivos) con conteo de cuentas
 * Para uso en CRUD/administración
 */
export const listarTodosTiposCuenta = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tipos = await prisma.tipoCuentaAhorro.findMany({
      orderBy: { codigo: 'asc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        estado: true,
        created_at: true,
        _count: {
          select: { cuentas: true },
        },
      },
    });

    res.json({
      success: true,
      data: tipos,
    });
  } catch (error) {
    logger.error('Error al listar todos los tipos de cuenta:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al listar tipos de cuenta',
      },
    });
  }
};

/**
 * POST /api/ahorro/cuentas/apertura
 * Apertura de nueva cuenta de ahorro
 */
export const aperturaCuenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const datos = aperturaCuentaSchema.parse(req.body);

    // Validar que el socio existe y está activo
    const socio = await prisma.socio.findUnique({
      where: { id: datos.socio_id },
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

    if (socio.estado === 'retirado') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SOCIO_RETIRADO',
          message: 'No se puede abrir cuenta para un socio retirado',
        },
      });
      return;
    }

    // Validar que el tipo de cuenta existe y está activo
    const tipoCuenta = await prisma.tipoCuentaAhorro.findUnique({
      where: { id: datos.tipo_cuenta_id },
    });

    if (!tipoCuenta || !tipoCuenta.estado) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIPO_CUENTA_INVALID',
          message: 'Tipo de cuenta no válido o inactivo',
        },
      });
      return;
    }

    // Validar que el socio no tenga ya una cuenta de este tipo
    const cuentaExistente = await prisma.cuentaAhorro.findFirst({
      where: {
        socio_id: datos.socio_id,
        tipo_cuenta_id: datos.tipo_cuenta_id,
        estado: true,
      },
    });

    if (cuentaExistente) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CUENTA_DUPLICADA',
          message: 'El socio ya tiene una cuenta activa de este tipo',
        },
      });
      return;
    }

    // Obtener tasa de cambio actual
    const tasaCambio = await obtenerTasaActual();

    // Generar número de cuenta (formato: XX-XX-XX-XXXXXX)
    const numeroCuenta = await generarNumeroCuenta(datos.tipo_cuenta_id, datos.socio_id);

    // Crear cuenta en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // Crear cuenta
      const cuenta = await tx.cuentaAhorro.create({
        data: {
          socio_id: datos.socio_id,
          tipo_cuenta_id: datos.tipo_cuenta_id,
          numero_cuenta: numeroCuenta,
          saldo_usd: datos.monto_inicial_usd || 0,
          saldo_bs: (datos.monto_inicial_usd || 0) * tasaCambio,
          monto_bloqueado_usd: 0,
          monto_bloqueado_bs: 0,
          estado: true,
          fecha_apertura: new Date(),
        },
        include: {
          socio: {
            select: {
              codigo_socio: true,
              nombre: true,
              apellido: true,
            },
          },
          tipo_cuenta: true,
        },
      });

      // Si hay monto inicial, crear movimiento de apertura
      if (datos.monto_inicial_usd && datos.monto_inicial_usd > 0) {
        await tx.movimientoAhorro.create({
          data: {
            cuenta_id: cuenta.id,
            tipo_movimiento: 'deposito',
            monto_usd: datos.monto_inicial_usd,
            monto_bs: datos.monto_inicial_usd * tasaCambio,
            tasa_cambio: tasaCambio,
            saldo_anterior_usd: 0,
            saldo_nuevo_usd: datos.monto_inicial_usd,
            // En bolivares tal cual: derivarlo de los dolares por la tasa
            // pierde centimos y descuadra la libreta
            saldo_nuevo_bs: Math.round(datos.monto_inicial_usd * tasaCambio * 100) / 100,
            concepto: 'Apertura de cuenta',
            fecha_movimiento: new Date(),
          },
        });
      }

      // Audit log
      await registrarAuditoria(tx, {
        req,
        accion: 'CREAR',
        modulo: 'ahorro',
        registro_id: cuenta.id,
        despues: cuenta,
      });

      return cuenta;
    });

    logger.info(`Cuenta de ahorro abierta: ${resultado.numero_cuenta}`);

    res.status(201).json({
      success: true,
      data: resultado,
      message: 'Cuenta de ahorro abierta exitosamente',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.errors,
        },
      });
      return;
    }

    // Los errores de negocio del generador de número llevan su propio mensaje
    if (error instanceof ConflictError || error instanceof BadRequestError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code ?? 'BAD_REQUEST', message: error.message },
      });
      return;
    }

    logger.error('Error al abrir cuenta:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al abrir cuenta de ahorro',
      },
    });
  }
};

/**
 * PUT /api/ahorro/cuentas/:id/estado
 * Activar/desactivar cuenta
 */
export const cambiarEstadoCuenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const cuentaId = parseInt(req.params.id!);
    const { estado } = req.body;

    if (isNaN(cuentaId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de cuenta inválido',
        },
      });
      return;
    }

    if (typeof estado !== 'boolean') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ESTADO',
          message: 'Estado debe ser true o false',
        },
      });
      return;
    }

    const cuenta = await prisma.cuentaAhorro.findUnique({
      where: { id: cuentaId },
    });

    if (!cuenta) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CUENTA_NOT_FOUND',
          message: 'Cuenta no encontrada',
        },
      });
      return;
    }

    // Si se va a desactivar, validar que no tenga saldo
    if (!estado && (Number(cuenta.saldo_usd) > 0 || Number(cuenta.saldo_bs) > 0)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CUENTA_CON_SALDO',
          message: 'No se puede desactivar una cuenta con saldo. Retire el saldo primero.',
        },
      });
      return;
    }

    // El cambio de estado y su auditoría se confirman juntos
    const cuentaActualizada = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.cuentaAhorro.update({
        where: { id: cuentaId },
        data: { estado },
        include: {
          socio: {
            select: {
              codigo_socio: true,
              nombre: true,
              apellido: true,
            },
          },
          tipo_cuenta: true,
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'ACTUALIZAR',
        modulo: 'ahorro',
        registro_id: cuentaId,
        antes: cuenta,
        despues: actualizada,
      });

      return actualizada;
    });

    res.json({
      success: true,
      data: cuentaActualizada,
      message: `Cuenta ${estado ? 'activada' : 'desactivada'} exitosamente`,
    });
  } catch (error) {
    logger.error('Error al cambiar estado de cuenta:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al cambiar estado de cuenta',
      },
    });
  }
};

// ============================================
// ENDPOINTS: MOVIMIENTOS
// ============================================

/**
 * POST /api/ahorro/movimientos
 * Registrar depósito o retiro
 */
export const registrarMovimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const datos = movimientoSchema.parse(req.body);

    // Validar que la cuenta existe y está activa
    const cuenta = await prisma.cuentaAhorro.findUnique({
      where: { id: datos.cuenta_id },
      include: {
        socio: true,
        tipo_cuenta: true,
      },
    });

    if (!cuenta) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CUENTA_NOT_FOUND',
          message: 'Cuenta no encontrada',
        },
      });
      return;
    }

    if (!cuenta.estado) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CUENTA_INACTIVA',
          message: 'La cuenta está inactiva',
        },
      });
      return;
    }

    // Obtener tasa de cambio actual
    const tasaCambio = await obtenerTasaActual();

    // Calcular saldo disponible (sin bloqueos)
    const saldoDisponibleUsd = Number(cuenta.saldo_usd) - Number(cuenta.monto_bloqueado_usd);

    // Validar retiro
    if (datos.tipo_movimiento === 'retiro' && datos.monto_usd > saldoDisponibleUsd) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SALDO_INSUFICIENTE',
          message: `Saldo disponible insuficiente. Disponible: $${saldoDisponibleUsd.toFixed(2)}`,
        },
      });
      return;
    }

    // Registrar movimiento en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // El saldo se relee con el socio bloqueado. El leído arriba puede estar
      // viejo si entre medio entró otro depósito, retiro o colecta del mismo
      // socio: uno de los dos se perdía, y un retiro se validaba contra un
      // saldo que ya no existía (ver utils/bloqueos.ts)
      await bloquearSocio(tx, cuenta.socio_id);
      const vigente = await tx.cuentaAhorro.findUniqueOrThrow({ where: { id: datos.cuenta_id } });

      if (datos.tipo_movimiento === 'retiro') {
        const disponible = Number(vigente.saldo_usd) - Number(vigente.monto_bloqueado_usd);
        if (datos.monto_usd > disponible) {
          throw new BadRequestError(`Saldo disponible insuficiente. Disponible: $${disponible.toFixed(2)}`);
        }
      }

      // Calcular nuevo saldo
      const saldoAnteriorUsd = Number(vigente.saldo_usd);
      const nuevoSaldoUsd =
        datos.tipo_movimiento === 'deposito'
          ? saldoAnteriorUsd + datos.monto_usd
          : saldoAnteriorUsd - datos.monto_usd;

      const montoBs = datos.monto_usd * tasaCambio;
      const nuevoSaldoBs =
        datos.tipo_movimiento === 'deposito'
          ? Number(vigente.saldo_bs) + montoBs
          : Number(vigente.saldo_bs) - montoBs;

      // Crear movimiento
      const movimiento = await tx.movimientoAhorro.create({
        data: {
          cuenta_id: datos.cuenta_id,
          tipo_movimiento: datos.tipo_movimiento,
          monto_usd: datos.monto_usd,
          monto_bs: montoBs,
          tasa_cambio: tasaCambio,
          saldo_anterior_usd: saldoAnteriorUsd,
          saldo_nuevo_usd: nuevoSaldoUsd,
          saldo_nuevo_bs: Math.round(nuevoSaldoUsd * tasaCambio * 100) / 100,
          concepto: datos.concepto,
          referencia: datos.referencia,
          fecha_movimiento: new Date(),
        },
      });

      // Actualizar saldo de cuenta
      const cuentaActualizada = await tx.cuentaAhorro.update({
        where: { id: datos.cuenta_id },
        data: {
          saldo_usd: nuevoSaldoUsd,
          saldo_bs: nuevoSaldoBs,
        },
        include: {
          socio: {
            select: {
              codigo_socio: true,
              nombre: true,
              apellido: true,
            },
          },
          tipo_cuenta: true,
        },
      });

      // Audit log
      await registrarAuditoria(tx, {
        req,
        accion: 'CREAR',
        modulo: 'movimientos_ahorro',
        registro_id: movimiento.id,
        despues: {
          movimiento,
          cuenta: cuentaActualizada.numero_cuenta,
          socio: `${cuentaActualizada.socio.codigo_socio} - ${cuentaActualizada.socio.nombre} ${cuentaActualizada.socio.apellido}`,
        },
      });

      return { movimiento, cuenta: cuentaActualizada };
    });

    logger.info(
      `${datos.tipo_movimiento.toUpperCase()} registrado: ${resultado.cuenta.numero_cuenta} - $${datos.monto_usd}`
    );

    res.status(201).json({
      success: true,
      data: resultado,
      message: `${datos.tipo_movimiento === 'deposito' ? 'Depósito' : 'Retiro'} registrado exitosamente`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.errors,
        },
      });
      return;
    }

    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        error: { code: 'SALDO_INSUFICIENTE', message: error.message },
      });
      return;
    }

    logger.error('Error al registrar movimiento:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al registrar movimiento',
      },
    });
  }
};

/**
 * GET /api/ahorro/movimientos
 * Consultar movimientos con filtros
 */
export const consultarMovimientos = async (req: Request, res: Response): Promise<void> => {
  try {
    const filtros = consultaMovimientosSchema.parse(req.query);

    const where: Prisma.MovimientoAhorroWhereInput = {};

    if (filtros.cuenta_id) where.cuenta_id = filtros.cuenta_id;
    if (filtros.tipo_movimiento) where.tipo_movimiento = filtros.tipo_movimiento;

    if (filtros.socio_id || filtros.tipo_cuenta_id) {
      where.cuenta = {};
      if (filtros.socio_id) where.cuenta.socio_id = filtros.socio_id;
      if (filtros.tipo_cuenta_id) where.cuenta.tipo_cuenta_id = filtros.tipo_cuenta_id;
    }

    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha_movimiento = {};
      if (filtros.fecha_desde) {
        where.fecha_movimiento.gte = new Date(filtros.fecha_desde);
      }
      if (filtros.fecha_hasta) {
        where.fecha_movimiento.lte = new Date(filtros.fecha_hasta);
      }
    }

    const skip = (filtros.page - 1) * filtros.limit;
    const take = filtros.limit;

    const [movimientos, total] = await Promise.all([
      prisma.movimientoAhorro.findMany({
        where,
        skip,
        take,
        include: {
          cuenta: {
            select: {
              id: true,
              numero_cuenta: true,
              socio: {
                select: {
                  codigo_socio: true,
                  nombre: true,
                  apellido: true,
                },
              },
              tipo_cuenta: {
                select: {
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: { fecha_movimiento: 'desc' },
      }),
      prisma.movimientoAhorro.count({ where }),
    ]);

    // Calcular totales
    const totales = await prisma.movimientoAhorro.aggregate({
      where,
      _sum: {
        monto_usd: true,
        monto_bs: true,
      },
    });

    res.json({
      success: true,
      data: movimientos,
      meta: {
        total,
        page: filtros.page,
        limit: filtros.limit,
        totalPages: Math.ceil(total / filtros.limit),
        totales: {
          total_usd: totales._sum.monto_usd || 0,
          total_bs: totales._sum.monto_bs || 0,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parámetros de consulta inválidos',
          details: error.errors,
        },
      });
      return;
    }

    logger.error('Error al consultar movimientos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al consultar movimientos',
      },
    });
  }
};

/**
 * GET /api/ahorro/estadisticas
 * Estadísticas generales de ahorro
 */
export const obtenerEstadisticas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalCuentas,
      cuentasActivas,
      cuentasInactivas,
      totalSaldos,
      totalBloqueado,
      totalMovimientos,
    ] = await Promise.all([
      prisma.cuentaAhorro.count(),
      prisma.cuentaAhorro.count({ where: { estado: true } }),
      prisma.cuentaAhorro.count({ where: { estado: false } }),
      prisma.cuentaAhorro.aggregate({
        _sum: {
          saldo_usd: true,
          saldo_bs: true,
        },
      }),
      prisma.cuentaAhorro.aggregate({
        _sum: {
          monto_bloqueado_usd: true,
          monto_bloqueado_bs: true,
        },
      }),
      prisma.movimientoAhorro.count(),
    ]);

    res.json({
      success: true,
      data: {
        total_cuentas: totalCuentas,
        cuentas_activas: cuentasActivas,
        cuentas_inactivas: cuentasInactivas,
        total_saldo_usd: totalSaldos._sum.saldo_usd || 0,
        total_saldo_bs: totalSaldos._sum.saldo_bs || 0,
        total_bloqueado_usd: totalBloqueado._sum.monto_bloqueado_usd || 0,
        total_bloqueado_bs: totalBloqueado._sum.monto_bloqueado_bs || 0,
        total_movimientos: totalMovimientos,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estadísticas',
      },
    });
  }
};

// ============================================
// UTILIDADES: RECÁLCULO DE SALDOS
// ============================================

/**
 * POST /api/ahorro/recalcular-saldos
 * Recalcular todos los saldos en Bs con la tasa actual
 * (Ejecutar cuando cambie la tasa de cambio)
 */
export const recalcularSaldos = async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtener tasa actual
    const tasaCambio = await obtenerTasaActual();

    // Obtener todas las cuentas activas
    const cuentas = await prisma.cuentaAhorro.findMany({
      where: { estado: true },
    });

    let actualizadas = 0;

    // Recalcular en lotes para evitar timeout
    for (const cuenta of cuentas) {
      const nuevoSaldoBs = Number(cuenta.saldo_usd) * tasaCambio;
      const nuevoBloqueadoBs = Number(cuenta.monto_bloqueado_usd) * tasaCambio;

      await prisma.cuentaAhorro.update({
        where: { id: cuenta.id },
        data: {
          saldo_bs: nuevoSaldoBs,
          monto_bloqueado_bs: nuevoBloqueadoBs,
        },
      });

      actualizadas++;
    }

    // Queda fuera de transacción a propósito: son miles de cuentas, una por
    // una, y lo que se audita es cuántas se actualizaron realmente
    await registrarAuditoria(prisma, {
      req,
      accion: 'ACTUALIZAR',
      modulo: 'ahorro',
      registro_id: null,
      despues: {
        accion: 'recalculo_masivo',
        tasa_aplicada: tasaCambio,
        cuentas_actualizadas: actualizadas,
      },
    });

    logger.info(`Saldos recalculados: ${actualizadas} cuentas con tasa ${tasaCambio}`);

    res.json({
      success: true,
      data: {
        tasa_aplicada: tasaCambio,
        cuentas_actualizadas: actualizadas,
      },
      message: `Saldos recalculados exitosamente para ${actualizadas} cuentas`,
    });
  } catch (error) {
    logger.error('Error al recalcular saldos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al recalcular saldos',
      },
    });
  }
};

// ============================================
// ENDPOINTS: ESTADÍSTICAS POR FERIA
// ============================================

/**
 * GET /api/ahorro/estadisticas/por-feria
 * Obtener estadísticas de ahorro agrupadas por feria/ubicación
 */
export const obtenerEstadisticasPorFeria = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipo_cuenta_id } = req.query;

    // Obtener todas las ubicaciones activas
    const ubicaciones = await prisma.ubicacion.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
    });

    // Construir filtro base
    const whereBase: Prisma.CuentaAhorroWhereInput = {
      estado: true,
    };

    if (tipo_cuenta_id) {
      whereBase.tipo_cuenta_id = Number(tipo_cuenta_id);
    }

    // Obtener estadísticas por cada ubicación
    const estadisticas = await Promise.all(
      ubicaciones.map(async (ubicacion) => {
        const where: Prisma.CuentaAhorroWhereInput = {
          ...whereBase,
          socio: {
            ubicacion_id: ubicacion.id,
            estado: 'activo',
          },
        };

        const [cuentas, totalSocios] = await Promise.all([
          prisma.cuentaAhorro.findMany({
            where,
            select: {
              saldo_usd: true,
              saldo_bs: true,
              monto_bloqueado_usd: true,
              monto_bloqueado_bs: true,
            },
          }),
          prisma.socio.count({
            where: {
              ubicacion_id: ubicacion.id,
              estado: 'activo',
            },
          }),
        ]);

        // Calcular totales
        const total_cuentas = cuentas.length;
        const total_saldo_usd = cuentas.reduce((sum, c) => sum + Number(c.saldo_usd), 0);
        const total_saldo_bs = cuentas.reduce((sum, c) => sum + Number(c.saldo_bs), 0);
        const total_bloqueado_usd = cuentas.reduce((sum, c) => sum + Number(c.monto_bloqueado_usd), 0);
        const total_bloqueado_bs = cuentas.reduce((sum, c) => sum + Number(c.monto_bloqueado_bs), 0);
        const promedio_saldo_usd = total_cuentas > 0 ? total_saldo_usd / total_cuentas : 0;

        return {
          ubicacion: {
            id: ubicacion.id,
            codigo: ubicacion.codigo,
            nombre: ubicacion.nombre,
          },
          socios_activos: totalSocios,
          cuentas: {
            total: total_cuentas,
            porcentaje_penetracion: totalSocios > 0 ? (total_cuentas / totalSocios) * 100 : 0,
          },
          saldos: {
            total_usd: total_saldo_usd,
            total_bs: total_saldo_bs,
            promedio_usd: promedio_saldo_usd,
            bloqueado_usd: total_bloqueado_usd,
            bloqueado_bs: total_bloqueado_bs,
          },
        };
      })
    );

    // Calcular totales generales
    const totales = estadisticas.reduce(
      (acc, est) => ({
        total_socios: acc.total_socios + est.socios_activos,
        total_cuentas: acc.total_cuentas + est.cuentas.total,
        total_saldo_usd: acc.total_saldo_usd + est.saldos.total_usd,
        total_saldo_bs: acc.total_saldo_bs + est.saldos.total_bs,
        total_bloqueado_usd: acc.total_bloqueado_usd + est.saldos.bloqueado_usd,
        total_bloqueado_bs: acc.total_bloqueado_bs + est.saldos.bloqueado_bs,
      }),
      {
        total_socios: 0,
        total_cuentas: 0,
        total_saldo_usd: 0,
        total_saldo_bs: 0,
        total_bloqueado_usd: 0,
        total_bloqueado_bs: 0,
      }
    );

    res.json({
      success: true,
      data: estadisticas,
      meta: {
        totales,
        total_ubicaciones: ubicaciones.length,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas por feria:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estadísticas por feria',
      },
    });
  }
};

/**
 * GET /api/ahorro/estadisticas/resumen-ferias
 * Obtener resumen simplificado de ahorro por ferias
 */
export const obtenerResumenPorFeria = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ubicaciones = await prisma.ubicacion.findMany({
      where: { estado: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        _count: {
          select: { socios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const resumen = await Promise.all(
      ubicaciones.map(async (ubicacion) => {
        const resultado = await prisma.cuentaAhorro.aggregate({
          where: {
            estado: true,
            socio: {
              ubicacion_id: ubicacion.id,
              estado: 'activo',
            },
          },
          _sum: {
            saldo_usd: true,
            saldo_bs: true,
          },
          _count: true,
        });

        return {
          ubicacion: {
            id: ubicacion.id,
            codigo: ubicacion.codigo,
            nombre: ubicacion.nombre,
          },
          total_socios: ubicacion._count.socios,
          total_cuentas: resultado._count,
          total_saldo_usd: Number(resultado._sum.saldo_usd || 0),
          total_saldo_bs: Number(resultado._sum.saldo_bs || 0),
        };
      })
    );

    res.json({
      success: true,
      data: resumen,
    });
  } catch (error) {
    logger.error('Error al obtener resumen por feria:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener resumen por feria',
      },
    });
  }
};
