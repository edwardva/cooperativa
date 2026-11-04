// ============================================
// COOPERATIVA EL TRIUNFO - REGLA
// Traspaso de un acuerdo (Funeraria o Salud) a otro socio
// ============================================
//
// Cuando el titular deja de estar (fallecimiento, migración, etc.) su acuerdo
// pasa a OTRO socio ya registrado, sin perder lo ganado: misma fecha de inicio,
// misma cobertura pagada, mismo historial de pagos. Reglas confirmadas por la
// cooperativa (02/11):
//
//   - El nuevo titular solo tiene que estar habilitado (en Salud, además, con
//     una cuenta de ahorro activa). No se aplica la edad máxima de Funeraria
//     ni período de espera: el acuerdo ya existía.
//   - El titular anterior sale del acuerdo; queda en la auditoría y en las
//     notas de los dos expedientes.
//   - Los beneficiarios pasan al expediente del nuevo titular. Si la persona
//     ya estaba registrada allí se usa esa ficha (no se duplica). La ficha del
//     expediente anterior no se borra: queda como historial.
//   - Los parentescos se revisan antes de confirmar, porque ahora son con el
//     nuevo titular.
//   - Si el nuevo titular ya tiene acuerdos de ese módulo, el traspasado queda
//     con el número original + "-T" (si ya existe, -T2, -T3...). Si no tiene
//     ninguno, conserva su número.
//   - Todo o nada: si algo falla no queda nada a medias.

import { z } from 'zod';
import type { Prisma, Beneficiario, Socio } from '@prisma/client';
import { bloquearSocios } from './bloqueos';

type Cliente = Prisma.TransactionClient;

export const MOTIVOS_TRASPASO = ['Fallecimiento', 'Migración', 'Otro'] as const;

// Lista unida de Salud y Funeraria (sociosController.PARENTESCOS_BENEFICIARIO)
export const PARENTESCOS_TRASPASO = [
  'No tiene', 'Esposo', 'Esposa', 'Hijo', 'Hija', 'Padre', 'Madre', 'Abuelo', 'Abuela',
  'Hermano', 'Hermana', 'Nieto', 'Nieta', 'Bisnieto', 'Cuñado', 'Cuñada', 'Suegro', 'Suegra',
  'Sobrino', 'Tio', 'Tia', 'Primo', 'Prima', 'Yerno', 'Yerna', 'Ahijado', 'Otro',
  'Hijo de crianza', 'Hija de crianza', 'Padrastro', 'Madrastra', 'Sobrina',
] as const;

/** Parentesco que se le pone en Salud a la fila del titular anterior, que queda retirada */
export const PARENTESCO_TITULAR_ANTERIOR = 'Titular anterior';

export const vistaPreviaTraspasoSchema = z.object({
  expediente: z.string().trim().toUpperCase().min(1, 'Escribe el expediente del nuevo titular').max(20),
});

export const confirmarTraspasoSchema = vistaPreviaTraspasoSchema
  .extend({
    motivo: z.enum(MOTIVOS_TRASPASO, { errorMap: () => ({ message: 'Elige el motivo del traspaso' }) }),
    detalle: z.string().trim().max(300).optional().default(''),
    // Parentesco de cada persona con el NUEVO titular, por la clave que dio la vista previa
    parentescos: z
      .array(
        z.object({
          clave: z.number().int().positive(),
          parentesco: z.enum(PARENTESCOS_TRASPASO, { errorMap: () => ({ message: 'Hay un parentesco inválido' }) }),
        })
      )
      .default([]),
  })
  .refine((d) => d.motivo !== 'Otro' || d.detalle.length >= 3, {
    message: 'Describe el motivo del traspaso',
    path: ['detalle'],
  });

export type ConfirmarTraspaso = z.infer<typeof confirmarTraspasoSchema>;

/** Error de regla de negocio: el controlador lo responde con su código HTTP */
export class ErrorTraspaso extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Qué pasa con cada persona del acuerdo al traspasarlo (se muestra antes de confirmar) */
export type AccionPersona =
  | 'pasa' // se copia al expediente del nuevo titular
  | 'reutiliza' // ya estaba registrada en el expediente del nuevo titular
  | 'otro_expediente' // Salud: socio de otro expediente; se queda con su ficha
  | 'es_nuevo_titular' // es el propio socio que recibe el acuerdo
  | 'excluida'; // ya está en otro acuerdo vigente del nuevo titular

export interface PersonaTraspaso {
  /** Fila de origen: beneficiario (Funeraria) o fila del acuerdo (Salud) */
  clave: number;
  cedula: string;
  nombre: string;
  apellido: string;
  estado: string;
  parentesco_actual: string;
  accion: AccionPersona;
  nota: string | null;
  /** Si hay que elegir el parentesco con el nuevo titular */
  requiere_parentesco: boolean;
}

/** Busca al nuevo titular por expediente y verifica que pueda recibir el acuerdo */
export async function buscarNuevoTitular(cliente: Cliente, expediente: string, socioAnteriorId: number): Promise<Socio> {
  const socio = await cliente.socio.findUnique({ where: { codigo_socio: expediente } });
  if (!socio) {
    throw new ErrorTraspaso(
      404,
      'SOCIO_NOT_FOUND',
      `No hay ningún socio registrado con el expediente ${expediente}. El acuerdo solo se puede traspasar a un socio registrado; regístralo primero en el módulo de Socios.`
    );
  }
  if (socio.id === socioAnteriorId) {
    throw new ErrorTraspaso(400, 'MISMO_TITULAR', 'El expediente indicado es el del titular actual del acuerdo. Escribe el expediente de quien lo va a recibir.');
  }
  if (socio.estado !== 'activo') {
    throw new ErrorTraspaso(
      400,
      'SOCIO_NO_HABILITADO',
      `El socio ${socio.codigo_socio} está ${socio.estado} y no puede recibir el acuerdo. Debe estar activo.`
    );
  }
  return socio;
}

/**
 * Número que queda el acuerdo traspasado: el mismo si el nuevo titular no
 * tiene otros acuerdos del módulo, o el original + "-T" (-T2, -T3... si ya existe).
 */
export async function numeroTraspasado(
  base: string,
  tieneOtrosAcuerdos: boolean,
  numeroUsado: (numero: string) => Promise<boolean>
): Promise<string> {
  if (!tieneOtrosAcuerdos) return base;
  for (let n = 1; n < 100; n++) {
    const candidato = `${base}-T${n === 1 ? '' : n}`;
    if (candidato.length > 20) {
      throw new ErrorTraspaso(
        400,
        'NUMERO_MUY_LARGO',
        `El número ${candidato} supera los 20 caracteres permitidos. Acorta el número del acuerdo antes de traspasarlo.`
      );
    }
    if (!(await numeroUsado(candidato))) return candidato;
  }
  throw new ErrorTraspaso(409, 'NUMERO_ACUERDO_EN_USO', `No se encontró un número libre para ${base}-T.`);
}

/** Bloquea a los dos socios (siempre en el mismo orden) antes de releer y escribir */
export const bloquearSociosTraspaso = (tx: Cliente, socioAnteriorId: number, socioNuevoId: number) =>
  bloquearSocios(tx, [socioAnteriorId, socioNuevoId]);

/** Ficha de la persona en el expediente del nuevo titular, por cédula exacta */
export const fichaEnExpediente = (cliente: Cliente, socioId: number, cedula: string) =>
  cliente.beneficiario.findUnique({ where: { socio_id_cedula: { socio_id: socioId, cedula } } });

/** Copia los datos personales de una ficha a otro expediente (nunca la mueve) */
export const copiarFichaAExpediente = (
  tx: Cliente,
  origen: Beneficiario,
  socioId: number,
  parentesco: string,
  extra: Partial<Prisma.BeneficiarioUncheckedCreateInput> = {}
) =>
  tx.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: origen.cedula,
      nombre: origen.nombre,
      apellido: origen.apellido,
      fecha_nacimiento: origen.fecha_nacimiento,
      fecha_ingreso: origen.fecha_ingreso,
      telefono: origen.telefono,
      estado: origen.estado,
      fecha_fallecimiento: origen.fecha_fallecimiento,
      parentesco,
      ...extra,
    },
  });

/** El fallecimiento es un hecho de la persona: si la ficha de origen lo dice, la reutilizada también */
export const datosFallecimiento = (origen: Beneficiario, destino: Beneficiario) =>
  origen.estado === 'fallecido' && destino.estado !== 'fallecido'
    ? { estado: 'fallecido' as const, fecha_fallecimiento: origen.fecha_fallecimiento }
    : {};

export const textoMotivo = (datos: Pick<ConfirmarTraspaso, 'motivo' | 'detalle'>) =>
  datos.detalle ? `${datos.motivo}: ${datos.detalle}` : datos.motivo;

/** Deja constancia del traspaso en las notas de los dos expedientes */
export async function anotarTraspasoEnExpedientes(
  tx: Cliente,
  modulo: 'funeraria' | 'salud',
  numeroOriginal: string,
  numeroFinal: string,
  anterior: Socio,
  nuevo: Socio,
  motivo: string,
  usuarioId: number
): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const nombreModulo = modulo === 'funeraria' ? 'funeraria' : 'salud';
  const numeros = numeroOriginal === numeroFinal ? numeroOriginal : `${numeroOriginal} (ahora ${numeroFinal})`;
  const notas: Array<[Socio, string]> = [
    [
      anterior,
      `[TRASPASO ${fecha}] Acuerdo de ${nombreModulo} ${numeros} traspasado al expediente ${nuevo.codigo_socio} (${nuevo.nombre} ${nuevo.apellido}, C.I. ${nuevo.cedula}). Motivo: ${motivo}. Usuario: ${usuarioId}`,
    ],
    [
      nuevo,
      `[TRASPASO ${fecha}] Recibe el acuerdo de ${nombreModulo} ${numeros} del expediente ${anterior.codigo_socio} (${anterior.nombre} ${anterior.apellido}, C.I. ${anterior.cedula}). Motivo: ${motivo}. Usuario: ${usuarioId}`,
    ],
  ];
  for (const [socio, nota] of notas) {
    const actual = await tx.socio.findUnique({ where: { id: socio.id }, select: { notas: true } });
    await tx.socio.update({
      where: { id: socio.id },
      data: { notas: [actual?.notas?.trim(), nota].filter(Boolean).join('\n') },
    });
  }
}

/** Respuesta HTTP común para los errores del traspaso */
export function responderErrorTraspaso(
  res: { status: (n: number) => { json: (b: unknown) => void } },
  error: unknown,
  mensajeGeneral: string
): boolean {
  if (error instanceof ErrorTraspaso) {
    res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
    return true;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message || 'Datos inválidos', details: error.errors },
    });
    return true;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: mensajeGeneral } });
  return false;
}
