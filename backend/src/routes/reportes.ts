/**
 * ============================================
 * ROUTES: REPORTES
 * ============================================
 * Rutas para generación de reportes
 */

import { Router } from 'express';
import {
  reporteSocios,
  reportePrestamos,
  listarTiposReportes,
} from '../controllers/reportesController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/reportes/tipos
 * Listar tipos de reportes disponibles
 * Permiso: reportes:read
 */
router.get('/tipos', authorize('reportes', 'read'), listarTiposReportes);

/**
 * POST /api/reportes/socios
 * Generar reporte de socios
 * Permiso: reportes:generate
 */
router.post('/socios', authorize('reportes', 'generate'), reporteSocios);

/**
 * POST /api/reportes/prestamos
 * Generar reporte de préstamos
 * Permiso: reportes:generate
 */
router.post('/prestamos', authorize('reportes', 'generate'), reportePrestamos);

export default router;
