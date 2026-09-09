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
  reporteFunerariaSuspendidos,
  reporteSaludSuspendidos,
  reporteSaludAcuerdos,
  reporteSaludGrupos,
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

/**
 * POST /api/reportes/funeraria-suspendidos
 * Generar reporte de acuerdos de funeraria suspendidos
 * Permiso: reportes:export
 */
router.post(
  '/funeraria-suspendidos',
  authorize('reportes', 'export'),
  reporteFunerariaSuspendidos
);

/**
 * POST /api/reportes/salud-suspendidos
 * Generar reporte de acuerdos de salud suspendidos (PDF o Excel)
 * Permiso: reportes:export
 */
router.post(
  '/salud-suspendidos',
  authorize('reportes', 'export'),
  reporteSaludSuspendidos
);

/**
 * POST /api/reportes/salud-acuerdos
 * Generar reporte Excel con todos los acuerdos de salud
 * Permiso: reportes:export
 */
router.post(
  '/salud-acuerdos',
  authorize('reportes', 'export'),
  reporteSaludAcuerdos
);

/**
 * POST /api/reportes/salud-grupos
 * Generar reporte Excel de acuerdos de salud agrupados por tipo (activos,
 * suspendidos, próximos a suspender)
 * Permiso: reportes:export
 */
router.post(
  '/salud-grupos',
  authorize('reportes', 'export'),
  reporteSaludGrupos
);

export default router;
