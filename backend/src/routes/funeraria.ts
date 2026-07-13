/**
 * ============================================
 * ROUTES: FUNERARIA
 * ============================================
 * Rutas para gestión de acuerdos de funeraria
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
} from '../controllers/funerariaController';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// ============================================
// RUTAS DE ACUERDOS DE FUNERARIA
// ============================================

/**
 * GET /api/funeraria/estadisticas
 * Obtener estadísticas generales
 */
router.get('/estadisticas', authenticate, obtenerEstadisticas);

/**
 * GET /api/funeraria/acuerdos
 * Listar todos los acuerdos con filtros
 */
router.get('/acuerdos', authenticate, listarAcuerdos);

/**
 * GET /api/funeraria/acuerdos/socio/:socioId
 * Obtener acuerdos de un socio específico
 */
router.get('/acuerdos/socio/:socioId', authenticate, obtenerAcuerdosPorSocio);

/**
 * GET /api/funeraria/acuerdos/:id
 * Obtener detalle de un acuerdo
 */
router.get('/acuerdos/:id', authenticate, obtenerAcuerdo);

/**
 * POST /api/funeraria/acuerdos
 * Crear nuevo acuerdo de funeraria
 */
router.post('/acuerdos', authenticate, crearAcuerdo);

/**
 * PATCH /api/funeraria/acuerdos/:id/estado
 * Cambiar estado de un acuerdo (suspender/reactivar/retirar)
 */
router.patch('/acuerdos/:id/estado', authenticate, cambiarEstado);

/**
 * POST /api/funeraria/verificar-suspensiones
 * Job para verificar y suspender automáticamente acuerdos con 6+ semanas
 * Uso: Ejecutar nocturnamente via cron/scheduler
 */
router.post('/verificar-suspensiones', authenticate, verificarSuspensionesAutomaticas);

export default router;
