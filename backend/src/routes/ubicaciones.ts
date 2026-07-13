/**
 * ============================================
 * ROUTES: UBICACIONES/SUCURSALES
 * ============================================
 * Rutas para la gestión de ubicaciones y sucursales
 */

import { Router } from 'express';
import {
  obtenerUbicaciones,
  obtenerUbicacionesActivas,
  obtenerUbicacionPorId,
  crearUbicacion,
  actualizarUbicacion,
  eliminarUbicacion,
} from '../controllers/ubicacionesController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/ubicaciones
 * Listar todas las ubicaciones
 * Permiso: ubicaciones:read
 */
router.get('/', authorize('ubicaciones', 'read'), obtenerUbicaciones);

/**
 * GET /api/ubicaciones/activas
 * Listar ubicaciones activas
 * Permiso: ubicaciones:read
 */
router.get('/activas', authorize('ubicaciones', 'read'), obtenerUbicacionesActivas);

/**
 * GET /api/ubicaciones/:id
 * Obtener ubicación por ID
 * Permiso: ubicaciones:read
 */
router.get('/:id', authorize('ubicaciones', 'read'), obtenerUbicacionPorId);

/**
 * POST /api/ubicaciones
 * Crear nueva ubicación
 * Permiso: ubicaciones:create
 */
router.post('/', authorize('ubicaciones', 'create'), crearUbicacion);

/**
 * PUT /api/ubicaciones/:id
 * Actualizar ubicación existente
 * Permiso: ubicaciones:update
 */
router.put('/:id', authorize('ubicaciones', 'update'), actualizarUbicacion);

/**
 * DELETE /api/ubicaciones/:id
 * Desactivar ubicación
 * Permiso: ubicaciones:delete
 */
router.delete('/:id', authorize('ubicaciones', 'delete'), eliminarUbicacion);

export default router;
