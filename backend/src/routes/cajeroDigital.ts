// ============================================
// COOPERATIVA EL TRIUNFO - RUTAS
// Cajero digital
// ============================================
//
// Dos grupos con permisos distintos:
//
//   /api/cajero-digital/*         lo usa el SOCIO desde su celular
//   /api/cajero-digital/pagos/... lo usa la CAJA para revisar lo declarado
//
// El primero se autentica con `autenticarSocio` y el segundo con el
// `authenticate` del personal. Un token no sirve en el otro grupo.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { accederSocio, registrarSocio } from '../services/cajeroDigitalService';
import { declararPago, revisarPago } from '../services/pagosWebService';
import { autenticarSocio } from '../middleware/autenticarSocio';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { BadRequestError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { fechaDia } from '../utils/fechaDia';

const router = Router();

const cuerpo = <T extends z.ZodTypeAny>(esquema: T, req: Request): z.infer<T> => {
  const r = esquema.safeParse(req.body);
  if (!r.success) {
    throw new BadRequestError('Datos inválidos', r.error.errors);
  }
  return r.data;
};

// ============================================
// ACCESO DEL SOCIO
// ============================================

const registroSchema = z.object({
  codigo_socio: z.string().min(1),
  cedula: z.string().min(1),
  telefono: z.string().min(7),
  clave: z.string().min(8),
});

router.post('/registro', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, data: await registrarSocio(cuerpo(registroSchema, req)) });
  } catch (error) {
    next(error);
  }
});

const accesoSchema = z.object({
  codigo_socio: z.string().min(1),
  clave: z.string().min(1),
});

router.post('/acceso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await accederSocio(cuerpo(accesoSchema, req)) });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LO QUE HACE EL SOCIO YA DENTRO
// ============================================

/** Su situacion: que debe, que prestamos tiene y hasta cuando esta cubierto */
router.get('/mi-situacion', autenticarSocio, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const socioId = req.socio!.socioId;
    const [socio, prestamos, pagos] = await Promise.all([
      prisma.socio.findUnique({
        where: { id: socioId },
        select: { codigo_socio: true, nombre: true, apellido: true, estado: true },
      }),
      prisma.prestamo.findMany({
        where: { socio_id: socioId, estado: { in: ['activo', 'moroso'] } },
        select: {
          id: true,
          numero_prestamo: true,
          saldo_capital_usd: true,
          saldo_interes_usd: true,
          cuota_semanal_usd: true,
          fecha_ultimo_abono: true,
        },
      }),
      // Sus propias declaraciones, para que sepa en que quedaron
      prisma.pagoWeb.findMany({
        where: { usuario_digital_id: req.socio!.usuarioDigitalId },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ]);
    res.json({ success: true, data: { socio, prestamos, pagos } });
  } catch (error) {
    next(error);
  }
});

const pagoSchema = z.object({
  destino: z.enum(['semanas', 'prestamo', 'ahorro']),
  monto_bs: z.number().nonnegative().default(0),
  monto_usd: z.number().nonnegative().default(0),
  banco: z.string().min(1),
  referencia_bancaria: z.string().min(1).max(100),
  fecha_pago: z.string(),
  semanas: z.number().int().positive().optional(),
  prestamo_id: z.number().int().positive().optional(),
});

router.post('/pagos', autenticarSocio, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = cuerpo(pagoSchema, req);
    const pago = await declararPago(prisma, req.socio!.usuarioDigitalId, req.socio!.socioId, {
      ...d,
      fecha_pago: fechaDia(d.fecha_pago, 'La fecha del pago'),
    });
    res.status(201).json({ success: true, data: pago });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LO QUE HACE LA CAJA
// ============================================

/** Lo declarado, para cotejarlo contra el banco */
router.get(
  '/pagos',
  authenticate,
  authorize('colecta', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const estado = req.query.estado as string | undefined;
      const pagos = await prisma.pagoWeb.findMany({
        where: estado ? { estado: estado as 'pendiente' | 'conciliado' | 'rechazado' } : {},
        orderBy: [{ estado: 'asc' }, { fecha_pago: 'desc' }],
        take: 200,
        include: {
          usuario_digital: {
            select: {
              socio: { select: { id: true, codigo_socio: true, nombre: true, apellido: true, telefono: true } },
            },
          },
          prestamo: { select: { id: true, numero_prestamo: true } },
        },
      });
      res.json({ success: true, data: pagos });
    } catch (error) {
      next(error);
    }
  }
);

const revisionSchema = z.object({
  conciliar: z.boolean(),
  motivo: z.string().optional(),
  observaciones: z.string().optional(),
});

router.post(
  '/pagos/:id/revisar',
  authenticate,
  authorize('colecta', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new BadRequestError('Pago inválido');
      const d = cuerpo(revisionSchema, req);
      const pago = await revisarPago(prisma, id, req.user!.userId, d);
      await registrarAuditoria(prisma, {
        req,
        accion: d.conciliar ? 'CONCILIAR' : 'RECHAZAR',
        modulo: 'cajero-digital',
        registro_id: id,
        despues: { estado: pago.estado, motivo: pago.motivo_rechazo },
      });
      res.json({ success: true, data: pago });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
