/**
 * ============================================
 * ROUTES: PARÁMETROS DEL SISTEMA
 * ============================================
 * Rutas para la gestión de parámetros operativos
 */

import { Router } from 'express';
import {
  obtenerParametros,
  obtenerParametroPorId,
  obtenerParametroPorClave,
  crearParametro,
  actualizarParametro,
  eliminarParametro,
} from '../controllers/parametrosController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/parametros
 * Listar todos los parámetros
 * Permiso: parametros:read
 */
router.get('/', authorize('parametros', 'read'), obtenerParametros);

/**
 * GET /api/parametros/clave/:clave
 * Obtener parámetro por clave
 * Permiso: parametros:read
 */
router.get('/clave/:clave', authorize('parametros', 'read'), obtenerParametroPorClave);

/**
 * GET /api/parametros/:id
 * Obtener parámetro por ID
 * Permiso: parametros:read
 */
router.get('/:id', authorize('parametros', 'read'), obtenerParametroPorId);

/**
 * POST /api/parametros
 * Crear nuevo parámetro
 * Permiso: parametros:create
 */
router.post('/', authorize('parametros', 'create'), crearParametro);

/**
 * PUT /api/parametros/:id
 * Actualizar parámetro existente
 * Permiso: parametros:update
 */
router.put('/:id', authorize('parametros', 'update'), actualizarParametro);

/**
 * DELETE /api/parametros/:id
 * Eliminar parámetro
 * Permiso: parametros:delete
 */
router.delete('/:id', authorize('parametros', 'delete'), eliminarParametro);

export default router;
