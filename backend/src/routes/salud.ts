/**
 * ============================================
 * ROUTES: SALUD
 * ============================================
 * Rutas para gestión de acuerdos de salud (grupos familiares sin límite de
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
  listarGruposParaImpresion,
  obtenerAcuerdo,
  crearGrupoAcuerdo,
  agregarBeneficiarioAGrupo,
  importarDesdeFuneraria,
  obtenerNumeroSugeridoSalud,
  obtenerNumeroSugeridoFuneraria,
  actualizarGrupoAcuerdo,
  eliminarGrupoAcuerdo,
  eliminarAcuerdo,
  cambiarEstado,
  retirarBeneficiario,
  actualizarParentescoEnAcuerdo,
  registrarPago,
  importarGrupoAFuneraria,
  verificarSuspensionesAutomaticas,
} from '../controllers/saludController';
import { vistaPreviaTraspasoSalud, confirmarTraspasoSalud } from '../controllers/saludTraspasoController';
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
router.get('/acuerdos/grupos', authorize('salud', 'read'), listarGruposParaImpresion);
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

// ============================================
// SUSPENSIÓN / REACTIVACIÓN / RETIRO
// ============================================
router.patch('/acuerdos/:id/estado', authorize('salud', 'update'), cambiarEstado);
router.patch('/acuerdos/:id/retirar', authorize('salud', 'update'), retirarBeneficiario);
router.patch('/acuerdos/:id/parentesco', authorize('salud', 'update'), actualizarParentescoEnAcuerdo);

// ============================================
// PAGOS
// ============================================
router.post('/grupos/:numeroAcuerdo/pagos', authorize('salud', 'update'), registrarPago);

// ============================================
// IMPORTAR ENTRE SALUD Y FUNERARIA (solo copian)
// ============================================
// Salud -> Funeraria; si no caben todos, puede crear un acuerdo de funeraria adicional
router.post('/grupos/:numeroAcuerdo/importar-funeraria', authorize('salud', 'update'), importarGrupoAFuneraria);
// Funeraria -> Salud: copia beneficiarios de un acuerdo de funeraria a este acuerdo de salud
router.post('/grupos/:numeroAcuerdo/importar-desde-funeraria', authorize('salud', 'update'), importarDesdeFuneraria);
// Funeraria -> Salud cuando el titular no tiene acuerdo de salud: lo crea y copia ahí
router.post('/importar-desde-funeraria/nuevo-acuerdo', authorize('salud', 'create'), importarDesdeFuneraria);
router.get('/socios/:socioId/numero-sugerido', authorize('salud', 'read'), obtenerNumeroSugeridoSalud);
router.get('/socios/:socioId/numero-sugerido-funeraria', authorize('salud', 'read'), obtenerNumeroSugeridoFuneraria);

// TRASPASO del acuerdo a otro socio registrado (fallecimiento, migración...)
router.get('/grupos/:numeroAcuerdo/traspaso', authorize('salud', 'read'), vistaPreviaTraspasoSalud);
router.post('/grupos/:numeroAcuerdo/traspaso', authorize('salud', 'update'), confirmarTraspasoSalud);

/**
 * POST /api/salud/verificar-suspensiones
 * Job para suspender automáticamente grupos con 11+ semanas sin pago.
 * También se ejecuta semanalmente vía backend/src/jobs/saludSuspension.ts
 */
router.post('/verificar-suspensiones', authorize('salud', 'update'), verificarSuspensionesAutomaticas);

export default router;
