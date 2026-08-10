import { Router } from 'express';
import {
  obtenerEstadisticasDashboard,
  obtenerActividadReciente,
} from '../controllers/dashboardController';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// RUTAS - DASHBOARD
// ============================================

/**
 * GET /api/dashboard/estadisticas
 * Obtener estadísticas generales del dashboard
 * Acceso: Todos los usuarios autenticados
 */
router.get('/estadisticas', obtenerEstadisticasDashboard);

/**
 * GET /api/dashboard/actividad-reciente
 * Obtener actividad reciente del sistema
 * Acceso: Todos los usuarios autenticados
 */
router.get('/actividad-reciente', obtenerActividadReciente);

export default router;
