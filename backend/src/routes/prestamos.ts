// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Préstamos
// ============================================

import { Router } from 'express';
import {
  simularPrestamo,
  crearPrestamo,
  listarPrestamos,
  obtenerPrestamo,
  registrarAbono,
  reversarAbono,
  reporteCartera,
  prestamosPorSocio,
} from '../controllers/prestamosController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// Rutas literales antes de /:id para que no se lean como un id

/**
 * GET /api/prestamos/simular?tipo_prestamo_id=&monto_usd=&plazo_semanas=
 * Cuota y plan de pagos SIN crear nada
 */
router.get('/simular', authorize('prestamos', 'read'), simularPrestamo);

/**
 * GET /api/prestamos/reportes/cartera?vista=por_cobrar|morosos|cobrados|emitidos
 * Reemplaza los cuatro listados del sistema viejo
 */
router.get('/reportes/cartera', authorize('prestamos', 'read'), reporteCartera);

/**
 * GET /api/prestamos/socio/:socioId
 * Préstamos vigentes de un socio (lo usa la pantalla de colecta)
 */
router.get('/socio/:socioId', authorize('prestamos', 'read'), prestamosPorSocio);

/**
 * GET /api/prestamos?estado=&socio_id=&busqueda=
 */
router.get('/', authorize('prestamos', 'read'), listarPrestamos);

/**
 * POST /api/prestamos
 * Otorga el préstamo, genera el plan y bloquea el ahorro de los fiadores
 */
router.post('/', authorize('prestamos', 'create'), crearPrestamo);

/**
 * GET /api/prestamos/:id
 */
router.get('/:id', authorize('prestamos', 'read'), obtenerPrestamo);

/**
 * POST /api/prestamos/:id/abonos
 * Aplica el pago en orden mora -> interes -> capital
 */
router.post('/:id/abonos', authorize('prestamos', 'update'), registrarAbono);

/**
 * POST /api/prestamos/:id/abonos/:abonoId/reversar
 * Reversa un abono mal cargado; exige motivo. Permiso delete, como el reverso de colecta
 */
router.post('/:id/abonos/:abonoId/reversar', authorize('prestamos', 'delete'), reversarAbono);

export default router;
