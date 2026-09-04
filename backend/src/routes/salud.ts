/**
 * ============================================
 * ROUTES: SALUD
 * ============================================
 * Rutas para gestión de acuerdos de salud (grupos familiares de hasta 9
 * personas compartiendo un mismo número de acuerdo).
 */

import { Router } from 'express';
import {
  listarTiposAcuerdo,
  obtenerEstadisticas,
  listarAcuerdos,
  obtenerAcuerdosPorSocio,
  obtenerGrupoPorNumeroAcuerdo,
  listarSuspendidosParaImpresion,
  obtenerAcuerdo,
  crearGrupoAcuerdo,
  agregarBeneficiarioAGrupo,
  crearAcuerdo,
  actualizarGrupoAcuerdo,
  eliminarGrupoAcuerdo,
  eliminarAcuerdo,
  cambiarEstado,
  retirarBeneficiario,
  registrarPago,
  importarGrupoAFuneraria,
  verificarSuspensionesAutomaticas,
} from '../controllers/saludController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// CATÁLOGO Y ESTADÍSTICAS
// ============================================
router.get('/tipos-acuerdo', authorize('salud', 'read'), listarTiposAcuerdo);
router.get('/estadisticas', authorize('salud', 'read'), obtenerEstadisticas);

// ============================================
// LISTADO / CONSULTA
// (rutas estáticas antes de "/acuerdos/:id" para que Express no las capture)
// ============================================
router.get('/acuerdos', authorize('salud', 'read'), listarAcuerdos);
router.get('/acuerdos/socio/:socioId', authorize('salud', 'read'), obtenerAcuerdosPorSocio);
router.get('/acuerdos/suspendidos/listado', authorize('salud', 'read'), listarSuspendidosParaImpresion);
router.get('/acuerdos/grupo/:numeroAcuerdo', authorize('salud', 'read'), obtenerGrupoPorNumeroAcuerdo);
router.get('/acuerdos/:id', authorize('salud', 'read'), obtenerAcuerdo);

// ============================================
// ALTA / MODIFICACIÓN / BAJA DE GRUPO
// ============================================
router.post('/grupos', authorize('salud', 'create'), crearGrupoAcuerdo);
router.post('/grupos/:numeroAcuerdo/beneficiarios', authorize('salud', 'create'), agregarBeneficiarioAGrupo);
router.put('/grupos/:numeroAcuerdo', authorize('salud', 'update'), actualizarGrupoAcuerdo);
router.delete('/grupos/:numeroAcuerdo', authorize('salud', 'delete'), eliminarGrupoAcuerdo);
router.delete('/acuerdos/:id', authorize('salud', 'delete'), eliminarAcuerdo);

/**
 * Alta de un único acuerdo para un beneficiario existente, sin número de
 * acuerdo — se conserva solo para el flujo "Importar a Salud" de Funeraria.
 */
router.post('/acuerdos', authorize('salud', 'create'), crearAcuerdo);

// ============================================
// SUSPENSIÓN / REACTIVACIÓN / RETIRO
// ============================================
router.patch('/acuerdos/:id/estado', authorize('salud', 'update'), cambiarEstado);
router.patch('/acuerdos/:id/retirar', authorize('salud', 'update'), retirarBeneficiario);

// ============================================
// PAGOS
// ============================================
router.post('/grupos/:numeroAcuerdo/pagos', authorize('salud', 'update'), registrarPago);

// ============================================
// TRASPASO A FUNERARIA
// ============================================
router.post('/grupos/:numeroAcuerdo/importar-funeraria', authorize('salud', 'update'), importarGrupoAFuneraria);

/**
 * POST /api/salud/verificar-suspensiones
 * Job para suspender automáticamente grupos con 11+ semanas sin pago.
 * También se ejecuta semanalmente vía backend/src/jobs/saludSuspension.ts
 */
router.post('/verificar-suspensiones', authorize('salud', 'update'), verificarSuspensionesAutomaticas);

export default router;
