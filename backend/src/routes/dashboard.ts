import { Router } from 'express';
import {
  obtenerEstadisticasDashboard,
  obtenerActividadReciente,
  obtenerIndicadores,
} from '../controllers/dashboardController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

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
 * GET /api/dashboard/indicadores?meses=12
 * Series del tablero: socios, ahorro, colecta, préstamos y atraso
 */
router.get('/indicadores', authorize('dashboard', 'read'), obtenerIndicadores);

/**
 * GET /api/dashboard/actividad-reciente
 * Obtener actividad reciente del sistema
 * Acceso: Todos los usuarios autenticados
 */
router.get('/actividad-reciente', obtenerActividadReciente);

export default router;
