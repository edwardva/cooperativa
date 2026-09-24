// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Tasa de cambio BCV automática
// ============================================
//
// La tasa maneja TODO el dinero del sistema (colecta, ahorro, préstamos), así
// que este módulo prioriza no romperse y no aceptar valores dudosos por encima
// de estar siempre al día.
//
// Fuentes, en orden:
//   1. ve.dolarapi.com — publica la tasa oficial del BCV, TLS correcto.
//   2. bcv.org.ve — la fuente autoritativa, PERO su certificado tiene la cadena
//      incompleta (UNABLE_TO_VERIFY_LEAF_SIGNATURE) y Node la rechaza. Sólo se
//      usa si se habilita explícitamente con BCV_TLS_INSEGURO=true, porque
//      saltarse la validación TLS de un dato que mueve dinero es un riesgo real:
//      un intermediario podría inyectar una tasa falsa.
//
// Si ninguna responde, se conserva la última tasa conocida. Nunca se deja al
// sistema sin tasa.

import * as https from 'https';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const CLAVE_TASA = 'TASA_CAMBIO_USD_BS';

/** Variación máxima aceptada de un día para otro sin intervención humana. */
const VARIACION_MAXIMA_PORCENTAJE = 15;

/**
 * Último recurso si no hay tasa en ningún lado: ni parámetro, ni histórico, ni
 * fuentes en línea. Fijada el 2026-08-22 con el valor del BCV de esa fecha.
 * Que el sistema arranque con una tasa vieja es malo; que no arranque, peor.
 */
const TASA_POR_DEFECTO = 784.6633;
const TASA_POR_DEFECTO_FECHA = '2026-08-22';

export interface TasaObtenida {
  tasa: number;
  fuente: string;
  fecha_valor: string | null;
}

export interface ResultadoSincronizacion {
  aplicada: boolean;
  tasa_anterior: number | null;
  tasa_nueva: number | null;
  fuente: string | null;
  motivo: string;
}

// ============================================
// FUENTES
// ============================================

/** Fuente principal: publica la tasa oficial del BCV con TLS válido. */
async function desdeDolarApi(): Promise<TasaObtenida | null> {
  try {
    const respuesta = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    });
    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as { promedio?: number; fechaActualizacion?: string };
    const tasa = Number(datos.promedio);
    if (!tasa || !isFinite(tasa) || tasa <= 0) return null;

    return {
      tasa,
      fuente: 've.dolarapi.com (oficial BCV)',
      fecha_valor: datos.fechaActualizacion ?? null,
    };
  } catch (error) {
    logger.warn('No se pudo obtener la tasa de dolarapi:', error);
    return null;
  }
}

/**
 * Fuente autoritativa, detrás de una bandera por el problema de certificado.
 * Requiere BCV_TLS_INSEGURO=true.
 */
async function desdeBcvDirecto(): Promise<TasaObtenida | null> {
  if (process.env.BCV_TLS_INSEGURO !== 'true') return null;

  return new Promise((resolver) => {
    const req = https.get(
      'https://www.bcv.org.ve/',
      { timeout: 15000, rejectUnauthorized: false },
      (res) => {
        let html = '';
        res.on('data', (c) => (html += c));
        res.on('end', () => {
          try {
            const i = html.indexOf('id="dolar"');
            if (i === -1) return resolver(null);

            const bloque = html.slice(i, i + 1200);
            const monto = bloque.match(/>\s*(\d{1,3}(?:\.\d{3})*,\d+)\s*</);
            if (!monto) return resolver(null);

            // Formato venezolano: punto de miles, coma decimal
            const tasa = Number(monto[1]!.replace(/\./g, '').replace(',', '.'));
            if (!tasa || !isFinite(tasa) || tasa <= 0) return resolver(null);

            // El texto de la fecha viene partido entre etiquetas, así que se
            // limpian antes de buscarlo
            const plano = bloque.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            // "Fecha Valor: Lunes, 24 Agosto 2026" — se corta en el año para no
            // arrastrar el título que viene pegado después
            const fecha = plano.match(/Fecha Valor:\s*([A-Za-zÁÉÍÓÚáéíóúñ]+,?\s*\d{1,2}\s+\w+\s+\d{4})/);
            const capturada = (fecha?.[1] ?? '').trim();
            resolver({
              tasa,
              fuente: 'bcv.org.ve (directo)',
              fecha_valor: capturada || null,
            });
          } catch {
            resolver(null);
          }
        });
      }
    );
    req.on('error', () => resolver(null));
    req.on('timeout', () => {
      req.destroy();
      resolver(null);
    });
  });
}

/** Consulta las fuentes en orden y devuelve la primera que responda. */
export async function consultarTasaBcv(): Promise<TasaObtenida | null> {
  // El BCV directo va primero SI está habilitado: es la fuente autoritativa
  const bcv = await desdeBcvDirecto();
  if (bcv) return bcv;

  return desdeDolarApi();
}

// ============================================
// SINCRONIZACIÓN
// ============================================

/**
 * Consulta la tasa y la aplica si es razonable.
 *
 * Un salto mayor al límite NO se aplica solo: puede ser un error de la fuente
 * o un cambio de formato en el HTML del BCV, y una tasa equivocada corrompería
 * todos los cobros del día. En ese caso queda registrado para que alguien la
 * cargue a mano.
 */
export async function sincronizarTasa(
  usuarioId?: number,
  forzar = false
): Promise<ResultadoSincronizacion> {
  const parametroActual = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_TASA } });
  const tasaAnterior = parametroActual ? Number(parametroActual.valor) : null;

  const obtenida = await consultarTasaBcv();

  if (!obtenida) {
    logger.warn('Ninguna fuente de tasa respondió; se conserva la tasa actual');
    return {
      aplicada: false,
      tasa_anterior: tasaAnterior,
      tasa_nueva: null,
      fuente: null,
      motivo: 'Ninguna fuente respondió. Se conserva la tasa vigente.',
    };
  }

  if (tasaAnterior && tasaAnterior > 0 && !forzar) {
    const variacion = Math.abs((obtenida.tasa - tasaAnterior) / tasaAnterior) * 100;
    if (variacion > VARIACION_MAXIMA_PORCENTAJE) {
      logger.warn(
        `Tasa descartada: ${obtenida.tasa} varía ${variacion.toFixed(1)}% respecto de ${tasaAnterior}`
      );
      return {
        aplicada: false,
        tasa_anterior: tasaAnterior,
        tasa_nueva: obtenida.tasa,
        fuente: obtenida.fuente,
        motivo:
          `La tasa obtenida (${obtenida.tasa}) varía ${variacion.toFixed(1)}% respecto de la vigente ` +
          `(${tasaAnterior}), por encima del ${VARIACION_MAXIMA_PORCENTAJE}% permitido. ` +
          'Revise y confirme manualmente.',
      };
    }
  }

  if (tasaAnterior === obtenida.tasa) {
    return {
      aplicada: false,
      tasa_anterior: tasaAnterior,
      tasa_nueva: obtenida.tasa,
      fuente: obtenida.fuente,
      motivo: 'La tasa no cambió.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.parametroSistema.upsert({
      where: { clave: CLAVE_TASA },
      update: { valor: String(obtenida.tasa), actualizado_por: usuarioId ?? null },
      create: {
        clave: CLAVE_TASA,
        valor: String(obtenida.tasa),
        descripcion: 'Tasa de cambio USD/Bs (BCV). Se sincroniza automáticamente.',
        tipo_dato: 'number',
        actualizado_por: usuarioId ?? null,
      },
    });

    // Queda el rastro histórico de cada cambio
    await tx.historicoTasaCambio.create({
      data: {
        tasa: obtenida.tasa,
        fecha_vigencia: new Date(),
        actualizado_por: usuarioId ?? null,
      },
    });
  });

  logger.info(`Tasa actualizada: ${tasaAnterior ?? 's/d'} -> ${obtenida.tasa} (${obtenida.fuente})`);

  return {
    aplicada: true,
    tasa_anterior: tasaAnterior,
    tasa_nueva: obtenida.tasa,
    fuente: obtenida.fuente,
    motivo: 'Tasa actualizada.',
  };
}

// ============================================
// PROGRAMACIÓN
// ============================================

let temporizador: NodeJS.Timeout | null = null;

/**
 * Arranca la sincronización periódica.
 *
 * No se usa una librería de cron para no sumar una dependencia por una sola
 * tarea. El BCV publica una vez al día, así que revisar cada 6 horas alcanza
 * de sobra y tolera que el servidor se reinicie a cualquier hora.
 */
export function iniciarSincronizacionAutomatica(horas = 6): void {
  if (temporizador) return;

  const intervalo = horas * 60 * 60 * 1000;

  // Un intento al arrancar, con margen para que la base esté lista
  setTimeout(() => {
    void sincronizarTasa().catch((e) => logger.error('Error en la sincronización inicial de tasa:', e));
  }, 10_000);

  temporizador = setInterval(() => {
    void sincronizarTasa().catch((e) => logger.error('Error en la sincronización de tasa:', e));
  }, intervalo);

  logger.info(`Sincronización automática de tasa BCV activada (cada ${horas} h)`);
}

export function detenerSincronizacionAutomatica(): void {
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
}

// ============================================
// RESOLUCIÓN CON RESPALDO
// ============================================

export interface TasaResuelta {
  tasa: number;
  origen: 'parametro' | 'historico' | 'por_defecto';
  actualizada_el: Date | null;
}

/**
 * Devuelve la tasa a usar, SIEMPRE. Nunca lanza ni devuelve null.
 *
 * No consulta la red: la sincronización periódica ya dejó el valor en la base,
 * así que ninguna petición del usuario queda esperando a un servicio externo.
 *
 * Orden: parámetro vigente -> última tasa histórica -> constante por defecto.
 */
export async function resolverTasa(): Promise<TasaResuelta> {
  try {
    const parametro = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_TASA } });
    const valor = parametro ? Number(parametro.valor) : 0;
    if (valor > 0) {
      return { tasa: valor, origen: 'parametro', actualizada_el: parametro!.updated_at };
    }

    const historica = await prisma.historicoTasaCambio.findFirst({ orderBy: { created_at: 'desc' } });
    if (historica && Number(historica.tasa) > 0) {
      logger.warn('Sin parámetro de tasa; se usa la última tasa histórica');
      return { tasa: Number(historica.tasa), origen: 'historico', actualizada_el: historica.created_at };
    }
  } catch (error) {
    logger.error('Error al resolver la tasa desde la base:', error);
  }

  logger.error(
    `Sin tasa en base ni en histórico. Se usa la constante por defecto (${TASA_POR_DEFECTO}, ` +
      `fijada el ${TASA_POR_DEFECTO_FECHA}). Sincronice o cargue la tasa cuanto antes.`
  );
  return { tasa: TASA_POR_DEFECTO, origen: 'por_defecto', actualizada_el: null };
}
