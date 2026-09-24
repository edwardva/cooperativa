// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Continuidad del calendario de colecta
// ============================================
//
// Requisito 3 de la reunión, y el más concreto de todos:
//
//   "Al llegar a la última semana del año, el sistema requiere intervención
//    del proveedor para continuar cobrando."
//
// La causa es que las semanas de colecta se cargaban a mano, año por año. Aquí
// se generan solas: al arrancar el servidor y todas las semanas, se asegura que
// existan las semanas del horizonte configurado hacia adelante. En diciembre
// las de enero ya están creadas y el cobro adelantado no encuentra un hueco.

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  type Periodo,
  lunesDeSemana,
  rangoDeSemana,
  semanaActual,
  semanasEnAno,
  sumarSemanas,
} from '../utils/calendarioSemanal';

/**
 * Cuántas semanas hacia adelante se mantienen creadas.
 *
 * 60 pasa del año: en cualquier momento del calendario hay semanas del año
 * siguiente disponibles, con margen sobrado para el tope de 10 semanas de
 * adelanto que maneja el personal.
 */
const HORIZONTE_SEMANAS = 60;

/**
 * Crea las semanas que falten desde hoy hasta el horizonte.
 *
 * La tasa se hereda de la última semana conocida: es un valor de arranque para
 * que la semana exista, no una decisión. El lunes, cuando la cooperativa fija
 * la tasa del BCV, se actualiza esa semana desde la pantalla correspondiente.
 *
 * Es idempotente: se puede llamar en cada arranque sin duplicar nada.
 */
export async function asegurarSemanas(desde?: Periodo): Promise<{ creadas: number }> {
  const inicio = desde ?? semanaActual();

  const existentes = await prisma.semanaColecta.findMany({
    where: { ano: { gte: inicio.ano } },
    select: { ano: true, semana: true },
  });
  const yaEstan = new Set(existentes.map((s) => `${s.ano}-${s.semana}`));

  // Tasa de arranque: la de la última semana cargada, o la del parámetro
  const ultima = await prisma.semanaColecta.findFirst({
    orderBy: [{ ano: 'desc' }, { semana: 'desc' }],
  });
  const parametroTasa = await prisma.parametroSistema.findUnique({
    where: { clave: 'TASA_CAMBIO_USD_BS' },
  });
  const tasaBase = Number(ultima?.tasa_usd_bs ?? parametroTasa?.valor ?? 0) || 0;

  const nuevas = [];
  for (let i = 0; i < HORIZONTE_SEMANAS; i++) {
    const periodo = sumarSemanas(inicio, i);
    if (yaEstan.has(`${periodo.ano}-${periodo.semana}`)) continue;

    const rango = rangoDeSemana(periodo);
    nuevas.push({
      semana: periodo.semana,
      ano: periodo.ano,
      tasa_usd_bs: tasaBase,
      fecha_inicio: new Date(`${rango.inicio}T00:00:00Z`),
      fecha_fin: new Date(`${rango.fin}T00:00:00Z`),
      // Sólo la semana que corre queda activa; las futuras se activan al llegar
      estado: periodo.ano === inicio.ano && periodo.semana === inicio.semana,
    });
  }

  if (nuevas.length === 0) return { creadas: 0 };

  const { count } = await prisma.semanaColecta.createMany({
    data: nuevas,
    skipDuplicates: true,
  });

  logger.info(
    `Calendario de colecta: ${count} semana(s) creada(s) hasta ${
      nuevas[nuevas.length - 1]!.ano
    }-S${nuevas[nuevas.length - 1]!.semana}`
  );
  return { creadas: count };
}

/**
 * Marca como activa la semana que corre y desactiva las demás.
 *
 * "Activa" es sólo cuál es el período en curso; no bloquea cobrar semanas
 * anteriores ni posteriores, que es precisamente lo que el cliente necesita
 * para adelantar y para ponerse al día.
 */
export async function activarSemanaEnCurso(): Promise<Periodo> {
  const actual = semanaActual();

  const semana = await prisma.semanaColecta.findUnique({
    where: { semana_ano: { semana: actual.semana, ano: actual.ano } },
  });

  if (!semana) {
    await asegurarSemanas(actual);
    return activarSemanaEnCurso();
  }

  if (!semana.estado) {
    await prisma.$transaction([
      prisma.semanaColecta.updateMany({
        where: { estado: true, NOT: { id: semana.id } },
        data: { estado: false },
      }),
      prisma.semanaColecta.update({ where: { id: semana.id }, data: { estado: true } }),
    ]);
    logger.info(`Semana de colecta en curso: ${actual.ano}-S${actual.semana}`);
  }

  return actual;
}

/**
 * Arranque y mantenimiento del calendario. Se llama al iniciar el servidor y
 * desde el job semanal.
 */
export async function mantenerCalendario(): Promise<void> {
  try {
    await asegurarSemanas();
    await activarSemanaEnCurso();
  } catch (error) {
    // Que falle el mantenimiento no puede impedir que el servidor arranque:
    // el cobro sabe operar sin una semana cargada.
    logger.error('Error al mantener el calendario de colecta:', error);
  }
}

/** Semanas que tiene el año, para mostrarlo donde haga falta. */
export { semanasEnAno, lunesDeSemana };
