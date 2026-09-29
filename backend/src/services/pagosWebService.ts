// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Pagos declarados desde el cajero digital
// ============================================
//
// Un pago web NO es un cobro: es un AVISO. El socio dice "transferi tanto, con
// esta referencia, para tantas semanas", y alguien de la cooperativa lo
// verifica contra el banco antes de convertirlo en un cobro real.
//
// Esa separacion es deliberada. El socio manda el dato desde su celular y nadie
// puede comprobarlo en ese momento; si tocara saldos al declararlo, bastaria
// con escribir una referencia inventada para figurar al dia. Mientras esta
// pendiente no mueve nada.
//
// Al conciliarlo NO se cobra solo: se deja listo para que la caja lo registre.
// Mover dinero a partir de lo que escribio alguien desde fuera, sin que una
// persona lo mire, no es algo que deba pasar sin que la cooperativa lo pida.

import type { Prisma, PrismaClient } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { leerParametroNumerico } from './tarifasService';

type Db = PrismaClient | Prisma.TransactionClient;

export interface DeclaracionDePago {
  destino: 'semanas' | 'prestamo' | 'ahorro';
  monto_bs: number;
  monto_usd: number;
  banco: string;
  referencia_bancaria: string;
  fecha_pago: Date;
  /** Solo cuando el destino son semanas */
  semanas?: number;
  /** Solo cuando abona a un prestamo */
  prestamo_id?: number;
}

/**
 * El socio declara lo que pago.
 *
 * La referencia bancaria es unica en la base: es lo unico que impide que el
 * mismo comprobante se declare dos veces y se termine cobrando dos veces.
 */
export const declararPago = async (
  db: Db,
  usuarioDigitalId: number,
  socioId: number,
  datos: DeclaracionDePago
) => {
  if (datos.monto_bs <= 0 && datos.monto_usd <= 0) {
    throw new BadRequestError('Indique el monto que pagó');
  }
  if (!datos.referencia_bancaria.trim()) {
    throw new BadRequestError('Indique la referencia de la transferencia');
  }

  // No se aceptan pagos con fecha futura: o ya se hizo, o no se puede declarar
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (datos.fecha_pago > hoy) {
    throw new BadRequestError('La fecha del pago no puede ser futura');
  }

  if (datos.destino === 'semanas') {
    const maximo = await leerParametroNumerico('MAX_SEMANAS_ADELANTO');
    if (!datos.semanas || datos.semanas < 1) {
      throw new BadRequestError('Indique cuántas semanas desea pagar');
    }
    // Confirmado por la cooperativa: "pago de semanas atrasadas mas maximo 10
    // semanas de adelanto". Las atrasadas no tienen tope; el adelanto si.
    const atrasadas = await semanasAtrasadas(db, socioId);
    if (datos.semanas > atrasadas + maximo) {
      throw new BadRequestError(
        `Puede pagar sus ${atrasadas} semana(s) atrasada(s) y adelantar hasta ${maximo} más`
      );
    }
  }

  if (datos.destino === 'prestamo') {
    if (!datos.prestamo_id) throw new BadRequestError('Indique a qué préstamo desea abonar');
    const prestamo = await db.prestamo.findFirst({
      where: { id: datos.prestamo_id, socio_id: socioId, estado: { in: ['activo', 'moroso'] } },
      select: { id: true },
    });
    // Se comprueba que el prestamo sea SUYO: si no, cualquiera podria abonar
    // al prestamo de otro, o averiguar que numeros de prestamo existen
    if (!prestamo) throw new BadRequestError('Ese préstamo no está a su nombre o no está vigente');
  }

  const repetida = await db.pagoWeb.findUnique({
    where: { referencia_bancaria: datos.referencia_bancaria.trim() },
    select: { id: true },
  });
  if (repetida) {
    throw new ConflictError('Esa referencia ya fue declarada');
  }

  return db.pagoWeb.create({
    data: {
      usuario_digital_id: usuarioDigitalId,
      destino: datos.destino,
      monto_bs: datos.monto_bs,
      monto_usd: datos.monto_usd,
      banco: datos.banco.trim(),
      referencia_bancaria: datos.referencia_bancaria.trim(),
      fecha_pago: datos.fecha_pago,
      semanas: datos.destino === 'semanas' ? (datos.semanas ?? 0) : 0,
      prestamo_id: datos.destino === 'prestamo' ? (datos.prestamo_id ?? null) : null,
    },
  });
};

/**
 * Semanas que el socio tiene sin pagar.
 *
 * Sale de la cobertura de sus acuerdos, que es la misma fuente que usa la
 * colecta: si aqui se contara de otra forma, el socio veria un numero en el
 * celular y otro distinto en la caja.
 */
const semanasAtrasadas = async (db: Db, socioId: number): Promise<number> => {
  const acuerdos = await db.acuerdoFuneraria.findMany({
    where: { estado: { in: ['activo', 'suspendido'] }, beneficiario: { socio_id: socioId } },
    select: { semanas_sin_pago: true },
  });
  const saludes = await db.acuerdoSalud.findMany({
    where: { estado: { in: ['activo', 'suspendido'] }, beneficiario: { socio_id: socioId } },
    select: { semanas_sin_pago: true },
  });
  const todas = [...acuerdos, ...saludes].map((a) => a.semanas_sin_pago ?? 0);
  return todas.length > 0 ? Math.max(...todas) : 0;
};

/** Marca el pago como conciliado o rechazado. No cobra: deja constancia. */
export const revisarPago = async (
  db: Db,
  pagoId: number,
  usuarioId: number,
  decision: { conciliar: boolean; motivo?: string; observaciones?: string }
) => {
  const pago = await db.pagoWeb.findUnique({
    where: { id: pagoId },
    select: { id: true, estado: true },
  });
  if (!pago) throw new NotFoundError('Pago no encontrado');
  if (pago.estado !== 'pendiente') {
    throw new ConflictError(`Ese pago ya fue ${pago.estado}`);
  }
  if (!decision.conciliar && !decision.motivo?.trim()) {
    // Un rechazo sin motivo no le sirve de nada al socio, que es quien tiene
    // que entender por que no se le tomo el pago
    throw new BadRequestError('Indique por qué se rechaza el pago');
  }

  return db.pagoWeb.update({
    where: { id: pagoId },
    data: {
      estado: decision.conciliar ? 'conciliado' : 'rechazado',
      fecha_conciliacion: new Date(),
      revisado_por: usuarioId,
      motivo_rechazo: decision.conciliar ? null : decision.motivo!.trim(),
      observaciones: decision.observaciones?.trim() || null,
    },
  });
};
