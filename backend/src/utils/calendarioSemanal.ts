// ============================================
// COOPERATIVA EL TRIUNFO - UTILIDAD
// Calendario semanal de colecta
// ============================================
//
// El problema que resuelve:
//
//   La colecta se cobra por SEMANAS, y una semana es un par (año, semana). Ese
//   par no se puede sumar directamente: la semana 51 de 2026 más 3 semanas no
//   es la semana 54 de 2026, es la semana 1 de 2027. Hacer esa cuenta a mano en
//   cada sitio es justo lo que obliga hoy a llamar al proveedor cada diciembre.
//
//   Aquí el par se convierte a un ORDINAL ABSOLUTO: un entero que cuenta
//   semanas desde una fecha fija. Sobre el ordinal la aritmética es trivial y
//   los cruces de año, los años de 53 semanas y los adelantos salen solos.
//
// Regla de calendario (confirmada por la cooperativa el 23/10/2026):
//
//   La semana va de LUNES a domingo, y la semana 1 de un año es la que
//   CONTIENE EL 1 DE ENERO. "La semana 53 es la semana 1 del próximo año": la
//   semana que cruza el fin de año ya es del año nuevo.
//
//   No es ISO-8601 (allí la semana 1 es la que contiene el 4 de enero). Las dos
//   reglas dan lo mismo en 2024, 2025 y 2026; difieren en los años cuyo 1 de
//   enero cae viernes, sábado o domingo (2027, 2028...). Con esta regla 2026
//   tiene 52 semanas: la del 28/12/2026 al 03/01/2027 es la semana 1 de 2027.
//
//   El sistema viejo no tenía una regla fija: en 2021-2022 numeró así, cerró
//   2022 con una "semana 53" y desde 2023 usó ISO (revisado en sus
//   movimientos de funeraria). Por eso cada diciembre había que llamar al
//   proveedor.
//
//   Toda la regla vive en `lunesDeSemana` y `periodoDeUtc`: cambiarla ahí la
//   cambia en todo el sistema, sin tocar quien la consume.

/** Un período de colecta: el par (año, semana) que identifica una semana. */
export interface Periodo {
  ano: number;
  semana: number;
}

const MS_POR_DIA = 86_400_000;
const MS_POR_SEMANA = 7 * MS_POR_DIA;

/**
 * Lunes de referencia del ordinal: lunes 3 de enero de 2000, semana 1 de 2000.
 * Cualquier lunes sirve; se fija uno anterior a todo dato del sistema para que
 * los ordinales sean siempre positivos y legibles en depuración.
 */
const EPOCA = Date.UTC(2000, 0, 3);

/**
 * Medianoche UTC del día CIVIL de la fecha.
 *
 * Se toman los componentes locales a propósito: "hoy" para el cajero es el día
 * que ve en pantalla, no el instante UTC. A partir de aquí todo es UTC puro.
 */
const aUtc = (fecha: Date): number =>
  Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

// ============================================
// LA REGLA DEL CALENDARIO
// ============================================

/**
 * Lunes con el que arranca la semana `semana` del año `ano`, en UTC.
 *
 * Admite semanas fuera de rango (0, -1, 54...) y devuelve el lunes que
 * corresponda: es lo que permite que `sumarSemanas` no tenga casos especiales.
 */
export const lunesDeSemana = (ano: number, semana: number): Date => {
  // La semana 1 es la que contiene el 1 de enero: arranca el lunes anterior
  // (o el mismo 1 de enero, si cae lunes)
  const primeroEnero = new Date(Date.UTC(ano, 0, 1));
  const diaSemana = primeroEnero.getUTCDay() || 7; // domingo = 7, no 0
  const lunesSemana1 = primeroEnero.getTime() - (diaSemana - 1) * MS_POR_DIA;

  return new Date(lunesSemana1 + (semana - 1) * MS_POR_SEMANA);
};

/**
 * Período (año, semana) al que pertenece una fecha.
 *
 * Ojo con el año: los últimos días de diciembre pueden caer en la semana 1 del
 * año siguiente, y los primeros de enero en la semana 52/53 del anterior. El
 * año que se devuelve es el del CALENDARIO SEMANAL, no el de la fecha, y es el
 * que hay que guardar como cobertura.
 */
export const semanaDeFecha = (fecha: Date = new Date()): Periodo =>
  periodoDeUtc(aUtc(fecha));

/**
 * Período de una medianoche UTC. Núcleo del cálculo, en UTC de principio a fin.
 *
 * Se mantiene aparte de `semanaDeFecha` porque `deOrdinal` ya trabaja en UTC:
 * si volviera a pasar por los componentes locales, en un huso al oeste de
 * Greenwich la medianoche UTC del lunes se leería como el domingo anterior y
 * cada ida y vuelta perdería una semana.
 */
const periodoDeUtc = (utc: number): Periodo => {
  const diaSemana = new Date(utc).getUTCDay() || 7;

  // El DOMINGO de esa semana decide el año: si la semana contiene un 1 de
  // enero, su domingo ya es del año nuevo; si no, toda la semana es de un año
  const lunes = utc - (diaSemana - 1) * MS_POR_DIA;
  const domingo = lunes + 6 * MS_POR_DIA;
  const ano = new Date(domingo).getUTCFullYear();

  const inicioAno = lunesDeSemana(ano, 1).getTime();
  const semana = Math.round((lunes - inicioAno) / MS_POR_SEMANA) + 1;

  return { ano, semana };
};

/** Cuántas semanas tiene el año: 52 o 53. Nunca se asume 52. */
export const semanasEnAno = (ano: number): number => {
  const inicio = lunesDeSemana(ano, 1).getTime();
  const inicioSiguiente = lunesDeSemana(ano + 1, 1).getTime();
  return Math.round((inicioSiguiente - inicio) / MS_POR_SEMANA);
};

// ============================================
// ORDINAL ABSOLUTO
// ============================================

/**
 * Convierte (año, semana) al entero con el que se hace toda la aritmética.
 *
 * Es la clave del módulo: dos períodos de años distintos se comparan y se
 * restan como números, sin ramas por cambio de año.
 */
export const aOrdinal = (periodo: Periodo): number =>
  Math.round((lunesDeSemana(periodo.ano, periodo.semana).getTime() - EPOCA) / MS_POR_SEMANA);

/** Vuelta del ordinal al par (año, semana), ya normalizado. */
export const deOrdinal = (ordinal: number): Periodo =>
  periodoDeUtc(EPOCA + ordinal * MS_POR_SEMANA);

/**
 * Normaliza un período: `{ano: 2026, semana: 54}` se convierte en el período
 * real al que apunta. Todo lo que entre por API o venga de datos viejos pasa
 * por aquí antes de guardarse.
 */
export const normalizarPeriodo = (periodo: Periodo): Periodo => deOrdinal(aOrdinal(periodo));

// ============================================
// ARITMÉTICA
// ============================================

/**
 * Avanza (o retrocede, con `n` negativo) un período. Es la operación del cobro:
 * pagar N semanas mueve la cobertura N semanas hacia adelante.
 */
export const sumarSemanas = (periodo: Periodo, n: number): Periodo =>
  deOrdinal(aOrdinal(periodo) + n);

/**
 * Semanas de `desde` hasta `hasta`. Positivo si `hasta` es posterior.
 *
 * Con esto se calculan las semanas pendientes (cobertura → semana actual) y las
 * adelantadas (semana actual → cobertura), que son el mismo cálculo con el
 * signo cambiado.
 */
export const diferenciaSemanas = (desde: Periodo, hasta: Periodo): number =>
  aOrdinal(hasta) - aOrdinal(desde);

/** Orden entre períodos, para comparar sin desarmar el par. */
export const esAnterior = (a: Periodo, b: Periodo): boolean => aOrdinal(a) < aOrdinal(b);
export const esPosterior = (a: Periodo, b: Periodo): boolean => aOrdinal(a) > aOrdinal(b);
export const sonIguales = (a: Periodo, b: Periodo): boolean => aOrdinal(a) === aOrdinal(b);

/** El período de hoy. */
export const semanaActual = (): Periodo => semanaDeFecha(new Date());

// ============================================
// PRESENTACIÓN
// ============================================

/** Lunes y domingo del período, en ISO (YYYY-MM-DD). */
export const rangoDeSemana = (periodo: Periodo): { inicio: string; fin: string } => {
  const lunes = lunesDeSemana(periodo.ano, periodo.semana);
  const domingo = new Date(lunes.getTime() + 6 * MS_POR_DIA);
  return {
    inicio: lunes.toISOString().slice(0, 10),
    fin: domingo.toISOString().slice(0, 10),
  };
};

/**
 * Etiqueta corta del período: "S36/2026".
 *
 * El cliente pidió explícitamente ver SIEMPRE el año junto a la semana, para no
 * confundir la semana 1 de 2027 con la 1 de 2026 durante los adelantos.
 */
export const formatearPeriodo = (periodo: Periodo | null | undefined): string =>
  periodo ? `S${String(periodo.semana).padStart(2, '0')}/${periodo.ano}` : '—';

/**
 * Lista los períodos de un rango, inclusive. Para generar semanas de colecta y
 * para desglosar qué semanas concretas cubrió un pago.
 */
export const periodosEntre = (desde: Periodo, hasta: Periodo): Periodo[] => {
  const inicio = aOrdinal(desde);
  const fin = aOrdinal(hasta);
  if (fin < inicio) return [];

  const periodos: Periodo[] = [];
  for (let o = inicio; o <= fin; o++) periodos.push(deOrdinal(o));
  return periodos;
};
