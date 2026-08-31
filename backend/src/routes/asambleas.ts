// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Asambleas y asistencia de socios
// ============================================

import { Router } from 'express';
import {
  obtenerAsambleas,
  obtenerAnosConAsambleas,
  obtenerAsambleaPorId,
  crearAsamblea,
  actualizarAsamblea,
  eliminarAsamblea,
  registrarAsistencia,
  registrarAsistenciaLote,
  eliminarAsistencia,
  obtenerAsistenciaAnualDeSocio,
  obtenerReporteInasistentes,
  obtenerResumenAnual,
} from '../controllers/asambleasController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// ============================================
// CONSULTAS DE LA REGLA DE NEGOCIO
// Van antes de /:id para que 'reportes' y 'anos' no se lean como un id
// ============================================

/**
 * GET /api/asambleas/anos
 * Años que tienen asambleas registradas
 */
router.get('/anos', authorize('asambleas', 'read'), obtenerAnosConAsambleas);

/**
 * GET /api/asambleas/resumen?ano=2026
 * Resumen anual de participación
 */
router.get('/resumen', authorize('asambleas', 'read'), obtenerResumenAnual);

/**
 * GET /api/asambleas/reportes/inasistentes?ano=2026&ubicacion_id=&excluir_nuevos=
 * Socios activos que no asistieron a ninguna asamblea del año
 */
router.get('/reportes/inasistentes', authorize('asambleas', 'read'), obtenerReporteInasistentes);

/**
 * GET /api/asambleas/socios/:socioId/asistencia?ano=2026
 * ¿El socio cumplió con asistir al menos a una asamblea del año?
 */
router.get('/socios/:socioId/asistencia', authorize('asambleas', 'read'), obtenerAsistenciaAnualDeSocio);

// ============================================
// CRUD DE ASAMBLEAS
// ============================================

/**
 * GET /api/asambleas?ano=2026&tipo=&ubicacion_id=
 */
router.get('/', authorize('asambleas', 'read'), obtenerAsambleas);

/**
 * POST /api/asambleas
 */
router.post('/', authorize('asambleas', 'create'), crearAsamblea);

/**
 * GET /api/asambleas/:id
 */
router.get('/:id', authorize('asambleas', 'read'), obtenerAsambleaPorId);

/**
 * PUT /api/asambleas/:id
 */
router.put('/:id', authorize('asambleas', 'update'), actualizarAsamblea);

/**
 * DELETE /api/asambleas/:id
 */
router.delete('/:id', authorize('asambleas', 'delete'), eliminarAsamblea);

// ============================================
// ASISTENCIA
// ============================================

/**
 * POST /api/asambleas/:id/asistencias
 */
router.post('/:id/asistencias', authorize('asambleas', 'create'), registrarAsistencia);

/**
 * POST /api/asambleas/:id/asistencias/lote
 */
router.post('/:id/asistencias/lote', authorize('asambleas', 'create'), registrarAsistenciaLote);

/**
 * DELETE /api/asambleas/:id/asistencias/:socioId
 */
router.delete('/:id/asistencias/:socioId', authorize('asambleas', 'delete'), eliminarAsistencia);

export default router;
