// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Personas
// ============================================

import { Router } from 'express';
import {
  listarPersonas,
  buscarPorIdentificacion,
  obtenerPersona,
  crearPersona,
  actualizarPersona,
} from '../controllers/personasController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

/** GET /api/personas?busqueda=&page=&limit= */
router.get('/', authorize('personas', 'read'), listarPersonas);

/**
 * GET /api/personas/identificacion/:numero?tipo=V
 * ¿Ya existe? Lo consulta todo formulario de alta antes de crear a nadie
 */
router.get('/identificacion/:numero', authorize('personas', 'read'), buscarPorIdentificacion);

/** GET /api/personas/:id — con sus expedientes de ahorrista y de trabajador */
router.get('/:id', authorize('personas', 'read'), obtenerPersona);

router.post('/', authorize('personas', 'create'), crearPersona);

/** PUT /api/personas/:id — copia los datos personales a sus expedientes ahorristas */
router.put('/:id', authorize('personas', 'update'), actualizarPersona);

export default router;
