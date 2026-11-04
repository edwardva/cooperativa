// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Sector y feria de una cédula
// ============================================
//
// Confirmado por la cooperativa el 2026-09-30:
//
//   - El socio particular se inscribe en un SECTOR y tiene derecho a ahorro.
//     Los trabajadores de El Triunfo también se inscriben en un sector.
//   - El que viene de una FERIA sólo tiene derecho a salud.
//   - Una misma cédula puede tener varios expedientes, pero como mucho uno en
//     un sector y uno en una feria. Nunca dos sectores ni dos ferias.
//
// "Estar en una feria" es tener un expediente de socio vigente en una feria o
// un expediente de trabajador sin retirar: los dos cuentan, porque el sistema
// anterior registraba al de feria como socio y la fase 2 como trabajador.

import type { Prisma, TipoUbicacion } from '@prisma/client';
import { ConflictError } from '../middleware/errorHandler';
import { etiquetaFeria } from './trabajadoresService';

type Db = Prisma.TransactionClient;

/** El suspendido sigue ocupando su sector o feria; el retirado ya no */
const ESTADOS_VIGENTES = ['activo', 'suspendido'] as const;

/** Un expediente sin ubicación se trata como particular: es lo que era en el sistema anterior */
export const tipoEfectivo = (ubicacion: { tipo: TipoUbicacion } | null | undefined): TipoUbicacion =>
  ubicacion?.tipo ?? 'sector';

const nombreTipo = (tipo: TipoUbicacion) => (tipo === 'feria' ? 'la feria' : 'el sector');

/**
 * Comprueba que la cédula pueda quedar en una ubicación del tipo indicado.
 * Lanza ConflictError con el expediente que lo impide.
 *
 * `personaId` sirve para encontrar al trabajador cuando la persona se vinculó
 * con otra cédula normalizada; si no se tiene, se busca por la cédula.
 */
export const verificarCupoPorCedula = async (
  db: Db,
  opciones: {
    cedula: string;
    tipo: TipoUbicacion;
    personaId?: number | null;
    excluirSocioId?: number;
    excluirTrabajadorId?: number;
  }
): Promise<void> => {
  const { cedula, tipo, excluirSocioId, excluirTrabajadorId } = opciones;

  // Dos altas a la vez con la misma cédula esperan su turno hasta el fin de la
  // transacción: si no, las dos verían el cupo libre y quedarían en dos sectores
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cedula:${cedula}`}))`;

  const socios = await db.socio.findMany({
    where: {
      estado: { in: [...ESTADOS_VIGENTES] },
      ...(excluirSocioId ? { id: { not: excluirSocioId } } : {}),
      OR: [{ cedula }, ...(opciones.personaId ? [{ persona_id: opciones.personaId }] : [])],
    },
    select: { codigo_socio: true, ubicacion: { select: { codigo: true, nombre: true, direccion: true, tipo: true } } },
  });

  const mismoTipo = socios.find((s) => tipoEfectivo(s.ubicacion) === tipo);
  if (mismoTipo) {
    const donde = mismoTipo.ubicacion ? ` ${etiquetaFeria(mismoTipo.ubicacion)}` : '';
    throw new ConflictError(
      `La cédula ${cedula} ya está en ${nombreTipo(tipo)}${donde} con el expediente ${mismoTipo.codigo_socio}. ` +
        `Una cédula puede estar en un solo sector y en una sola feria.`,
      { codigo_socio: mismoTipo.codigo_socio }
    );
  }

  if (tipo !== 'feria') return;

  const personaId =
    opciones.personaId ??
    (await db.persona.findUnique({ where: { numero_identificacion: cedula }, select: { id: true } }))?.id;
  if (!personaId) return;

  const trabajador = await db.socioTrabajador.findFirst({
    where: {
      persona_id: personaId,
      estado: { not: 'retirado' },
      ...(excluirTrabajadorId ? { id: { not: excluirTrabajadorId } } : {}),
    },
    select: {
      codigo_trabajador: true,
      ferias: { where: { fecha_fin: null }, select: { feria: { select: { codigo: true, nombre: true, direccion: true } } } },
    },
  });
  if (trabajador) {
    const feria = trabajador.ferias[0]?.feria;
    throw new ConflictError(
      `La cédula ${cedula} ya trabaja en la feria${feria ? ` ${etiquetaFeria(feria)}` : ''} ` +
        `(trabajador ${trabajador.codigo_trabajador}). Una cédula puede estar en una sola feria.`,
      { codigo_trabajador: trabajador.codigo_trabajador }
    );
  }
};
