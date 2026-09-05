// ============================================
// COOPERATIVA EL TRIUNFO - ROUTES
// Colecta (cobro unificado) y cierre de caja
// ============================================

import { Router } from 'express';
import {
  buscarSocioParaColecta,
  calcularPaquete,
  registrarColecta,
  obtenerColecta,
  listarColectas,
  previoCierreCaja,
  cerrarCaja,
  listarCierresCaja,
  reversarColecta,
  reportePorServicio,
  asientoContable,
} from '../controllers/colectaController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// Las rutas literales van antes de /:id para que no se lean como un id

/**
 * GET /api/colecta/buscar?termino=
 * Búsqueda unificada: devuelve el socio con todo lo cobrable
 */
router.get('/buscar', authorize('colecta', 'read'), buscarSocioParaColecta);

/**
 * GET /api/colecta/calcular?socio_id=&semanas=&ahorro_adicional_usd=
 * Importe del paquete semanal, para el desglose en vivo de la pantalla
 */
router.get('/calcular', authorize('colecta', 'read'), calcularPaquete);

/**
 * GET /api/colecta/cierre/previo
 * Vista previa del cierre de caja del cajero autenticado
 */
router.get('/cierre/previo', authorize('colecta', 'read'), previoCierreCaja);

/**
 * POST /api/colecta/cierre
 */
router.post('/cierre', authorize('colecta', 'create'), cerrarCaja);

/**
 * GET /api/colecta/cierres
 */
router.get('/cierres', authorize('colecta', 'read'), listarCierresCaja);

/**
 * GET /api/colecta/reportes/por-servicio?desde=&hasta=&servicio=&solo_mias=
 * Reemplaza los cuatro reportes por servicio del sistema viejo
 */
router.get('/reportes/por-servicio', authorize('colecta', 'read'), reportePorServicio);

/**
 * GET /api/colecta/reportes/asiento-contable?desde=&hasta=
 */
router.get('/reportes/asiento-contable', authorize('colecta', 'read'), asientoContable);

/**
 * GET /api/colecta?fecha=&solo_mias=
 */
router.get('/', authorize('colecta', 'read'), listarColectas);

/**
 * POST /api/colecta
 * Registra el cobro completo en una transacción
 */
router.post('/', authorize('colecta', 'create'), registrarColecta);

/**
 * GET /api/colecta/:id
 */
router.get('/:id', authorize('colecta', 'read'), obtenerColecta);

/**
 * POST /api/colecta/:id/reversar
 * Deshace un cobro dejando rastro. Requiere permiso de borrado.
 */
router.post('/:id/reversar', authorize('colecta', 'delete'), reversarColecta);

export default router;
