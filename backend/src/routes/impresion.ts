// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Motor de Impresión
// ============================================

import { Router } from 'express';
import {
  imprimirTicketColecta,
  imprimirNotaOperacion,
  imprimirCarnetSocio,
  imprimirFichaAcuerdoFuneraria,
  imprimirFichaAcuerdoSalud,
  obtenerFormatosDisponibles,
  generarVistaPrevia
} from '../controllers/impresionController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// RUTAS
// ============================================

/**
 * GET /api/impresion/formatos
 * Obtener formatos de impresión disponibles
 */
router.get(
  '/formatos',
  authorize('impresion', 'read'),
  obtenerFormatosDisponibles
);

/**
 * POST /api/impresion/preview
 * Generar vista previa de documento sin registrar
 */
router.post(
  '/preview',
  authorize('impresion', 'read'),
  generarVistaPrevia
);

/**
 * POST /api/impresion/ticket-colecta
 * Imprimir ticket de colecta
 */
router.post(
  '/ticket-colecta',
  authorize('impresion', 'create'),
  imprimirTicketColecta
);

/**
 * POST /api/impresion/nota-operacion
 * Imprimir nota de operación
 */
router.post(
  '/nota-operacion',
  authorize('impresion', 'create'),
  imprimirNotaOperacion
);

/**
 * POST /api/impresion/carnet-socio
 * Imprimir carnet de socio
 */
router.post(
  '/carnet-socio',
  authorize('impresion', 'create'),
  imprimirCarnetSocio
);

/**
 * POST /api/impresion/ficha-acuerdo-funeraria
 * Imprimir ficha de acuerdo de funeraria (socio + beneficiarios)
 */
router.post(
  '/ficha-acuerdo-funeraria',
  authorize('impresion', 'create'),
  imprimirFichaAcuerdoFuneraria
);

/**
 * POST /api/impresion/ficha-acuerdo-salud
 * Imprimir ficha de acuerdo de salud (titular + beneficiarios del grupo)
 */
router.post(
  '/ficha-acuerdo-salud',
  authorize('impresion', 'create'),
  imprimirFichaAcuerdoSalud
);

export default router;
