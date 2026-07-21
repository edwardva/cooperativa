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

const router = Router();

// ============================================
// RUTAS DE CUENTAS DE AHORRO
// ============================================

/**
 * GET /api/ahorro/cuentas
 * Listar todas las cuentas con filtros
 */
router.get('/cuentas', authenticate, listarCuentas);

/**
 * GET /api/ahorro/cuentas/socio/:socioId
 * Obtener cuentas de un socio específico
 */
router.get('/cuentas/socio/:socioId', authenticate, obtenerCuentasPorSocio);

/**
 * GET /api/ahorro/cuentas/:id
 * Obtener detalle de una cuenta
 */
router.get('/cuentas/:id', authenticate, obtenerCuenta);

/**
 * POST /api/ahorro/cuentas/apertura
 * Apertura de nueva cuenta
 */
router.post('/cuentas/apertura', authenticate, aperturaCuenta);

/**
 * PUT /api/ahorro/cuentas/:id/estado
 * Activar/desactivar cuenta
 */
router.put('/cuentas/:id/estado', authenticate, cambiarEstadoCuenta);

// ============================================
// RUTAS DE MOVIMIENTOS
// ============================================

/**
 * POST /api/ahorro/movimientos
 * Registrar depósito o retiro
 */
router.post('/movimientos', authenticate, registrarMovimiento);

/**
 * GET /api/ahorro/movimientos
 * Consultar movimientos con filtros
 */
router.get('/movimientos', authenticate, consultarMovimientos);

// ============================================
// RUTAS DE ESTADÍSTICAS Y UTILIDADES
// ============================================

/**
 * GET /api/ahorro/estadisticas
 * Obtener estadísticas generales de ahorro
 */
router.get('/estadisticas', authenticate, obtenerEstadisticas);

/**
 * GET /api/ahorro/estadisticas/por-feria
 * Obtener estadísticas de ahorro agrupadas por feria/ubicación
 */
router.get('/estadisticas/por-feria', authenticate, obtenerEstadisticasPorFeria);

/**
 * GET /api/ahorro/estadisticas/resumen-ferias
 * Obtener resumen simplificado por ferias
 */
router.get('/estadisticas/resumen-ferias', authenticate, obtenerResumenPorFeria);

/**
 * POST /api/ahorro/recalcular-saldos
 * Recalcular todos los saldos en Bs con tasa actual
 */
router.post('/recalcular-saldos', authenticate, recalcularSaldos);

export default router;
