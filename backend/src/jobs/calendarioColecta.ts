/**
 * ============================================
 * JOB: calendario de colecta
 * ============================================
 * Cada lunes deja lista la semana en curso y adelanta el horizonte de semanas
 * creadas. Es el mecanismo que sustituye a la intervención anual del proveedor
 * para poder seguir cobrando al pasar de diciembre a enero (requisito 3).
 */

import cron from 'node-cron';
import { mantenerCalendario } from '../services/semanasColectaService';
import { logger } from '../utils/logger';

/**
 * Lunes 00:01, antes que el job de salud: el resto de la semana depende de que
 * la semana en curso ya esté marcada.
 */
export function iniciarJobCalendarioColecta(): void {
  cron.schedule('1 0 * * 1', () => {
    void mantenerCalendario();
  });
  logger.info('Job de calendario de colecta programado (lunes 00:01)');
}
