// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Fondo de los trabajadores de El Triunfo
// ============================================
//
// Reglas confirmadas por la cooperativa el 24/10:
//
//   - Es un fondo COMÚN de todos los trabajadores: cualquiera puede pedir.
//   - Entra lo que se consigue (ventas de pollo, queso, chucherías...). No hay
//     cuota fija ni saldo de arranque.
//   - Sale como AYUDA, que no se devuelve. El fondo cubre el porcentaje del
//     concepto (p. ej. lentes 70 %) y el resto lo pone el trabajador.
//   - Sin topes. Lo autoriza el cajero que atiende; queda el registro de quién
//     se lo llevó, el motivo y el monto.
//   - En bolívares; el dólar va al lado sólo como referencia.
//   - Familiares: padres, cónyuge e hijos, sin límite de edad, y uno puede
//     estar en el fondo de dos trabajadores.
//
// Saldo = ingresos − egresos (sin los reversados). Un egreso nunca deja el
// fondo en negativo: se valida con el fondo bloqueado.

import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { redondear } from './cobroSemanalService';
import { resolverTasa } from './tasaCambioService';

type Tx = Prisma.TransactionClient;

/** Sectores de los trabajadores de El Triunfo. Falta confirmar el "código diferente" */
export const CLAVE_SECTORES_TRABAJADORES = 'FONDO_SECTORES_TRABAJADORES';
const SECTORES_TRABAJADORES_POR_DEFECTO = '01-06';

export const sectoresTrabajadores = async (): Promise<string[]> => {
  const p = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_SECTORES_TRABAJADORES } });
  return (p?.valor ?? SECTORES_TRABAJADORES_POR_DEFECTO)
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
};

/** Deja creado el parámetro, para que se vea y se edite en Parámetros */
export const sembrarParametroFondo = async (): Promise<void> => {
  await prisma.parametroSistema.upsert({
    where: { clave: CLAVE_SECTORES_TRABAJADORES },
    update: {},
    create: {
      clave: CLAVE_SECTORES_TRABAJADORES,
      valor: SECTORES_TRABAJADORES_POR_DEFECTO,
      descripcion:
        'Códigos de sector, separados por coma, de los trabajadores de El Triunfo. El Fondo avisa si el socio no está en uno de ellos.',
      tipo_dato: 'string',
    },
  });
};

/** Dos egresos a la vez no pueden leer el mismo saldo y dejarlo en negativo */
const bloquearFondo = (tx: Tx) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fondo_trabajadores'))`;

export const saldoDelFondo = async (db: Tx | typeof prisma = prisma) => {
  const grupos = await db.fondoMovimiento.groupBy({
    by: ['tipo'],
    where: { reversado: false },
    _sum: { monto_bs: true, monto_usd: true },
  });
  const suma = (tipo: 'ingreso' | 'egreso', campo: 'monto_bs' | 'monto_usd') =>
    Number(grupos.find((g) => g.tipo === tipo)?._sum[campo] ?? 0);
  return {
    ingresos_bs: redondear(suma('ingreso', 'monto_bs')),
    egresos_bs: redondear(suma('egreso', 'monto_bs')),
    saldo_bs: redondear(suma('ingreso', 'monto_bs') - suma('egreso', 'monto_bs')),
  };
};

export const registrarIngreso = async (
  tx: Tx,
  datos: {
    conceptoId: number;
    montoBs: number;
    descripcion?: string | null;
    entregadoPor?: string | null;
    referencia?: string | null;
    usuarioId: number;
  }
) => {
  const concepto = await tx.fondoConcepto.findUnique({ where: { id: datos.conceptoId } });
  if (!concepto || concepto.tipo !== 'ingreso' || !concepto.activo) {
    throw new BadRequestError('Elija un concepto de ingreso activo');
  }
  if (!(datos.montoBs > 0)) throw new BadRequestError('Indique el monto en bolívares');
  const { tasa } = await resolverTasa();
  await bloquearFondo(tx);
  return tx.fondoMovimiento.create({
    data: {
      tipo: 'ingreso',
      concepto_id: concepto.id,
      descripcion: datos.descripcion?.trim() || null,
      monto_bs: redondear(datos.montoBs),
      monto_usd: redondear(datos.montoBs / tasa),
      tasa_cambio: tasa,
      entregado_por: datos.entregadoPor?.trim() || null,
      referencia: datos.referencia?.trim() || null,
      usuario_id: datos.usuarioId,
    },
    include: { concepto: true },
  });
};

/**
 * Una ayuda del fondo. Con el gasto total y el porcentaje del concepto se
 * calcula lo que pone el fondo y lo que pone el trabajador. El porcentaje se
 * puede ajustar en el momento (el cajero decide si aplica).
 */
export const registrarEgreso = async (
  tx: Tx,
  datos: {
    conceptoId: number;
    socioId: number;
    beneficiarioId?: number | null;
    gastoTotalBs: number;
    porcentaje?: number | null;
    descripcion: string;
    usuarioId: number;
  }
) => {
  const concepto = await tx.fondoConcepto.findUnique({ where: { id: datos.conceptoId } });
  if (!concepto || concepto.tipo !== 'egreso' || !concepto.activo) {
    throw new BadRequestError('Elija un concepto de gasto activo');
  }
  const socio = await tx.socio.findUnique({ where: { id: datos.socioId }, select: { id: true, estado: true, codigo_socio: true } });
  if (!socio) throw new NotFoundError('Socio no encontrado');
  if (socio.estado === 'retirado') throw new BadRequestError(`El socio ${socio.codigo_socio} está retirado`);

  if (datos.beneficiarioId) {
    const b = await tx.fondoBeneficiario.findUnique({ where: { id: datos.beneficiarioId } });
    if (!b || b.socio_id !== socio.id || !b.activo) {
      throw new BadRequestError('Ese familiar no está registrado en el fondo de este trabajador');
    }
  }
  if (!(datos.gastoTotalBs > 0)) throw new BadRequestError('Indique el monto total del gasto en bolívares');
  if (!datos.descripcion?.trim()) throw new BadRequestError('Escriba el motivo de la ayuda');

  const porcentaje = datos.porcentaje ?? (concepto.porcentaje !== null ? Number(concepto.porcentaje) : 100);
  if (porcentaje <= 0 || porcentaje > 100) throw new BadRequestError('El porcentaje debe estar entre 1 y 100');

  const montoFondo = redondear((datos.gastoTotalBs * porcentaje) / 100);
  const { tasa } = await resolverTasa();

  await bloquearFondo(tx);
  const { saldo_bs } = await saldoDelFondo(tx);
  if (montoFondo > saldo_bs) {
    throw new BadRequestError(
      `El fondo no alcanza: tiene Bs ${saldo_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} y la ayuda es de Bs ${montoFondo.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    );
  }

  return tx.fondoMovimiento.create({
    data: {
      tipo: 'egreso',
      concepto_id: concepto.id,
      descripcion: datos.descripcion.trim(),
      monto_bs: montoFondo,
      monto_usd: redondear(montoFondo / tasa),
      tasa_cambio: tasa,
      socio_id: socio.id,
      beneficiario_id: datos.beneficiarioId ?? null,
      gasto_total_bs: redondear(datos.gastoTotalBs),
      porcentaje,
      a_cargo_socio_bs: redondear(datos.gastoTotalBs - montoFondo),
      usuario_id: datos.usuarioId,
    },
    include: {
      concepto: true,
      socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } },
      beneficiario: true,
    },
  });
};

/**
 * Deshace un movimiento. Un ingreso no se reversa si con eso el fondo queda en
 * negativo: ya se gastó.
 */
export const reversarMovimiento = async (tx: Tx, id: number, motivo: string, usuarioId: number) => {
  await bloquearFondo(tx);
  const m = await tx.fondoMovimiento.findUnique({ where: { id } });
  if (!m) throw new NotFoundError('Movimiento no encontrado');
  if (m.reversado) throw new BadRequestError('Ese movimiento ya fue reversado');
  if (m.tipo === 'ingreso') {
    const { saldo_bs } = await saldoDelFondo(tx);
    if (Number(m.monto_bs) > saldo_bs) {
      throw new BadRequestError('No se puede reversar ese ingreso: el fondo quedaría en negativo porque ya se usó');
    }
  }
  return tx.fondoMovimiento.update({
    where: { id },
    data: { reversado: true, fecha_reverso: new Date(), motivo_reverso: motivo, reversado_por: usuarioId },
  });
};
