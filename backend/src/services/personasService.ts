// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Personas: la identidad que comparten los expedientes
// ============================================
//
// Mientras `socios` conserve sus columnas de datos personales, la persona y sus
// expedientes ahorristas tienen que decir lo mismo. La regla:
//
//   - Crear o corregir la cédula de un socio lo vincula a la persona de esa
//     cédula (la crea si no existe). Si la persona existente tiene OTRO nombre
//     no se vincula: se avisa y queda para revisión. Nunca se pisa una persona.
//   - Editar los datos personales de un lado los copia al otro y a los demás
//     expedientes ahorristas de la misma persona.

import type { Persona, Prisma, Sexo, TipoIdentificacion } from '@prisma/client';
import { BadRequestError } from '../middleware/errorHandler';
import { validarCedula } from '../utils/cedula';
import { pareceLaMismaPersona } from '../utils/personas';

type Tx = Prisma.TransactionClient;

/** Cédula (V/E) en dígitos validados; RIF y pasaporte en mayúsculas sin separadores */
export const normalizarIdentificacion = (tipo: TipoIdentificacion, numero: string): string => {
  if (tipo === 'V' || tipo === 'E') {
    const resultado = validarCedula(numero);
    if (!resultado.valida) throw new BadRequestError(resultado.error ?? 'Cédula inválida');
    return resultado.cedula;
  }
  const limpio = String(numero ?? '').toUpperCase().replace(/[\s.-]/g, '');
  if (!/^[A-Z0-9]{5,20}$/.test(limpio)) {
    throw new BadRequestError('El RIF o pasaporte debe tener entre 5 y 20 letras o números');
  }
  return limpio;
};

interface DatosPersonalesSocio {
  id: number;
  cedula: string;
  persona_id: number | null;
  nombre: string;
  apellido: string;
  sexo: Sexo | null;
  fecha_nacimiento: Date | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}

const desdeSocio = (s: DatosPersonalesSocio) => ({
  nombres: s.nombre,
  apellidos: s.apellido,
  sexo: s.sexo,
  fecha_nacimiento: s.fecha_nacimiento,
  telefono: s.telefono,
  email: s.email,
  direccion: s.direccion,
});

const haciaSocio = (p: Persona) => ({
  nombre: p.nombres,
  apellido: p.apellidos,
  sexo: p.sexo,
  fecha_nacimiento: p.fecha_nacimiento,
  telefono: p.telefono,
  email: p.email,
  direccion: p.direccion,
});

export interface VinculoPersona {
  persona_id: number | null;
  /** Por qué no se vinculó, para mostrárselo al usuario */
  conflicto: string | null;
}

/**
 * Vincula el socio con la persona de su cédula, creándola si no existe.
 * Cédulas inválidas del sistema viejo no generan persona: se corrigen primero.
 */
export const vincularPersonaDeSocio = async (
  tx: Tx,
  socio: DatosPersonalesSocio,
  usuarioId?: number | null
): Promise<VinculoPersona> => {
  const desvincular = async () => {
    if (socio.persona_id !== null) {
      await tx.socio.update({ where: { id: socio.id }, data: { persona_id: null } });
    }
  };

  if (!validarCedula(socio.cedula).valida) {
    await desvincular();
    return { persona_id: null, conflicto: null };
  }

  const existente = await tx.persona.findUnique({ where: { numero_identificacion: socio.cedula } });

  if (existente && !pareceLaMismaPersona(
    { nombre: existente.nombres, apellido: existente.apellidos },
    { nombre: socio.nombre, apellido: socio.apellido }
  )) {
    await desvincular();
    return {
      persona_id: null,
      conflicto:
        `La cédula ${socio.cedula} ya está registrada a nombre de ${existente.nombres} ${existente.apellidos}. ` +
        'El expediente se guardó sin vincular a esa persona: revise cuál de los dos nombres es el correcto.',
    };
  }

  const persona =
    existente ??
    (await tx.persona.create({
      data: { numero_identificacion: socio.cedula, ...desdeSocio(socio), created_by: usuarioId ?? null },
    }));

  if (socio.persona_id !== persona.id) {
    await tx.socio.update({ where: { id: socio.id }, data: { persona_id: persona.id } });
  }
  return { persona_id: persona.id, conflicto: null };
};

/** Tras editar una persona: sus datos pasan a todos sus expedientes ahorristas */
export const propagarPersonaASocios = async (tx: Tx, personaId: number): Promise<void> => {
  const persona = await tx.persona.findUniqueOrThrow({ where: { id: personaId } });
  await tx.socio.updateMany({ where: { persona_id: personaId }, data: haciaSocio(persona) });
};

/** Tras editar un socio vinculado: sus datos pasan a la persona y a los otros expedientes */
export const propagarSocioAPersona = async (tx: Tx, socio: DatosPersonalesSocio): Promise<void> => {
  if (socio.persona_id === null) return;
  const persona = await tx.persona.update({ where: { id: socio.persona_id }, data: desdeSocio(socio) });
  await tx.socio.updateMany({
    where: { persona_id: socio.persona_id, id: { not: socio.id } },
    data: haciaSocio(persona),
  });
};
