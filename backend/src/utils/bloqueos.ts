// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Bloqueos de fila para operaciones financieras
// ============================================
//
// Las operaciones que leen un saldo, una cobertura o una deuda y después la
// escriben corrían en READ COMMITTED sin bloquear nada. `$transaction` sola no
// lo evita: dos cajeros cobrando al mismo socio a la vez leían la misma
// cobertura y los dos cubrían "la próxima semana", que era la misma semana; o
// leían el mismo saldo y uno de los dos depósitos se perdía.
//
// El candado se toma sobre la fila del SOCIO y no sobre cada cuenta o acuerdo:
// una colecta toca varios servicios del mismo socio, y tomar siempre una sola
// fila, siempre la misma, no puede cruzarse en un deadlock con otra operación
// sobre ese socio.
//
// La regla para que sirva: toda operación que modifique saldo, cobertura o
// deuda de un socio lo bloquea PRIMERO y relee DESPUÉS, dentro de la misma
// transacción. Una lectura hecha antes del bloqueo puede estar vieja.

import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../middleware/errorHandler';

export const bloquearSocio = async (tx: Prisma.TransactionClient, socioId: number): Promise<void> => {
  const filas = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM socios WHERE id = ${socioId} FOR UPDATE
  `;
  if (filas.length === 0) throw new NotFoundError('Socio no encontrado');
};

/**
 * Varios socios a la vez (deudor y fiadores, integrantes de un grupo). Siempre
 * en orden de id: si dos transacciones bloquean el mismo par en distinto
 * orden, cada una espera a la otra para siempre.
 */
export const bloquearSocios = async (tx: Prisma.TransactionClient, socioIds: number[]): Promise<void> => {
  const unicos = [...new Set(socioIds)].sort((a, b) => a - b);
  for (const id of unicos) {
    await bloquearSocio(tx, id);
  }
};
