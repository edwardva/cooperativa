// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Morosidad del socio
// ============================================

import { Router } from 'express';
import { revisarMorosidadSocios, reactivarSocio, historialMorosidad } from '../controllers/morosidadController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

/**
 * POST /api/morosidad/revisar
 * Simula por defecto; con { aplicar: true } suspende, reactiva y deja historial
 */
router.post('/revisar', authorize('socios', 'update'), revisarMorosidadSocios);

/**
 * POST /api/morosidad/reactivar
 * Levanta a mano la suspensión de un socio, con motivo
 */
router.post('/reactivar', authorize('socios', 'reactivar'), reactivarSocio);

/**
 * GET /api/morosidad/historial
 * Suspensiones, reactivaciones y retiros, con quién los hizo
 */
router.get('/historial', authorize('socios', 'read'), historialMorosidad);

export default router;
