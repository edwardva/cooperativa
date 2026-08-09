/**
 * ============================================
 * ROUTES: FUNERARIA
 * ============================================
 * Rutas para gestión de acuerdos de funeraria
 */

import { Router } from 'express';
import {
  listarTiposAcuerdo,
  listarAcuerdos,
  obtenerEstadisticas,
  obtenerAcuerdosPorSocio,
  listarSuspendidosParaImpresion,
  obtenerAcuerdo,
  crearAcuerdo,
  actualizarAcuerdo,
  eliminarAcuerdo,
  cambiarEstado,
  verificarSuspensionesAutomaticas,
} from '../controllers/funerariaController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// RUTAS DE ACUERDOS DE FUNERARIA
// ============================================

/**
 * GET /api/funeraria/tipos-acuerdo
 * Listar tipos de acuerdo activos (catálogo)
 */
router.get('/tipos-acuerdo', authorize('funeraria', 'read'), listarTiposAcuerdo);

/**
 * GET /api/funeraria/estadisticas
 * Obtener estadísticas generales
 */
router.get('/estadisticas', authorize('funeraria', 'read'), obtenerEstadisticas);

/**
 * GET /api/funeraria/acuerdos
 * Listar todos los acuerdos con filtros
 */
router.get('/acuerdos', authorize('funeraria', 'read'), listarAcuerdos);

/**
 * GET /api/funeraria/acuerdos/socio/:socioId
 * Obtener acuerdos de un socio específico
 */
router.get('/acuerdos/socio/:socioId', authorize('funeraria', 'read'), obtenerAcuerdosPorSocio);

/**
 * GET /api/funeraria/acuerdos/suspendidos/listado
 * Listado completo (sin paginar) de acuerdos suspendidos, para imprimir
 */
router.get(
  '/acuerdos/suspendidos/listado',
  authorize('funeraria', 'read'),
  listarSuspendidosParaImpresion
);

/**
 * GET /api/funeraria/acuerdos/:id
 * Obtener detalle de un acuerdo
 */
router.get('/acuerdos/:id', authorize('funeraria', 'read'), obtenerAcuerdo);

/**
 * POST /api/funeraria/acuerdos
 * Crear nuevo acuerdo de funeraria
 */
router.post('/acuerdos', authorize('funeraria', 'create'), crearAcuerdo);

/**
 * PUT /api/funeraria/acuerdos/:id
 * Actualizar datos de un acuerdo (tipo, número de acuerdo/contrato, fecha de inicio)
 */
router.put('/acuerdos/:id', authorize('funeraria', 'update'), actualizarAcuerdo);

/**
 * DELETE /api/funeraria/acuerdos/:id
 * Eliminar un acuerdo sin movimientos registrados
 */
router.delete('/acuerdos/:id', authorize('funeraria', 'delete'), eliminarAcuerdo);

/**
 * PATCH /api/funeraria/acuerdos/:id/estado
 * Cambiar estado de un acuerdo (suspender/reactivar/retirar)
 */
router.patch('/acuerdos/:id/estado', authorize('funeraria', 'update'), cambiarEstado);

/**
 * POST /api/funeraria/verificar-suspensiones
 * Job para verificar y suspender automáticamente acuerdos con 6+ semanas
 * Uso: Ejecutar nocturnamente via cron/scheduler
 */
router.post(
  '/verificar-suspensiones',
  authorize('funeraria', 'update'),
  verificarSuspensionesAutomaticas
);

export default router;
