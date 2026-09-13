// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Auditoría (sólo lectura, sólo administradores)
// ============================================

import { Router } from 'express';
import { listarAuditoria, opcionesAuditoria } from '../controllers/auditoriaController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

router.get('/opciones', authorize('auditoria', 'read'), opcionesAuditoria);
router.get('/', authorize('auditoria', 'read'), listarAuditoria);

export default router;
