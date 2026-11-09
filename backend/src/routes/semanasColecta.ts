// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Semanas de Colecta (Gestión Tasa Semanal)
// ============================================

import { Router } from 'express';
import {
  obtenerSemanasColecta,
  obtenerSemanasActivas,
  obtenerSemanaColectaPorId,
  obtenerSemanaActual,
  crearSemanaColecta,
  actualizarSemanaColecta,
  eliminarSemanaColecta,
} from '../controllers/semanasColectaController';
import { authenticate } from '../middleware/authenticate';
import { confirmarCierre, listarAnosConfirmados, obtenerCierreAno } from '../controllers/calendarioAnosController';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// RUTAS
// ============================================

/**
 * GET /api/semanas-colecta
 * Obtener todas las semanas de colecta
 */
router.get(
  '/',
  authorize('semanas_colecta', 'read'),
  obtenerSemanasColecta
);

/**
 * GET /api/semanas-colecta/activas
 * Obtener semanas de colecta activas
 */
router.get(
  '/activas',
  authorize('semanas_colecta', 'read'),
  obtenerSemanasActivas
);

/**
 * GET /api/semanas-colecta/actual
 * Obtener la semana de colecta actual (basada en fecha actual)
 */
router.get(
  '/actual',
  authorize('semanas_colecta', 'read'),
  obtenerSemanaActual
);

/**
 * GET /api/semanas-colecta/cierre-ano[/:ano]
 * Con cuántas semanas cierra el año (52 o 53) y si falta confirmarlo con la
 * funeraria. Lo leen también los cajeros: de ahí sale el aviso de diciembre.
 */
router.get('/anos', authorize('semanas_colecta', 'read'), listarAnosConfirmados);
router.get('/cierre-ano', authorize('semanas_colecta', 'read'), obtenerCierreAno);
router.get('/cierre-ano/:ano', authorize('semanas_colecta', 'read'), obtenerCierreAno);

/**
 * PUT /api/semanas-colecta/cierre-ano/:ano
 * Confirma lo que avisó la funeraria. Si cambia el largo, re-rotula lo guardado.
 */
router.put('/cierre-ano/:ano', authorize('semanas_colecta', 'update'), confirmarCierre);

/**
 * GET /api/semanas-colecta/:id
 * Obtener semana de colecta por ID
 */
router.get(
  '/:id',
  authorize('semanas_colecta', 'read'),
  obtenerSemanaColectaPorId
);

/**
 * POST /api/semanas-colecta
 * Crear nueva semana de colecta
 */
router.post(
  '/',
  authorize('semanas_colecta', 'create'),
  crearSemanaColecta
);

/**
 * PUT /api/semanas-colecta/:id
 * Actualizar semana de colecta existente
 */
router.put(
  '/:id',
  authorize('semanas_colecta', 'update'),
  actualizarSemanaColecta
);

/**
 * DELETE /api/semanas-colecta/:id
 * Eliminar (soft delete) semana de colecta
 */
router.delete(
  '/:id',
  authorize('semanas_colecta', 'delete'),
  eliminarSemanaColecta
);

export default router;
