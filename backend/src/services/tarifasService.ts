// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Tarifas y reglas de la colecta
// ============================================
//
// Requisito 2 de la reunión: los importes unitarios NO se editan en la pantalla
// de cobro y NO viven en el código. Vienen de parámetros, porque la cooperativa
// los cambia por acuerdo de asamblea.
//
// Valores de referencia que dio el cliente (a confirmar antes de producción,
// la transcripción tiene cifras con errores):
//
//   Ahorro     USD 0,03 por semana
//   Funeraria  USD 0,75 por semana
//   Salud      USD 0,96 por semana
//
// Se cargan como parámetro editable, nunca como constante.

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ============================================
// CLAVES Y VALORES POR DEFECTO
// ============================================

/**
 * Cada regla configurable, con el valor que se usa si el parámetro todavía no
 * está cargado. El sistema nunca se queda sin un valor con el que operar.
 */
export const PARAMETROS_COLECTA = {
  TARIFA_AHORRO_SEMANAL_USD: {
    porDefecto: 0.03,
    descripcion: 'Aporte semanal de ahorro obligatorio, en USD',
  },
  TARIFA_FUNERARIA_SEMANAL_USD: {
    porDefecto: 0.75,
    descripcion: 'Cuota semanal del servicio de funeraria, en USD',
  },
  TARIFA_SALUD_SEMANAL_USD: {
    porDefecto: 0.96,
    descripcion: 'Cuota semanal del servicio de salud, en USD',
  },
  MAX_SEMANAS_ADELANTO: {
    porDefecto: 10,
    descripcion: 'Semanas que se pueden adelantar antes de advertir al cajero',
  },
  BLOQUEAR_ADELANTO_EXCEDIDO: {
    porDefecto: 0,
    descripcion:
      'Si vale 1, pasar del máximo de adelanto se rechaza; si vale 0, sólo se advierte',
  },
  SEMANAS_SUSPENSION_FUNERARIA: {
    porDefecto: 6,
    descripcion: 'Semanas de atraso que suspenden el servicio de funeraria',
  },
  SEMANAS_SUSPENSION_SALUD: {
    porDefecto: 6,
    descripcion: 'Semanas de atraso que suspenden el servicio de salud',
  },
} as const;

/**
 * Código del tipo de cuenta que recibe el ahorro obligatorio de la colecta.
 *
 * En el sistema viejo es la cuenta `01` (ahorro en bolívares); la `12` es la de
 * divisas y la `02` el acumulado histórico. El cliente todavía debe confirmar
 * cuáles siguen operativos, así que va por parámetro y no fijo en el código.
 */
export const CLAVE_TIPO_CUENTA_AHORRO = 'TIPO_CUENTA_AHORRO_OBLIGATORIO';
const TIPO_CUENTA_AHORRO_POR_DEFECTO = '01';

/** Código del tipo de cuenta donde cae el ahorro obligatorio. */
export async function tipoCuentaAhorroObligatorio(): Promise<string> {
  try {
    const p = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_TIPO_CUENTA_AHORRO } });
    return p?.valor?.trim() || TIPO_CUENTA_AHORRO_POR_DEFECTO;
  } catch {
    return TIPO_CUENTA_AHORRO_POR_DEFECTO;
  }
}

export type ClaveParametroColecta = keyof typeof PARAMETROS_COLECTA;

// ============================================
// LECTURA
// ============================================

/**
 * Valor numérico de un parámetro. Si falta o está corrupto se usa el valor por
 * defecto y se deja aviso: una tarifa mal cargada no puede detener la caja,
 * pero tampoco puede pasar inadvertida.
 */
export async function leerParametroNumerico(clave: ClaveParametroColecta): Promise<number> {
  const { porDefecto } = PARAMETROS_COLECTA[clave];

  try {
    const parametro = await prisma.parametroSistema.findUnique({ where: { clave } });
    if (!parametro) return porDefecto;

    const valor = Number(parametro.valor);
    if (!isFinite(valor) || valor < 0) {
      logger.warn(`Parámetro ${clave} con valor inválido ("${parametro.valor}"); se usa ${porDefecto}`);
      return porDefecto;
    }
    return valor;
  } catch (error) {
    logger.error(`Error al leer el parámetro ${clave}; se usa ${porDefecto}`, error);
    return porDefecto;
  }
}

/** Las tres tarifas semanales y las reglas de cobro, en una sola lectura. */
export interface TarifasColecta {
  ahorro_usd: number;
  funeraria_usd: number;
  salud_usd: number;
  max_semanas_adelanto: number;
  bloquear_adelanto_excedido: boolean;
  semanas_suspension_funeraria: number;
  semanas_suspension_salud: number;
}

export async function obtenerTarifas(): Promise<TarifasColecta> {
  const claves = Object.keys(PARAMETROS_COLECTA) as ClaveParametroColecta[];
  const parametros = await prisma.parametroSistema.findMany({
    where: { clave: { in: claves } },
  });

  const mapa = new Map(parametros.map((p) => [p.clave, p.valor]));

  const leer = (clave: ClaveParametroColecta): number => {
    const crudo = mapa.get(clave);
    if (crudo === undefined) return PARAMETROS_COLECTA[clave].porDefecto;

    const valor = Number(crudo);
    if (!isFinite(valor) || valor < 0) {
      logger.warn(`Parámetro ${clave} con valor inválido ("${crudo}")`);
      return PARAMETROS_COLECTA[clave].porDefecto;
    }
    return valor;
  };

  return {
    ahorro_usd: leer('TARIFA_AHORRO_SEMANAL_USD'),
    funeraria_usd: leer('TARIFA_FUNERARIA_SEMANAL_USD'),
    salud_usd: leer('TARIFA_SALUD_SEMANAL_USD'),
    max_semanas_adelanto: leer('MAX_SEMANAS_ADELANTO'),
    bloquear_adelanto_excedido: leer('BLOQUEAR_ADELANTO_EXCEDIDO') === 1,
    semanas_suspension_funeraria: leer('SEMANAS_SUSPENSION_FUNERARIA'),
    semanas_suspension_salud: leer('SEMANAS_SUSPENSION_SALUD'),
  };
}

/**
 * Deja creados los parámetros que falten, con su valor por defecto.
 *
 * Se llama al arrancar el servidor: así los valores aparecen en la pantalla de
 * Parámetros y el personal puede ajustarlos sin pedir una carga técnica, que es
 * justo lo que el cliente quiere dejar de necesitar.
 */
export async function sembrarParametrosColecta(): Promise<void> {
  for (const [clave, { porDefecto, descripcion }] of Object.entries(PARAMETROS_COLECTA)) {
    await prisma.parametroSistema.upsert({
      where: { clave },
      // No se pisa lo que la cooperativa haya configurado
      update: {},
      create: { clave, valor: String(porDefecto), descripcion, tipo_dato: 'number' },
    });
  }

  // Suspension automatica: apagada mientras el cliente no confirme cuantas
  // semanas suspenden. El job informa a cuantos alcanzaria sin aplicarlo.
  await prisma.parametroSistema.upsert({
    where: { clave: 'SUSPENSION_AUTOMATICA' },
    update: {},
    create: {
      clave: 'SUSPENSION_AUTOMATICA',
      valor: '0',
      descripcion:
        'Si vale 1, el job semanal suspende los acuerdos que alcancen el umbral de atraso',
      tipo_dato: 'number',
    },
  });

  await prisma.parametroSistema.upsert({
    where: { clave: CLAVE_TIPO_CUENTA_AHORRO },
    update: {},
    create: {
      clave: CLAVE_TIPO_CUENTA_AHORRO,
      valor: TIPO_CUENTA_AHORRO_POR_DEFECTO,
      descripcion: 'Código del tipo de cuenta que recibe el ahorro obligatorio de la colecta',
      tipo_dato: 'string',
    },
  });

  logger.info('Parámetros de colecta verificados');
}
