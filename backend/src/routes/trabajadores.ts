// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Socios trabajadores
// ============================================

import { Router } from 'express';
import {
  listarTrabajadores,
  obtenerTrabajador,
  crearTrabajador,
  actualizarTrabajador,
  trasladarTrabajador,
  retirarTrabajador,
} from '../controllers/trabajadoresController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

/** GET /api/trabajadores?feria_id=&estado=&busqueda=&ingreso_desde=&ingreso_hasta= */
router.get('/', authorize('trabajadores', 'read'), listarTrabajadores);

router.get('/:id', authorize('trabajadores', 'read'), obtenerTrabajador);

/** POST /api/trabajadores — reutiliza la persona si la identificación ya existe */
router.post('/', authorize('trabajadores', 'create'), crearTrabajador);

router.put('/:id', authorize('trabajadores', 'update'), actualizarTrabajador);

/** POST /api/trabajadores/:id/traslado-feria — cierra la feria actual y abre la nueva */
router.post('/:id/traslado-feria', authorize('trabajadores', 'update'), trasladarTrabajador);

/** POST /api/trabajadores/:id/retiro — cierra la feria y retira el expediente */
router.post('/:id/retiro', authorize('trabajadores', 'update'), retirarTrabajador);

export default router;
