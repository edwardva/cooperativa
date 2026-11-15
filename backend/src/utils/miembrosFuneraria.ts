/**
 * Quién está en cada acuerdo de funeraria (tabla acuerdo_funeraria_beneficiarios).
 *
 * Reglas (10/11/2026):
 *  - Una persona puede estar en varios acuerdos de funeraria a la vez.
 *  - En un mismo acuerdo solo puede estar vigente una vez.
 *  - Retirarla pone fecha_retiro; volver a registrarla crea un renglón nuevo,
 *    así queda el historial de cuándo salió y cuándo volvió.
 *  - Tope de 8 beneficiarios activos y vigentes por acuerdo (9 con el titular).
 *    Quien falleció o fue retirado libera su cupo.
 *  - La ficha siempre es del expediente del titular del acuerdo (si la persona
 *    está en otro expediente, se copia; nunca se mueve).
 */
import type { Beneficiario, Prisma } from '@prisma/client';

type Cliente = Prisma.TransactionClient;

export const MAX_BENEFICIARIOS_FUNERARIA = 8;

export const esParentescoTitular = (parentesco: string | null | undefined) =>
  (parentesco ?? '').trim().toLowerCase() === 'titular';

/** Filtro de renglones vigentes que ocupan cupo en un acuerdo */
export const whereOcupaCupo = (acuerdoId: number): Prisma.AcuerdoFunerariaBeneficiarioWhereInput => ({
  acuerdo_id: acuerdoId,
  fecha_retiro: null,
  beneficiario: { estado: 'activo', NOT: { parentesco: { equals: 'titular', mode: 'insensitive' } } },
});

/** Beneficiarios que ocupan cupo en el acuerdo ahora mismo */
export const contarActivosEnAcuerdo = (cliente: Cliente, acuerdoId: number) =>
  cliente.acuerdoFunerariaBeneficiario.count({ where: whereOcupaCupo(acuerdoId) });

/** Renglón vigente de la persona en ese acuerdo (null si no está o ya salió) */
export const membresiaVigente = (cliente: Cliente, acuerdoId: number, beneficiarioId: number) =>
  cliente.acuerdoFunerariaBeneficiario.findFirst({
    where: { acuerdo_id: acuerdoId, beneficiario_id: beneficiarioId, fecha_retiro: null },
  });

/** Acuerdos (no retirados) en que la persona está vigente */
export const membresiasVigentesDe = (cliente: Cliente, beneficiarioId: number) =>
  cliente.acuerdoFunerariaBeneficiario.findMany({
    where: { beneficiario_id: beneficiarioId, fecha_retiro: null, acuerdo: { estado: { not: 'retirado' } } },
    include: { acuerdo: { select: { id: true, numero_acuerdo: true, estado: true } } },
  });

/**
 * Agrega a las personas al acuerdo. Quien ya está vigente en él se deja como
 * está (no se duplica). Devuelve los ids que se agregaron de verdad.
 * No valida el tope: quien llama decide cuántos caben.
 */
export async function agregarAlAcuerdo(
  tx: Cliente,
  acuerdoId: number,
  beneficiarioIds: number[],
  fechaIngreso: Date = new Date()
): Promise<number[]> {
  const agregados: number[] = [];
  for (const beneficiarioId of beneficiarioIds) {
    if (await membresiaVigente(tx, acuerdoId, beneficiarioId)) continue;
    await tx.acuerdoFunerariaBeneficiario.create({
      data: { acuerdo_id: acuerdoId, beneficiario_id: beneficiarioId, fecha_ingreso: fechaIngreso },
    });
    agregados.push(beneficiarioId);
  }
  return agregados;
}

/** Retira a la persona del acuerdo (el renglón queda como historial) */
export const retirarDelAcuerdo = (tx: Cliente, acuerdoId: number, beneficiarioId: number, fecha: Date = new Date()) =>
  tx.acuerdoFunerariaBeneficiario.updateMany({
    where: { acuerdo_id: acuerdoId, beneficiario_id: beneficiarioId, fecha_retiro: null },
    data: { fecha_retiro: fecha },
  });

/**
 * Ficha de la persona en el expediente del titular. Si ya la tiene, se usa
 * esa; si la persona solo existe en otro expediente (p. ej. es socio, o
 * beneficiario de otra familia), se copian sus datos aquí con el parentesco
 * que tiene con ESTE titular. La ficha original no se toca.
 */
export async function fichaParaFuneraria(
  tx: Cliente,
  socioId: number,
  persona: Beneficiario,
  parentesco: string
): Promise<Beneficiario> {
  if (persona.socio_id === socioId) return persona;
  const existente = await tx.beneficiario.findUnique({
    where: { socio_id_cedula: { socio_id: socioId, cedula: persona.cedula } },
  });
  if (existente) return existente;
  return tx.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: persona.cedula,
      nombre: persona.nombre,
      apellido: persona.apellido,
      fecha_nacimiento: persona.fecha_nacimiento,
      fecha_ingreso: persona.fecha_ingreso,
      telefono: persona.telefono,
      estado: persona.estado,
      fecha_fallecimiento: persona.fecha_fallecimiento,
      parentesco,
    },
  });
}
