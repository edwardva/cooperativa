/**
 * ============================================
 * ROUTES: TIPOS DE CUENTA DE AHORRO
 * ============================================
 * Rutas para la gestión de tipos de cuenta de ahorro
 */

import { Router } from 'express';
import {
  obtenerTiposCuenta,
  obtenerTiposCuentaActivos,
  obtenerTipoCuentaPorId,
  crearTipoCuenta,
  actualizarTipoCuenta,
  eliminarTipoCuenta,
} from '../controllers/tiposCuentaController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/tipos-cuenta
 * Listar todos los tipos de cuenta
 * Permiso: tipos_cuenta:read
 */
router.get('/', authorize('tipos_cuenta', 'read'), obtenerTiposCuenta);

/**
 * GET /api/tipos-cuenta/activos
 * Listar tipos de cuenta activos
 * Permiso: tipos_cuenta:read
 */
router.get('/activos', authorize('tipos_cuenta', 'read'), obtenerTiposCuentaActivos);

/**
 * GET /api/tipos-cuenta/:id
 * Obtener tipo de cuenta por ID
 * Permiso: tipos_cuenta:read
 */
router.get('/:id', authorize('tipos_cuenta', 'read'), obtenerTipoCuentaPorId);

/**
 * POST /api/tipos-cuenta
 * Crear nuevo tipo de cuenta
 * Permiso: tipos_cuenta:create
 */
router.post('/', authorize('tipos_cuenta', 'create'), crearTipoCuenta);

/**
 * PUT /api/tipos-cuenta/:id
 * Actualizar tipo de cuenta existente
 * Permiso: tipos_cuenta:update
 */
router.put('/:id', authorize('tipos_cuenta', 'update'), actualizarTipoCuenta);

/**
 * DELETE /api/tipos-cuenta/:id
 * Desactivar tipo de cuenta
 * Permiso: tipos_cuenta:delete
 */
router.delete('/:id', authorize('tipos_cuenta', 'delete'), eliminarTipoCuenta);

export default router;
