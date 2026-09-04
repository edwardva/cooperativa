/**
 * ============================================
 * JOB: SUSPENSIÓN SEMANAL DE SALUD
 * ============================================
 * Cada semana, incrementa en 1 las "semanas sin pago" de todos los acuerdos
 * de salud activos, y suspende (en cascada, por grupo) los que lleguen a
 * SEMANAS_LIMITE_SUSPENSION. Este mecanismo no existe hoy para Funeraria
 * (queda fuera del alcance de este trabajo): solo se agrega para Salud.
 */

import cron from 'node-cron';
import { incrementarSemanasSinPago, suspenderGruposVencidos } from '../controllers/saludController';
import { logger } from '../utils/logger';

async function ejecutarJobSemanal(): Promise<void> {
  try {
    const { gruposIncrementados } = await incrementarSemanasSinPago();
    const { gruposSuspendidos, personasSuspendidas } = await suspenderGruposVencidos(null);
    logger.info(
      `Job semanal de salud completado: ${gruposIncrementados} grupo(s) incrementado(s), ${gruposSuspendidos} grupo(s) suspendido(s) (${personasSuspendidas} persona(s))`
    );
  } catch (error) {
    logger.error('Error en el job semanal de salud:', error);
  }
}

/**
 * Programa el job para correr todos los lunes a las 00:05 (hora del servidor).
 */
export function iniciarJobSemanalSalud(): void {
  cron.schedule('5 0 * * 1', () => {
    void ejecutarJobSemanal();
  });
  logger.info('Job semanal de salud programado (lunes 00:05)');
}

// Exportado para pruebas manuales / ejecución bajo demanda.
export { ejecutarJobSemanal };
