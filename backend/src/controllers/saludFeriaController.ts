// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Pago de Salud por Feria (HU-07 a HU-10, HU-19)
// ============================================
//
// La feria descuenta la salud a sus trabajadores y la paga junta. La salud se
// calcula por SEMANA (confirmado por la cooperativa) y un pago puede cubrir
// varias semanas seguidas: crea un encabezado con el rango y un renglón por
// trabajador y semana pendiente, en UNA transacción (HU-09): si falla un
// renglón no queda nada.
//
// Por parámetro: la periodicidad (PERIODICIDAD_SALUD_FERIA, semanal), el monto
// por trabajador y período (TARIFA_SALUD_TRABAJADOR_USD) y cuántas semanas se
// pueden adelantar (SEMANAS_ADELANTO_SALUD_FERIA, 10: la cooperativa cobra lo
// que la feria debe más diez semanas). No hay pagos parciales (pendiente 8): un
// pago cubre a todos los pendientes de los períodos elegidos.

import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { calcularDeudaRango, feriasPendientesDelPeriodo, periodoDesdeParametros } from '../services/saludFeriaService';
import { etiquetaFeria } from '../services/trabajadoresService';
import { leerParametroNumerico, periodicidadSaludFeria } from '../services/tarifasService';
import { resolverTasa } from '../services/tasaCambioService';
import { redondear } from '../services/cobroSemanalService';
import { bloquearFeria } from '../utils/bloqueos';
import { fechaDia, hoyDia } from '../utils/fechaDia';
import {
  contarPeriodos,
  etiquetaPeriodo,
  etiquetaRango,
  MAX_PERIODOS_POR_PAGO,
  periodoQueContiene,
  periodosDesde,
  rangoPeriodo,
  validarPeriodo,
  type PeriodoSaludRef,
} from '../utils/periodoSalud';
import { responderError, responderInvalido } from '../utils/responderError';

const METODOS_PAGO = ['transferencia', 'pago_movil', 'deposito', 'efectivo', 'otro'] as const;

// ============================================
// SCHEMAS
// ============================================

const registrarPagoSchema = z.object({
  feria_id: z.number({ required_error: 'Seleccione la feria' }).int().positive(),
  tipo: z.enum(['mensual', 'semanal']).optional(),
  /** Primer período que se paga */
  anio: z.number().int(),
  numero: z.number().int(),
  /** Períodos seguidos desde el primero: la feria paga varias semanas juntas */
  cantidad: z
    .number()
    .int()
    .min(1, 'Indique al menos un período')
    .max(MAX_PERIODOS_POR_PAGO, `Un pago cubre como máximo ${MAX_PERIODOS_POR_PAGO} períodos`)
    .default(1),
  fecha_pago: z.string().min(1, 'Indique la fecha del pago'),
  moneda: z.enum(['BS', 'USD']).default('BS'),
  monto_recibido: z.number().positive('El monto recibido debe ser mayor a cero'),
  metodo_pago: z.enum(METODOS_PAGO, { errorMap: () => ({ message: 'Seleccione el método de pago' }) }),
  referencia: z.string().trim().max(60).optional().nullable(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
  /** Lo que el usuario vio y confirmó: si la deuda cambió entre medio, se rechaza */
  esperado: z.object({
    cantidad_trabajadores: z.number().int().nonnegative(),
    cantidad_renglones: z.number().int().nonnegative(),
    monto_usd: z.number().nonnegative(),
  }),
  /** El recibido no coincide con el esperado y el usuario lo acepta igual */
  aceptar_diferencia: z.boolean().optional().default(false),
});

const anularSchema = z.object({
  motivo: z.string().trim().min(5, 'Explique el motivo de la anulación').max(500),
});

// ============================================
// HELPERS
// ============================================

const idDeRuta = (req: Request, param = 'id'): number => {
  const id = parseInt(String(req.params[param]), 10);
  if (isNaN(id)) throw new BadRequestError('ID inválido');
  return id;
};

/** Período de la query (?tipo=&anio=&numero=); sin anio/numero, el período en curso */
const periodoDeQuery = (req: Request): Promise<PeriodoSaludRef> =>
  periodoDesdeParametros({ tipo: req.query.tipo, anio: req.query.anio, numero: req.query.numero });

/** ?cantidad= de períodos seguidos; sin ella, uno */
const cantidadDeQuery = (req: Request): number => {
  const valor = req.query.cantidad;
  const cantidad = valor === undefined || valor === '' ? 1 : Number(valor);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_PERIODOS_POR_PAGO) {
    throw new BadRequestError(`La cantidad de períodos debe estar entre 1 y ${MAX_PERIODOS_POR_PAGO}`);
  }
  return cantidad;
};

const conEtiqueta = <T extends PeriodoSaludRef>(p: T) => ({ ...p, etiqueta: etiquetaPeriodo(p) });

const includeDetalle = {
  feria: { select: { id: true, codigo: true, nombre: true, direccion: true, responsable: true } },
  periodo: true,
  periodo_hasta: true,
  detalles: {
    include: {
      periodo: true,
      trabajador: {
        select: {
          id: true,
          codigo_trabajador: true,
          persona: { select: { tipo_identificacion: true, numero_identificacion: true, nombres: true, apellidos: true } },
        },
      },
    },
  },
} satisfies Prisma.PagoSaludFeriaInclude;

/** HU-10: encabezado, renglones, quién registró y si la suma cuadra */
const cargarPago = async (id: number) => {
  const pago = await prisma.pagoSaludFeria.findUnique({ where: { id }, include: includeDetalle });
  if (!pago) throw new NotFoundError('Pago no encontrado');

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: [pago.created_by, pago.anulado_por].filter((x): x is number => x !== null) } },
    select: { id: true, nombre_completo: true, username: true },
  });
  const usuario = (uid: number | null) => usuarios.find((u) => u.id === uid) ?? null;

  const suma = redondear(pago.detalles.reduce((s, d) => s + Number(d.monto_usd), 0));
  return {
    ...pago,
    periodo: conEtiqueta(pago.periodo),
    periodo_hasta: conEtiqueta(pago.periodo_hasta),
    etiqueta_periodos: etiquetaRango(pago.periodo, pago.periodo_hasta),
    // Por trabajador y, dentro de cada uno, por semana
    detalles: pago.detalles
      .map((d) => ({ ...d, periodo: conEtiqueta(d.periodo) }))
      .sort(
        (a, b) =>
          a.trabajador.persona.apellidos.localeCompare(b.trabajador.persona.apellidos, 'es') ||
          a.trabajador_id - b.trabajador_id ||
          a.periodo.fecha_inicio.getTime() - b.periodo.fecha_inicio.getTime()
      ),
    registrado_por: usuario(pago.created_by),
    anulado_por_usuario: usuario(pago.anulado_por),
    suma_detalles_usd: suma,
    cuadra: Math.abs(suma - Number(pago.monto_esperado_usd)) < 0.01,
  };
};

// ============================================
// CONSULTAS
// ============================================

/** GET /api/salud-feria/configuracion — periodicidad, tarifa, tasa y período en curso */
export const obtenerConfiguracion = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [periodicidad, tarifa, { tasa }] = await Promise.all([
      periodicidadSaludFeria(),
      leerParametroNumerico('TARIFA_SALUD_TRABAJADOR_USD'),
      resolverTasa(),
    ]);
    const actual = rangoPeriodo(periodoQueContiene(periodicidad));
    res.json({
      success: true,
      data: {
        periodicidad,
        tarifa_usd: tarifa,
        tarifa_configurada: tarifa > 0,
        tasa,
        periodo_actual: actual,
        max_periodos: MAX_PERIODOS_POR_PAGO,
        max_adelanto: await leerParametroNumerico('SEMANAS_ADELANTO_SALUD_FERIA'),
        metodos_pago: METODOS_PAGO,
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al leer la configuración');
  }
};

/** GET /api/salud-feria/ferias/:feriaId/deuda?tipo=&anio=&numero=&cantidad= (HU-07): desde un período, `cantidad` seguidos */
export const obtenerDeuda = async (req: Request, res: Response): Promise<void> => {
  try {
    const feriaId = idDeRuta(req, 'feriaId');
    const ref = await periodoDeQuery(req);
    const cantidad = cantidadDeQuery(req);

    const [feria, tarifa, { tasa }, maxAdelanto] = await Promise.all([
      prisma.ubicacion.findUnique({ where: { id: feriaId }, select: { id: true, codigo: true, nombre: true, direccion: true, responsable: true, estado: true } }),
      leerParametroNumerico('TARIFA_SALUD_TRABAJADOR_USD'),
      resolverTasa(),
      leerParametroNumerico('SEMANAS_ADELANTO_SALUD_FERIA'),
    ]);
    if (!feria) throw new NotFoundError('Feria no encontrada');

    const deuda = await calcularDeudaRango(prisma, feriaId, ref, cantidad, tarifa);
    res.json({
      success: true,
      data: {
        feria,
        ...deuda,
        tasa,
        monto_pendiente_bs: redondear(deuda.resumen.monto_pendiente_usd * tasa),
        tarifa_configurada: tarifa > 0,
        // Períodos que todavía no empiezan: se pagan adelantados hasta el tope
        adelantadas: deuda.periodos.filter((p) => p.inicio > hoyDia()).length,
        max_adelanto: maxAdelanto,
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al calcular la deuda de salud');
  }
};

/**
 * GET /api/salud-feria/pagos?feria_id=&tipo=&anio=&numero=&estado=&referencia=&trabajador=&page=&limit=
 * RF-SAL-14: por feria, período, estado, referencia y trabajador
 */
export const listarPagos = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query;
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.PagoSaludFeriaWhereInput = {};

    if (q.feria_id) where.feria_id = Number(q.feria_id);
    if (q.estado) {
      if (q.estado !== 'vigente' && q.estado !== 'anulado') throw new BadRequestError('Estado inválido');
      where.estado = q.estado;
    }
    if (q.anio) {
      // Pagos cuyo rango de períodos toca el período (o el año) pedido
      const anio = Number(q.anio);
      if (!Number.isInteger(anio)) throw new BadRequestError('Año inválido');
      const rango = q.numero
        ? rangoPeriodo(await periodoDesdeParametros({ tipo: q.tipo, anio: q.anio, numero: q.numero }))
        : { inicio: new Date(Date.UTC(anio, 0, 1)), fin: new Date(Date.UTC(anio, 11, 31)) };
      where.periodo = { fecha_inicio: { lte: rango.fin } };
      where.periodo_hasta = { fecha_fin: { gte: rango.inicio } };
    }
    if (q.referencia) where.referencia = { contains: String(q.referencia), mode: Prisma.QueryMode.insensitive };
    if (q.trabajador) {
      const texto = String(q.trabajador).trim();
      const insensible = Prisma.QueryMode.insensitive;
      where.detalles = {
        some: {
          trabajador: {
            OR: [
              { codigo_trabajador: { contains: texto, mode: insensible } },
              { persona: { numero_identificacion: { contains: texto.replace(/\D/g, '') || texto } } },
              { persona: { apellidos: { contains: texto, mode: insensible } } },
            ],
          },
        },
      };
    }

    const [total, pagos] = await Promise.all([
      prisma.pagoSaludFeria.count({ where }),
      prisma.pagoSaludFeria.findMany({
        where,
        include: { feria: { select: { id: true, codigo: true, nombre: true, direccion: true } }, periodo: true, periodo_hasta: true },
        orderBy: [{ fecha_pago: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: pagos.map((p) => ({
        ...p,
        periodo: conEtiqueta(p.periodo),
        periodo_hasta: conEtiqueta(p.periodo_hasta),
        etiqueta_periodos: etiquetaRango(p.periodo, p.periodo_hasta),
      })),
      meta: { total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    responderError(res, error, 'Error al listar los pagos de salud');
  }
};

/** GET /api/salud-feria/pagos/:id (HU-10) */
export const obtenerPago = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await cargarPago(idDeRuta(req)) });
  } catch (error) {
    responderError(res, error, 'Error al obtener el pago');
  }
};

/** GET /api/salud-feria/trabajadores/:id/pagos — historial de salud de un trabajador */
export const historialTrabajador = async (req: Request, res: Response): Promise<void> => {
  try {
    const detalles = await prisma.pagoSaludTrabajador.findMany({
      where: { trabajador_id: idDeRuta(req) },
      include: {
        periodo: true,
        feria: { select: { id: true, codigo: true, nombre: true, direccion: true } },
        pago: { select: { id: true, fecha_pago: true, referencia: true, estado: true } },
      },
      orderBy: [{ periodo: { fecha_inicio: 'desc' } }, { id: 'desc' }],
    });
    res.json({
      success: true,
      data: detalles.map((d) => ({ ...d, periodo: { ...d.periodo, etiqueta: etiquetaPeriodo(d.periodo) } })),
    });
  } catch (error) {
    responderError(res, error, 'Error al obtener el historial de salud');
  }
};

/**
 * GET /api/salud-feria/ferias-pendientes?tipo=&anio=&numero= (HU-19)
 * Todas las ferias activas, más las inactivas que tengan algo en el período
 */
export const feriasPendientes = async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await periodoDeQuery(req);
    res.json({ success: true, data: await feriasPendientesDelPeriodo(prisma, ref) });
  } catch (error) {
    responderError(res, error, 'Error al calcular las ferias pendientes');
  }
};

// ============================================
// OPERACIONES
// ============================================

/**
 * POST /api/salud-feria/pagos (HU-08, HU-09)
 *
 * Con la feria bloqueada recalcula la deuda de todos los períodos (BE-009: no
 * confía en la pantalla), exige que coincida con lo que el usuario confirmó,
 * crea el encabezado y un renglón por trabajador y período pendiente. Todo o nada.
 */
export const registrarPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = registrarPagoSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    const desde: PeriodoSaludRef = { tipo: d.tipo ?? (await periodicidadSaludFeria()), anio: d.anio, numero: d.numero };
    const errorPeriodo = validarPeriodo(desde);
    if (errorPeriodo) throw new BadRequestError(errorPeriodo);
    const refs = periodosDesde(desde, d.cantidad);
    // La feria paga lo que debe y adelanta unas semanas, con tope configurable
    const adelantadas = refs.filter((r) => rangoPeriodo(r).inicio > hoyDia());
    const maxAdelanto = await leerParametroNumerico('SEMANAS_ADELANTO_SALUD_FERIA');
    if (adelantadas.length > maxAdelanto) {
      throw new BadRequestError(
        `Se pueden adelantar hasta ${maxAdelanto} período(s) y el rango tiene ${adelantadas.length}. ` +
          `El primero adelantado es ${etiquetaPeriodo(adelantadas[0]!)}.`
      );
    }

    const fechaPago = fechaDia(d.fecha_pago, 'La fecha del pago');
    if (fechaPago > hoyDia()) throw new BadRequestError('La fecha del pago no puede ser posterior a hoy');

    const tarifa = await leerParametroNumerico('TARIFA_SALUD_TRABAJADOR_USD');
    if (tarifa <= 0) {
      throw new BadRequestError(
        'El monto de salud por trabajador no está configurado. Cárguelo en Parámetros (TARIFA_SALUD_TRABAJADOR_USD).'
      );
    }
    const { tasa } = await resolverTasa();

    const pagoId = await prisma.$transaction(async (tx) => {
      // Dos usuarios registrando el pago de la misma feria calculaban la misma deuda
      await bloquearFeria(tx, d.feria_id);
      const feria = await tx.ubicacion.findUniqueOrThrow({ where: { id: d.feria_id } });

      const deuda = await calcularDeudaRango(tx, feria.id, desde, d.cantidad, tarifa);
      const {
        trabajadores_con_pendiente: trabajadores,
        renglones_pendientes: renglones,
        monto_pendiente_usd: esperadoUsd,
      } = deuda.resumen;
      if (renglones === 0) {
        throw new ConflictError(`La feria ${etiquetaFeria(feria)} no tiene trabajadores pendientes en ${deuda.etiqueta}`);
      }

      if (
        d.esperado.cantidad_trabajadores !== trabajadores ||
        d.esperado.cantidad_renglones !== renglones ||
        Math.abs(d.esperado.monto_usd - esperadoUsd) > 0.009
      ) {
        throw new ConflictError(
          `La deuda cambió mientras se registraba: ahora son ${trabajadores} trabajador(es) y ${renglones} ` +
            `movimiento(s) por $${esperadoUsd}. Revise el detalle y confirme de nuevo.`,
          { cantidad_trabajadores: trabajadores, cantidad_renglones: renglones, monto_usd: esperadoUsd }
        );
      }

      const esperadoBs = redondear(esperadoUsd * tasa);
      const esperadoEnMoneda = d.moneda === 'USD' ? esperadoUsd : esperadoBs;
      const diferencia = redondear(d.monto_recibido - esperadoEnMoneda);
      if (Math.abs(diferencia) > 0.009 && !d.aceptar_diferencia) {
        throw new ConflictError(
          `El monto recibido (${d.monto_recibido} ${d.moneda}) difiere del esperado (${esperadoEnMoneda} ${d.moneda}) ` +
            `en ${diferencia}. Confirme la diferencia para registrarlo.`,
          { diferencia, esperado: esperadoEnMoneda, moneda: d.moneda }
        );
      }

      // El pago cubre de la primera a la última semana que tenía algo pendiente
      const conPendientes = deuda.periodos.filter((p) => p.pendientes > 0);
      // Hay al menos un renglón pendiente, así que al menos un período con pendientes
      const primero = conPendientes[0]!;
      const ultimoPendiente = conPendientes[conPendientes.length - 1]!;
      const clave = (p: { anio: number; numero: number }) => `${p.anio}-${p.numero}`;
      const idDePeriodo = new Map<string, number>();
      for (const p of deuda.periodos) {
        if (p.inicio < primero.inicio || p.inicio > ultimoPendiente.inicio) continue;
        const guardado = await tx.periodoSalud.upsert({
          where: { tipo_anio_numero: { tipo: p.tipo, anio: p.anio, numero: p.numero } },
          update: {},
          create: { tipo: p.tipo, anio: p.anio, numero: p.numero, fecha_inicio: p.inicio, fecha_fin: p.fin },
        });
        idDePeriodo.set(clave(p), guardado.id);
      }
      const idPeriodo = (p: { anio: number; numero: number }): number => {
        const id = idDePeriodo.get(clave(p));
        if (id === undefined) throw new Error(`Período ${clave(p)} sin guardar`);
        return id;
      };

      const pago = await tx.pagoSaludFeria.create({
        data: {
          feria_id: feria.id,
          periodo_id: idPeriodo(primero),
          periodo_hasta_id: idPeriodo(ultimoPendiente),
          cantidad_periodos: contarPeriodos(primero, ultimoPendiente),
          fecha_pago: fechaPago,
          cantidad_trabajadores: trabajadores,
          tarifa_usd: tarifa,
          monto_esperado_usd: esperadoUsd,
          tasa_cambio: tasa,
          monto_esperado_bs: esperadoBs,
          moneda: d.moneda,
          monto_recibido: d.monto_recibido,
          metodo_pago: d.metodo_pago,
          referencia: d.referencia || null,
          observaciones: d.observaciones || null,
          created_by: req.user!.userId,
        },
      });

      // RF-SAL-11/12: un renglón por trabajador y período, atado al pago que lo originó
      await tx.pagoSaludTrabajador.createMany({
        data: deuda.filas.flatMap((f) =>
          f.periodos
            .filter((p) => p.estado === 'pendiente')
            .map((p) => ({
              pago_id: pago.id,
              trabajador_id: f.trabajador_id,
              feria_id: feria.id,
              periodo_id: idPeriodo(p),
              monto_usd: p.monto_usd,
            }))
        ),
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'PAGO_SALUD_FERIA',
        modulo: 'salud_feria',
        registro_id: pago.id,
        despues: {
          feria: feria.codigo,
          periodo: etiquetaRango(primero, ultimoPendiente),
          trabajadores,
          movimientos: renglones,
          monto_esperado_usd: esperadoUsd,
          monto_recibido: d.monto_recibido,
          moneda: d.moneda,
          diferencia,
          referencia: d.referencia ?? null,
        },
      });

      return pago.id;
    });

    res.status(201).json({ success: true, data: await cargarPago(pagoId), message: 'Pago registrado' });
  } catch (error) {
    responderError(res, error, 'Error al registrar el pago de salud');
  }
};

/**
 * POST /api/salud-feria/pagos/:id/anular (RF-SAL-15)
 * Marca el pago y sus renglones como anulados; esas semanas vuelven a pendiente.
 */
export const anularPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idDeRuta(req);
    const validacion = anularSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);

    const existe = await prisma.pagoSaludFeria.findUnique({ where: { id }, select: { feria_id: true } });
    if (!existe) throw new NotFoundError('Pago no encontrado');

    await prisma.$transaction(async (tx) => {
      await bloquearFeria(tx, existe.feria_id);
      const pago = await tx.pagoSaludFeria.findUniqueOrThrow({ where: { id }, include: { periodo: true, periodo_hasta: true } });
      if (pago.estado === 'anulado') throw new ConflictError('Este pago ya fue anulado');

      await tx.pagoSaludFeria.update({
        where: { id },
        data: {
          estado: 'anulado',
          anulado_por: req.user!.userId,
          fecha_anulacion: new Date(),
          motivo_anulacion: validacion.data.motivo,
        },
      });
      const { count } = await tx.pagoSaludTrabajador.updateMany({ where: { pago_id: id }, data: { estado: 'anulado' } });

      await registrarAuditoria(tx, {
        req,
        accion: 'ANULAR_PAGO_SALUD_FERIA',
        modulo: 'salud_feria',
        registro_id: id,
        antes: { estado: pago.estado, movimientos: count, periodo: etiquetaRango(pago.periodo, pago.periodo_hasta) },
        despues: { estado: 'anulado', motivo: validacion.data.motivo },
      });
    });

    res.json({ success: true, data: await cargarPago(id), message: 'Pago anulado' });
  } catch (error) {
    responderError(res, error, 'Error al anular el pago');
  }
};
