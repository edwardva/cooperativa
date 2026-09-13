// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Pago de Salud por Feria
// ============================================

import { Router } from 'express';
import {
  obtenerConfiguracion,
  obtenerDeuda,
  listarPagos,
  obtenerPago,
  historialTrabajador,
  feriasPendientes,
  registrarPago,
  anularPago,
} from '../controllers/saludFeriaController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

/** Periodicidad, tarifa, tasa y período en curso */
router.get('/configuracion', authorize('salud_feria', 'read'), obtenerConfiguracion);

/** GET /api/salud-feria/ferias-pendientes?tipo=&anio=&numero= */
router.get('/ferias-pendientes', authorize('salud_feria', 'read'), feriasPendientes);

/** GET /api/salud-feria/ferias/:feriaId/deuda?tipo=&anio=&numero= */
router.get('/ferias/:feriaId/deuda', authorize('salud_feria', 'read'), obtenerDeuda);

router.get('/trabajadores/:id/pagos', authorize('salud_feria', 'read'), historialTrabajador);

router.get('/pagos', authorize('salud_feria', 'read'), listarPagos);
router.get('/pagos/:id', authorize('salud_feria', 'read'), obtenerPago);

/** POST /api/salud-feria/pagos — pago masivo: encabezado y un renglón por trabajador */
router.post('/pagos', authorize('salud_feria', 'create'), registrarPago);

/** POST /api/salud-feria/pagos/:id/anular — exige motivo */
router.post('/pagos/:id/anular', authorize('salud_feria', 'delete'), anularPago);

export default router;
