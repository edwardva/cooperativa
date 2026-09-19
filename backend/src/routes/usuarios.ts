// ============================================
// COOPERATIVA EL TRIUNFO - RUTAS
// Usuarios del sistema
// ============================================

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  listarUsuarios,
  listarRoles,
  crearUsuario,
  actualizarUsuario,
  restablecerClave,
} from '../controllers/usuariosController';

const router = Router();

router.use(authenticate);

router.get('/', authorize('usuarios', 'read'), listarUsuarios);
router.get('/roles', authorize('usuarios', 'read'), listarRoles);
router.post('/', authorize('usuarios', 'create'), crearUsuario);
router.put('/:id', authorize('usuarios', 'update'), actualizarUsuario);
router.post('/:id/clave', authorize('usuarios', 'update'), restablecerClave);

export default router;
