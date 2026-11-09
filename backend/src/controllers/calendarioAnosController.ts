// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLADOR
// Cierre de año del calendario de colecta (52 o 53 semanas)
// ============================================

import type { Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../middleware/errorHandler';
import { confirmarCierreAno, estadoCierreAno } from '../services/calendarioAnosService';
import { largosDeAnoVigentes, semanaActual } from '../utils/calendarioSemanal';
import { responderError } from '../utils/responderError';

const anoDe = (req: Request): number => {
  if (req.params.ano === undefined) return semanaActual().ano;
  const ano = Number(req.params.ano);
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) throw new BadRequestError('Año inválido');
  return ano;
};

/** GET /api/semanas-colecta/cierre-ano[/:ano] — sin año, el del calendario en curso */
export const obtenerCierreAno = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await estadoCierreAno(anoDe(req)) });
  } catch (error) {
    responderError(res, error, 'Error al consultar el cierre del año');
  }
};

const confirmarSchema = z.object({
  semanas: z.union([z.literal(52), z.literal(53)]),
  observaciones: z.string().trim().max(500).optional().nullable(),
});

/** PUT /api/semanas-colecta/cierre-ano/:ano — lo que avisó la funeraria */
export const confirmarCierre = async (req: Request, res: Response): Promise<void> => {
  try {
    const datos = confirmarSchema.safeParse(req.body);
    if (!datos.success) throw new BadRequestError('Indique si el año cierra en 52 o en 53 semanas');
    const resultado = await confirmarCierreAno(
      anoDe(req),
      datos.data.semanas,
      datos.data.observaciones || null,
      req
    );
    res.json({ success: true, data: resultado });
  } catch (error) {
    responderError(res, error, 'Error al confirmar el cierre del año');
  }
};

/** GET /api/semanas-colecta/anos — años confirmados, para que el frontend arme el mismo calendario */
export const listarAnosConfirmados = (_req: Request, res: Response): void => {
  const anos = [...largosDeAnoVigentes().entries()].map(([ano, semanas]) => ({ ano, semanas }));
  res.json({ success: true, data: anos });
};
