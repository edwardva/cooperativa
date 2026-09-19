/**
 * ============================================
 * ROUTES: AHORRO
 * ============================================
 * Rutas para gestión de cuentas de ahorro y movimientos
 */

import { Router } from 'express';
import {
  // Cuentas
  listarCuentas,
  obtenerCuentasPorSocio,
  obtenerCuenta,
  listarTiposCuenta,
  listarTodosTiposCuenta,
  aperturaCuenta,
  cambiarEstadoCuenta,
  
  // Movimientos
  registrarMovimiento,
  consultarMovimientos,
  
  // Estadísticas y utilidades
  obtenerEstadisticas,
  obtenerEstadisticasPorFeria,
  obtenerResumenPorFeria,
  recalcularSaldos,
} from '../controllers/ahorroController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// ============================================
// RUTAS DE CUENTAS DE AHORRO
// ============================================

/**
 * GET /api/ahorro/tipos-cuenta
 * Listar tipos de cuenta activos
 */
router.get('/tipos-cuenta', authenticate, authorize('ahorro', 'read'), listarTiposCuenta);

/**
 * GET /api/ahorro/tipos-cuenta/todos
 * Listar TODOS los tipos de cuenta (incluyendo inactivos) con conteo
 */
router.get('/tipos-cuenta/todos', authenticate, authorize('ahorro', 'read'), listarTodosTiposCuenta);

/**
 * GET /api/ahorro/cuentas
 * Listar todas las cuentas con filtros
 */
router.get('/cuentas', authenticate, authorize('ahorro', 'read'), listarCuentas);

/**
 * GET /api/ahorro/cuentas/socio/:socioId
 * Obtener cuentas de un socio específico
 */
router.get('/cuentas/socio/:socioId', authenticate, authorize('ahorro', 'read'), obtenerCuentasPorSocio);

/**
 * GET /api/ahorro/cuentas/:id
 * Obtener detalle de una cuenta
 */
router.get('/cuentas/:id', authenticate, authorize('ahorro', 'read'), obtenerCuenta);

/**
 * POST /api/ahorro/cuentas/apertura
 * Apertura de nueva cuenta
 */
router.post('/cuentas/apertura', authenticate, authorize('ahorro', 'create'), aperturaCuenta);

/**
 * PUT /api/ahorro/cuentas/:id/estado
 * Activar/desactivar cuenta
 */
router.put('/cuentas/:id/estado', authenticate, authorize('ahorro', 'update'), cambiarEstadoCuenta);

// ============================================
// RUTAS DE MOVIMIENTOS
// ============================================

/**
 * POST /api/ahorro/movimientos
 * Registrar depósito o retiro
 */
router.post('/movimientos', authenticate, authorize('ahorro', 'create'), registrarMovimiento);

/**
 * GET /api/ahorro/movimientos
 * Consultar movimientos con filtros
 */
router.get('/movimientos', authenticate, authorize('ahorro', 'read'), consultarMovimientos);

// ============================================
// RUTAS DE ESTADÍSTICAS Y UTILIDADES
// ============================================

/**
 * GET /api/ahorro/estadisticas
 * Obtener estadísticas generales de ahorro
 */
router.get('/estadisticas', authenticate, authorize('ahorro', 'read'), obtenerEstadisticas);

/**
 * GET /api/ahorro/estadisticas/por-feria
 * Obtener estadísticas de ahorro agrupadas por feria/ubicación
 */
router.get('/estadisticas/por-feria', authenticate, authorize('ahorro', 'read'), obtenerEstadisticasPorFeria);

/**
 * GET /api/ahorro/estadisticas/resumen-ferias
 * Obtener resumen simplificado por ferias
 */
router.get('/estadisticas/resumen-ferias', authenticate, authorize('ahorro', 'read'), obtenerResumenPorFeria);

/**
 * POST /api/ahorro/recalcular-saldos
 * Recalcular todos los saldos en Bs con tasa actual
 */
router.post('/recalcular-saldos', authenticate, authorize('ahorro', 'update'), recalcularSaldos);

export default router;
