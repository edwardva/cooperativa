// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Morosidad del socio
// ============================================

import { Router } from 'express';
import { revisarMorosidadSocios } from '../controllers/morosidadController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

/**
 * POST /api/morosidad/revisar
 * Simula por defecto; con { aplicar: true } suspende, reactiva y deja historial
 */
router.post('/revisar', authorize('socios', 'update'), revisarMorosidadSocios);

export default router;
