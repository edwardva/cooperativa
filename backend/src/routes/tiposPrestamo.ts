/**
 * ============================================
 * ROUTES: TIPOS DE PRÉSTAMO
 * ============================================
 * Rutas para la gestión de tipos de préstamo
 */

import { Router } from 'express';
import {
  obtenerTiposPrestamo,
  obtenerTiposPrestamoActivos,
  obtenerTipoPrestamoPorId,
  crearTipoPrestamo,
  actualizarTipoPrestamo,
  eliminarTipoPrestamo,
} from '../controllers/tiposPrestamoController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/tipos-prestamo
 * Listar todos los tipos de préstamo
 * Permiso: tipos_prestamo:read
 */
router.get('/', authorize('tipos_prestamo', 'read'), obtenerTiposPrestamo);

/**
 * GET /api/tipos-prestamo/activos
 * Listar tipos de préstamo activos
 * Permiso: tipos_prestamo:read
 */
router.get('/activos', authorize('tipos_prestamo', 'read'), obtenerTiposPrestamoActivos);

/**
 * GET /api/tipos-prestamo/:id
 * Obtener tipo de préstamo por ID
 * Permiso: tipos_prestamo:read
 */
router.get('/:id', authorize('tipos_prestamo', 'read'), obtenerTipoPrestamoPorId);

/**
 * POST /api/tipos-prestamo
 * Crear nuevo tipo de préstamo
 * Permiso: tipos_prestamo:create
 */
router.post('/', authorize('tipos_prestamo', 'create'), crearTipoPrestamo);

/**
 * PUT /api/tipos-prestamo/:id
 * Actualizar tipo de préstamo existente
 * Permiso: tipos_prestamo:update
 */
router.put('/:id', authorize('tipos_prestamo', 'update'), actualizarTipoPrestamo);

/**
 * DELETE /api/tipos-prestamo/:id
 * Desactivar tipo de préstamo
 * Permiso: tipos_prestamo:delete
 */
router.delete('/:id', authorize('tipos_prestamo', 'delete'), eliminarTipoPrestamo);

export default router;
