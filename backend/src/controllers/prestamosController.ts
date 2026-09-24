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
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { exigirPermisoSiEsDeDiaAnterior } from '../utils/reversoDelDia';
// `calcularMora` sólo se usa con los préstamos anteriores al cálculo nuevo
import { calcularMora, distribuirAbono } from '../utils/amortizacion';
import { ponerInteresAlDia, usaInteresDiario } from '../services/interesPrestamoService';
import { ahorroLibre, bloquearAhorro } from '../services/garantiaPrestamoService';
import { condicionesDelMonto, DIAS_POR_CUOTA, planDeCuotas, situacionDeAtraso } from '../utils/planPrestamo';
import { fechaDia, hoyDia } from '../utils/fechaDia';
import { resolverTasa } from '../services/tasaCambioService';
import { carteraPrestamos } from '../services/carteraService';
import { registrarAuditoria } from '../services/auditoriaService';
import { bloquearSocio, bloquearSocios } from '../utils/bloqueos';
import {
  ajustarGarantias,
  sincronizarCuotas,
} from '../services/abonosPrestamoService';

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const simularSchema = z.object({
  tipo_prestamo_id: z.coerce.number().int().positive(),
  monto_usd: z.coerce.number().positive('El monto debe ser mayor a cero'),
  // El plazo sale de la tabla por monto: se acepta por compatibilidad y se ignora
  plazo_semanas: z.coerce.number().int().min(1).max(520).optional(),
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
  // Las cuotas salen de la tabla por monto: el plazo ya no se elige
  plazo_semanas: z.number().int().min(1).max(520).optional(),
  fecha_desembolso: z.string().min(1, 'Indique la fecha de entrega'),
  fiadores: z.array(fiadorSchema).optional().default([]),
  // Inicial que se paga al llevarse el producto: con ahorro, en bolívares o mezclando
  inicial_ahorro_usd: z.number().min(0).optional().default(0),
  inicial_efectivo_usd: z.number().min(0).optional().default(0),
  inicial_efectivo_bs: z.number().min(0).optional().default(0),
  observaciones: z.string().trim().max(500).optional().nullable(),
});

const aprobarPrestamoSchema = z.object({
  fecha_entrega: z.string().min(1, 'Indique la fecha de entrega'),
  inicial_ahorro_usd: z.number().min(0).optional().default(0),
  inicial_efectivo_usd: z.number().min(0).optional().default(0),
  inicial_efectivo_bs: z.number().min(0).optional().default(0),
  observaciones: z.string().trim().max(500).optional().nullable(),
});

const abonoSchema = z.object({
  monto_usd: z.number().positive('El monto debe ser mayor a cero'),
  concepto: z.string().max(300).optional().nullable(),
});

const reversarAbonoSchema = z.object({
  motivo: z.string().trim().min(5, 'Explique el motivo del reverso').max(500),
});

// ============================================
// HELPERS
// ============================================

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

const responderError = (res: Response, error: unknown, mensaje: string): void => {
  if (
    error instanceof BadRequestError ||
    error instanceof ConflictError ||
    error instanceof ForbiddenError ||
    error instanceof NotFoundError
  ) {
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
 * Pone al día la situación del préstamo: marca las cuotas vencidas y, en los
 * préstamos anteriores al cálculo nuevo, recalcula la mora.
 *
 * Con el cálculo confirmado por la cooperativa NO hay recargo por atraso: el
 * interés ya corre por día sobre el saldo, a los 21 días de la cuota más vieja
 * impaga el socio recibe un aviso y a los 30 queda moroso.
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

  if (usaInteresDiario(prestamo)) {
    await ponerInteresAlDia(prisma, prestamo);
    const { situacion } = situacionDeAtraso(
      prestamo.plan_pagos.map((c) => ({ fecha_vencimiento: c.fecha_vencimiento, pagada: c.estado === 'pagada' })),
      hoy
    );
    await prisma.prestamo.update({
      where: { id: prestamoId },
      data: {
        saldo_mora_usd: 0,
        saldo_mora_bs: 0,
        ...(prestamo.estado === 'activo' && situacion === 'moroso' ? { estado: 'moroso' as const } : {}),
        ...(prestamo.estado === 'moroso' && situacion !== 'moroso' ? { estado: 'activo' as const } : {}),
      },
    });
    return 0;
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

/**
 * El préstamo con todo lo que muestra la pantalla: fiadores, plan, abonos y el
 * resumen calculado. Lo devuelven la consulta, el alta y la aprobación, para
 * que las tres respondan lo mismo.
 */
async function prestamoConResumen(id: number) {
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
  // Los abonos reversados siguen en la lista, pero ya no cuentan como pagados
  const totalAbonado = prestamo.abonos.filter((ab) => !ab.reversado).reduce((a, ab) => a + Number(ab.monto_usd), 0);

  return {
    ...prestamo,
    resumen: {
      cuotas_totales: prestamo.plan_pagos.length,
      cuotas_pagadas: cuotasPagadas,
      cuotas_vencidas: cuotasVencidas,
      total_abonado_usd: redondear(totalAbonado),
      deuda_total_usd: redondear(
        Number(prestamo.saldo_capital_usd) + Number(prestamo.saldo_interes_usd) + Number(prestamo.saldo_mora_usd)
      ),
      avance_porcentaje:
        prestamo.plan_pagos.length > 0
          ? Math.round((cuotasPagadas / prestamo.plan_pagos.length) * 1000) / 10
          : 0,
    },
  };
}

/**
 * Entrega del préstamo: se cobra la inicial, se bloquea el ahorro que lo
 * respalda —el del socio y el de sus fiadores— y se arma el plan de cuotas.
 *
 * Es lo que pasa al otorgarlo, cuando el socio lo cubre con su propio ahorro, y
 * lo que pasa al aprobarlo en la reunión de los martes, cuando no lo cubre.
 */
async function entregarPrestamo(
  tx: Prisma.TransactionClient,
  prestamoId: number,
  opciones: {
    fechaEntrega: Date;
    tasaCambio: number;
    tasaMensual: number;
    inicial: { ahorro_usd: number; efectivo_usd: number; efectivo_bs: number };
  }
): Promise<void> {
  const { fechaEntrega, tasaCambio, tasaMensual, inicial } = opciones;
  const prestamo = await tx.prestamo.findUniqueOrThrow({ where: { id: prestamoId }, include: { fiadores: true } });
  const monto = Number(prestamo.monto_original_usd);
  const condiciones = condicionesDelMonto(monto);

  // La inicial se paga al llevarse el producto: con ahorro en divisas, en
  // bolívares, o mezclando las dos
  const efectivoUsd = redondear(
    inicial.efectivo_usd + (inicial.efectivo_bs > 0 ? inicial.efectivo_bs / tasaCambio : 0)
  );
  const cubierta = redondear(inicial.ahorro_usd + efectivoUsd);
  if (cubierta + 0.009 < condiciones.inicial_usd) {
    throw new BadRequestError(
      `La inicial es $${condiciones.inicial_usd} (${condiciones.tramo.inicial_porcentaje}% de $${monto}) ` +
        `y se están cubriendo $${cubierta}`
    );
  }
  // Se admite la diferencia del cambio a bolívares, pero un exceso grande suele
  // ser un monto mal tecleado: mejor avisar que guardarlo
  const tolerancia = Math.max(1, redondear(condiciones.inicial_usd * 0.01));
  if (cubierta > condiciones.inicial_usd + tolerancia) {
    throw new BadRequestError(
      `Se están pagando $${cubierta} de inicial y corresponden $${condiciones.inicial_usd}. ` +
        'Revise el monto.'
    );
  }
  // Lo que se guarda es lo que cubre la inicial: el ahorro primero
  const ahorroAplicado = Math.min(redondear(inicial.ahorro_usd), condiciones.inicial_usd);
  const efectivoAplicado = redondear(Math.min(efectivoUsd, condiciones.inicial_usd - ahorroAplicado));

  // Del ahorro del socio se bloquea la parte de la inicial que paga con ahorro
  // y, con lo que le quede, la garantía del saldo deudor. Los fiadores cubren
  // lo que falte, y se van liberando a medida que paga.
  const libre = await ahorroLibre(tx, prestamo.socio_id);
  if (ahorroAplicado > libre + 0.009) {
    throw new BadRequestError(`El socio tiene $${libre} de ahorro libre y no alcanza para $${ahorroAplicado} de inicial`);
  }
  const garantiaPropia = redondear(Math.max(0, Math.min(libre - ahorroAplicado, condiciones.financiado_usd)));
  await bloquearAhorro(tx, prestamo.socio_id, redondear(ahorroAplicado + garantiaPropia), tasaCambio);

  for (const fiador of prestamo.fiadores) {
    if (Number(fiador.monto_bloqueado_usd) > 0) continue;
    await bloquearAhorro(tx, fiador.socio_id, Number(fiador.monto_garantizado_usd), tasaCambio, 'fiador');
    await tx.fiador.update({
      where: { id: fiador.id },
      data: {
        monto_bloqueado_usd: fiador.monto_garantizado_usd,
        monto_bloqueado_bs: redondear(Number(fiador.monto_garantizado_usd) * tasaCambio),
      },
    });
  }

  // Las cuotas reparten el saldo deudor que queda después de la inicial
  const plan = planDeCuotas(condiciones.financiado_usd, condiciones.cuotas, tasaMensual, fechaEntrega);
  await tx.planPago.createMany({
    data: plan.map((c) => ({
      prestamo_id: prestamoId,
      numero_cuota: c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      monto_capital_usd: c.monto_capital_usd,
      monto_capital_bs: redondear(c.monto_capital_usd * tasaCambio),
      // El interés del plan es estimado: el real corre por día sobre el saldo
      monto_interes_usd: c.monto_interes_estimado_usd,
      monto_interes_bs: redondear(c.monto_interes_estimado_usd * tasaCambio),
      monto_total_usd: c.monto_total_estimado_usd,
      monto_total_bs: redondear(c.monto_total_estimado_usd * tasaCambio),
    })),
  });

  await tx.prestamo.update({
    where: { id: prestamoId },
    data: {
      estado: 'activo',
      fecha_desembolso: fechaEntrega,
      fecha_vencimiento: plan[plan.length - 1]!.fecha_vencimiento,
      // Desde acá el interés corre por día sobre el saldo
      interes_calculado_hasta: fechaEntrega,
      inicial_usd: condiciones.inicial_usd,
      garantia_propia_usd: garantiaPropia,
      inicial_ahorro_usd: ahorroAplicado,
      inicial_efectivo_usd: efectivoAplicado,
      inicial_efectivo_bs: inicial.efectivo_bs,
    },
  });

  // Si al entregar el ahorro propio ya cubre más que al pedirlo, sobra garantía
  await ajustarGarantias(tx, prestamoId, tasaCambio);
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

    const { tipo_prestamo_id, monto_usd, fecha_desembolso } = validacion.data;

    const tipo = await prisma.tipoPrestamo.findUnique({ where: { id: tipo_prestamo_id } });
    if (!tipo) throw new NotFoundError('Tipo de préstamo no encontrado');
    if (!tipo.estado) throw new BadRequestError('El tipo de préstamo está inactivo');

    let condiciones;
    try {
      condiciones = condicionesDelMonto(monto_usd);
    } catch (e) {
      throw new BadRequestError(e instanceof Error ? e.message : 'Monto fuera de la tabla de préstamos');
    }

    const fecha = fecha_desembolso ? fechaDia(fecha_desembolso.slice(0, 10), 'La fecha de entrega') : hoyDia();
    const tasaMensual = Number(tipo.tasa_interes_mensual) || redondear(Number(tipo.tasa_interes_anual) / 12);
    // Las cuotas reparten el saldo que queda después de la inicial
    const plan = planDeCuotas(condiciones.financiado_usd, condiciones.cuotas, tasaMensual, fecha);
    const tasaCambio = await obtenerTasaActual();
    const totalInteres = redondear(plan.reduce((a, c) => a + c.monto_interes_estimado_usd, 0));

    res.json({
      success: true,
      data: {
        tipo_prestamo: { id: tipo.id, codigo: tipo.codigo, nombre: tipo.nombre },
        monto_usd,
        cuotas: condiciones.cuotas,
        dias_por_cuota: DIAS_POR_CUOTA,
        cuota_capital_usd: condiciones.cuota_capital_usd,
        cuota_capital_bs: redondear(condiciones.cuota_capital_usd * tasaCambio),
        // La inicial se paga al llevarse el producto, aparte de las cuotas
        inicial_usd: condiciones.inicial_usd,
        inicial_bs: redondear(condiciones.inicial_usd * tasaCambio),
        inicial_porcentaje: condiciones.tramo.inicial_porcentaje,
        tasa_interes_mensual: tasaMensual,
        tasa_cambio: tasaCambio,
        requiere_fiadores: tipo.requiere_fiadores,
        // Estimado: el interés real depende del día en que se pague cada cuota
        total_interes_estimado_usd: totalInteres,
        saldo_deudor_usd: condiciones.financiado_usd,
        // Inicial, saldo en cuotas e interés estimado
        total_a_pagar_estimado_usd: redondear(monto_usd + totalInteres),
        plan,
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
    // El plazo ya no se elige: la tabla dice cuántas cuotas van según el monto

    // Confirmado: hasta un préstamo abierto por categoría (línea blanca, efectivo,
    // gastos médicos). Lo que no puede es tener dos del mismo tipo.
    const abierto = await prisma.prestamo.findFirst({
      where: {
        socio_id: datos.socio_id,
        tipo_prestamo_id: datos.tipo_prestamo_id,
        estado: { in: ['solicitado', 'aprobado', 'activo', 'moroso'] },
      },
    });
    if (abierto) {
      throw new ConflictError(
        `El socio ya tiene el préstamo ${abierto.numero_prestamo} de ${tipo.nombre} sin saldar: ` +
          'se permite uno abierto por tipo'
      );
    }

    // --- Condiciones de la tabla que pasó la cooperativa ---
    let condiciones;
    try {
      condiciones = condicionesDelMonto(datos.monto_usd);
    } catch (e) {
      throw new BadRequestError(e instanceof Error ? e.message : 'Monto fuera de la tabla de préstamos');
    }
    const tasaMensual = Number(tipo.tasa_interes_mensual) || redondear(Number(tipo.tasa_interes_anual) / 12);

    // --- ¿Va a la reunión? Sólo si su ahorro no cubre lo que va a deber ---
    // Confirmado: los fiadores cubren la diferencia entre el saldo deudor (el
    // monto menos la inicial) y el ahorro propio que le queda después de poner
    // la parte de la inicial que paga con ahorro.
    const ahorroPropio = await ahorroLibre(prisma, datos.socio_id);
    const inicialConAhorro = Math.min(datos.inicial_ahorro_usd, condiciones.inicial_usd);
    if (inicialConAhorro > ahorroPropio + 0.009) {
      throw new BadRequestError(
        `El socio tiene $${ahorroPropio} de ahorro libre y no alcanza para poner $${inicialConAhorro} de inicial`
      );
    }
    const ahorroDisponible = redondear(Math.max(0, ahorroPropio - inicialConAhorro));
    const faltante = redondear(Math.max(0, condiciones.financiado_usd - ahorroDisponible));
    const requiereAprobacion = faltante > 0;
    const garantizado = redondear(datos.fiadores.reduce((a, f) => a + f.monto_garantizado_usd, 0));

    if (requiereAprobacion && garantizado + 0.009 < faltante) {
      throw new BadRequestError(
        `El socio va a deber $${condiciones.financiado_usd} y le quedan $${ahorroDisponible} de ahorro: ` +
          `los fiadores deben cubrir los $${faltante} que faltan y suman $${garantizado}`
      );
    }
    for (const fiador of datos.fiadores) {
      if (fiador.socio_id === datos.socio_id) {
        throw new BadRequestError('El socio no puede ser fiador de su propio préstamo');
      }
      const libre = await ahorroLibre(prisma, fiador.socio_id);
      if (libre + 0.009 < fiador.monto_garantizado_usd) {
        const s = await prisma.socio.findUnique({ where: { id: fiador.socio_id }, select: { codigo_socio: true } });
        throw new BadRequestError(
          `El fiador ${s?.codigo_socio ?? fiador.socio_id} tiene $${libre} disponible ` +
            `y debe garantizar $${fiador.monto_garantizado_usd}`
        );
      }
    }

    const fechaEntrega = fechaDia(datos.fecha_desembolso.slice(0, 10), 'La fecha de entrega');
    const tasaCambio = await obtenerTasaActual();
    const numero = await generarNumeroPrestamo();

    const prestamo = await prisma.$transaction(async (tx) => {
      // Las validaciones de arriba leen sin bloquear. Con deudor y fiadores
      // bloqueados se repite la que otra operación simultánea puede volver
      // falsa: que el socio no tenga ya otro préstamo abierto.
      await bloquearSocios(tx, [datos.socio_id, ...datos.fiadores.map((f) => f.socio_id)]);

      const otroAbierto = await tx.prestamo.findFirst({
        where: {
          socio_id: datos.socio_id,
          tipo_prestamo_id: datos.tipo_prestamo_id,
          estado: { in: ['solicitado', 'aprobado', 'activo', 'moroso'] },
        },
      });
      if (otroAbierto) {
        throw new ConflictError(
          `El socio ya tiene el préstamo ${otroAbierto.numero_prestamo} de ${tipo.nombre} sin saldar`
        );
      }

      const creado = await tx.prestamo.create({
        data: {
          socio_id: datos.socio_id,
          tipo_prestamo_id: datos.tipo_prestamo_id,
          numero_prestamo: numero,
          monto_original_usd: datos.monto_usd,
          monto_original_bs: redondear(datos.monto_usd * tasaCambio),
          tasa_cambio_inicial: tasaCambio,
          tasa_interes: Number(tipo.tasa_interes_anual),
          tasa_interes_mensual: tasaMensual,
          // El plazo en semanas se conserva por los reportes viejos: 21 días son 3 semanas
          plazo_semanas: condiciones.cuotas * 3,
          cantidad_cuotas: condiciones.cuotas,
          dias_por_cuota: DIAS_POR_CUOTA,
          cuota_semanal_usd: condiciones.cuota_capital_usd,
          cuota_semanal_bs: redondear(condiciones.cuota_capital_usd * tasaCambio),
          // Lo que se debe es el saldo después de la inicial, que se paga al entregar
          saldo_capital_usd: condiciones.financiado_usd,
          saldo_capital_bs: redondear(condiciones.financiado_usd * tasaCambio),
          // El interés arranca en cero y corre por día desde la entrega
          saldo_interes_usd: 0,
          saldo_interes_bs: 0,
          inicial_usd: condiciones.inicial_usd,
          estado: requiereAprobacion ? 'solicitado' : 'activo',
          fecha_solicitud: hoyDia(),
          fecha_desembolso: fechaEntrega,
          fecha_vencimiento: new Date(fechaEntrega.getTime() + condiciones.cuotas * DIAS_POR_CUOTA * 86_400_000),
          observaciones_aprobacion: datos.observaciones ?? null,
        },
      });

      // El orden de la lista es el orden en que se van liberando
      for (const [indice, fiador] of datos.fiadores.entries()) {
        await tx.fiador.create({
          data: {
            prestamo_id: creado.id,
            socio_id: fiador.socio_id,
            orden: indice + 1,
            monto_garantizado_usd: fiador.monto_garantizado_usd,
            monto_garantizado_bs: redondear(fiador.monto_garantizado_usd * tasaCambio),
            monto_bloqueado_usd: 0,
            monto_bloqueado_bs: 0,
          },
        });
      }

      // Lo que cubre con su ahorro se entrega sin pasar por la reunión
      if (!requiereAprobacion) {
        await entregarPrestamo(tx, creado.id, {
          fechaEntrega,
          tasaCambio,
          tasaMensual,
          inicial: {
            ahorro_usd: datos.inicial_ahorro_usd,
            efectivo_usd: datos.inicial_efectivo_usd,
            efectivo_bs: datos.inicial_efectivo_bs,
          },
        });
      }

      await registrarAuditoria(tx, {
        req,
        accion: requiereAprobacion ? 'SOLICITAR_PRESTAMO' : 'CREAR',
        modulo: 'prestamos',
        registro_id: creado.id,
        despues: {
          numero,
          monto: datos.monto_usd,
          cuotas: condiciones.cuotas,
          inicial_usd: condiciones.inicial_usd,
          ahorro_propio_usd: ahorroPropio,
          falta_cubrir_usd: faltante,
          estado: requiereAprobacion ? 'solicitado' : 'activo',
        },
      });

      return creado;
    });

    logger.info(
      `Préstamo ${numero}: $${datos.monto_usd} en ${condiciones.cuotas} cuotas` +
        (requiereAprobacion ? ' — EN SOLICITUD, espera la reunión' : ' — entregado')
    );
    res.status(201).json({ success: true, data: await prestamoConResumen(prestamo.id) });
  } catch (error) {
    responderError(res, error, 'Error al otorgar el préstamo');
  }
};

/**
 * POST /api/prestamos/:id/aprobar
 *
 * La reunión ordinaria de los martes aprueba los préstamos que el socio no
 * cubre con su propio ahorro (confirmado: no es la junta directiva ni la
 * asamblea, y no se anota número de acta). Aprobar es entregar: se cobra la
 * inicial, se bloquean los ahorros y queda el plan de cuotas.
 */
export const aprobarPrestamo = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new BadRequestError('ID inválido');

    const validacion = aprobarPrestamoSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }
    const datos = validacion.data;

    const existe = await prisma.prestamo.findUnique({ where: { id }, select: { socio_id: true, estado: true } });
    if (!existe) throw new NotFoundError('Préstamo no encontrado');
    if (existe.estado !== 'solicitado') {
      throw new ConflictError(`El préstamo está ${existe.estado}: sólo se aprueba el que está en solicitud`);
    }

    const fechaEntrega = fechaDia(datos.fecha_entrega.slice(0, 10), 'La fecha de entrega');
    const tasaCambio = await obtenerTasaActual();

    await prisma.$transaction(async (tx) => {
      const prestamo = await tx.prestamo.findUniqueOrThrow({
        where: { id },
        include: { fiadores: true, tipo_prestamo: true },
      });
      await bloquearSocios(tx, [prestamo.socio_id, ...prestamo.fiadores.map((f) => f.socio_id)]);
      if (prestamo.estado !== 'solicitado') throw new ConflictError('El préstamo ya fue aprobado');

      const tasaMensual =
        Number(prestamo.tipo_prestamo.tasa_interes_mensual) ||
        redondear(Number(prestamo.tipo_prestamo.tasa_interes_anual) / 12);

      await entregarPrestamo(tx, id, {
        fechaEntrega,
        tasaCambio,
        tasaMensual,
        inicial: {
          ahorro_usd: datos.inicial_ahorro_usd,
          efectivo_usd: datos.inicial_efectivo_usd,
          efectivo_bs: datos.inicial_efectivo_bs,
        },
      });

      await tx.prestamo.update({
        where: { id },
        data: {
          fecha_aprobacion: hoyDia(),
          aprobado_por: req.user!.userId,
          ...(datos.observaciones ? { observaciones_aprobacion: datos.observaciones } : {}),
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'APROBAR_PRESTAMO',
        modulo: 'prestamos',
        registro_id: id,
        antes: { estado: 'solicitado' },
        despues: {
          estado: 'activo',
          fecha_entrega: fechaEntrega.toISOString().slice(0, 10),
          numero: prestamo.numero_prestamo,
        },
      });
    });

    res.json({
      success: true,
      data: await prestamoConResumen(id),
      message: 'Préstamo aprobado y entregado',
    });
  } catch (error) {
    responderError(res, error, 'Error al aprobar el préstamo');
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

    res.json({ success: true, data: await prestamoConResumen(id) });
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

    const existe = await prisma.prestamo.findUnique({ where: { id }, select: { socio_id: true } });
    if (!existe) throw new NotFoundError('Préstamo no encontrado');

    const monto = redondear(validacion.data.monto_usd);
    const tasa = await obtenerTasaActual();

    const resultado = await prisma.$transaction(async (tx) => {
      // El préstamo se lee DESPUÉS de bloquear al socio. Leído antes, dos abonos
      // simultáneos partían del mismo saldo y uno de los dos se perdía.
      await bloquearSocio(tx, existe.socio_id);

      const prestamo = await tx.prestamo.findUnique({ where: { id } });
      if (!prestamo) throw new NotFoundError('Préstamo no encontrado');
      if (prestamo.estado === 'saldado') throw new ConflictError('El préstamo ya está saldado');
      if (prestamo.estado === 'cancelado') throw new ConflictError('El préstamo está cancelado');
      if (prestamo.estado === 'solicitado' || prestamo.estado === 'aprobado') {
        throw new ConflictError('El préstamo todavía no se ha entregado: no se le pueden cargar abonos');
      }

      // El interés corre por día: se suma lo que va hasta hoy antes de repartir
      const { saldo_interes_usd: saldoInteres } = await ponerInteresAlDia(tx, prestamo);

      const reparto = distribuirAbono(
        monto,
        Number(prestamo.saldo_mora_usd),
        saldoInteres,
        Number(prestamo.saldo_capital_usd)
      );

      if (reparto.sobrante > 0) {
        throw new BadRequestError(
          `El abono excede la deuda en $${reparto.sobrante}. La deuda total es $${redondear(
            Number(prestamo.saldo_mora_usd) + saldoInteres + Number(prestamo.saldo_capital_usd)
          )}`
        );
      }

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
      const nuevoInteres = redondear(saldoInteres - reparto.interes);
      const nuevaMora = redondear(Number(prestamo.saldo_mora_usd) - reparto.mora);
      const saldado = nuevoCapital <= 0 && nuevoInteres <= 0 && nuevaMora <= 0;

      await tx.prestamo.update({
        where: { id },
        data: {
          saldo_capital_usd: Math.max(nuevoCapital, 0),
          saldo_capital_bs: redondear(Math.max(nuevoCapital, 0) * tasa),
          saldo_interes_usd: Math.max(nuevoInteres, 0),
          saldo_interes_bs: redondear(Math.max(nuevoInteres, 0) * tasa),
          saldo_mora_usd: Math.max(nuevaMora, 0),
          saldo_mora_bs: redondear(Math.max(nuevaMora, 0) * tasa),
          fecha_ultimo_abono: new Date(),
          ...(saldado ? { estado: 'saldado' as const } : {}),
        },
      });

      const { cuotas_pagadas } = await sincronizarCuotas(tx, id);
      // Libera de a un fiador, en su orden; al saldar, también el ahorro propio
      await ajustarGarantias(tx, id, tasa);

      await registrarAuditoria(tx, {
        req,
        accion: 'ABONO_PRESTAMO',
        modulo: 'prestamos',
        registro_id: id,
        despues: { abono_id: abono.id, monto, reparto, saldado, cuotas_pagadas },
      });

      return { abono, reparto, saldado, numero: prestamo.numero_prestamo };
    });

    logger.info(
      `Abono de $${monto} al préstamo ${resultado.numero}` +
        (resultado.saldado ? ' — SALDADO, fiadores liberados' : '')
    );

    res.status(201).json({
      success: true,
      data: { abono: resultado.abono, reparto: resultado.reparto, saldado: resultado.saldado },
    });
  } catch (error) {
    responderError(res, error, 'Error al registrar el abono');
  }
};

/**
 * POST /api/prestamos/:id/abonos/:abonoId/reversar
 *
 * Corrige un abono mal cargado (RF-PRE-08). No se borra: queda marcado con
 * motivo, fecha y usuario, y la deuda vuelve a lo que era — capital, interés y
 * mora por separado, con lo que ese abono había aplicado a cada uno.
 *
 * Se rechazan dos casos:
 *  - Abonos cobrados en colecta. Se reversan reversando la colecta, que es lo
 *    que entró en caja; reversados sueltos, el cierre de caja quedaría mintiendo.
 *  - Préstamos saldados cuyos fiadores ya recuperaron el ahorro.
 */
export const reversarAbono = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const abonoId = parseInt(String(req.params.abonoId), 10);
    if (isNaN(id) || isNaN(abonoId)) throw new BadRequestError('ID inválido');

    const validacion = reversarAbonoSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }
    const { motivo } = validacion.data;

    const existe = await prisma.prestamo.findUnique({ where: { id }, select: { socio_id: true } });
    if (!existe) throw new NotFoundError('Préstamo no encontrado');

    const resultado = await prisma.$transaction(async (tx) => {
      await bloquearSocio(tx, existe.socio_id);

      const [prestamo, abono] = [
        await tx.prestamo.findUnique({ where: { id } }),
        await tx.abonoPrestamo.findUnique({ where: { id: abonoId } }),
      ];
      if (!prestamo) throw new NotFoundError('Préstamo no encontrado');
      if (!abono || abono.prestamo_id !== id) throw new NotFoundError('El abono no pertenece a este préstamo');
      if (abono.reversado) throw new ConflictError('Este abono ya fue reversado');
      if (abono.colecta_id) {
        throw new ConflictError(
          `Este abono se cobró en la colecta #${abono.colecta_id}. Reverse esa colecta: ` +
            'el dinero entró por caja y el cierre tiene que reflejar el reverso.'
        );
      }
      if (prestamo.estado === 'cancelado') throw new ConflictError('El préstamo está cancelado');
      // Cualquier cajero reversa lo del día; días anteriores, sólo la caja 99
      await exigirPermisoSiEsDeDiaAnterior(req, 'prestamos', abono.fecha_abono);
      // Si el abono había saldado el préstamo, la deuda se reabre y los fiadores
      // ya liberados siguen liberados: la cooperativa confirmó que no se les
      // vuelve a bloquear el ahorro.

      await tx.abonoPrestamo.update({
        where: { id: abonoId },
        data: {
          reversado: true,
          fecha_reverso: new Date(),
          motivo_reverso: motivo,
          reversado_por: req.user!.userId,
        },
      });

      const tasa = Number(abono.tasa_cambio);
      const capital = redondear(Number(prestamo.saldo_capital_usd) + Number(abono.aplicado_capital_usd));
      const interes = redondear(Number(prestamo.saldo_interes_usd) + Number(abono.aplicado_interes_usd));
      const mora = redondear(Number(prestamo.saldo_mora_usd) + Number(abono.aplicado_mora_usd));

      // Fecha del último abono: la del abono vigente anterior, si queda alguno
      const anterior = await tx.abonoPrestamo.findFirst({
        where: { prestamo_id: id, reversado: false },
        orderBy: { fecha_abono: 'desc' },
        select: { fecha_abono: true },
      });

      await tx.prestamo.update({
        where: { id },
        data: {
          saldo_capital_usd: capital,
          saldo_capital_bs: redondear(capital * tasa),
          saldo_interes_usd: interes,
          saldo_interes_bs: redondear(interes * tasa),
          saldo_mora_usd: mora,
          saldo_mora_bs: redondear(mora * tasa),
          fecha_ultimo_abono: anterior?.fecha_abono ?? null,
          ...(prestamo.estado === 'saldado' ? { estado: 'activo' as const } : {}),
        },
      });

      const { cuotas_pagadas } = await sincronizarCuotas(tx, id);

      await registrarAuditoria(tx, {
        req,
        accion: 'REVERSAR_ABONO',
        modulo: 'prestamos',
        registro_id: id,
        antes: {
          abono_id: abono.id,
          monto_usd: abono.monto_usd,
          estado: prestamo.estado,
          saldo_capital_usd: prestamo.saldo_capital_usd,
          saldo_interes_usd: prestamo.saldo_interes_usd,
          saldo_mora_usd: prestamo.saldo_mora_usd,
        },
        despues: { motivo, saldo_capital_usd: capital, saldo_interes_usd: interes, saldo_mora_usd: mora, cuotas_pagadas },
      });

      return { numero: prestamo.numero_prestamo, monto: Number(abono.monto_usd) };
    });

    // La mora depende de la fecha y de qué cuotas quedaron vencidas: con las
    // cuotas ya desmarcadas se recalcula, igual que al consultar el préstamo
    await actualizarMoraYCuotas(id);

    logger.info(`Abono ${abonoId} de $${resultado.monto} al préstamo ${resultado.numero} reversado: ${motivo}`);
    res.json({ success: true, data: { id: abonoId, reversado: true } });
  } catch (error) {
    responderError(res, error, 'Error al reversar el abono');
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
    res.json({ success: true, data: await carteraPrestamos(String(req.query.vista ?? 'por_cobrar')) });
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
