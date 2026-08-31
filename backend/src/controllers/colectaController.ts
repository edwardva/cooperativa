// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Colecta (cobro unificado) y cierre de caja
// ============================================
//
// Rediseño respecto al sistema viejo:
//
//   Antes: el cajero entraba por NÚMERO DE CUENTA (01-08-00-121753) en una
//   pantalla por servicio, cada una en un iframe distinto. Un socio que pagaba
//   ahorro + funeraria + salud obligaba a repetir la búsqueda tres veces.
//
//   Ahora: se busca UNA vez por cédula o expediente y se devuelve todo lo
//   cobrable del socio. El cobro se registra en UNA transacción: una Colecta
//   con N detalles, y cada detalle impacta su servicio.

import type { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { normalizarCedula } from '../utils/cedula';
import { distribuirAbono } from '../utils/amortizacion';
import { resolverTasa } from '../services/tasaCambioService';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const detalleColectaSchema = z.object({
  servicio: z.enum(['ahorro', 'funeraria', 'salud', 'prestamo']),
  /** Id de la cuenta de ahorro o del acuerdo, según el servicio */
  referencia_id: z.number().int().positive(),
  monto_usd: z.number().positive('El monto debe ser mayor a cero'),
  /**
   * Cuántas semanas cubre ESTE renglón. Normalmente es el mismo valor global
   * de `semanas`, pero se admite por renglón para casos excepcionales.
   */
  semanas: z.number().int().positive().optional(),

  /**
   * Reintegro: cargo por reactivar un acuerdo suspendido. NO cubre semanas
   * (no baja el atraso), suma al total y reactiva el acuerdo. En el sistema
   * viejo son los campos `reintegro` / `reintegro_sal`, con sus propias
   * cuentas contables (09 REINT-FUN, 10 REINT-SALUD).
   */
  es_reintegro: z.boolean().optional().default(false),

  concepto: z.string().max(300).optional().nullable(),
});

const registrarColectaSchema = z.object({
  socio_id: z.number().int().positive(),

  /**
   * Semanas a cobrar: el driver de todo el cobro. En el sistema viejo es el
   * campo `sem`, que multiplica por igual ahorro, funeraria y salud.
   */
  semanas: z.number().int().min(1).max(104).default(1),

  /** Periodo cobrado (campos sem_cob / ano_cob del formulario original) */
  semana_cobro: z.number().int().min(1).max(53).optional(),
  ano_cobro: z.number().int().min(2000).max(2100).optional(),

  /** Numero de recibo o comprobante */
  referencia: z.string().max(50).optional().nullable(),

  /**
   * Asamblea a la que asistio el socio. La caja es donde se ve al socio, asi
   * que es el momento natural para registrar la asistencia (el sistema viejo
   * tiene el campo "Asistio a la Asamblea" en esta misma pantalla).
   */
  asamblea_id: z.number().int().positive().optional().nullable(),

  detalles: z.array(detalleColectaSchema).min(1, 'Agregue al menos un cobro'),
  observaciones: z.string().max(500).optional().nullable(),
});

const reversarColectaSchema = z.object({
  motivo: z.string().min(5, 'Explique el motivo del reverso').max(500),
});

const cerrarCajaSchema = z.object({
  observaciones: z.string().max(500).optional().nullable(),
});

// ============================================
// HELPERS
// ============================================

/**
 * Tasa vigente para cobrar, más la semana de colecta si hay una activa.
 *
 * La semana NO es un requisito: en el sistema viejo la pantalla de Colecta
 * Global trae la tasa y lleva la semana como un campo del formulario. La tasa
 * la resuelve el servicio central, que tiene su propia cadena de respaldo y
 * nunca deja al sistema sin valor.
 */
async function obtenerTasaActual(): Promise<{ tasa: number; semanaId: number | null; origen: string }> {
  const semana = await prisma.semanaColecta.findFirst({
    where: { estado: true },
    orderBy: { created_at: 'desc' },
  });

  // Si la semana trae su propia tasa, manda: es la que acordó la cooperativa
  // para ese período y puede diferir a propósito de la del BCV.
  if (semana && Number(semana.tasa_usd_bs) > 0) {
    return {
      tasa: Number(semana.tasa_usd_bs),
      semanaId: semana.id,
      origen: `semana ${semana.semana}/${semana.ano}`,
    };
  }

  const resuelta = await resolverTasa();
  return { tasa: resuelta.tasa, semanaId: semana?.id ?? null, origen: resuelta.origen };
}

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

// ============================================
// BÚSQUEDA UNIFICADA DEL SOCIO
// ============================================

/**
 * GET /api/colecta/buscar?termino=12345678
 *
 * Núcleo del rediseño: una sola búsqueda devuelve al socio con TODO lo que se
 * le puede cobrar hoy — cuentas de ahorro, acuerdos de funeraria y de salud —
 * ya con los montos sugeridos calculados.
 *
 * El término se interpreta solo: dígitos = cédula, cualquier otra cosa = expediente.
 */
export const buscarSocioParaColecta = async (req: Request, res: Response): Promise<void> => {
  try {
    const termino = String(req.query.termino ?? '').trim();
    if (!termino) {
      throw new BadRequestError('Indique una cédula o un número de expediente');
    }

    const { tasa } = await obtenerTasaActual();

    // Cédula si son solo dígitos (se normaliza igual que en el alta de socios);
    // en caso contrario se busca por expediente
    const soloDigitos = /^[\dVvEe.\s-]+$/.test(termino);
    const cedulaNormalizada = soloDigitos ? normalizarCedula(termino).cedula : '';

    const where: Prisma.SocioWhereInput = cedulaNormalizada
      ? { cedula: cedulaNormalizada }
      : { codigo_socio: termino };

    const socios = await prisma.socio.findMany({
      where,
      include: {
        ubicacion: { select: { id: true, codigo: true, direccion: true } },
        cuentas_ahorro: {
          where: { estado: true },
          include: { tipo_cuenta: { select: { id: true, codigo: true, nombre: true } } },
          orderBy: { numero_cuenta: 'asc' },
        },
        beneficiarios: {
          include: {
            acuerdos_funeraria: {
              where: { estado: { in: ['activo', 'suspendido'] } },
              include: { tipo_acuerdo: true },
            },
            acuerdos_salud: {
              where: { estado: { in: ['activo', 'suspendido'] } },
              include: { tipo_acuerdo: true },
            },
          },
        },
      },
    });

    if (socios.length === 0) {
      res.json({ success: true, data: { encontrados: [], tasa, asambleas: [] } });
      return;
    }

    // Asambleas del año en curso, para poder marcar la asistencia en la caja
    const anoActual = new Date().getFullYear();
    const asambleas = await prisma.asamblea.findMany({
      where: { ano: anoActual, estado: true },
      orderBy: { fecha: 'desc' },
      select: { id: true, titulo: true, fecha: true, tipo: true },
    });

    // A cuáles ya asistió cada socio, para no volver a ofrecerlas
    const asistencias = await prisma.asistenciaAsamblea.findMany({
      where: { socio_id: { in: socios.map((s) => s.id) }, asamblea: { ano: anoActual } },
      select: { socio_id: true, asamblea_id: true },
    });

    // Préstamos vigentes: son el cuarto servicio cobrable en caja
    const prestamos = await prisma.prestamo.findMany({
      where: { socio_id: { in: socios.map((s) => s.id) }, estado: { in: ['activo', 'moroso'] } },
      include: { tipo_prestamo: { select: { nombre: true } } },
    });
    const prestamosPorSocio = new Map<number, typeof prestamos>();
    for (const p of prestamos) {
      const lista = prestamosPorSocio.get(p.socio_id) ?? [];
      lista.push(p);
      prestamosPorSocio.set(p.socio_id, lista);
    }

    // Se arma una vista plana de "cobrables" para que el frontend no tenga que
    // recorrer beneficiarios ni calcular montos
    const encontrados = socios.map((socio) => {
      const ahorro = socio.cuentas_ahorro.map((cuenta) => ({
        tipo: 'ahorro' as const,
        referencia_id: cuenta.id,
        titulo: cuenta.tipo_cuenta.nombre,
        detalle: cuenta.numero_cuenta,
        saldo_usd: Number(cuenta.saldo_usd),
        saldo_bs: Number(cuenta.saldo_bs),
        semanas_sin_pago: null as number | null,
        monto_sugerido_usd: null as number | null,
        estado: 'activo',
      }));

      const funeraria = socio.beneficiarios.flatMap((b) =>
        b.acuerdos_funeraria.map((acuerdo) => ({
          tipo: 'funeraria' as const,
          referencia_id: acuerdo.id,
          titulo: acuerdo.tipo_acuerdo.nombre,
          detalle: `${b.nombre} ${b.apellido}${acuerdo.numero_acuerdo ? ` · ${acuerdo.numero_acuerdo}` : ''}`,
          saldo_usd: null as number | null,
          saldo_bs: null as number | null,
          semanas_sin_pago: acuerdo.semanas_sin_pago,
          // Sugerencia: ponerse al día. Si no debe nada, una semana.
          monto_sugerido_usd: redondear(
            Number(acuerdo.tipo_acuerdo.monto_usd) * Math.max(acuerdo.semanas_sin_pago, 1)
          ),
          monto_semanal_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
          estado: acuerdo.estado,
        }))
      );

      const prestamos = (prestamosPorSocio.get(socio.id) ?? []).map((p) => ({
        tipo: 'prestamo' as const,
        referencia_id: p.id,
        titulo: p.tipo_prestamo.nombre,
        detalle: `${p.numero_prestamo} · cuota $${Number(p.cuota_semanal_usd).toFixed(2)}`,
        saldo_usd: Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd),
        saldo_bs: null as number | null,
        semanas_sin_pago: null as number | null,
        // Sugerencia: una cuota semanal, mas la mora si la hay
        monto_sugerido_usd: redondear(Number(p.cuota_semanal_usd) + Number(p.saldo_mora_usd)),
        monto_semanal_usd: Number(p.cuota_semanal_usd),
        estado: p.estado,
      }));

      const salud = socio.beneficiarios.flatMap((b) =>
        b.acuerdos_salud.map((acuerdo) => ({
          tipo: 'salud' as const,
          referencia_id: acuerdo.id,
          titulo: acuerdo.tipo_acuerdo.nombre,
          detalle: `${b.nombre} ${b.apellido}`,
          saldo_usd: null as number | null,
          saldo_bs: null as number | null,
          semanas_sin_pago: acuerdo.semanas_sin_pago,
          monto_sugerido_usd: redondear(
            Number(acuerdo.tipo_acuerdo.monto_usd) * Math.max(acuerdo.semanas_sin_pago, 1)
          ),
          monto_semanal_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
          estado: acuerdo.estado,
        }))
      );

      return {
        id: socio.id,
        codigo_socio: socio.codigo_socio,
        cedula: socio.cedula,
        nombre: socio.nombre,
        apellido: socio.apellido,
        estado: socio.estado,
        telefono: socio.telefono,
        ubicacion: socio.ubicacion,
        cobrables: [...ahorro, ...funeraria, ...salud, ...prestamos],
        // Cantidad de acuerdos por servicio: en el sistema viejo son nu_fun y
        // nu_sal, los multiplicadores del subtotal
        cantidad_funeraria: funeraria.length,
        cantidad_salud: salud.length,
        // Cuota semanal de cada servicio (el mayor si tiene varios planes)
        cuota_funeraria_usd: funeraria.reduce((max, a) => Math.max(max, a.monto_semanal_usd ?? 0), 0),
        cuota_salud_usd: salud.reduce((max, a) => Math.max(max, a.monto_semanal_usd ?? 0), 0),
        // Mayor atraso entre sus acuerdos: es lo que sugiere cuántas semanas cobrar
        mayor_atraso: Math.max(0, ...[...funeraria, ...salud].map((a) => a.semanas_sin_pago ?? 0)),
        asambleas_asistidas: asistencias
          .filter((a) => a.socio_id === socio.id)
          .map((a) => a.asamblea_id),
        alertas: {
          // Se avisa, no se bloquea: la decisión es del cajero
          socio_retirado: socio.estado === 'retirado',
          acuerdos_suspendidos: [...funeraria, ...salud].filter((a) => a.estado === 'suspendido').length,
        },
      };
    });

    res.json({ success: true, data: { encontrados, tasa, asambleas } });
  } catch (error) {
    responderError(res, error, 'Error al buscar el socio');
  }
};

// ============================================
// REGISTRO DE LA COLECTA
// ============================================

/**
 * POST /api/colecta
 *
 * Registra el cobro completo en UNA transacción: la Colecta, sus detalles y el
 * movimiento correspondiente en cada servicio. Si algo falla, no queda nada a
 * medias — que es justo el riesgo del flujo viejo, donde cada servicio se
 * cobraba por separado y podía quedar la mitad hecha.
 */
export const registrarColecta = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = registrarColectaSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const datos = validacion.data;
    const { tasa, semanaId } = await obtenerTasaActual();

    const socio = await prisma.socio.findUnique({ where: { id: datos.socio_id } });
    if (!socio) {
      throw new NotFoundError('Socio no encontrado');
    }

    const resultado = await prisma.$transaction(async (tx) => {
      let totalUsd = 0;

      // Se valida TODO antes de escribir nada
      const preparados = [];
      for (const detalle of datos.detalles) {
        const montoUsd = redondear(detalle.monto_usd);
        const montoBs = redondear(montoUsd * tasa);

        if (detalle.servicio === 'ahorro') {
          const cuenta = await tx.cuentaAhorro.findUnique({ where: { id: detalle.referencia_id } });
          if (!cuenta) throw new NotFoundError(`Cuenta de ahorro ${detalle.referencia_id} no encontrada`);
          if (cuenta.socio_id !== datos.socio_id) {
            throw new BadRequestError(`La cuenta ${cuenta.numero_cuenta} no pertenece a este socio`);
          }
          preparados.push({ detalle, montoUsd, montoBs, cuenta });
        } else if (detalle.servicio === 'prestamo') {
          const prestamo = await tx.prestamo.findUnique({ where: { id: detalle.referencia_id } });
          if (!prestamo) throw new NotFoundError(`Préstamo ${detalle.referencia_id} no encontrado`);
          if (prestamo.socio_id !== datos.socio_id) {
            throw new BadRequestError(`El préstamo ${prestamo.numero_prestamo} no pertenece a este socio`);
          }
          if (prestamo.estado === 'saldado' || prestamo.estado === 'cancelado') {
            throw new BadRequestError(`El préstamo ${prestamo.numero_prestamo} está ${prestamo.estado}`);
          }
          preparados.push({ detalle, montoUsd, montoBs, prestamo });
        } else {
          const acuerdo =
            detalle.servicio === 'funeraria'
              ? await tx.acuerdoFuneraria.findUnique({
                  where: { id: detalle.referencia_id },
                  include: { tipo_acuerdo: true, beneficiario: true },
                })
              : await tx.acuerdoSalud.findUnique({
                  where: { id: detalle.referencia_id },
                  include: { tipo_acuerdo: true, beneficiario: true },
                });

          if (!acuerdo) throw new NotFoundError(`Acuerdo ${detalle.referencia_id} no encontrado`);
          if (acuerdo.beneficiario.socio_id !== datos.socio_id) {
            throw new BadRequestError('El acuerdo no pertenece a este socio');
          }
          preparados.push({ detalle, montoUsd, montoBs, acuerdo });
        }

        totalUsd += montoUsd;
      }

      totalUsd = redondear(totalUsd);
      const totalBs = redondear(totalUsd * tasa);

      const colecta = await tx.colecta.create({
        data: {
          socio_id: datos.socio_id,
          usuario_id: req.user!.userId,
          semana_colecta_id: semanaId, // opcional: puede no haber semana cargada
          semanas_cobradas: datos.semanas,
          semana_cobro: datos.semana_cobro ?? null,
          ano_cobro: datos.ano_cobro ?? null,
          referencia: datos.referencia ?? null,
          monto_total_usd: totalUsd,
          monto_total_bs: totalBs,
          tasa_cambio: tasa,
          observaciones: datos.observaciones ?? null,
        },
      });

      // Ahora sí se impacta cada servicio
      for (const item of preparados) {
        const { detalle, montoUsd, montoBs } = item;

        await tx.detalleColecta.create({
          data: {
            colecta_id: colecta.id,
            servicio: detalle.servicio,
            referencia_id: detalle.referencia_id,
            monto_usd: montoUsd,
            monto_bs: montoBs,
            concepto: detalle.concepto ?? null,
          },
        });

        if (detalle.servicio === 'ahorro') {
          const cuenta = (item as any).cuenta;
          const saldoAnterior = Number(cuenta.saldo_usd);
          const saldoNuevo = redondear(saldoAnterior + montoUsd);

          await tx.movimientoAhorro.create({
            data: {
              cuenta_id: cuenta.id,
              tipo_movimiento: 'deposito',
              monto_usd: montoUsd,
              monto_bs: montoBs,
              tasa_cambio: tasa,
              saldo_anterior_usd: saldoAnterior,
              saldo_nuevo_usd: saldoNuevo,
              concepto: detalle.concepto ?? 'Colecta',
              referencia: `COL-${colecta.id}`,
            },
          });

          await tx.cuentaAhorro.update({
            where: { id: cuenta.id },
            data: { saldo_usd: saldoNuevo, saldo_bs: redondear(saldoNuevo * tasa) },
          });
        } else if (detalle.servicio === 'prestamo') {
          const prestamo = (item as any).prestamo;

          // Mismo orden que en el módulo de préstamos: mora, interés, capital
          const reparto = distribuirAbono(
            montoUsd,
            Number(prestamo.saldo_mora_usd),
            Number(prestamo.saldo_interes_usd),
            Number(prestamo.saldo_capital_usd)
          );

          if (reparto.sobrante > 0) {
            throw new BadRequestError(
              `El abono al préstamo ${prestamo.numero_prestamo} excede la deuda en $${reparto.sobrante}`
            );
          }

          await tx.abonoPrestamo.create({
            data: {
              prestamo_id: prestamo.id,
              monto_usd: montoUsd,
              monto_bs: montoBs,
              tasa_cambio: tasa,
              aplicado_capital_usd: reparto.capital,
              aplicado_capital_bs: redondear(reparto.capital * tasa),
              aplicado_interes_usd: reparto.interes,
              aplicado_interes_bs: redondear(reparto.interes * tasa),
              aplicado_mora_usd: reparto.mora,
              aplicado_mora_bs: redondear(reparto.mora * tasa),
              concepto: detalle.concepto ?? `Colecta #${colecta.id}`,
            },
          });

          const capital = redondear(Number(prestamo.saldo_capital_usd) - reparto.capital);
          const interes = redondear(Number(prestamo.saldo_interes_usd) - reparto.interes);
          const mora = redondear(Number(prestamo.saldo_mora_usd) - reparto.mora);
          const saldado = capital <= 0 && interes <= 0 && mora <= 0;

          await tx.prestamo.update({
            where: { id: prestamo.id },
            data: {
              saldo_capital_usd: Math.max(capital, 0),
              saldo_capital_bs: redondear(Math.max(capital, 0) * tasa),
              saldo_interes_usd: Math.max(interes, 0),
              saldo_interes_bs: redondear(Math.max(interes, 0) * tasa),
              saldo_mora_usd: Math.max(mora, 0),
              saldo_mora_bs: redondear(Math.max(mora, 0) * tasa),
              ...(saldado ? { estado: 'saldado' as const } : {}),
            },
          });
        } else {
          const acuerdo = (item as any).acuerdo;
          const montoSemanal = Number(acuerdo.tipo_acuerdo.monto_usd);

          // El reintegro no cubre semanas: es el cargo por reactivar.
          // Para un pago normal: lo indicado en el renglon, si no el driver
          // global de la colecta, y como ultimo recurso deducido del monto.
          const semanasPagadas = detalle.es_reintegro
            ? 0
            : detalle.semanas ??
              datos.semanas ??
              (montoSemanal > 0 ? Math.floor(montoUsd / montoSemanal) : 0);

          const semanasRestantes = Math.max(acuerdo.semanas_sin_pago - semanasPagadas, 0);

          const datosMovimiento = {
            acuerdo_id: acuerdo.id,
            tipo_movimiento: detalle.es_reintegro ? 'reintegro' : 'pago',
            monto_usd: montoUsd,
            monto_bs: montoBs,
            tasa_cambio: tasa,
            semanas_pagadas: semanasPagadas,
            concepto: detalle.concepto ?? (detalle.es_reintegro ? 'Reintegro' : 'Colecta'),
          };

          // Se reactiva al pagar el reintegro, o al quedar sin atraso
          const reactivar =
            acuerdo.estado === 'suspendido' && (detalle.es_reintegro || semanasRestantes === 0);
          const datosAcuerdo = {
            semanas_sin_pago: semanasRestantes,
            ...(reactivar ? { estado: 'activo' as const, fecha_suspension: null } : {}),
          };

          if (detalle.servicio === 'funeraria') {
            await tx.movimientoFuneraria.create({ data: datosMovimiento });
            await tx.acuerdoFuneraria.update({ where: { id: acuerdo.id }, data: datosAcuerdo });
          } else {
            await tx.movimientoSalud.create({ data: datosMovimiento });
            await tx.acuerdoSalud.update({ where: { id: acuerdo.id }, data: datosAcuerdo });
          }
        }
      }

      // La caja es donde se ve al socio: si el cajero marca que asistio, la
      // asistencia queda registrada junto con el cobro. Si ya estaba marcada,
      // el indice unico la ignora sin romper la transaccion.
      if (datos.asamblea_id) {
        const asamblea = await tx.asamblea.findUnique({ where: { id: datos.asamblea_id } });
        if (!asamblea) throw new NotFoundError('Asamblea no encontrada');

        await tx.asistenciaAsamblea.createMany({
          data: [{
            asamblea_id: datos.asamblea_id,
            socio_id: datos.socio_id,
            registrado_por: req.user!.userId,
            observacion: `Registrada en colecta #${colecta.id}`,
          }],
          skipDuplicates: true,
        });
      }

      await tx.auditLog.create({
        data: {
          usuario_id: req.user!.userId,
          accion: 'COLECTA',
          modulo: 'colecta',
          registro_id: colecta.id,
          datos_despues: { total_usd: totalUsd, detalles: datos.detalles.length } as any,
          ip_address: req.ip || 'unknown',
          user_agent: req.get('user-agent') || 'unknown',
        },
      });

      return colecta;
    });

    const completa = await prisma.colecta.findUnique({
      where: { id: resultado.id },
      include: {
        detalles: true,
        socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
        usuario: { select: { username: true, nombre_completo: true } },
      },
    });

    logger.info(`Colecta ${resultado.id} registrada: ${resultado.monto_total_usd} USD`);
    res.status(201).json({ success: true, data: completa });
  } catch (error) {
    responderError(res, error, 'Error al registrar la colecta');
  }
};

/** GET /api/colecta/:id — para reimprimir el recibo */
export const obtenerColecta = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new BadRequestError('ID inválido');

    const colecta = await prisma.colecta.findUnique({
      where: { id },
      include: {
        detalles: true,
        socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
        usuario: { select: { username: true, nombre_completo: true } },
        semana_colecta: { select: { semana: true, ano: true } },
      },
    });

    if (!colecta) throw new NotFoundError('Colecta no encontrada');
    res.json({ success: true, data: colecta });
  } catch (error) {
    responderError(res, error, 'Error al obtener la colecta');
  }
};

/**
 * GET /api/colecta?fecha=YYYY-MM-DD&solo_mias=true
 * Colectas del día; por defecto las del cajero autenticado.
 */
export const listarColectas = async (req: Request, res: Response): Promise<void> => {
  try {
    const fecha = req.query.fecha ? new Date(String(req.query.fecha)) : new Date();
    if (isNaN(fecha.getTime())) throw new BadRequestError('Fecha inválida');

    const desde = new Date(fecha);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(fecha);
    hasta.setHours(23, 59, 59, 999);

    const soloMias = String(req.query.solo_mias ?? 'true') === 'true';

    const where: Prisma.ColectaWhereInput = {
      fecha_colecta: { gte: desde, lte: hasta },
      // Las reversadas no suman: su efecto ya fue deshecho
      reversada: false,
      ...(soloMias ? { usuario_id: req.user!.userId } : {}),
    };

    const [colectas, agregado] = await Promise.all([
      prisma.colecta.findMany({
        where,
        orderBy: { fecha_colecta: 'desc' },
        include: {
          detalles: true,
          socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
          usuario: { select: { username: true } },
        },
      }),
      prisma.colecta.aggregate({
        where,
        _sum: { monto_total_usd: true, monto_total_bs: true },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        colectas,
        resumen: {
          cantidad: agregado._count,
          total_usd: Number(agregado._sum.monto_total_usd ?? 0),
          total_bs: Number(agregado._sum.monto_total_bs ?? 0),
        },
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al listar las colectas');
  }
};

// ============================================
// CIERRE DE CAJA
// ============================================

/**
 * Suma lo cobrado por un cajero desde su último cierre hasta ahora,
 * desglosado por servicio. Es la base tanto de la vista previa como del cierre.
 */
async function calcularTotalesPendientes(usuarioId: number) {
  const ultimoCierre = await prisma.cierreCaja.findFirst({
    where: { usuario_id: usuarioId },
    orderBy: { fecha_cierre: 'desc' },
  });

  // Desde el último cierre; si nunca cerró, desde el inicio
  const desde = ultimoCierre ? ultimoCierre.fecha_cierre : new Date(0);
  const hasta = new Date();

  const colectas = await prisma.colecta.findMany({
    where: { usuario_id: usuarioId, fecha_colecta: { gt: desde, lte: hasta }, reversada: false },
    include: { detalles: true },
  });

  const totales = {
    ahorro_usd: 0, funeraria_usd: 0, salud_usd: 0, prestamos_usd: 0,
    ahorro_bs: 0, funeraria_bs: 0, salud_bs: 0, prestamos_bs: 0,
  };

  for (const colecta of colectas) {
    for (const d of colecta.detalles) {
      const usd = Number(d.monto_usd);
      const bs = Number(d.monto_bs);
      if (d.servicio === 'ahorro') { totales.ahorro_usd += usd; totales.ahorro_bs += bs; }
      else if (d.servicio === 'funeraria') { totales.funeraria_usd += usd; totales.funeraria_bs += bs; }
      else if (d.servicio === 'salud') { totales.salud_usd += usd; totales.salud_bs += bs; }
      else if (d.servicio === 'prestamo') { totales.prestamos_usd += usd; totales.prestamos_bs += bs; }
    }
  }

  const totalUsd = redondear(totales.ahorro_usd + totales.funeraria_usd + totales.salud_usd + totales.prestamos_usd);
  const totalBs = redondear(totales.ahorro_bs + totales.funeraria_bs + totales.salud_bs + totales.prestamos_bs);

  return {
    desde,
    hasta,
    cantidad_transacciones: colectas.length,
    totales: {
      ahorro_usd: redondear(totales.ahorro_usd),
      funeraria_usd: redondear(totales.funeraria_usd),
      salud_usd: redondear(totales.salud_usd),
      prestamos_usd: redondear(totales.prestamos_usd),
      ahorro_bs: redondear(totales.ahorro_bs),
      funeraria_bs: redondear(totales.funeraria_bs),
      salud_bs: redondear(totales.salud_bs),
      prestamos_bs: redondear(totales.prestamos_bs),
      total_usd: totalUsd,
      total_bs: totalBs,
    },
  };
}

/**
 * GET /api/colecta/cierre/previo
 * Vista previa del cierre: qué se va a cerrar, antes de confirmarlo.
 */
export const previoCierreCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const resumen = await calcularTotalesPendientes(req.user!.userId);
    res.json({ success: true, data: resumen });
  } catch (error) {
    responderError(res, error, 'Error al calcular el cierre');
  }
};

/** POST /api/colecta/cierre */
export const cerrarCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = cerrarCajaSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const resumen = await calcularTotalesPendientes(req.user!.userId);

    if (resumen.cantidad_transacciones === 0) {
      throw new ConflictError('No hay colectas pendientes de cierre');
    }

    const cierre = await prisma.cierreCaja.create({
      data: {
        usuario_id: req.user!.userId,
        fecha_inicio_operacion: resumen.desde,
        fecha_fin_operacion: resumen.hasta,
        total_ahorro_usd: resumen.totales.ahorro_usd,
        total_funeraria_usd: resumen.totales.funeraria_usd,
        total_salud_usd: resumen.totales.salud_usd,
        total_prestamos_usd: resumen.totales.prestamos_usd,
        total_general_usd: resumen.totales.total_usd,
        total_ahorro_bs: resumen.totales.ahorro_bs,
        total_funeraria_bs: resumen.totales.funeraria_bs,
        total_salud_bs: resumen.totales.salud_bs,
        total_prestamos_bs: resumen.totales.prestamos_bs,
        total_general_bs: resumen.totales.total_bs,
        cantidad_transacciones: resumen.cantidad_transacciones,
        observaciones: validacion.data.observaciones ?? null,
      },
      include: { usuario: { select: { username: true, nombre_completo: true } } },
    });

    logger.info(`Cierre de caja ${cierre.id}: ${cierre.total_general_usd} USD en ${cierre.cantidad_transacciones} transacciones`);
    res.status(201).json({ success: true, data: cierre });
  } catch (error) {
    responderError(res, error, 'Error al cerrar la caja');
  }
};

/** GET /api/colecta/cierres — historial */
export const listarCierresCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const soloMios = String(req.query.solo_mios ?? 'true') === 'true';
    const cierres = await prisma.cierreCaja.findMany({
      where: soloMios ? { usuario_id: req.user!.userId } : {},
      orderBy: { fecha_cierre: 'desc' },
      take: 50,
      include: { usuario: { select: { username: true, nombre_completo: true } } },
    });
    res.json({ success: true, data: cierres });
  } catch (error) {
    responderError(res, error, 'Error al listar los cierres de caja');
  }
};

// ============================================
// REVERSO DE COBRO
// ============================================

/**
 * POST /api/colecta/:id/reversar
 *
 * El cajero se equivoca y hay que deshacer el cobro. No se borra nada: se
 * marca la colecta como reversada y se crean movimientos espejo en cada
 * servicio, de modo que el historial del socio muestre el cobro y su reverso.
 *
 * Dos candados importantes:
 *  - No se reversa dos veces.
 *  - No se reversa una colecta ya incluida en un cierre de caja: los totales
 *    de ese cierre quedarían mintiendo. En ese caso hay que hacer un ajuste
 *    contable, no un reverso.
 */
export const reversarColecta = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new BadRequestError('ID inválido');

    const validacion = reversarColectaSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const colecta = await prisma.colecta.findUnique({
      where: { id },
      include: { detalles: true },
    });

    if (!colecta) throw new NotFoundError('Colecta no encontrada');
    if (colecta.reversada) throw new ConflictError('Esta colecta ya fue reversada');

    // ¿Quedó dentro de un cierre de caja ya hecho?
    const cierrePosterior = await prisma.cierreCaja.findFirst({
      where: { usuario_id: colecta.usuario_id, fecha_cierre: { gte: colecta.fecha_colecta } },
      orderBy: { fecha_cierre: 'asc' },
    });

    if (cierrePosterior) {
      throw new ConflictError(
        `La colecta ya está incluida en el cierre de caja #${cierrePosterior.id} ` +
          `del ${cierrePosterior.fecha_cierre.toISOString().slice(0, 10)}. ` +
          'Reversarla descuadraría ese cierre; corresponde un ajuste contable.'
      );
    }

    const tasa = Number(colecta.tasa_cambio);

    await prisma.$transaction(async (tx) => {
      for (const detalle of colecta.detalles) {
        const montoUsd = Number(detalle.monto_usd);
        const montoBs = Number(detalle.monto_bs);
        if (!detalle.referencia_id) continue;

        if (detalle.servicio === 'ahorro') {
          const cuenta = await tx.cuentaAhorro.findUnique({ where: { id: detalle.referencia_id } });
          if (!cuenta) continue;

          const saldoAnterior = Number(cuenta.saldo_usd);
          const saldoNuevo = redondear(saldoAnterior - montoUsd);

          await tx.movimientoAhorro.create({
            data: {
              cuenta_id: cuenta.id,
              tipo_movimiento: 'retiro',
              monto_usd: montoUsd,
              monto_bs: montoBs,
              tasa_cambio: tasa,
              saldo_anterior_usd: saldoAnterior,
              saldo_nuevo_usd: saldoNuevo,
              concepto: `Reverso de colecta #${colecta.id}: ${validacion.data.motivo}`,
              referencia: `REV-${colecta.id}`,
            },
          });

          await tx.cuentaAhorro.update({
            where: { id: cuenta.id },
            data: { saldo_usd: saldoNuevo, saldo_bs: redondear(saldoNuevo * tasa) },
          });
        } else if (detalle.servicio === 'funeraria' || detalle.servicio === 'salud') {
          // Se recupera cuántas semanas cubrió el pago para devolverlas
          const movimiento =
            detalle.servicio === 'funeraria'
              ? await tx.movimientoFuneraria.findFirst({
                  where: { acuerdo_id: detalle.referencia_id, tipo_movimiento: 'pago' },
                  orderBy: { created_at: 'desc' },
                })
              : await tx.movimientoSalud.findFirst({
                  where: { acuerdo_id: detalle.referencia_id, tipo_movimiento: 'pago' },
                  orderBy: { created_at: 'desc' },
                });

          const semanas = movimiento?.semanas_pagadas ?? 0;

          const datosReverso = {
            acuerdo_id: detalle.referencia_id,
            tipo_movimiento: 'reverso',
            monto_usd: montoUsd,
            monto_bs: montoBs,
            tasa_cambio: tasa,
            semanas_pagadas: -semanas,
            concepto: `Reverso de colecta #${colecta.id}: ${validacion.data.motivo}`,
          };

          if (detalle.servicio === 'funeraria') {
            const acuerdo = await tx.acuerdoFuneraria.findUnique({ where: { id: detalle.referencia_id } });
            if (!acuerdo) continue;
            await tx.movimientoFuneraria.create({ data: datosReverso });
            await tx.acuerdoFuneraria.update({
              where: { id: acuerdo.id },
              data: { semanas_sin_pago: acuerdo.semanas_sin_pago + semanas },
            });
          } else {
            const acuerdo = await tx.acuerdoSalud.findUnique({ where: { id: detalle.referencia_id } });
            if (!acuerdo) continue;
            await tx.movimientoSalud.create({ data: datosReverso });
            await tx.acuerdoSalud.update({
              where: { id: acuerdo.id },
              data: { semanas_sin_pago: acuerdo.semanas_sin_pago + semanas },
            });
          }
        }
      }

      await tx.colecta.update({
        where: { id: colecta.id },
        data: {
          reversada: true,
          fecha_reverso: new Date(),
          motivo_reverso: validacion.data.motivo,
          reversada_por: req.user!.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          usuario_id: req.user!.userId,
          accion: 'REVERSAR_COLECTA',
          modulo: 'colecta',
          registro_id: colecta.id,
          datos_antes: { monto_total_usd: colecta.monto_total_usd } as any,
          datos_despues: { motivo: validacion.data.motivo } as any,
          ip_address: req.ip || 'unknown',
          user_agent: req.get('user-agent') || 'unknown',
        },
      });
    });

    logger.info(`Colecta ${colecta.id} reversada por usuario ${req.user!.userId}`);
    res.json({ success: true, data: { id: colecta.id, reversada: true } });
  } catch (error) {
    responderError(res, error, 'Error al reversar la colecta');
  }
};

// ============================================
// REPORTES DE IMPRESIÓN
// ============================================

/** Rango [desde, hasta] del día o del período pedido, en hora local. */
function rangoFechas(req: Request): { desde: Date; hasta: Date } {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date(`${String(req.query.desde ?? hoy)}T00:00:00`);
  const hasta = new Date(`${String(req.query.hasta ?? req.query.desde ?? hoy)}T23:59:59.999`);

  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    throw new BadRequestError('Fechas inválidas');
  }
  if (desde > hasta) throw new BadRequestError('La fecha desde no puede ser posterior a la fecha hasta');

  return { desde, hasta };
}

/**
 * GET /api/colecta/reportes/por-servicio?desde=&hasta=&servicio=&solo_mias=
 *
 * Equivale a los reportes "Colecta Ahorro / Funeraria / Salud" del sistema
 * viejo, pero en UN endpoint con filtro de servicio en vez de cuatro pantallas.
 */
export const reportePorServicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta } = rangoFechas(req);
    const servicio = req.query.servicio ? String(req.query.servicio) : undefined;
    const soloMias = String(req.query.solo_mias ?? 'false') === 'true';

    const colectas = await prisma.colecta.findMany({
      where: {
        fecha_colecta: { gte: desde, lte: hasta },
        reversada: false,
        ...(soloMias ? { usuario_id: req.user!.userId } : {}),
      },
      orderBy: { fecha_colecta: 'asc' },
      include: {
        detalles: true,
        socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
        usuario: { select: { username: true } },
      },
    });

    // Una fila por detalle: es lo que se imprime
    const filas = colectas.flatMap((colecta) =>
      colecta.detalles
        .filter((d) => !servicio || servicio === 'todos' || d.servicio === servicio)
        .map((d) => ({
          colecta_id: colecta.id,
          fecha: colecta.fecha_colecta,
          servicio: d.servicio,
          codigo_socio: colecta.socio.codigo_socio,
          cedula: colecta.socio.cedula,
          socio: `${colecta.socio.apellido}, ${colecta.socio.nombre}`,
          concepto: d.concepto,
          monto_usd: Number(d.monto_usd),
          monto_bs: Number(d.monto_bs),
          cajero: colecta.usuario.username,
        }))
    );

    const porServicio: Record<string, { cantidad: number; usd: number; bs: number }> = {};
    for (const fila of filas) {
      const acc = (porServicio[fila.servicio] ??= { cantidad: 0, usd: 0, bs: 0 });
      acc.cantidad++;
      acc.usd += fila.monto_usd;
      acc.bs += fila.monto_bs;
    }
    for (const k of Object.keys(porServicio)) {
      porServicio[k]!.usd = redondear(porServicio[k]!.usd);
      porServicio[k]!.bs = redondear(porServicio[k]!.bs);
    }

    res.json({
      success: true,
      data: {
        desde,
        hasta,
        filas,
        resumen: {
          por_servicio: porServicio,
          cantidad: filas.length,
          total_usd: redondear(filas.reduce((a, f) => a + f.monto_usd, 0)),
          total_bs: redondear(filas.reduce((a, f) => a + f.monto_bs, 0)),
        },
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al generar el reporte');
  }
};

/** Cuenta contable de cada servicio, configurable en Parámetros del sistema. */
const CUENTAS_CONTABLES: Record<string, { clave: string; porDefecto: string; nombre: string }> = {
  ahorro: { clave: 'CUENTA_CONTABLE_AHORRO', porDefecto: '21210702002', nombre: 'Colecta Ahorro' },
  funeraria: { clave: 'CUENTA_CONTABLE_FUNERARIA', porDefecto: '21210302001', nombre: 'Colecta Funeraria' },
  salud: { clave: 'CUENTA_CONTABLE_SALUD', porDefecto: '41110108008', nombre: 'Colecta Salud' },
  prestamo: { clave: 'CUENTA_CONTABLE_PRESTAMOS', porDefecto: '', nombre: 'Colecta Prestamos' },
  caja: { clave: 'CUENTA_CONTABLE_CAJA', porDefecto: '', nombre: 'Caja' },
};

/**
 * GET /api/colecta/reportes/asiento-contable?desde=&hasta=
 *
 * Reproduce el asiento del sistema viejo: una línea por servicio con su cuenta
 * contable, el monto al HABER, y la contrapartida de caja al DEBE por el total.
 * Los montos van en bolívares, como en el original.
 *
 * Los códigos de cuenta se leen de Parámetros del sistema; los valores por
 * defecto son los que usa hoy el sistema viejo.
 */
export const asientoContable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta } = rangoFechas(req);

    const colectas = await prisma.colecta.findMany({
      where: { fecha_colecta: { gte: desde, lte: hasta }, reversada: false },
      include: { detalles: true },
    });

    const totales: Record<string, number> = {};
    for (const colecta of colectas) {
      for (const d of colecta.detalles) {
        totales[d.servicio] = (totales[d.servicio] ?? 0) + Number(d.monto_bs);
      }
    }

    const parametros = await prisma.parametroSistema.findMany({
      where: { clave: { in: Object.values(CUENTAS_CONTABLES).map((c) => c.clave) } },
    });
    const valorParametro = (clave: string, porDefecto: string): string =>
      parametros.find((p) => p.clave === clave)?.valor ?? porDefecto;

    const lineas = Object.entries(totales)
      .filter(([, monto]) => monto > 0)
      .map(([servicio, monto]) => {
        const config = CUENTAS_CONTABLES[servicio] ?? {
          clave: '',
          porDefecto: '',
          nombre: servicio,
        };
        return {
          cuenta: config.clave ? valorParametro(config.clave, config.porDefecto) : '',
          nombre: config.nombre,
          debe: 0,
          haber: redondear(monto),
        };
      })
      .sort((a, b) => a.cuenta.localeCompare(b.cuenta));

    const totalHaber = redondear(lineas.reduce((a, l) => a + l.haber, 0));

    // Contrapartida: la caja recibe el total
    const lineaCaja = {
      cuenta: valorParametro(CUENTAS_CONTABLES.caja!.clave, CUENTAS_CONTABLES.caja!.porDefecto),
      nombre: CUENTAS_CONTABLES.caja!.nombre,
      debe: totalHaber,
      haber: 0,
    };

    res.json({
      success: true,
      data: {
        desde,
        hasta,
        lineas: [lineaCaja, ...lineas],
        totales: { debe: totalHaber, haber: totalHaber },
        // El asiento cuadra por construcción; se expone para que el contador lo vea
        cuadra: true,
        cantidad_colectas: colectas.length,
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al generar el asiento contable');
  }
};
