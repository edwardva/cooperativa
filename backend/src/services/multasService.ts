// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Multas por inasistencia a asamblea
// ============================================
//
// Reglas confirmadas por la cooperativa el 23/10:
//
//   - La asamblea sectorial se hace en varias fechas al año (marzo). El socio
//     debe ir al menos a UNA, de cualquier sector.
//   - El que no va a ninguna paga una multa al monto VIGENTE (parámetro
//     MULTA_INASISTENCIA_ASAMBLEA_USD), entera, apenas termina la última
//     asamblea del año. Aplica a activos y suspendidos de cualquier sector o
//     feria; no al que se inscribió después de la última asamblea.
//   - Si falta también al año siguiente, la sanción de ese año ya no es otra
//     multa: es perder la condición de socio (retiro por inasistencia).
//   - Se cobra aparte de la colecta y no impide cobrarle lo demás.
//   - Para reactivar a un retirado, primero paga la multa que deba.
//
// Sólo se guardan las multas PAGADAS. Quién debe se calcula de la asistencia:
// si una asistencia se carga tarde, la deuda desaparece sola.

import type { Prisma, PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { bloquearSocio } from '../utils/bloqueos';
import { hoyDia } from '../utils/fechaDia';
import { redondear } from './cobroSemanalService';
import { leerParametroNumerico } from './tarifasService';
import { resolverTasa } from './tasaCambioService';

type Db = PrismaClient | Prisma.TransactionClient;

export const FORMAS_PAGO_MULTA = ['efectivo', 'transferencia', 'pago_movil', 'punto', 'ahorro'] as const;
export type FormaPagoMulta = (typeof FORMAS_PAGO_MULTA)[number];

export const montoMultaVigente = (): Promise<number> => leerParametroNumerico('MULTA_INASISTENCIA_ASAMBLEA_USD');

/**
 * Años cuyas asambleas ya terminaron, con la fecha de la última. Desde el día
 * siguiente a esa fecha la multa del año ya se puede cobrar.
 */
export const anosCerrados = async (db: Db): Promise<Map<number, Date>> => {
  const grupos = await db.asamblea.groupBy({
    by: ['ano'],
    where: { estado: true },
    _max: { fecha: true },
  });
  const hoy = hoyDia();
  return new Map(
    grupos
      .filter((g) => g._max.fecha !== null && g._max.fecha < hoy)
      .map((g) => [g.ano, g._max.fecha!] as const)
      .sort((a, b) => a[0] - b[0])
  );
};

/**
 * Años de multa que el socio debe y todavía no pagó.
 *
 * Un año sólo genera multa si el socio NO faltó también al año anterior: en ese
 * caso la sanción es el retiro, no una segunda multa.
 */
export const anosAdeudados = async (db: Db, socioId: number): Promise<number[]> => {
  const socio = await db.socio.findUnique({ where: { id: socioId }, select: { fecha_inscripcion: true } });
  if (!socio) throw new NotFoundError('Socio no encontrado');

  const [cerrados, asistencias, pagadas] = await Promise.all([
    anosCerrados(db),
    db.asistenciaAsamblea.findMany({
      where: { socio_id: socioId, asistio: true, asamblea: { estado: true } },
      select: { asamblea: { select: { ano: true } } },
    }),
    db.multaAsamblea.findMany({ where: { socio_id: socioId, estado: 'pagada' }, select: { ano: true } }),
  ]);
  const asistio = new Set(asistencias.map((a) => a.asamblea.ano));
  const pagado = new Set(pagadas.map((m) => m.ano));

  const falto = (ano: number): boolean => {
    const ultima = cerrados.get(ano);
    return ultima !== undefined && socio.fecha_inscripcion <= ultima && !asistio.has(ano);
  };

  return [...cerrados.keys()].filter((ano) => falto(ano) && !falto(ano - 1) && !pagado.has(ano));
};

/**
 * Socios que deben la multa de un año. Activos y suspendidos de cualquier
 * sector o feria; los que faltaron también el año anterior van al reporte de
 * retiro, no aquí.
 */
export const deudoresDelAno = async (
  db: Db,
  ano: number,
  filtros: { feriaId?: number; socioIds?: number[] } = {}
) => {
  const cerrados = await anosCerrados(db);
  const ultima = cerrados.get(ano);
  if (!ultima) {
    throw new BadRequestError(
      `Las asambleas de ${ano} no han terminado o no están cargadas: la multa se cobra después de la última.`
    );
  }
  const ultimaAnterior = cerrados.get(ano - 1);

  const where: Prisma.SocioWhereInput = {
    estado: { in: ['activo', 'suspendido'] },
    fecha_inscripcion: { lte: ultima },
    ...(filtros.feriaId ? { ubicacion_id: filtros.feriaId } : {}),
    ...(filtros.socioIds ? { id: { in: filtros.socioIds } } : {}),
    AND: [
      { asistencias_asamblea: { none: { asistio: true, asamblea: { ano, estado: true } } } },
      { multas_asamblea: { none: { ano, estado: 'pagada' } } },
      // Si también faltó el año anterior, lo que corresponde es el retiro
      ...(ultimaAnterior
        ? [
            {
              OR: [
                { fecha_inscripcion: { gt: ultimaAnterior } },
                { asistencias_asamblea: { some: { asistio: true, asamblea: { ano: ano - 1, estado: true } } } },
              ],
            },
          ]
        : []),
    ],
  };

  return db.socio.findMany({
    where,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      codigo_socio: true,
      cedula: true,
      nombre: true,
      apellido: true,
      telefono: true,
      estado: true,
      ubicacion: { select: { codigo: true, nombre: true, direccion: true } },
    },
  });
};

/**
 * Cobra la multa de un año, entera. Con `forma_pago: 'ahorro'` se descuenta de
 * una cuenta del socio, en la moneda de esa cuenta, igual que un retiro.
 * Va dentro de la transacción del llamador, con el socio bloqueado.
 */
export const cobrarMulta = async (
  tx: Prisma.TransactionClient,
  datos: {
    socioId: number;
    ano: number;
    formaPago: FormaPagoMulta;
    referencia?: string | null;
    cuentaAhorroId?: number | null;
    usuarioId: number;
    observacion?: string | null;
  }
) => {
  await bloquearSocio(tx, datos.socioId);

  const adeudados = await anosAdeudados(tx, datos.socioId);
  if (!adeudados.includes(datos.ano)) {
    throw new BadRequestError(`El socio no debe la multa de ${datos.ano}`);
  }

  const montoUsd = await montoMultaVigente();
  if (montoUsd <= 0) {
    throw new BadRequestError('El monto de la multa no está configurado. Cárguelo en Multas → Parámetros.');
  }
  const { tasa } = await resolverTasa();
  const montoBs = redondear(montoUsd * tasa);

  let cuentaAhorroId: number | null = null;
  let movimientoAhorroId: number | null = null;

  if (datos.formaPago === 'ahorro') {
    if (!datos.cuentaAhorroId) throw new BadRequestError('Indique de qué cuenta de ahorro se descuenta');
    const cuenta = await tx.cuentaAhorro.findUnique({
      where: { id: datos.cuentaAhorroId },
      include: { tipo_cuenta: { select: { moneda: true } } },
    });
    if (!cuenta || cuenta.socio_id !== datos.socioId || !cuenta.estado) {
      throw new BadRequestError('Esa cuenta de ahorro no es del socio o no está activa');
    }

    // Igual que un retiro: se mueve en la moneda de la cuenta y la otra acompaña
    const enBolivares = cuenta.tipo_cuenta.moneda === 'bs';
    const monto = enBolivares ? montoBs : montoUsd;
    const disponible = enBolivares
      ? Number(cuenta.saldo_bs) - Number(cuenta.monto_bloqueado_bs)
      : Number(cuenta.saldo_usd) - Number(cuenta.monto_bloqueado_usd);
    if (monto > disponible) {
      throw new BadRequestError(
        `La cuenta ${cuenta.numero_cuenta} no alcanza: tiene ${enBolivares ? 'Bs ' : '$'}${disponible.toFixed(2)} disponible`
      );
    }

    const saldoNuevoUsd = redondear(Number(cuenta.saldo_usd) - montoUsd);
    const saldoNuevoBs = redondear(Number(cuenta.saldo_bs) - montoBs);
    const movimiento = await tx.movimientoAhorro.create({
      data: {
        cuenta_id: cuenta.id,
        tipo_movimiento: 'retiro',
        monto_usd: montoUsd,
        monto_bs: montoBs,
        tasa_cambio: tasa,
        saldo_anterior_usd: Number(cuenta.saldo_usd),
        saldo_nuevo_usd: saldoNuevoUsd,
        saldo_nuevo_bs: saldoNuevoBs,
        concepto: `Multa por inasistencia a asamblea ${datos.ano}`,
        referencia: `MULTA-${datos.ano}`,
      },
    });
    await tx.cuentaAhorro.update({
      where: { id: cuenta.id },
      data: { saldo_usd: saldoNuevoUsd, saldo_bs: saldoNuevoBs },
    });
    cuentaAhorroId = cuenta.id;
    movimientoAhorroId = movimiento.id;
  }

  return tx.multaAsamblea.create({
    data: {
      socio_id: datos.socioId,
      ano: datos.ano,
      monto_usd: montoUsd,
      monto_bs: montoBs,
      tasa_cambio: tasa,
      forma_pago: datos.formaPago,
      referencia: datos.referencia?.trim() || null,
      cuenta_ahorro_id: cuentaAhorroId,
      movimiento_ahorro_id: movimientoAhorroId,
      usuario_id: datos.usuarioId,
      observacion: datos.observacion?.trim() || null,
    },
    include: { socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } } },
  });
};

/**
 * Deshace el cobro de una multa. Si se había descontado del ahorro, el dinero
 * vuelve a la cuenta con un depósito que lo explica.
 */
export const reversarMulta = async (
  tx: Prisma.TransactionClient,
  multaId: number,
  motivo: string,
  usuarioId: number
) => {
  const multa = await tx.multaAsamblea.findUnique({ where: { id: multaId } });
  if (!multa) throw new NotFoundError('Multa no encontrada');
  await bloquearSocio(tx, multa.socio_id);
  const vigente = await tx.multaAsamblea.findUniqueOrThrow({ where: { id: multaId } });
  if (vigente.estado !== 'pagada') throw new BadRequestError('Esa multa ya fue reversada');

  if (vigente.forma_pago === 'ahorro' && vigente.cuenta_ahorro_id) {
    const cuenta = await tx.cuentaAhorro.findUniqueOrThrow({ where: { id: vigente.cuenta_ahorro_id } });
    const saldoNuevoUsd = redondear(Number(cuenta.saldo_usd) + Number(vigente.monto_usd));
    const saldoNuevoBs = redondear(Number(cuenta.saldo_bs) + Number(vigente.monto_bs));
    await tx.movimientoAhorro.create({
      data: {
        cuenta_id: cuenta.id,
        tipo_movimiento: 'deposito',
        monto_usd: vigente.monto_usd,
        monto_bs: vigente.monto_bs,
        tasa_cambio: vigente.tasa_cambio,
        saldo_anterior_usd: Number(cuenta.saldo_usd),
        saldo_nuevo_usd: saldoNuevoUsd,
        saldo_nuevo_bs: saldoNuevoBs,
        concepto: `Reverso de multa ${vigente.ano}: ${motivo}`,
        referencia: `REV-MULTA-${vigente.id}`,
      },
    });
    await tx.cuentaAhorro.update({
      where: { id: cuenta.id },
      data: { saldo_usd: saldoNuevoUsd, saldo_bs: saldoNuevoBs },
    });
  }

  return tx.multaAsamblea.update({
    where: { id: multaId },
    data: { estado: 'reversada', fecha_reverso: new Date(), motivo_reverso: motivo, reversada_por: usuarioId },
  });
};
