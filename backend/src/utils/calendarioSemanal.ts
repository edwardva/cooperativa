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
// Regla de calendario (confirmada por la cooperativa el 23/10 y el 10/11/2026):
//
//   La semana va de LUNES a domingo, y la semana 1 de un año es la que
//   CONTIENE EL 1 DE ENERO: la semana que cruza el fin de año ya es la 1 del
//   año nuevo. Con eso casi todos los años tienen 52 semanas; 2026 cierra con
//   la 52 el domingo 27/12 y la 1 de 2027 arranca el lunes 28/12.
//
//   Pero quien decide si un año cierra en 52 o en 53 es la FUNERARIA, y lo
//   avisa cada diciembre ("este año cobramos hasta la 53"). Por eso el largo
//   de un año se puede confirmar a mano (tabla `anos_colecta`, ver
//   services/calendarioAnosService.ts). Con un año confirmado en 53, la semana
//   que cruza el año pasa a ser su semana 53 y el año siguiente arranca una
//   semana después. Sin confirmación vale la regla del 1 de enero.
//
//   El sistema viejo no tenía una regla fija: en 2021-2022 numeró así, cerró
//   2022 con una "semana 53" y desde 2023 usó ISO (revisado en sus
//   movimientos de funeraria). Por eso cada diciembre había que llamar al
//   proveedor.
//
//   Toda la regla vive en `inicioDeAno` y `periodoDeUtc`: cambiarla ahí la
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
 * Años con el largo confirmado por la funeraria: año -> 52 o 53 semanas.
 *
 * Vive en memoria para que todo el calendario siga siendo síncrono. Lo carga
 * `calendarioAnosService` al arrancar y cada vez que alguien confirma un año.
 */
export type LargosDeAno = ReadonlyMap<number, 52 | 53>;

let largosVigentes: LargosDeAno = new Map();
let menorAnoConfirmado = Infinity;
const cacheInicio = new Map<number, number>();

export const fijarLargosDeAno = (largos: LargosDeAno): void => {
  largosVigentes = new Map(largos);
  menorAnoConfirmado = largos.size ? Math.min(...largos.keys()) : Infinity;
  cacheInicio.clear();
};

export const largosDeAnoVigentes = (): LargosDeAno => largosVigentes;

/** Regla base: lunes de la semana que contiene el 1 de enero (o el mismo 1, si es lunes) */
const lunesQueContieneElPrimero = (ano: number): number => {
  const primeroEnero = new Date(Date.UTC(ano, 0, 1));
  const diaSemana = primeroEnero.getUTCDay() || 7; // domingo = 7, no 0
  return primeroEnero.getTime() - (diaSemana - 1) * MS_POR_DIA;
};

/**
 * Lunes (UTC, en ms) con el que arranca la semana 1 del año.
 *
 * Si no hay ningún año confirmado antes de `ano`, es la regla del 1 de enero.
 * Si lo hay, se parte del inicio del año anterior: un año confirmado mide lo
 * que se confirmó, y uno sin confirmar sigue la regla del 1 de enero pero sin
 * bajar de 52 ni pasar de 53 semanas (así el calendario vuelve solo a la regla
 * al año siguiente de una semana 53).
 */
export const inicioDeAno = (ano: number, largos: LargosDeAno = largosVigentes): number => {
  const vigentes = largos === largosVigentes;
  if (vigentes) {
    const enCache = cacheInicio.get(ano);
    if (enCache !== undefined) return enCache;
  }

  const menor = vigentes ? menorAnoConfirmado : largos.size ? Math.min(...largos.keys()) : Infinity;
  let inicio: number;
  if (ano <= menor) {
    inicio = lunesQueContieneElPrimero(ano);
  } else {
    const previo = inicioDeAno(ano - 1, largos);
    const confirmado = largos.get(ano - 1);
    const semanas =
      confirmado ??
      Math.min(53, Math.max(52, Math.round((lunesQueContieneElPrimero(ano) - previo) / MS_POR_SEMANA)));
    inicio = previo + semanas * MS_POR_SEMANA;
  }

  if (vigentes) cacheInicio.set(ano, inicio);
  return inicio;
};

/**
 * Lunes con el que arranca la semana `semana` del año `ano`, en UTC.
 *
 * Admite semanas fuera de rango (0, -1, 54...) y devuelve el lunes que
 * corresponda: es lo que permite que `sumarSemanas` no tenga casos especiales.
 */
export const lunesDeSemana = (ano: number, semana: number, largos: LargosDeAno = largosVigentes): Date =>
  new Date(inicioDeAno(ano, largos) + (semana - 1) * MS_POR_SEMANA);

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
export const periodoDeUtc = (utc: number, largos: LargosDeAno = largosVigentes): Periodo => {
  const diaSemana = new Date(utc).getUTCDay() || 7;
  const lunes = utc - (diaSemana - 1) * MS_POR_DIA;

  // Se parte del año del domingo (la regla base) y se corrige si un año
  // confirmado en 53 corrió el inicio
  let ano = new Date(lunes + 6 * MS_POR_DIA).getUTCFullYear();
  while (lunes < inicioDeAno(ano, largos)) ano--;
  while (lunes >= inicioDeAno(ano + 1, largos)) ano++;

  const semana = Math.round((lunes - inicioDeAno(ano, largos)) / MS_POR_SEMANA) + 1;
  return { ano, semana };
};

/** Cuántas semanas tiene el año: 52 o 53. Nunca se asume 52. */
export const semanasEnAno = (ano: number, largos: LargosDeAno = largosVigentes): number =>
  Math.round((inicioDeAno(ano + 1, largos) - inicioDeAno(ano, largos)) / MS_POR_SEMANA);

/**
 * Semanas que tendría el año por la regla del 1 de enero, sin confirmar nada.
 * Es lo que el sistema propone hasta que la funeraria avise otra cosa.
 */
export const semanasEnAnoPorRegla = (ano: number): number => {
  const sinAno = new Map(largosVigentes);
  sinAno.delete(ano);
  return semanasEnAno(ano, sinAno);
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
