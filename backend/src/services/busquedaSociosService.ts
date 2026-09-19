// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Búsqueda de socios por nombre, sin acentos
// ============================================
//
// `contains` de Prisma compara letra por letra: "maria" no encontraba a
// "MARÍA" ni "peña" a "PENA". Con los datos migrados no se notaba, porque
// vienen en mayúsculas y sin acentos, pero los socios que se cargan desde el
// sistema nuevo sí llevan tilde.
//
// Postgres resuelve esto con `unaccent`, que Prisma no sabe expresar en un
// `where`. Por eso la búsqueda por texto se hace en una consulta aparte que
// devuelve ids, y el resto de los filtros (estado, feria, paginación) sigue
// como estaba.

import { Prisma, type PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Más resultados que esto no se muestran igual: se pide afinar la búsqueda */
const TOPE = 5_000;

export interface OpcionesBusqueda {
  /** Campos donde buscar cada palabra. Por defecto, los cuatro del listado */
  campos?: ('codigo_socio' | 'cedula' | 'nombre' | 'apellido')[];
  limite?: number;
}

/**
 * Ids de los socios donde CADA palabra del texto aparece en alguno de los
 * campos, sin importar acentos, mayúsculas ni el orden de las palabras.
 */
export const idsSociosPorTexto = async (
  db: Db,
  texto: string,
  opciones: OpcionesBusqueda = {}
): Promise<number[]> => {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];

  const campos = opciones.campos ?? ['codigo_socio', 'cedula', 'nombre', 'apellido'];
  const limite = Math.min(opciones.limite ?? TOPE, TOPE);

  // Una columna con todo lo buscable, sin acentos y en minúsculas. El orden
  // importa: la base corre con LC_CTYPE=C, donde `lower` deja intactas las
  // letras acentuadas, así que primero se quitan los acentos.
  const columna = Prisma.sql`lower(unaccent(concat_ws(' ', ${Prisma.join(
    campos.map((c) => Prisma.raw(`"${c}"`)),
    ', '
  )})))`;

  const condiciones = palabras.map(
    (p) => Prisma.sql`${columna} LIKE lower(unaccent(${`%${p}%`}))`
  );

  const filas = await db.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM socios WHERE ${Prisma.join(condiciones, ' AND ')} LIMIT ${limite}`
  );
  return filas.map((f) => f.id);
};
