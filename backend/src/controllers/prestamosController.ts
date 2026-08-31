// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Préstamos: otorgamiento, plan de pagos, abonos y fiadores
// ============================================
//
// Modelo de cálculo: amortización con cuota fija semanal (sistema francés),
// que es lo que define el esquema (`cuota_semanal_usd` + tabla `plan_pagos`
// con capital e interés desglosados por cuota).
//
// Un abono se aplica SIEMPRE en el orden mora → interés → capital.

import type { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { generarPlanPagos, calcularMora, distribuirAbono } from '../utils/amortizacion';
import { resolverTasa } from '../services/tasaCambioService';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const simularSchema = z.object({
  tipo_prestamo_id: z.coerce.number().int().positive(),
  monto_usd: z.coerce.number().positive('El monto debe ser mayor a cero'),
  plazo_semanas: z.coerce.number().int().min(1).max(520),
  fecha_desembolso: z.string().optional(),
});

const fiadorSchema = z.object({
  socio_id: z.number().int().positive(),
  monto_garantizado_usd: z.number().positive(),
});

const crearPrestamoSchema = z.object({
  socio_id: z.number().int().positive(),
  tipo_prestamo_id: z.number().int().positive(),
  monto_usd: z.number().positive('El monto debe ser mayor a cero'),
  plazo_semanas: z.number().int().min(1).max(520),
  fecha_desembolso: z.string().min(1, 'Indique la fecha de desembolso'),
  fiadores: z.array(fiadorSchema).optional().default([]),
});

const abonoSchema = z.object({
  monto_usd: z.number().positive('El monto debe ser mayor a cero'),
  concepto: z.string().max(300).optional().nullable(),
});

// ============================================
// HELPERS
// ============================================

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

const responderError = (res: Response, error: unknown, mensaje: string): void => {
  if (error instanceof BadRequestError || error instanceof ConflictError || error instanceof NotFoundError) {
    res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
    return;
  }
  logger.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: mensaje } });
};

/**
 * Tasa vigente. Delega en el servicio central, que resuelve con respaldo
 * (parámetro -> histórico -> constante) y nunca falla.
 */
async function obtenerTasaActual(): Promise<number> {
  const { tasa } = await resolverTasa();
  return tasa;
}

/** Correlativo anual: PR-2026-00001 */
async function generarNumeroPrestamo(): Promise<string> {
  const ano = new Date().getFullYear();
  const prefijo = `PR-${ano}-`;

  const ultimo = await prisma.prestamo.findFirst({
    where: { numero_prestamo: { startsWith: prefijo } },
    orderBy: { numero_prestamo: 'desc' },
    select: { numero_prestamo: true },
  });

  const siguiente = ultimo ? parseInt(ultimo.numero_prestamo.slice(prefijo.length), 10) + 1 : 1;
  return `${prefijo}${String(siguiente).padStart(5, '0')}`;
}

/**
 * Recalcula la mora de un préstamo según las cuotas vencidas impagas y
 * marca como `vencida` a las que corresponda.
 */
async function actualizarMoraYCuotas(prestamoId: number): Promise<number> {
  const prestamo = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    include: { tipo_prestamo: true, plan_pagos: true },
  });
  if (!prestamo) throw new NotFoundError('Préstamo no encontrado');

  const hoy = new Date();
  const vencidas = prestamo.plan_pagos.filter(
    (c) => c.estado !== 'pagada' && c.fecha_vencimiento < hoy
  );

  // Las cuotas pendientes que ya pasaron su fecha quedan marcadas
  const porMarcar = vencidas.filter((c) => c.estado === 'pendiente').map((c) => c.id);
  if (porMarcar.length > 0) {
    await prisma.planPago.updateMany({ where: { id: { in: porMarcar } }, data: { estado: 'vencida' } });
  }

  const mora = calcularMora(
    vencidas.map((c) => ({
      monto_total_usd: Number(c.monto_total_usd),
      fecha_vencimiento: c.fecha_vencimiento,
    })),
    Number(prestamo.tipo_prestamo.tasa_mora_mensual),
    hoy
  );

  const tasa = Number(prestamo.tasa_cambio_inicial);
  await prisma.prestamo.update({
    where: { id: prestamoId },
    data: {
      saldo_mora_usd: mora,
      saldo_mora_bs: redondear(mora * tasa),
      // Con cuotas vencidas el préstamo pasa a moroso; sin ellas vuelve a activo
      ...(prestamo.estado === 'activo' && vencidas.length > 0 ? { estado: 'moroso' as const } : {}),
      ...(prestamo.estado === 'moroso' && vencidas.length === 0 ? { estado: 'activo' as const } : {}),
    },
  });

  return mora;
}

// ============================================
// SIMULACIÓN
// ============================================

/**
 * GET /api/prestamos/simular?tipo_prestamo_id=&monto_usd=&plazo_semanas=
 *
 * Devuelve la cuota y el plan completo SIN crear nada. Permite mostrarle al
 * socio cuánto pagaría antes de decidir, que hoy se hace a mano.
 */
export const simularPrestamo = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = simularSchema.safeParse(req.query);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const { tipo_prestamo_id, monto_usd, plazo_semanas, fecha_desembolso } = validacion.data;

    const tipo = await prisma.tipoPrestamo.findUnique({ where: { id: tipo_prestamo_id } });
    if (!tipo) throw new NotFoundError('Tipo de préstamo no encontrado');
    if (!tipo.estado) throw new BadRequestError('El tipo de préstamo está inactivo');

    if (plazo_semanas > tipo.plazo_maximo_semanas) {
      throw new BadRequestError(
        `El plazo excede el máximo de ${tipo.plazo_maximo_semanas} semanas para ${tipo.nombre}`
      );
    }

    const fecha = fecha_desembolso ? new Date(fecha_desembolso) : new Date();
    if (isNaN(fecha.getTime())) throw new BadRequestError('Fecha de desembolso inválida');

    const resultado = generarPlanPagos(monto_usd, Number(tipo.tasa_interes_anual), plazo_semanas, fecha);
    const tasaCambio = await obtenerTasaActual();

    res.json({
      success: true,
      data: {
        tipo_prestamo: { id: tipo.id, codigo: tipo.codigo, nombre: tipo.nombre },
        monto_usd,
        plazo_semanas,
        tasa_interes_anual: Number(tipo.tasa_interes_anual),
        tasa_cambio: tasaCambio,
        requiere_fiadores: tipo.requiere_fiadores,
        ...resultado,
        cuota_semanal_bs: redondear(resultado.cuota_semanal_usd * tasaCambio),
        total_a_pagar_bs: redondear(resultado.total_a_pagar_usd * tasaCambio),
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al simular el préstamo');
  }
};

// ============================================
// OTORGAMIENTO
// ============================================

/**
 * POST /api/prestamos
 *
 * Crea el préstamo, genera su plan de pagos completo y bloquea el ahorro de
 * los fiadores, todo en una transacción.
 */
export const crearPrestamo = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = crearPrestamoSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const datos = validacion.data;

    const [socio, tipo] = await Promise.all([
      prisma.socio.findUnique({ where: { id: datos.socio_id } }),
      prisma.tipoPrestamo.findUnique({ where: { id: datos.tipo_prestamo_id } }),
    ]);

    if (!socio) throw new NotFoundError('Socio no encontrado');
    if (socio.estado !== 'activo') {
      throw new BadRequestError(`El socio está ${socio.estado}; no puede recibir un préstamo`);
    }
    if (!tipo) throw new NotFoundError('Tipo de préstamo no encontrado');
    if (!tipo.estado) throw new BadRequestError('El tipo de préstamo está inactivo');
    if (datos.plazo_semanas > tipo.plazo_maximo_semanas) {
      throw new BadRequestError(`El plazo excede el máximo de ${tipo.plazo_maximo_semanas} semanas`);
    }

    // Un socio no puede tener dos préstamos abiertos a la vez
    const abierto = await prisma.prestamo.findFirst({
      where: { socio_id: datos.socio_id, estado: { in: ['activo', 'moroso'] } },
    });
    if (abierto) {
      throw new ConflictError(
        `El socio ya tiene el préstamo ${abierto.numero_prestamo} sin saldar`
      );
    }

    // --- Fiadores ---
    if (tipo.requiere_fiadores && datos.fiadores.length === 0) {
      throw new BadRequestError(`${tipo.nombre} requiere al menos un fiador`);
    }

    const parametro = await prisma.parametroSistema.findUnique({
      where: { clave: 'PORCENTAJE_AHORRO_FIADOR' },
    });
    const porcentajeRequerido = Number(parametro?.valor ?? 30);

    if (datos.fiadores.length > 0) {
      const totalGarantizado = datos.fiadores.reduce((a, f) => a + f.monto_garantizado_usd, 0);
      const minimo = redondear(datos.monto_usd * (porcentajeRequerido / 100));

      if (totalGarantizado < minimo) {
        throw new BadRequestError(
          `Las garantías suman $${redondear(totalGarantizado)} y deben cubrir al menos ` +
            `$${minimo} (${porcentajeRequerido}% del préstamo)`
        );
      }

      // Cada fiador debe tener ahorro libre suficiente
      for (const fiador of datos.fiadores) {
        if (fiador.socio_id === datos.socio_id) {
          throw new BadRequestError('El socio no puede ser fiador de su propio préstamo');
        }

        const cuentas = await prisma.cuentaAhorro.findMany({
          where: { socio_id: fiador.socio_id, estado: true },
        });
        const disponible = cuentas.reduce(
          (a, c) => a + (Number(c.saldo_usd) - Number(c.monto_bloqueado_usd)),
          0
        );

        if (disponible < fiador.monto_garantizado_usd) {
          const s = await prisma.socio.findUnique({ where: { id: fiador.socio_id } });
          throw new BadRequestError(
            `El fiador ${s?.codigo_socio ?? fiador.socio_id} tiene $${redondear(disponible)} ` +
              `disponible y debe garantizar $${fiador.monto_garantizado_usd}`
          );
        }
      }
    }

    const fechaDesembolso = new Date(datos.fecha_desembolso);
    if (isNaN(fechaDesembolso.getTime())) throw new BadRequestError('Fecha de desembolso inválida');

    const tasaCambio = await obtenerTasaActual();
    const resultado = generarPlanPagos(
      datos.monto_usd,
      Number(tipo.tasa_interes_anual),
      datos.plazo_semanas,
      fechaDesembolso
    );
    const numero = await generarNumeroPrestamo();

    const fechaVencimiento = resultado.plan[resultado.plan.length - 1]!.fecha_vencimiento;

    const prestamo = await prisma.$transaction(async (tx) => {
      const creado = await tx.prestamo.create({
        data: {
          socio_id: datos.socio_id,
          tipo_prestamo_id: datos.tipo_prestamo_id,
          numero_prestamo: numero,
          monto_original_usd: datos.monto_usd,
          monto_original_bs: redondear(datos.monto_usd * tasaCambio),
          tasa_cambio_inicial: tasaCambio,
          tasa_interes: Number(tipo.tasa_interes_anual),
          plazo_semanas: datos.plazo_semanas,
          cuota_semanal_usd: resultado.cuota_semanal_usd,
          cuota_semanal_bs: redondear(resultado.cuota_semanal_usd * tasaCambio),
          saldo_capital_usd: datos.monto_usd,
          saldo_capital_bs: redondear(datos.monto_usd * tasaCambio),
          saldo_interes_usd: resultado.total_interes_usd,
          saldo_interes_bs: redondear(resultado.total_interes_usd * tasaCambio),
          fecha_desembolso: fechaDesembolso,
          fecha_vencimiento: fechaVencimiento,
        },
      });

      await tx.planPago.createMany({
        data: resultado.plan.map((c) => ({
          prestamo_id: creado.id,
          numero_cuota: c.numero_cuota,
          fecha_vencimiento: c.fecha_vencimiento,
          monto_capital_usd: c.monto_capital_usd,
          monto_capital_bs: redondear(c.monto_capital_usd * tasaCambio),
          monto_interes_usd: c.monto_interes_usd,
          monto_interes_bs: redondear(c.monto_interes_usd * tasaCambio),
          monto_total_usd: c.monto_total_usd,
          monto_total_bs: redondear(c.monto_total_usd * tasaCambio),
        })),
      });

      // Bloquear el ahorro de cada fiador
      for (const fiador of datos.fiadores) {
        await tx.fiador.create({
          data: {
            prestamo_id: creado.id,
            socio_id: fiador.socio_id,
            monto_garantizado_usd: fiador.monto_garantizado_usd,
            monto_garantizado_bs: redondear(fiador.monto_garantizado_usd * tasaCambio),
            monto_bloqueado_usd: fiador.monto_garantizado_usd,
            monto_bloqueado_bs: redondear(fiador.monto_garantizado_usd * tasaCambio),
          },
        });

        // Se bloquea sobre la primera cuenta con saldo libre suficiente
        const cuentas = await tx.cuentaAhorro.findMany({
          where: { socio_id: fiador.socio_id, estado: true },
          orderBy: { saldo_usd: 'desc' },
        });
        let porBloquear = fiador.monto_garantizado_usd;
        for (const cuenta of cuentas) {
          if (porBloquear <= 0) break;
          const libre = Number(cuenta.saldo_usd) - Number(cuenta.monto_bloqueado_usd);
          const bloquear = Math.min(libre, porBloquear);
          if (bloquear <= 0) continue;

          await tx.cuentaAhorro.update({
            where: { id: cuenta.id },
            data: {
              monto_bloqueado_usd: redondear(Number(cuenta.monto_bloqueado_usd) + bloquear),
              monto_bloqueado_bs: redondear((Number(cuenta.monto_bloqueado_usd) + bloquear) * tasaCambio),
            },
          });
          porBloquear = redondear(porBloquear - bloquear);
        }
      }

      await tx.auditLog.create({
        data: {
          usuario_id: req.user!.userId,
          accion: 'CREAR',
          modulo: 'prestamos',
          registro_id: creado.id,
          datos_despues: { numero, monto: datos.monto_usd, plazo: datos.plazo_semanas } as any,
          ip_address: req.ip || 'unknown',
          user_agent: req.get('user-agent') || 'unknown',
        },
      });

      return creado;
    });

    logger.info(`Préstamo ${numero} otorgado: $${datos.monto_usd} a ${datos.plazo_semanas} semanas`);

    const completo = await prisma.prestamo.findUnique({
      where: { id: prestamo.id },
      include: {
        socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
        tipo_prestamo: true,
        fiadores: { include: { socio: { select: { codigo_socio: true, nombre: true, apellido: true } } } },
        plan_pagos: { orderBy: { numero_cuota: 'asc' } },
      },
    });

    res.status(201).json({ success: true, data: completo });
  } catch (error) {
    responderError(res, error, 'Error al otorgar el préstamo');
  }
};

// ============================================
// CONSULTAS
// ============================================

/** GET /api/prestamos?estado=&socio_id=&busqueda=&page=&limit= */
export const listarPrestamos = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '50'), 10) || 50);
    const estado = req.query.estado ? String(req.query.estado) : undefined;
    const socioId = req.query.socio_id ? parseInt(String(req.query.socio_id), 10) : undefined;
    const busqueda = req.query.busqueda ? String(req.query.busqueda).trim() : '';

    const where: Prisma.PrestamoWhereInput = {};
    if (estado && estado !== 'todos') where.estado = estado as Prisma.EnumEstadoPrestamoFilter['equals'];
    if (socioId) where.socio_id = socioId;
    if (busqueda) {
      where.OR = [
        { numero_prestamo: { contains: busqueda, mode: 'insensitive' } },
        { socio: { codigo_socio: { contains: busqueda, mode: 'insensitive' } } },
        { socio: { cedula: { contains: busqueda, mode: 'insensitive' } } },
        { socio: { apellido: { contains: busqueda, mode: 'insensitive' } } },
      ];
    }

    const [prestamos, total, agregado] = await Promise.all([
      prisma.prestamo.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          socio: { select: { id: true, codigo_socio: true, cedula: true, nombre: true, apellido: true } },
          tipo_prestamo: { select: { codigo: true, nombre: true } },
          _count: { select: { abonos: true, fiadores: true } },
        },
      }),
      prisma.prestamo.count({ where }),
      prisma.prestamo.aggregate({
        where,
        _sum: { saldo_capital_usd: true, saldo_interes_usd: true, saldo_mora_usd: true, monto_original_usd: true },
      }),
    ]);

    res.json({
      success: true,
      data: prestamos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totales: {
          otorgado_usd: Number(agregado._sum.monto_original_usd ?? 0),
          capital_usd: Number(agregado._sum.saldo_capital_usd ?? 0),
          interes_usd: Number(agregado._sum.saldo_interes_usd ?? 0),
          mora_usd: Number(agregado._sum.saldo_mora_usd ?? 0),
        },
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al listar los préstamos');
  }
};

/** GET /api/prestamos/:id — ficha completa con plan, abonos y fiadores */
export const obtenerPrestamo = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new BadRequestError('ID inválido');

    // La mora depende de la fecha, así que se recalcula al consultar
    await actualizarMoraYCuotas(id);

    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: {
        socio: { select: { id: true, codigo_socio: true, cedula: true, nombre: true, apellido: true, telefono: true } },
        tipo_prestamo: true,
        fiadores: {
          include: { socio: { select: { id: true, codigo_socio: true, cedula: true, nombre: true, apellido: true } } },
        },
        plan_pagos: { orderBy: { numero_cuota: 'asc' } },
        abonos: { orderBy: { fecha_abono: 'desc' } },
      },
    });

    if (!prestamo) throw new NotFoundError('Préstamo no encontrado');

    const cuotasPagadas = prestamo.plan_pagos.filter((c) => c.estado === 'pagada').length;
    const cuotasVencidas = prestamo.plan_pagos.filter((c) => c.estado === 'vencida').length;
    const totalAbonado = prestamo.abonos.reduce((a, ab) => a + Number(ab.monto_usd), 0);

    res.json({
      success: true,
      data: {
        ...prestamo,
        resumen: {
          cuotas_totales: prestamo.plan_pagos.length,
          cuotas_pagadas: cuotasPagadas,
          cuotas_vencidas: cuotasVencidas,
          total_abonado_usd: redondear(totalAbonado),
          deuda_total_usd: redondear(
            Number(prestamo.saldo_capital_usd) +
              Number(prestamo.saldo_interes_usd) +
              Number(prestamo.saldo_mora_usd)
          ),
          avance_porcentaje:
            prestamo.plan_pagos.length > 0
              ? Math.round((cuotasPagadas / prestamo.plan_pagos.length) * 1000) / 10
              : 0,
        },
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al obtener el préstamo');
  }
};

// ============================================
// ABONOS
// ============================================

/**
 * POST /api/prestamos/:id/abonos
 *
 * Aplica un pago en el orden mora → interés → capital, marca las cuotas que
 * queden cubiertas y, si el saldo llega a cero, salda el préstamo y libera a
 * los fiadores devolviéndoles el ahorro bloqueado.
 */
export const registrarAbono = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new BadRequestError('ID inválido');

    const validacion = abonoSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    await actualizarMoraYCuotas(id);

    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: { plan_pagos: { orderBy: { numero_cuota: 'asc' } } },
    });
    if (!prestamo) throw new NotFoundError('Préstamo no encontrado');
    if (prestamo.estado === 'saldado') throw new ConflictError('El préstamo ya está saldado');
    if (prestamo.estado === 'cancelado') throw new ConflictError('El préstamo está cancelado');

    const monto = redondear(validacion.data.monto_usd);
    const tasa = await obtenerTasaActual();

    const reparto = distribuirAbono(
      monto,
      Number(prestamo.saldo_mora_usd),
      Number(prestamo.saldo_interes_usd),
      Number(prestamo.saldo_capital_usd)
    );

    if (reparto.sobrante > 0) {
      throw new BadRequestError(
        `El abono excede la deuda en $${reparto.sobrante}. La deuda total es $${redondear(
          Number(prestamo.saldo_mora_usd) +
            Number(prestamo.saldo_interes_usd) +
            Number(prestamo.saldo_capital_usd)
        )}`
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const abono = await tx.abonoPrestamo.create({
        data: {
          prestamo_id: id,
          monto_usd: monto,
          monto_bs: redondear(monto * tasa),
          tasa_cambio: tasa,
          aplicado_capital_usd: reparto.capital,
          aplicado_capital_bs: redondear(reparto.capital * tasa),
          aplicado_interes_usd: reparto.interes,
          aplicado_interes_bs: redondear(reparto.interes * tasa),
          aplicado_mora_usd: reparto.mora,
          aplicado_mora_bs: redondear(reparto.mora * tasa),
          concepto: validacion.data.concepto ?? 'Abono a préstamo',
        },
      });

      const nuevoCapital = redondear(Number(prestamo.saldo_capital_usd) - reparto.capital);
      const nuevoInteres = redondear(Number(prestamo.saldo_interes_usd) - reparto.interes);
      const nuevaMora = redondear(Number(prestamo.saldo_mora_usd) - reparto.mora);
      const saldado = nuevoCapital <= 0 && nuevoInteres <= 0 && nuevaMora <= 0;

      // Se marcan como pagadas tantas cuotas como cubra lo abonado
      let restante = redondear(reparto.capital + reparto.interes);
      const pendientes = prestamo.plan_pagos.filter((c) => c.estado !== 'pagada');
      for (const cuota of pendientes) {
        const totalCuota = Number(cuota.monto_total_usd);
        if (restante + 0.009 < totalCuota) break;
        await tx.planPago.update({
          where: { id: cuota.id },
          data: { estado: 'pagada', fecha_pago: new Date() },
        });
        restante = redondear(restante - totalCuota);
      }

      await tx.prestamo.update({
        where: { id },
        data: {
          saldo_capital_usd: Math.max(nuevoCapital, 0),
          saldo_capital_bs: redondear(Math.max(nuevoCapital, 0) * tasa),
          saldo_interes_usd: Math.max(nuevoInteres, 0),
          saldo_interes_bs: redondear(Math.max(nuevoInteres, 0) * tasa),
          saldo_mora_usd: Math.max(nuevaMora, 0),
          saldo_mora_bs: redondear(Math.max(nuevaMora, 0) * tasa),
          ...(saldado ? { estado: 'saldado' as const } : {}),
        },
      });

      // Al saldarse, los fiadores recuperan su ahorro bloqueado
      if (saldado) {
        const fiadores = await tx.fiador.findMany({ where: { prestamo_id: id, estado: 'activo' } });
        for (const fiador of fiadores) {
          let porLiberar = Number(fiador.monto_bloqueado_usd);
          const cuentas = await tx.cuentaAhorro.findMany({
            where: { socio_id: fiador.socio_id, monto_bloqueado_usd: { gt: 0 } },
          });
          for (const cuenta of cuentas) {
            if (porLiberar <= 0) break;
            const liberar = Math.min(Number(cuenta.monto_bloqueado_usd), porLiberar);
            const restanteBloqueado = redondear(Number(cuenta.monto_bloqueado_usd) - liberar);
            await tx.cuentaAhorro.update({
              where: { id: cuenta.id },
              data: {
                monto_bloqueado_usd: restanteBloqueado,
                monto_bloqueado_bs: redondear(restanteBloqueado * tasa),
              },
            });
            porLiberar = redondear(porLiberar - liberar);
          }

          await tx.fiador.update({
            where: { id: fiador.id },
            data: { estado: 'liberado', fecha_liberacion: new Date() },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          usuario_id: req.user!.userId,
          accion: 'ABONO_PRESTAMO',
          modulo: 'prestamos',
          registro_id: id,
          datos_despues: { monto, reparto, saldado } as any,
          ip_address: req.ip || 'unknown',
          user_agent: req.get('user-agent') || 'unknown',
        },
      });

      return { abono, saldado };
    });

    logger.info(
      `Abono de $${monto} al préstamo ${prestamo.numero_prestamo}` +
        (resultado.saldado ? ' — SALDADO, fiadores liberados' : '')
    );

    res.status(201).json({
      success: true,
      data: { abono: resultado.abono, reparto, saldado: resultado.saldado },
    });
  } catch (error) {
    responderError(res, error, 'Error al registrar el abono');
  }
};

// ============================================
// REPORTES
// ============================================

/**
 * GET /api/prestamos/reportes/cartera
 *
 * Reemplaza los cuatro listados del sistema viejo (Por Cobrar, Cobrados,
 * Morosos, Emitidos) con un solo endpoint filtrado por estado.
 */
export const reporteCartera = async (req: Request, res: Response): Promise<void> => {
  try {
    const vista = String(req.query.vista ?? 'por_cobrar');

    const filtros: Record<string, Prisma.PrestamoWhereInput> = {
      por_cobrar: { estado: { in: ['activo', 'moroso'] } },
      morosos: { estado: 'moroso' },
      cobrados: { estado: 'saldado' },
      emitidos: {},
    };

    const where = filtros[vista] ?? filtros.por_cobrar!;

    const prestamos = await prisma.prestamo.findMany({
      where,
      orderBy: { fecha_desembolso: 'desc' },
      include: {
        socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true, telefono: true } },
        tipo_prestamo: { select: { codigo: true, nombre: true } },
        plan_pagos: { select: { estado: true } },
      },
    });

    const filas = prestamos.map((p) => {
      const vencidas = p.plan_pagos.filter((c) => c.estado === 'vencida').length;
      const pagadas = p.plan_pagos.filter((c) => c.estado === 'pagada').length;
      return {
        id: p.id,
        numero_prestamo: p.numero_prestamo,
        codigo_socio: p.socio.codigo_socio,
        cedula: p.socio.cedula,
        socio: `${p.socio.apellido}, ${p.socio.nombre}`,
        telefono: p.socio.telefono,
        tipo: p.tipo_prestamo.nombre,
        monto_original_usd: Number(p.monto_original_usd),
        saldo_capital_usd: Number(p.saldo_capital_usd),
        saldo_interes_usd: Number(p.saldo_interes_usd),
        saldo_mora_usd: Number(p.saldo_mora_usd),
        deuda_total_usd: redondear(
          Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd)
        ),
        cuotas_pagadas: pagadas,
        cuotas_vencidas: vencidas,
        cuotas_totales: p.plan_pagos.length,
        estado: p.estado,
        fecha_desembolso: p.fecha_desembolso,
        fecha_vencimiento: p.fecha_vencimiento,
      };
    });

    res.json({
      success: true,
      data: {
        vista,
        filas,
        resumen: {
          cantidad: filas.length,
          otorgado_usd: redondear(filas.reduce((a, f) => a + f.monto_original_usd, 0)),
          por_cobrar_usd: redondear(filas.reduce((a, f) => a + f.deuda_total_usd, 0)),
          mora_usd: redondear(filas.reduce((a, f) => a + f.saldo_mora_usd, 0)),
        },
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al generar el reporte de cartera');
  }
};

/** GET /api/prestamos/socio/:socioId — préstamos de un socio, para la colecta */
export const prestamosPorSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(String(req.params.socioId), 10);
    if (isNaN(socioId)) throw new BadRequestError('ID de socio inválido');

    const prestamos = await prisma.prestamo.findMany({
      where: { socio_id: socioId, estado: { in: ['activo', 'moroso'] } },
      include: { tipo_prestamo: { select: { codigo: true, nombre: true } } },
      orderBy: { fecha_desembolso: 'desc' },
    });

    // La mora depende de la fecha: se refresca antes de mostrarla en caja
    for (const p of prestamos) {
      await actualizarMoraYCuotas(p.id);
    }

    const actualizados = await prisma.prestamo.findMany({
      where: { socio_id: socioId, estado: { in: ['activo', 'moroso'] } },
      include: { tipo_prestamo: { select: { codigo: true, nombre: true } } },
      orderBy: { fecha_desembolso: 'desc' },
    });

    res.json({ success: true, data: actualizados });
  } catch (error) {
    responderError(res, error, 'Error al obtener los préstamos del socio');
  }
};
