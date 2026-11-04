// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLADOR
// Consulta de una cédula en el CNE para la inscripción
// ============================================

import type { Request, Response } from 'express';
import { validarCedula } from '../utils/cedula';
import { BadRequestError } from '../middleware/errorHandler';
import { responderError } from '../utils/responderError';
import { cneConfigurado, consultarCne } from '../services/cneService';

/**
 * GET /api/socios/cne/:cedula   (admite "V12345678", "E-1234567" o solo dígitos)
 *
 * `disponible: false` cuando no hay credenciales: la pantalla no avisa nada y
 * se sigue a mano. `datos: null` cuando la cédula no aparece o el servicio no
 * respondió.
 */
export const consultarCedulaCne = async (req: Request, res: Response): Promise<void> => {
  try {
    const revision = validarCedula(String(req.params.cedula ?? ''));
    if (!revision.valida) throw new BadRequestError(revision.error ?? 'Cédula inválida');

    if (!cneConfigurado()) {
      res.json({ success: true, data: { disponible: false, datos: null } });
      return;
    }

    const datos = await consultarCne(revision.nacionalidad ?? 'V', revision.cedula);
    res.json({ success: true, data: { disponible: true, datos } });
  } catch (error) {
    responderError(res, error, 'Error al consultar la cédula');
  }
};
