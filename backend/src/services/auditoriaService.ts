// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Auditoría
// ============================================
//
// Un solo punto de escritura para `audit_log`. Antes cada controlador armaba el
// registro a mano, 33 veces, y eso dejaba tres problemas:
//
//   - Datos distintos según quién lo escribiera: unos guardaban IP y user
//     agent, otros no; unos el objeto, otros una frase de texto.
//   - Registros de socio con la FOTO adentro: `datos_despues: socio` volcaba
//     el BLOB entero como un arreglo de números en la columna JSON.
//   - Nada que recordara pasar la transacción: la auditoría de una operación
//     financiera tiene que confirmarse o descartarse junto con la operación.
//
// Por eso recibe el cliente (`prisma` o `tx`) como primer argumento.

import type { Request } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';

type ClienteBD = PrismaClient | Prisma.TransactionClient;

export interface EventoAuditoria {
  /** Request de origen: aporta usuario, IP y user agent */
  req?: Request | null;
  /** Para procesos sin request (jobs, servicios): el usuario responsable */
  usuarioId?: number | null;
  accion: string;
  modulo: string;
  registro_id?: number | null;
  antes?: unknown;
  despues?: unknown;
}

/**
 * Convierte cualquier valor a algo que la columna JSON acepte.
 *
 * Decimal y Date ya se serializan solos (a texto). Lo binario se reemplaza por
 * una marca: la foto del socio no aporta nada a la auditoría y pesa cientos de KB.
 */
export const aJsonAuditable = (valor: unknown): Prisma.InputJsonValue | undefined => {
  if (valor === undefined || valor === null) return undefined;

  const texto = JSON.stringify(valor, (_clave, v: unknown) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Uint8Array) return '[binario omitido]';
    // Buffer pasa por su toJSON antes de llegar aquí: { type: 'Buffer', data: [...] }
    if (
      v !== null &&
      typeof v === 'object' &&
      (v as { type?: unknown }).type === 'Buffer' &&
      Array.isArray((v as { data?: unknown }).data)
    ) {
      return '[binario omitido]';
    }
    return v;
  });

  return texto === undefined ? undefined : (JSON.parse(texto) as Prisma.InputJsonValue);
};

export const registrarAuditoria = (db: ClienteBD, evento: EventoAuditoria) => {
  const { req } = evento;

  return db.auditLog.create({
    data: {
      usuario_id: evento.usuarioId ?? req?.user?.userId ?? null,
      accion: evento.accion,
      modulo: evento.modulo,
      registro_id: evento.registro_id ?? null,
      datos_antes: aJsonAuditable(evento.antes),
      datos_despues: aJsonAuditable(evento.despues),
      ip_address: req ? req.ip || 'unknown' : null,
      user_agent: req ? req.get('user-agent') || 'unknown' : null,
    },
  });
};
