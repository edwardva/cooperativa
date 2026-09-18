// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Morosidad del socio (Sprint F)
// ============================================
//
// Un solo endpoint que revisa el atraso de todos los socios y dice qué haría.
// Por defecto SIMULA: aplicar es una decisión explícita de quien lo corre, y
// queda en la auditoría. El retiro de la semana 41 no se aplica acá: se informa,
// porque hoy la cooperativa revisa esa lista a mano.

import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { registrarAuditoria } from '../services/auditoriaService';
import { revisarMorosidad } from '../services/morosidadService';
import { responderError } from '../utils/responderError';

const prisma = new PrismaClient();

/** POST /api/morosidad/revisar  body: { aplicar?: boolean } */
export const revisarMorosidadSocios = async (req: Request, res: Response): Promise<void> => {
  try {
    const aplicar = req.body?.aplicar === true;

    const resultado = await prisma.$transaction(
      async (tx) => {
        const r = await revisarMorosidad(tx, { aplicar, usuarioId: req.user!.userId });
        if (aplicar) {
          await registrarAuditoria(tx, {
            req,
            accion: 'MOROSIDAD_SOCIOS',
            modulo: 'socios',
            despues: { ...r.totales, hasta: r.hasta.toISOString().slice(0, 10) },
          });
        }
        return r;
      },
      // Son miles de socios: el plazo por defecto de 5 segundos no alcanza
      { maxWait: 15_000, timeout: 180_000 }
    );

    res.json({
      success: true,
      data: resultado,
      message: aplicar
        ? `Morosidad aplicada: ${resultado.totales.suspender} suspendido(s), ${resultado.totales.reactivar} reactivado(s)`
        : 'Simulación: no se cambió nada',
    });
  } catch (error) {
    responderError(res, error, 'Error al revisar la morosidad');
  }
};
