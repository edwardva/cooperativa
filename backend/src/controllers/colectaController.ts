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
import {
  formatearPeriodo,
  semanaActual,
  type Periodo,
} from '../utils/calendarioSemanal';
import {
  aplicarPago,
  calcularSituacion,
  coberturaDe,
  semanasSinPagoDerivadas,
} from '../services/coberturaService';
import {
  armarPaquete,
  resumirServicio,
  semanasParaPonerseAlDia,
  tarifaDeAcuerdo,
  validarIntegridadDelPaquete,
  type AcuerdoCobrable,
} from '../services/cobroSemanalService';
import { obtenerTarifas, tipoCuentaAhorroObligatorio } from '../services/tarifasService';

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

  /**
   * Oficina y canal del cobro. El cuadre se pide por oficina, por colector y
   * por canal, además del consolidado general (req. 9).
   */
  ubicacion_id: z.number().int().positive().optional().nullable(),
  canal: z.enum(['presencial', 'digital']).optional().default('presencial'),

  /**
   * Permite saltarse la advertencia de adelanto. No salta el bloqueo cuando la
   * cooperativa lo activa por parámetro: eso es una regla, no un aviso.
   */
  confirmar_advertencias: z.boolean().optional().default(false),

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

/**
 * Acuerdos vigentes del socio con su situación ya calculada.
 *
 * Lo usan el cobro (para validar que el paquete esté completo) y el cálculo
 * previo del importe, así que ambos ven exactamente lo mismo.
 */
async function cargarAcuerdosDelSocio(
  socioId: number,
  tarifas: Awaited<ReturnType<typeof obtenerTarifas>>,
  actual: Periodo
): Promise<AcuerdoCobrable[]> {
  const beneficiarios = await prisma.beneficiario.findMany({
    where: { socio_id: socioId },
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
  });

  return beneficiarios.flatMap((b) => [
    ...b.acuerdos_funeraria.map((a) => ({
      servicio: 'funeraria' as const,
      referencia_id: a.id,
      titulo: a.tipo_acuerdo.nombre,
      detalle: `${b.nombre} ${b.apellido}`,
      numero_acuerdo: a.numero_acuerdo,
      monto_plan_usd: Number(a.tipo_acuerdo.monto_usd),
      situacion: calcularSituacion(a, tarifas.semanas_suspension_funeraria, actual),
    })),
    ...b.acuerdos_salud.map((a) => ({
      servicio: 'salud' as const,
      referencia_id: a.id,
      titulo: a.tipo_acuerdo.nombre,
      detalle: `${b.nombre} ${b.apellido}`,
      numero_acuerdo: a.numero_acuerdo,
      monto_plan_usd: Number(a.tipo_acuerdo.monto_usd),
      situacion: calcularSituacion(a, tarifas.semanas_suspension_salud, actual),
    })),
  ]);
}

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

    const [{ tasa }, tarifas, codigoCuentaAhorro] = await Promise.all([
      obtenerTasaActual(),
      obtenerTarifas(),
      tipoCuentaAhorroObligatorio(),
    ]);
    const actual = semanaActual();

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
          include: {
            tipo_cuenta: { select: { id: true, codigo: true, nombre: true } },
            // Movimientos recientes en la pantalla principal: el cliente pidió
            // no tener que abrir otra ventana para verlos (req. 4)
            movimientos: {
              orderBy: { fecha_movimiento: 'desc' },
              take: 5,
              select: {
                id: true,
                tipo_movimiento: true,
                monto_usd: true,
                monto_bs: true,
                moneda: true,
                canal: true,
                concepto: true,
                referencia: true,
                fecha_movimiento: true,
              },
            },
          },
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
      const cuentas = socio.cuentas_ahorro.map((cuenta) => ({
        tipo: 'ahorro' as const,
        referencia_id: cuenta.id,
        titulo: cuenta.tipo_cuenta.nombre,
        codigo_tipo: cuenta.tipo_cuenta.codigo,
        detalle: cuenta.numero_cuenta,
        saldo_usd: Number(cuenta.saldo_usd),
        saldo_bs: Number(cuenta.saldo_bs),
        bloqueado_usd: Number(cuenta.monto_bloqueado_usd),
        // Lo que realmente puede retirar: el resto está comprometido como fianza
        disponible_usd: redondear(Number(cuenta.saldo_usd) - Number(cuenta.monto_bloqueado_usd)),
        semanas_sin_pago: null as number | null,
        monto_sugerido_usd: null as number | null,
        estado: 'activo',
        movimientos_recientes: cuenta.movimientos.map((m) => ({
          id: m.id,
          tipo: m.tipo_movimiento,
          monto_usd: Number(m.monto_usd),
          monto_bs: Number(m.monto_bs),
          moneda: m.moneda,
          canal: m.canal,
          concepto: m.concepto,
          referencia: m.referencia,
          fecha: m.fecha_movimiento,
        })),
      }));

      // Cuenta que recibe el ahorro obligatorio: la del tipo configurado, y si
      // no existe, la primera activa. El cajero no arma códigos a mano.
      const cuentaAhorro =
        cuentas.find((c) => c.codigo_tipo === codigoCuentaAhorro) ?? cuentas[0] ?? null;

      // --- Acuerdos, con su situación calculada desde la cobertura ---
      const acuerdosFuneraria: AcuerdoCobrable[] = socio.beneficiarios.flatMap((b) =>
        b.acuerdos_funeraria.map((acuerdo) => ({
          servicio: 'funeraria' as const,
          referencia_id: acuerdo.id,
          titulo: acuerdo.tipo_acuerdo.nombre,
          detalle: `${b.nombre} ${b.apellido}`,
          numero_acuerdo: acuerdo.numero_acuerdo,
          monto_plan_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
          situacion: calcularSituacion(acuerdo, tarifas.semanas_suspension_funeraria, actual),
        }))
      );

      const acuerdosSalud: AcuerdoCobrable[] = socio.beneficiarios.flatMap((b) =>
        b.acuerdos_salud.map((acuerdo) => ({
          servicio: 'salud' as const,
          referencia_id: acuerdo.id,
          titulo: acuerdo.tipo_acuerdo.nombre,
          detalle: `${b.nombre} ${b.apellido}`,
          numero_acuerdo: acuerdo.numero_acuerdo,
          monto_plan_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
          situacion: calcularSituacion(acuerdo, tarifas.semanas_suspension_salud, actual),
        }))
      );

      const acuerdos = [...acuerdosFuneraria, ...acuerdosSalud];

      // Resumen POR SERVICIO, no una fila por semana adeudada (req. 1)
      const servicios = acuerdos.map((a) => resumirServicio(a, tarifas));

      // --- Préstamos ---
      const prestamos = (prestamosPorSocio.get(socio.id) ?? []).map((p) => ({
        tipo: 'prestamo' as const,
        referencia_id: p.id,
        titulo: p.tipo_prestamo.nombre,
        // Categoría, pagaré, moneda y saldo, separados en vez de amontonados
        categoria: p.tipo_prestamo.nombre,
        numero_pagare: p.numero_prestamo,
        moneda: 'USD',
        detalle: `${p.numero_prestamo} · cuota $${Number(p.cuota_semanal_usd).toFixed(2)}`,
        saldo_usd: redondear(
          Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd)
        ),
        saldo_capital_usd: Number(p.saldo_capital_usd),
        saldo_interes_usd: Number(p.saldo_interes_usd),
        saldo_mora_usd: Number(p.saldo_mora_usd),
        saldo_bs: redondear(
          (Number(p.saldo_capital_usd) + Number(p.saldo_interes_usd) + Number(p.saldo_mora_usd)) * tasa
        ),
        fecha_desembolso: p.fecha_desembolso,
        // El dato que hoy obliga a abrir otra pantalla (req. 5)
        fecha_ultimo_abono: p.fecha_ultimo_abono,
        semanas_sin_pago: null as number | null,
        monto_sugerido_usd: redondear(Number(p.cuota_semanal_usd) + Number(p.saldo_mora_usd)),
        monto_semanal_usd: Number(p.cuota_semanal_usd),
        estado: p.estado,
      }));

      // --- Cobrables: se conserva la forma que ya consume el frontend ---
      const cobrablesServicio = acuerdos.map((a) => {
        const tarifa = tarifaDeAcuerdo(a, tarifas);
        return {
          tipo: a.servicio,
          referencia_id: a.referencia_id,
          titulo: a.titulo,
          detalle: `${a.detalle}${a.numero_acuerdo ? ` · ${a.numero_acuerdo}` : ''}`,
          saldo_usd: null as number | null,
          saldo_bs: null as number | null,
          semanas_sin_pago: a.situacion.semanas_pendientes,
          monto_sugerido_usd: redondear(tarifa * Math.max(a.situacion.semanas_pendientes, 1)),
          monto_semanal_usd: tarifa,
          estado: a.situacion.estado_registrado,
          pagado_hasta: a.situacion.cobertura,
          pagado_hasta_texto: formatearPeriodo(a.situacion.cobertura),
          fecha_ultimo_pago: a.situacion.fecha_ultimo_pago,
          semanas_adelantadas: a.situacion.semanas_adelantadas,
        };
      });

      // Semanas sugeridas: las que hacen falta para dejar TODO al día
      const pendientes = semanasParaPonerseAlDia(acuerdos);

      // Paquete de una semana, para que la pantalla muestre el desglose al abrir
      const paqueteSugerido = armarPaquete({
        semanas: Math.max(pendientes, 1),
        acuerdos,
        tarifas,
        tasa,
        cuentaAhorroId: cuentaAhorro?.referencia_id ?? null,
      });

      return {
        id: socio.id,
        codigo_socio: socio.codigo_socio,
        cedula: socio.cedula,
        nombre: socio.nombre,
        apellido: socio.apellido,
        estado: socio.estado,
        es_trabajador: socio.es_trabajador,
        telefono: socio.telefono,
        ubicacion: socio.ubicacion,

        cobrables: [...cuentas, ...cobrablesServicio, ...prestamos],

        // Vistas ya resueltas para la pantalla principal
        cuentas_ahorro: cuentas,
        cuenta_ahorro_obligatorio_id: cuentaAhorro?.referencia_id ?? null,
        servicios,
        prestamos,
        semanas_para_ponerse_al_dia: pendientes,
        paquete_sugerido: paqueteSugerido,

        // Cantidad de acuerdos por servicio: en el sistema viejo son nu_fun y
        // nu_sal, los multiplicadores del subtotal
        cantidad_funeraria: acuerdosFuneraria.length,
        cantidad_salud: acuerdosSalud.length,
        cuota_funeraria_usd: Math.max(
          0,
          ...acuerdosFuneraria.map((a) => tarifaDeAcuerdo(a, tarifas))
        ),
        cuota_salud_usd: Math.max(0, ...acuerdosSalud.map((a) => tarifaDeAcuerdo(a, tarifas))),
        mayor_atraso: pendientes,
        asambleas_asistidas: asistencias
          .filter((a) => a.socio_id === socio.id)
          .map((a) => a.asamblea_id),
        alertas: {
          // Se avisa, no se bloquea: la decisión es del cajero
          socio_retirado: socio.estado === 'retirado',
          acuerdos_suspendidos: acuerdos.filter(
            (a) => a.situacion.estado_registrado === 'suspendido'
          ).length,
          // Acuerdos cuyo estado guardado no coincide con lo que dice la
          // cobertura: es el caso que el personal marcó como mal calculado
          servicios_a_revisar: servicios.filter((sv) => sv.requiere_revision).length,
          // Fianzas que comprometen su ahorro (req. 5)
          ahorro_bloqueado_usd: redondear(
            cuentas.reduce((total, c) => total + c.bloqueado_usd, 0)
          ),
        },
      };
    });

    res.json({
      success: true,
      data: {
        encontrados,
        tasa,
        asambleas,
        // Tarifas de SÓLO LECTURA: la pantalla las muestra, no las edita (req. 2)
        tarifas,
        semana_actual: actual,
        semana_actual_texto: formatearPeriodo(actual),
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al buscar el socio');
  }
};

// ============================================
// CÁLCULO DEL PAQUETE SEMANAL
// ============================================

const calcularPaqueteSchema = z.object({
  socio_id: z.coerce.number().int().positive(),
  semanas: z.coerce.number().int().min(1).max(104).default(1),
  ahorro_adicional_usd: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/colecta/calcular?socio_id=&semanas=&ahorro_adicional_usd=
 *
 * El cajero escribe cuántas semanas paga el socio y esto devuelve el importe:
 * ahorro obligatorio más cada servicio contratado, con su desglose y el total
 * en USD y en bolívares.
 *
 * Las tarifas vienen de parámetros y salen como SÓLO LECTURA. Lo único que se
 * decide en la pantalla de cobro es la cantidad de semanas (req. 1 y 2).
 */
export const calcularPaquete = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = calcularPaqueteSchema.safeParse(req.query);
    if (!validacion.success) {
      throw new BadRequestError('Indique el socio y la cantidad de semanas');
    }
    const { socio_id, semanas, ahorro_adicional_usd } = validacion.data;

    const [{ tasa }, tarifas, codigoCuenta] = await Promise.all([
      obtenerTasaActual(),
      obtenerTarifas(),
      tipoCuentaAhorroObligatorio(),
    ]);
    const actual = semanaActual();

    const socio = await prisma.socio.findUnique({ where: { id: socio_id } });
    if (!socio) throw new NotFoundError('Socio no encontrado');

    const acuerdos = await cargarAcuerdosDelSocio(socio_id, tarifas, actual);

    const cuentas = await prisma.cuentaAhorro.findMany({
      where: { socio_id, estado: true },
      include: { tipo_cuenta: { select: { codigo: true } } },
      orderBy: { numero_cuenta: 'asc' },
    });
    const cuentaAhorro =
      cuentas.find((c) => c.tipo_cuenta.codigo === codigoCuenta) ?? cuentas[0] ?? null;

    // Sólo se cobran los acuerdos activos: los suspendidos requieren reintegro,
    // que es una decisión aparte del cajero.
    const activos = acuerdos.filter((a) => a.situacion.estado_registrado === 'activo');

    const paquete = armarPaquete({
      semanas,
      acuerdos: activos,
      tarifas,
      tasa,
      cuentaAhorroId: cuentaAhorro?.id ?? null,
      ahorroAdicionalUsd: ahorro_adicional_usd,
    });

    const pendientes = semanasParaPonerseAlDia(acuerdos);

    res.json({
      success: true,
      data: {
        ...paquete,
        tarifas,
        semana_actual: actual,
        semana_actual_texto: formatearPeriodo(actual),
        // Pendientes y adelantadas se suman: "una pendiente más diez
        // adelantadas equivale a pagar once semanas"
        semanas_pendientes: pendientes,
        semanas_adelantadas: Math.max(0, semanas - pendientes),
        acuerdos_suspendidos: acuerdos.length - activos.length,
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al calcular el cobro');
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
    const [{ tasa, semanaId }, tarifas] = await Promise.all([obtenerTasaActual(), obtenerTarifas()]);
    const actual = semanaActual();

    const socio = await prisma.socio.findUnique({ where: { id: datos.socio_id } });
    if (!socio) {
      throw new NotFoundError('Socio no encontrado');
    }

    // ------------------------------------------------------------------
    // Integridad del paquete, ANTES de escribir nada.
    //
    // "No permitir seleccionar únicamente uno de los servicios contratados
    //  para pagar esa semana." Se valida aquí y no sólo en la pantalla: es una
    // regla del negocio y no puede depender de que el cliente HTTP se porte
    // bien.
    // ------------------------------------------------------------------
    const acuerdosDelSocio = await cargarAcuerdosDelSocio(datos.socio_id, tarifas, actual);

    const cobrados = datos.detalles
      .filter((d) => (d.servicio === 'funeraria' || d.servicio === 'salud') && !d.es_reintegro)
      .map((d) => ({
        servicio: d.servicio as 'funeraria' | 'salud',
        referencia_id: d.referencia_id,
        semanas: d.semanas ?? datos.semanas,
      }));

    const problemas = validarIntegridadDelPaquete({
      acuerdosDelSocio,
      cobrados,
      tarifas,
      semanasSolicitadas: datos.semanas,
    });

    if (problemas.length > 0) {
      throw new BadRequestError(problemas.map((p) => p.mensaje).join(' '));
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
          ubicacion_id: datos.ubicacion_id ?? socio.ubicacion_id ?? null,
          canal: datos.canal,
          monto_total_usd: totalUsd,
          monto_total_bs: totalBs,
          tasa_cambio: tasa,
          // Tarifas congeladas: cambiarlas mañana no altera lo ya cobrado
          tarifa_ahorro_usd: tarifas.ahorro_usd,
          tarifa_funeraria_usd: tarifas.funeraria_usd,
          tarifa_salud_usd: tarifas.salud_usd,
          observaciones: datos.observaciones ?? null,
        },
      });

      // Ahora sí se impacta cada servicio.
      //
      // El renglón de servicio se resuelve primero (para saber adónde queda la
      // cobertura) y el detalle se escribe con ese dato: es lo que permite que
      // el reverso devuelva la cobertura exacta sin tener que adivinarla.
      for (const item of preparados) {
        const { detalle, montoUsd, montoBs } = item;

        let datosDetalle: {
          semanas: number | null;
          tarifa_unitaria_usd: number | null;
          cobertura_ano_antes: number | null;
          cobertura_semana_antes: number | null;
          cobertura_ano_despues: number | null;
          cobertura_semana_despues: number | null;
        } = {
          semanas: null,
          tarifa_unitaria_usd: null,
          cobertura_ano_antes: null,
          cobertura_semana_antes: null,
          cobertura_ano_despues: null,
          cobertura_semana_despues: null,
        };

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
              // El cuadre necesita saber si entraron bolívares o divisas, y si
              // fue presencial o por el cajero digital (req. 4 y 9)
              moneda: 'BS' as const,
              canal: datos.canal,
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
              // El dato que hoy obliga a abrir otra pantalla para saber cuándo
              // pagó por última vez (req. 5)
              fecha_ultimo_abono: new Date(),
              ...(saldado ? { estado: 'saldado' as const } : {}),
            },
          });
        } else {
          const acuerdo = (item as any).acuerdo;
          const tarifaUnitaria =
            Number(acuerdo.tipo_acuerdo.monto_usd) > 0
              ? Number(acuerdo.tipo_acuerdo.monto_usd)
              : detalle.servicio === 'funeraria'
                ? tarifas.funeraria_usd
                : tarifas.salud_usd;

          // El reintegro es el cargo por reactivar: suma al total pero NO
          // mueve la cobertura, porque no cubre ninguna semana.
          const semanasPagadas = detalle.es_reintegro
            ? 0
            : (detalle.semanas ??
              datos.semanas ??
              (tarifaUnitaria > 0 ? Math.floor(montoUsd / tarifaUnitaria) : 0));

          // -----------------------------------------------------------
          // Cobertura: aquí es donde el pago se traduce a "hasta cuándo".
          //
          // Es una suma sobre el calendario, así que un pago de diciembre que
          // se pasa a enero no necesita ningún caso especial, y adelantar más
          // allá del año en curso tampoco.
          // -----------------------------------------------------------
          const coberturaAntes = coberturaDe(acuerdo, actual);
          const coberturaDespues =
            coberturaAntes && semanasPagadas > 0
              ? aplicarPago(coberturaAntes, semanasPagadas)
              : coberturaAntes;

          datosDetalle = {
            semanas: semanasPagadas,
            tarifa_unitaria_usd: tarifaUnitaria,
            cobertura_ano_antes: coberturaAntes?.ano ?? null,
            cobertura_semana_antes: coberturaAntes?.semana ?? null,
            cobertura_ano_despues: coberturaDespues?.ano ?? null,
            cobertura_semana_despues: coberturaDespues?.semana ?? null,
          };

          const datosMovimiento = {
            acuerdo_id: acuerdo.id,
            tipo_movimiento: detalle.es_reintegro ? 'reintegro' : 'pago',
            monto_usd: montoUsd,
            monto_bs: montoBs,
            tasa_cambio: tasa,
            semanas_pagadas: semanasPagadas,
            // Hasta cuándo dejó cubierto el acuerdo ESTE movimiento
            ano_cobertura: coberturaDespues?.ano ?? null,
            semana_cobertura: coberturaDespues?.semana ?? null,
            concepto: detalle.concepto ?? (detalle.es_reintegro ? 'Reintegro' : 'Colecta'),
          };

          // `semanas_sin_pago` pasa a ser un valor derivado: se recalcula desde
          // la cobertura en vez de restarse a ciegas. Se sigue escribiendo
          // porque lo leen funeraria, salud y los reportes.
          const semanasRestantes = coberturaDespues
            ? semanasSinPagoDerivadas(coberturaDespues, actual)
            : Math.max(acuerdo.semanas_sin_pago - semanasPagadas, 0);

          // Se reactiva al pagar el reintegro, o al quedar sin atraso
          const reactivar =
            acuerdo.estado === 'suspendido' && (detalle.es_reintegro || semanasRestantes === 0);

          const datosAcuerdo = {
            semanas_sin_pago: semanasRestantes,
            ...(coberturaDespues
              ? {
                  ano_pagado_hasta: coberturaDespues.ano,
                  semana_pagada_hasta: coberturaDespues.semana,
                }
              : {}),
            // Cuándo se cobró, que es OTRO dato distinto de hasta cuándo cubre
            ...(semanasPagadas > 0 ? { fecha_ultimo_pago: new Date() } : {}),
            ...(reactivar ? { estado: 'activo' as const, fecha_suspension: null } : {}),
          };

          if (detalle.servicio === 'funeraria') {
            await tx.movimientoFuneraria.create({ data: datosMovimiento });
            await tx.acuerdoFuneraria.update({ where: { id: acuerdo.id }, data: datosAcuerdo });
          } else {
            await tx.movimientoSalud.create({
              data: { ...datosMovimiento, ubicacion_id: datos.ubicacion_id ?? socio.ubicacion_id ?? null },
            });
            await tx.acuerdoSalud.update({ where: { id: acuerdo.id }, data: datosAcuerdo });
          }
        }

        // El detalle se escribe al final, ya con la cobertura resuelta
        await tx.detalleColecta.create({
          data: {
            colecta_id: colecta.id,
            servicio: detalle.servicio,
            referencia_id: detalle.referencia_id,
            monto_usd: montoUsd,
            monto_bs: montoBs,
            es_reintegro: detalle.es_reintegro,
            concepto: detalle.concepto ?? null,
            ...datosDetalle,
          },
        });
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
    const actual = semanaActual();

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
        } else if (detalle.servicio === 'prestamo') {
          // El cliente pidió expresamente poder reversar abonos a préstamo
          // (req. 6). Antes el reverso de la colecta los dejaba aplicados.
          const prestamo = await tx.prestamo.findUnique({ where: { id: detalle.referencia_id } });
          if (!prestamo) continue;

          // Se busca el abono de ESTA colecta, no "el último": entremedio puede
          // haber habido otro abono desde el módulo de préstamos.
          const abono = await tx.abonoPrestamo.findFirst({
            where: {
              prestamo_id: prestamo.id,
              reversado: false,
              concepto: { contains: `Colecta #${colecta.id}` },
            },
            orderBy: { fecha_abono: 'desc' },
          });
          if (!abono) continue;

          await tx.abonoPrestamo.update({
            where: { id: abono.id },
            data: {
              reversado: true,
              fecha_reverso: new Date(),
              motivo_reverso: validacion.data.motivo,
              reversado_por: req.user!.userId,
            },
          });

          // Se devuelve cada saldo a lo que era: capital, interés y mora
          const capital = redondear(
            Number(prestamo.saldo_capital_usd) + Number(abono.aplicado_capital_usd)
          );
          const interes = redondear(
            Number(prestamo.saldo_interes_usd) + Number(abono.aplicado_interes_usd)
          );
          const mora = redondear(Number(prestamo.saldo_mora_usd) + Number(abono.aplicado_mora_usd));

          // Fecha del último abono: la del abono vigente anterior, si queda alguno
          const anterior = await tx.abonoPrestamo.findFirst({
            where: { prestamo_id: prestamo.id, reversado: false, id: { not: abono.id } },
            orderBy: { fecha_abono: 'desc' },
            select: { fecha_abono: true },
          });

          await tx.prestamo.update({
            where: { id: prestamo.id },
            data: {
              saldo_capital_usd: capital,
              saldo_capital_bs: redondear(capital * tasa),
              saldo_interes_usd: interes,
              saldo_interes_bs: redondear(interes * tasa),
              saldo_mora_usd: mora,
              saldo_mora_bs: redondear(mora * tasa),
              fecha_ultimo_abono: anterior?.fecha_abono ?? null,
              // Si el abono lo había saldado, vuelve a estar activo
              ...(prestamo.estado === 'saldado' ? { estado: 'activo' as const } : {}),
            },
          });
        } else if (detalle.servicio === 'funeraria' || detalle.servicio === 'salud') {
          // La cobertura anterior viene GUARDADA en el detalle: se devuelve
          // exactamente adonde estaba. Antes se buscaba "el último movimiento
          // del acuerdo", que podía ser el de otra operación posterior.
          const semanas = detalle.semanas ?? 0;
          const coberturaAntes =
            detalle.cobertura_ano_antes !== null && detalle.cobertura_semana_antes !== null
              ? { ano: detalle.cobertura_ano_antes, semana: detalle.cobertura_semana_antes }
              : null;

          const datosReverso = {
            acuerdo_id: detalle.referencia_id,
            tipo_movimiento: 'reverso',
            monto_usd: montoUsd,
            monto_bs: montoBs,
            tasa_cambio: tasa,
            semanas_pagadas: -semanas,
            ano_cobertura: coberturaAntes?.ano ?? null,
            semana_cobertura: coberturaAntes?.semana ?? null,
            concepto: `Reverso de colecta #${colecta.id}: ${validacion.data.motivo}`,
          };

          // Datos viejos sin cobertura guardada: se cae al cálculo por contador
          const datosAcuerdo = coberturaAntes
            ? {
                ano_pagado_hasta: coberturaAntes.ano,
                semana_pagada_hasta: coberturaAntes.semana,
                semanas_sin_pago: semanasSinPagoDerivadas(coberturaAntes, actual),
              }
            : null;

          if (detalle.servicio === 'funeraria') {
            const acuerdo = await tx.acuerdoFuneraria.findUnique({ where: { id: detalle.referencia_id } });
            if (!acuerdo) continue;
            await tx.movimientoFuneraria.create({ data: datosReverso });
            await tx.acuerdoFuneraria.update({
              where: { id: acuerdo.id },
              data: datosAcuerdo ?? { semanas_sin_pago: acuerdo.semanas_sin_pago + semanas },
            });
          } else {
            const acuerdo = await tx.acuerdoSalud.findUnique({ where: { id: detalle.referencia_id } });
            if (!acuerdo) continue;
            await tx.movimientoSalud.create({ data: datosReverso });
            await tx.acuerdoSalud.update({
              where: { id: acuerdo.id },
              data: datosAcuerdo ?? { semanas_sin_pago: acuerdo.semanas_sin_pago + semanas },
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
