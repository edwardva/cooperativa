/**
 * ============================================
 * ROUTES: REPORTES
 * ============================================
 * Rutas para generación de reportes
 */

import { Router } from 'express';
import {
  reporteFunerariaSuspendidos,
  reporteSaludSuspendidos,
  reporteSaludAcuerdos,
  reporteSaludGrupos,
} from '../controllers/reportesController';
import { catalogoReportes, exportarReporte, verReporte } from '../controllers/reportesFase2Controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

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

/**
 * Reportes de fase 2 (RF-REP-01 a 08): la misma tabla se ve en pantalla y se
 * exporta, así los totales coinciden.
 *   GET /api/reportes/catalogo
 *   GET /api/reportes/generar/:reporte?...                   Permiso: reportes:read
 *   GET /api/reportes/exportar/:reporte?formato=excel|pdf... Permiso: reportes:export
 */
router.get('/catalogo', authorize('reportes', 'read'), catalogoReportes);
router.get('/generar/:reporte', authorize('reportes', 'read'), verReporte);
router.get('/exportar/:reporte', authorize('reportes', 'export'), exportarReporte);

export default router;
