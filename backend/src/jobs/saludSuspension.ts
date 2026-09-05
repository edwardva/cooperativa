/**
 * ============================================
 * JOB: estado semanal de los servicios
 * ============================================
 *
 * Requisito 8 de la reunión.
 *
 * Antes este job sumaba 1 a `semanas_sin_pago` de cada acuerdo de salud todos
 * los lunes. Con la cobertura por (año, semana) como fuente de verdad eso pasó
 * a estar mal: el atraso ya sale de comparar la cobertura con la semana en
 * curso, así que incrementarlo ademas lo contaba dos veces, y a un socio que
 * pagó por adelantado lo dejaba figurando como atrasado.
 *
 * Ahora RECALCULA, y cubre funeraria además de salud — antes funeraria no
 * tenía ningún mecanismo.
 */

import cron from 'node-cron';
import { recalcularEstados } from '../services/estadoServiciosService';
import { logger } from '../utils/logger';

async function ejecutarJobSemanal(): Promise<void> {
  try {
    await recalcularEstados();
  } catch (error) {
    logger.error('Error en el job semanal de estado de servicios:', error);
  }
}

/**
 * Lunes 00:05, después del job de calendario: el atraso se mide contra la
 * semana en curso, así que primero tiene que estar marcada.
 */
export function iniciarJobSemanalSalud(): void {
  cron.schedule('5 0 * * 1', () => {
    void ejecutarJobSemanal();
  });
  logger.info('Job semanal de estado de servicios programado (lunes 00:05)');
}

// Exportado para pruebas manuales / ejecución bajo demanda.
export { ejecutarJobSemanal };
