// ============================================
// COOPERATIVA EL TRIUNFO - SERVICIO
// Datos de una cédula en el CNE (vía cedula.com.ve)
// ============================================
//
// Al inscribir a alguien, con la cédula se traen nombres y apellidos del
// registro electoral. La página del CNE no responde desde el servidor (está
// fuera de Venezuela), así que se usa la API de cedula.com.ve, plan gratis:
// 75 consultas por hora, de sobra para las inscripciones de la cooperativa.
//
// Documentación: https://wiki.cedula.com.ve/wiki:consultar_api
// Credenciales en el .env: CEDULA_API_APP_ID y CEDULA_API_TOKEN. Sin ellas la
// consulta queda apagada y el formulario sigue como siempre (a mano).
//
// Nunca bloquea una inscripción: si el servicio falla, tarda o no encuentra la
// cédula, se devuelve null y el operador escribe los datos.

import { logger } from '../utils/logger';

const URL_API = 'https://api.cedula.com.ve/api/v1';
const ESPERA_MS = 6000;

export interface DatosCne {
  nacionalidad: 'V' | 'E';
  cedula: string;
  nombres: string;
  apellidos: string;
  rif: string | null;
  estado: string | null;
  municipio: string | null;
  parroquia: string | null;
  centro_electoral: string | null;
}

export const cneConfigurado = (): boolean =>
  !!process.env.CEDULA_API_APP_ID && !!process.env.CEDULA_API_TOKEN;

const unir = (...partes: (string | null | undefined)[]): string =>
  partes
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLocaleUpperCase('es-VE');

const texto = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t : null;
};

/**
 * Consulta una cédula. Devuelve null si no aparece, si el servicio no responde
 * o si no está configurado.
 */
export async function consultarCne(nacionalidad: 'V' | 'E', cedula: string): Promise<DatosCne | null> {
  if (!cneConfigurado()) return null;

  const url = new URL(URL_API);
  url.searchParams.set('app_id', process.env.CEDULA_API_APP_ID!);
  url.searchParams.set('token', process.env.CEDULA_API_TOKEN!);
  url.searchParams.set('nacionalidad', nacionalidad);
  url.searchParams.set('cedula', cedula);

  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) });
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: boolean;
      error_str?: string | false;
      data?: Record<string, any> | null;
    } | null;

    if (!respuesta.ok || !cuerpo || cuerpo.error || !cuerpo.data) {
      // "No encontrado" es normal (menores, extranjeros sin registro). Una
      // credencial mala o el tope de consultas se anotan como advertencia,
      // porque apagan la consulta para todos (p. ej. error_str INVALID_TOKEN)
      const motivo = cuerpo?.error_str || null;
      const deConfiguracion = !respuesta.ok || /TOKEN|APP|LIMIT|PLAN|KEY/i.test(motivo ?? '');
      logger[deConfiguracion ? 'warn' : 'info']('Consulta de cédula sin datos', {
        cedula,
        status: respuesta.status,
        motivo,
      });
      return null;
    }

    const d = cuerpo.data;
    const nombres = unir(d.primer_nombre, d.segundo_nombre);
    const apellidos = unir(d.primer_apellido, d.segundo_apellido);
    if (!nombres && !apellidos) return null;

    return {
      nacionalidad,
      cedula,
      nombres,
      apellidos,
      rif: texto(d.rif),
      estado: texto(d.cne?.estado),
      municipio: texto(d.cne?.municipio),
      parroquia: texto(d.cne?.parroquia),
      centro_electoral: texto(d.cne?.centro_electoral),
    };
  } catch (error) {
    // Caído o lento: el operador escribe los datos a mano
    logger.warn('No se pudo consultar la cédula', {
      cedula,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
