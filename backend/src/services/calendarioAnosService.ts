// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Cierre de año del calendario de colecta: 52 o 53 semanas
// ============================================
//
// Confirmado por la cooperativa el 10/11/2026: el año cierra en 52 o en 53
// según lo avise la FUNERARIA cada diciembre. Si no avisa, se cierra en 52 y
// la semana que cruza el año es la 1 del año nuevo (regla del 1 de enero).
//
// Lo que automatiza este servicio:
// - Sin hacer nada, el calendario sigue la regla.
// - Desde el 1 de diciembre, mientras el año no esté confirmado, la colecta
//   muestra un aviso para preguntarle a la funeraria.
// - Al confirmar 53 (o volver a 52), lo ya guardado con rótulos posteriores
//   (adelantos) se re-rotula conservando la fecha real que cubría: nadie gana
//   ni pierde semanas. Se bloquea cuando la semana en disputa ya empezó,
//   porque ya habría cobros hechos con ese número.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BadRequestError, ConflictError } from '../middleware/errorHandler';
import {
  fijarLargosDeAno,
  inicioDeAno,
  largosDeAnoVigentes,
  lunesDeSemana,
  periodoDeUtc,
  semanasEnAno,
  semanasEnAnoPorRegla,
  type LargosDeAno,
} from '../utils/calendarioSemanal';
import { registrarAuditoria } from './auditoriaService';
import { asegurarSemanas } from './semanasColectaService';
import type { Request } from 'express';
import { logger } from '../utils/logger';

const MS_DIA = 86_400_000;
const MS_SEMANA = 7 * MS_DIA;

type Tx = Prisma.TransactionClient;

/** Lee los años confirmados y los deja vigentes en el calendario */
export const cargarLargosDeAno = async (): Promise<void> => {
  const filas = await prisma.anoColecta.findMany({ select: { ano: true, semanas: true } });
  fijarLargosDeAno(new Map(filas.map((f) => [f.ano, f.semanas === 53 ? 53 : 52] as const)));
};

const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Medianoche UTC del día civil de hoy (el servidor corre en hora de Venezuela) */
const hoyUtc = (): number => {
  const h = new Date();
  return Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
};

export interface EstadoCierreAno {
  ano: number;
  /** Lo que se usa hoy: el confirmado o, si no hay, el de la regla */
  semanas: number;
  semanas_por_regla: number;
  confirmado: boolean;
  confirmado_por: string | null;
  fecha_confirmacion: string | null;
  /** Domingo en que cierra la última semana del año */
  cierra_el: string;
  /** Lunes en que arranca la semana 1 del año siguiente */
  siguiente_arranca_el: string;
  /** La semana que es la 53 o la 1 del año siguiente, según lo que se decida */
  semana_en_disputa: { inicio: string; fin: string };
  /** Se puede cambiar mientras la semana en disputa no haya empezado */
  puede_cambiar: boolean;
  /** Diciembre, año sin confirmar y la semana en disputa todavía no empezó */
  mostrar_aviso: boolean;
}

export const estadoCierreAno = async (ano: number): Promise<EstadoCierreAno> => {
  const fila = await prisma.anoColecta.findUnique({ where: { ano } });
  const usuario = fila?.confirmado_por
    ? await prisma.usuario.findUnique({ where: { id: fila.confirmado_por }, select: { nombre_completo: true, username: true } })
    : null;

  const inicio = inicioDeAno(ano);
  const disputa = inicio + 52 * MS_SEMANA;
  const semanas = semanasEnAno(ano);
  const hoy = hoyUtc();
  const puedeCambiar = hoy < disputa;

  return {
    ano,
    semanas,
    semanas_por_regla: semanasEnAnoPorRegla(ano),
    confirmado: Boolean(fila),
    confirmado_por: usuario ? usuario.nombre_completo || usuario.username : null,
    fecha_confirmacion: fila ? fila.updated_at.toISOString() : null,
    cierra_el: iso(inicio + semanas * MS_SEMANA - MS_DIA),
    siguiente_arranca_el: iso(inicio + semanas * MS_SEMANA),
    semana_en_disputa: { inicio: iso(disputa), fin: iso(disputa + 6 * MS_DIA) },
    puede_cambiar: puedeCambiar,
    mostrar_aviso: !fila && puedeCambiar && hoy >= Date.UTC(ano, 11, 1),
  };
};

// ============================================
// RE-ROTULAR LO GUARDADO
// ============================================

/** Tablas con un par (año, semana) guardado, sin fecha propia */
const PARES: { tabla: string; ano: string; semana: string }[] = [
  { tabla: 'acuerdos_funeraria', ano: 'ano_pagado_hasta', semana: 'semana_pagada_hasta' },
  { tabla: 'acuerdos_salud', ano: 'ano_pagado_hasta', semana: 'semana_pagada_hasta' },
  { tabla: 'movimientos_funeraria', ano: 'ano_cobertura', semana: 'semana_cobertura' },
  { tabla: 'movimientos_salud', ano: 'ano_cobertura', semana: 'semana_cobertura' },
  { tabla: 'colecta', ano: 'ano_cobro', semana: 'semana_cobro' },
  { tabla: 'detalle_colecta', ano: 'cobertura_ano_antes', semana: 'cobertura_semana_antes' },
  { tabla: 'detalle_colecta', ano: 'cobertura_ano_despues', semana: 'cobertura_semana_despues' },
];

/**
 * Cambia los rótulos desde la semana en disputa en adelante. Cada rótulo viejo
 * se lleva a su fecha con el calendario anterior y se vuelve a rotular con el
 * nuevo. Devuelve cuántas filas cambiaron.
 */
const rerotular = async (tx: Tx, ano: number, viejos: LargosDeAno, nuevos: LargosDeAno): Promise<number> => {
  let cambiadas = 0;
  const disputa = inicioDeAno(ano, viejos) + 52 * MS_SEMANA;
  const desde = periodoDeUtc(disputa, viejos);

  for (const { tabla, ano: colAno, semana: colSemana } of PARES) {
    const filas = await tx.$queryRaw<{ a: number; s: number }[]>(Prisma.sql`
      SELECT DISTINCT ${Prisma.raw(colAno)} AS a, ${Prisma.raw(colSemana)} AS s
      FROM ${Prisma.raw(tabla)}
      WHERE ${Prisma.raw(colSemana)} IS NOT NULL
        AND (${Prisma.raw(colAno)} > ${desde.ano}
          OR (${Prisma.raw(colAno)} = ${desde.ano} AND ${Prisma.raw(colSemana)} >= ${desde.semana}))
    `);

    const cambios = filas
      .map(({ a, s }) => {
        const nuevo = periodoDeUtc(lunesDeSemana(a, s, viejos).getTime(), nuevos);
        return { a, s, na: nuevo.ano, ns: nuevo.semana };
      })
      .filter((c) => c.a !== c.na || c.s !== c.ns);
    if (cambios.length === 0) continue;

    // Una sola sentencia con la tabla de equivalencias: cada fila cambia una
    // vez, sin que un rótulo recién puesto vuelva a cambiar
    const valores = Prisma.join(cambios.map((c) => Prisma.sql`(${c.a}::int, ${c.s}::int, ${c.na}::int, ${c.ns}::int)`));
    cambiadas += await tx.$executeRaw(Prisma.sql`
      UPDATE ${Prisma.raw(tabla)} t
      SET ${Prisma.raw(colAno)} = m.na, ${Prisma.raw(colSemana)} = m.ns
      FROM (VALUES ${valores}) AS m(a, s, na, ns)
      WHERE t.${Prisma.raw(colAno)} = m.a AND t.${Prisma.raw(colSemana)} = m.s
    `);
  }

  // Tablas con fechas: el rótulo sale de la fecha de inicio. En dos pasos para
  // no chocar con sus índices únicos a mitad de camino.
  const fechaDisputa = new Date(disputa);

  const semanas = await tx.semanaColecta.findMany({
    where: { fecha_inicio: { gte: fechaDisputa } },
    select: { id: true, fecha_inicio: true },
  });
  for (const fila of semanas) await tx.semanaColecta.update({ where: { id: fila.id }, data: { semana: -fila.id } });
  for (const fila of semanas) {
    const p = periodoDeUtc(fila.fecha_inicio.getTime(), nuevos);
    await tx.semanaColecta.update({ where: { id: fila.id }, data: { ano: p.ano, semana: p.semana } });
  }

  const periodos = await tx.periodoSalud.findMany({
    where: { tipo: 'semanal', fecha_inicio: { gte: fechaDisputa } },
    select: { id: true, fecha_inicio: true },
  });
  for (const fila of periodos) await tx.periodoSalud.update({ where: { id: fila.id }, data: { numero: -fila.id } });
  for (const fila of periodos) {
    const p = periodoDeUtc(fila.fecha_inicio.getTime(), nuevos);
    await tx.periodoSalud.update({ where: { id: fila.id }, data: { anio: p.ano, numero: p.semana } });
  }

  return cambiadas + semanas.length + periodos.length;
};

/**
 * Confirma con cuántas semanas cierra el año, según lo avisó la funeraria.
 * Confirmar el mismo largo que ya rige sólo deja constancia (y apaga el aviso).
 */
export const confirmarCierreAno = async (
  ano: number,
  semanas: number,
  observaciones: string | null,
  req: Request
): Promise<{ estado: EstadoCierreAno; filas_rerotuladas: number }> => {
  if (semanas !== 52 && semanas !== 53) throw new BadRequestError('El año cierra en 52 o en 53 semanas');

  const viejos = largosDeAnoVigentes();
  const nuevos = new Map(viejos);
  nuevos.set(ano, semanas as 52 | 53);
  const cambiaElLargo = semanasEnAno(ano, viejos) !== semanas;

  let filas = 0;
  await prisma.$transaction(
    async (tx) => {
      // Ningún cobro puede escribir rótulos mientras se re-rotula
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('calendario_colecta'))`;

      if (cambiaElLargo) {
        const disputa = inicioDeAno(ano, viejos) + 52 * MS_SEMANA;
        if (hoyUtc() >= disputa) {
          throw new ConflictError(
            `La semana del ${iso(disputa)} ya empezó y tiene cobros con su número. ` +
              'El cierre del año ya no se puede cambiar desde aquí.'
          );
        }
        filas = await rerotular(tx, ano, viejos, nuevos);
      }

      const antes = await tx.anoColecta.findUnique({ where: { ano } });
      const despues = await tx.anoColecta.upsert({
        where: { ano },
        create: { ano, semanas, observaciones, confirmado_por: req.user?.userId ?? null },
        update: { semanas, observaciones, confirmado_por: req.user?.userId ?? null },
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'CONFIRMAR_CIERRE_ANO',
        modulo: 'semanas_colecta',
        registro_id: ano,
        antes,
        despues: { ...despues, filas_rerotuladas: filas },
      });
    },
    { timeout: 60_000 }
  );

  // Recién con la transacción hecha el calendario en memoria pasa a ser el nuevo
  fijarLargosDeAno(nuevos);
  if (cambiaElLargo) {
    logger.info(`Calendario: ${ano} cierra en ${semanas} semanas (${filas} filas re-rotuladas)`);
    await asegurarSemanas();
  }

  return { estado: await estadoCierreAno(ano), filas_rerotuladas: filas };
};
