// ============================================
// COOPERATIVA EL TRIUNFO - RUTAS
// Multas por inasistencia a asamblea
// ============================================
//
// Módulo propio en el menú, aparte de la colecta (confirmado el 23/10): ver
// quién debe, cobrar entera la multa, reversarla y cambiar el monto vigente.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { BadRequestError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { resolverTasa } from '../services/tasaCambioService';
import { redondear } from '../services/cobroSemanalService';
import { exigirPermisoSiEsDeDiaAnterior } from '../utils/reversoDelDia';
import {
  FORMAS_PAGO_MULTA,
  anosAdeudados,
  anosCerrados,
  cobrarMulta,
  deudoresDelAno,
  montoMultaVigente,
  reversarMulta,
} from '../services/multasService';
import { idsSociosPorTexto } from '../services/busquedaSociosService';

const router = Router();
router.use(authenticate);

const CLAVE_MONTO = 'MULTA_INASISTENCIA_ASAMBLEA_USD';

const cuerpo = <T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> => {
  const r = schema.safeParse(req.body);
  if (!r.success) throw new BadRequestError(r.error.errors[0]?.message ?? 'Datos inválidos');
  return r.data;
};

/** Monto vigente y su equivalente en Bs a la tasa del día */
router.get('/parametros', authorize('multas', 'read'), async (_req, res: Response, next: NextFunction) => {
  try {
    const [monto, { tasa }] = await Promise.all([montoMultaVigente(), resolverTasa()]);
    res.json({ success: true, data: { monto_usd: monto, tasa, monto_bs: redondear(monto * tasa) } });
  } catch (error) {
    next(error);
  }
});

/** Cambiar el monto: la cooperativa lo fija cada año */
router.put('/parametros', authorize('multas', 'update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { monto_usd } = cuerpo(z.object({ monto_usd: z.number().nonnegative().max(100000) }), req);
    const antes = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_MONTO } });
    await prisma.$transaction(async (tx) => {
      await tx.parametroSistema.upsert({
        where: { clave: CLAVE_MONTO },
        update: { valor: String(monto_usd) },
        create: {
          clave: CLAVE_MONTO,
          valor: String(monto_usd),
          descripcion: 'Multa por no asistir a ninguna asamblea sectorial del año, en USD (0 = sin configurar)',
          tipo_dato: 'number',
        },
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'ACTUALIZAR',
        modulo: 'multas',
        antes: { monto_usd: antes?.valor ?? null },
        despues: { monto_usd },
      });
    });
    res.json({ success: true, data: { monto_usd } });
  } catch (error) {
    next(error);
  }
});

/** Años cuyas asambleas ya terminaron: desde ahí se puede cobrar su multa */
router.get('/anos', authorize('multas', 'read'), async (_req, res: Response, next: NextFunction) => {
  try {
    const cerrados = await anosCerrados(prisma);
    res.json({
      success: true,
      data: [...cerrados.entries()]
        .map(([ano, ultima]) => ({ ano, ultima_asamblea: ultima }))
        .sort((a, b) => b.ano - a.ano),
    });
  } catch (error) {
    next(error);
  }
});

/** Quiénes deben la multa de un año */
router.get('/deudores', authorize('multas', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ano = Number(req.query.ano);
    if (!Number.isInteger(ano)) throw new BadRequestError('Indique el año');
    const feriaId = Number(req.query.feria_id) || undefined;
    const q = String(req.query.q ?? '').trim();
    const socioIds = q ? await idsSociosPorTexto(prisma, q) : undefined;
    const [deudores, monto, { tasa }] = await Promise.all([
      deudoresDelAno(prisma, ano, { feriaId, socioIds }),
      montoMultaVigente(),
      resolverTasa(),
    ]);
    res.json({
      success: true,
      data: {
        ano,
        monto_usd: monto,
        monto_bs: redondear(monto * tasa),
        tasa,
        deudores,
        total_usd: redondear(deudores.length * monto),
        total_bs: redondear(deudores.length * monto * tasa),
      },
    });
  } catch (error) {
    next(error);
  }
});

/** Lo de un socio: qué años debe, sus multas pagadas y sus cuentas para descontar */
router.get('/socio/:id', authorize('multas', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const socioId = Number(req.params.id);
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true,
        codigo_socio: true,
        cedula: true,
        nombre: true,
        apellido: true,
        estado: true,
        cuentas_ahorro: {
          where: { estado: true },
          select: {
            id: true,
            numero_cuenta: true,
            saldo_usd: true,
            saldo_bs: true,
            tipo_cuenta: { select: { nombre: true, moneda: true } },
          },
        },
        multas_asamblea: { orderBy: { fecha_pago: 'desc' } },
      },
    });
    if (!socio) throw new BadRequestError('Socio no encontrado');
    const [adeudados, monto, { tasa }] = await Promise.all([
      anosAdeudados(prisma, socioId),
      montoMultaVigente(),
      resolverTasa(),
    ]);
    res.json({
      success: true,
      data: { socio, anos_adeudados: adeudados, monto_usd: monto, monto_bs: redondear(monto * tasa), tasa },
    });
  } catch (error) {
    next(error);
  }
});

/** Multas cobradas en un rango de fechas (por defecto, hoy) */
router.get('/pagos', authorize('multas', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const hoyTexto = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const desde = new Date(`${String(req.query.desde || hoyTexto)}T00:00:00`);
    const hasta = new Date(`${String(req.query.hasta || hoyTexto)}T23:59:59.999`);
    if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) throw new BadRequestError('Fechas inválidas');

    const pagos = await prisma.multaAsamblea.findMany({
      where: { fecha_pago: { gte: desde, lte: hasta } },
      orderBy: { fecha_pago: 'desc' },
      include: { socio: { select: { codigo_socio: true, cedula: true, nombre: true, apellido: true } } },
    });
    const vigentes = pagos.filter((p) => p.estado === 'pagada');
    res.json({
      success: true,
      data: {
        pagos,
        total_usd: redondear(vigentes.reduce((t, p) => t + Number(p.monto_usd), 0)),
        total_bs: redondear(vigentes.reduce((t, p) => t + Number(p.monto_bs), 0)),
        cantidad: vigentes.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

const cobrarSchema = z.object({
  socio_id: z.number().int().positive(),
  ano: z.number().int().min(2000).max(2100),
  forma_pago: z.enum(FORMAS_PAGO_MULTA),
  referencia: z.string().max(50).optional().nullable(),
  cuenta_ahorro_id: z.number().int().positive().optional().nullable(),
  observacion: z.string().max(500).optional().nullable(),
});

/** Cobrar la multa de un año, entera */
router.post('/cobrar', authorize('multas', 'create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = cuerpo(cobrarSchema, req);
    const multa = await prisma.$transaction(async (tx) => {
      const m = await cobrarMulta(tx, {
        socioId: d.socio_id,
        ano: d.ano,
        formaPago: d.forma_pago,
        referencia: d.referencia,
        cuentaAhorroId: d.cuenta_ahorro_id,
        usuarioId: req.user!.userId,
        observacion: d.observacion,
      });
      await registrarAuditoria(tx, {
        req,
        accion: 'COBRAR_MULTA',
        modulo: 'multas',
        registro_id: m.id,
        despues: { socio_id: m.socio_id, ano: m.ano, monto_usd: m.monto_usd, forma_pago: m.forma_pago },
      });
      return m;
    });
    res.status(201).json({ success: true, data: multa });
  } catch (error) {
    next(error);
  }
});

/** Reversar un cobro de multa: del día, cualquier cajero; de otro día, la caja 99 */
router.post('/:id/reversar', authorize('multas', 'delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { motivo } = cuerpo(z.object({ motivo: z.string().trim().min(5, 'Escriba el motivo del reverso').max(500) }), req);
    const multa = await prisma.multaAsamblea.findUnique({ where: { id }, select: { fecha_pago: true } });
    if (!multa) throw new BadRequestError('Multa no encontrada');
    await exigirPermisoSiEsDeDiaAnterior(req, 'multas', multa.fecha_pago);

    const reversada = await prisma.$transaction(async (tx) => {
      const r = await reversarMulta(tx, id, motivo, req.user!.userId);
      await registrarAuditoria(tx, {
        req,
        accion: 'REVERSAR_MULTA',
        modulo: 'multas',
        registro_id: id,
        despues: { motivo },
      });
      return r;
    });
    res.json({ success: true, data: reversada });
  } catch (error) {
    next(error);
  }
});

export default router;
