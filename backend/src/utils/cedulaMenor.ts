// ============================================
// COOPERATIVA EL TRIUNFO - REGLA
// Beneficiarios menores sin cédula
// ============================================
//
// Para un menor sin cédula propia el operador escribe solo "MENOR" (en Salud
// o en Funeraria). La cédula del beneficiario es única, así que guardar
// "MENOR" tal cual solo serviría para el primer niño, y Salud, que busca a la
// persona por cédula, terminaría enlazando al menor de otra familia. Por eso
// "MENOR" se convierte en una identificación correlativa: MENOR-1, MENOR-2...
// (confirmado por la cooperativa el 30/10).

import { Prisma } from '@prisma/client';

export const PALABRA_MENOR = 'MENOR';

/** Si el operador pidió una identificación de menor ("MENOR" sin número) */
export const esPedidoDeMenor = (cedula: string | undefined | null): boolean =>
  (cedula ?? '').trim().toUpperCase() === PALABRA_MENOR;

/**
 * Cédula a guardar: la que se escribió, o la siguiente MENOR-N si se escribió
 * "MENOR". Se calcula dentro de la transacción del alta; si dos altas
 * simultáneas tomaran el mismo número, el índice único de la cédula rechaza
 * la segunda en lugar de duplicarla.
 */
export async function cedulaParaGuardar(
  tx: Prisma.TransactionClient,
  cedula: string
): Promise<string> {
  if (!esPedidoDeMenor(cedula)) return cedula;

  const [fila] = await tx.$queryRaw<Array<{ ultimo: number | null }>>`
    SELECT MAX(CAST(substring(cedula FROM '^MENOR-([0-9]+)$') AS INTEGER)) AS ultimo
    FROM beneficiarios
    WHERE cedula ~ '^MENOR-[0-9]+$'
  `;
  return `${PALABRA_MENOR}-${(fila?.ultimo ?? 0) + 1}`;
}
