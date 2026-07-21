/**
 * ============================================
 * ROUTES: SALUD
 * ============================================
 * Rutas para gestión de acuerdos de salud
 */

import { Router } from 'express';
import {
  listarAcuerdos,
  obtenerEstadisticas,
  obtenerAcuerdosPorSocio,
  obtenerAcuerdo,
  crearAcuerdo,
  cambiarEstado,
  verificarSuspensionesAutomaticas,
} from '../controllers/saludController';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// ============================================
// RUTAS DE ACUERDOS DE SALUD
// ============================================

/**
 * GET /api/salud/estadisticas
 * Obtener estadísticas generales
 */
router.get('/estadisticas', authenticate, obtenerEstadisticas);

/**
 * GET /api/salud/acuerdos
 * Listar todos los acuerdos con filtros
 */
router.get('/acuerdos', authenticate, listarAcuerdos);

/**
 * GET /api/salud/acuerdos/socio/:socioId
 * Obtener acuerdos de un socio específico
 */
router.get('/acuerdos/socio/:socioId', authenticate, obtenerAcuerdosPorSocio);

/**
 * GET /api/salud/acuerdos/:id
 * Obtener detalle de un acuerdo
 */
router.get('/acuerdos/:id', authenticate, obtenerAcuerdo);

/**
 * POST /api/salud/acuerdos
 * Crear nuevo acuerdo de salud
 */
router.post('/acuerdos', authenticate, crearAcuerdo);

/**
 * PATCH /api/salud/acuerdos/:id/estado
 * Cambiar estado de un acuerdo (suspender/reactivar/retirar)
 */
router.patch('/acuerdos/:id/estado', authenticate, cambiarEstado);

/**
 * POST /api/salud/verificar-suspensiones
 * Job para verificar y suspender automáticamente acuerdos con 11+ semanas
 * Uso: Ejecutar nocturnamente via cron/scheduler
 */
router.post('/verificar-suspensiones', authenticate, verificarSuspensionesAutomaticas);

export default router;
