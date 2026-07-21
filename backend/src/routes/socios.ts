import { Router } from 'express';
import {
  obtenerSocios,
  obtenerSocioPorId,
  buscarSocioPorCedula,
  crearSocio,
  actualizarSocio,
  eliminarSocio,
  retirarSocio,
  obtenerBeneficiarios,
  agregarBeneficiario,
  actualizarBeneficiario,
  eliminarBeneficiario,
  obtenerEstadisticasSocios,
} from '../controllers/sociosController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// RUTAS - SOCIOS
// ============================================

/**
 * GET /api/socios
 * Obtener todos los socios con paginación y búsqueda
 * Query params: page, limit, search, estado, ubicacion_id
 * Permisos: socios:read
 */
router.get(
  '/',
  authorize('socios', 'read'),
  obtenerSocios
);

/**
 * GET /api/socios/estadisticas
 * Obtener estadísticas generales de socios
 * Permisos: socios:read
 */
router.get(
  '/estadisticas',
  authorize('socios', 'read'),
  obtenerEstadisticasSocios
);

/**
 * GET /api/socios/buscar/:cedula
 * Buscar socio rápido por cédula (para Colecta)
 * Permisos: socios:read
 */
router.get(
  '/buscar/:cedula',
  authorize('socios', 'read'),
  buscarSocioPorCedula
);

/**
 * GET /api/socios/:id
 * Obtener un socio por ID con sus relaciones
 * Permisos: socios:read
 */
router.get(
  '/:id',
  authorize('socios', 'read'),
  obtenerSocioPorId
);

/**
 * POST /api/socios
 * Crear un nuevo socio
 * Permisos: socios:create
 */
router.post(
  '/',
  authorize('socios', 'create'),
  crearSocio
);

/**
 * PUT /api/socios/:id
 * Actualizar un socio
 * Permisos: socios:update
 */
router.put(
  '/:id',
  authorize('socios', 'update'),
  actualizarSocio
);

/**
 * DELETE /api/socios/:id
 * Eliminar un socio (soft delete, cambio de estado a 'retirado')
 * Permisos: socios:delete
 */
router.delete(
  '/:id',
  authorize('socios', 'delete'),
  eliminarSocio
);

/**
 * POST /api/socios/:id/retiro
 * Registrar retiro de un socio con fecha y motivo
 */
router.post(
  '/:id/retiro',
  authorize('socios', 'update'),
  retirarSocio
);

// ============================================
// RUTAS - BENEFICIARIOS
// ============================================

/**
 * GET /api/socios/:socioId/beneficiarios
 * Obtener beneficiarios de un socio
 * Permisos: socios:read
 */
router.get(
  '/:socioId/beneficiarios',
  authorize('socios', 'read'),
  obtenerBeneficiarios
);

/**
 * POST /api/socios/:socioId/beneficiarios
 * Agregar beneficiario a un socio (máximo 9)
 * Permisos: socios:create
 */
router.post(
  '/:socioId/beneficiarios',
  authorize('socios', 'create'),
  agregarBeneficiario
);

/**
 * PUT /api/socios/:socioId/beneficiarios/:beneficiarioId
 * Actualizar beneficiario
 * Permisos: socios:update
 */
router.put(
  '/:socioId/beneficiarios/:beneficiarioId',
  authorize('socios', 'update'),
  actualizarBeneficiario
);

/**
 * DELETE /api/socios/:socioId/beneficiarios/:beneficiarioId
 * Eliminar beneficiario (soft delete)
 * Permisos: socios:delete
 */
router.delete(
  '/:socioId/beneficiarios/:beneficiarioId',
  authorize('socios', 'delete'),
  eliminarBeneficiario
);

export default router;
