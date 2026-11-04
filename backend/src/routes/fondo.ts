// ============================================
// COOPERATIVA EL TRIUNFO - RUTAS
// Fondo de los trabajadores de El Triunfo
// ============================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { resolverTasa } from '../services/tasaCambioService';
import { exigirPermisoSiEsDeDiaAnterior } from '../utils/reversoDelDia';
import { fechaDia } from '../utils/fechaDia';
import {
  registrarEgreso,
  registrarIngreso,
  reversarMovimiento,
  saldoDelFondo,
  sectoresTrabajadores,
} from '../services/fondoService';

const router = Router();
router.use(authenticate);

const cuerpo = <T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> => {
  const r = schema.safeParse(req.body);
  if (!r.success) throw new BadRequestError(r.error.errors[0]?.message ?? 'Datos inválidos');
  return r.data;
};

const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable();

/** Saldo del fondo y la tasa del día para mostrar el $ de referencia */
router.get('/resumen', authorize('fondo', 'read'), async (_req, res: Response, next: NextFunction) => {
  try {
    const [saldo, { tasa }, sectores] = await Promise.all([saldoDelFondo(), resolverTasa(), sectoresTrabajadores()]);
    res.json({ success: true, data: { ...saldo, tasa, saldo_usd: Math.round((saldo.saldo_bs / tasa) * 100) / 100, sectores_trabajadores: sectores } });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------ Conceptos

router.get('/conceptos', authorize('fondo', 'read'), async (_req, res: Response, next: NextFunction) => {
  try {
    const conceptos = await prisma.fondoConcepto.findMany({ orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }] });
    res.json({ success: true, data: conceptos });
  } catch (error) {
    next(error);
  }
});

const conceptoSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']),
  nombre: z.string().trim().min(2, 'Escriba el nombre del concepto').max(100),
  porcentaje: z.number().min(1).max(100).optional().nullable(),
  activo: z.boolean().optional(),
});

router.post('/conceptos', authorize('fondo', 'update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = cuerpo(conceptoSchema, req);
    const concepto = await prisma.fondoConcepto.create({
      data: { tipo: d.tipo, nombre: d.nombre, porcentaje: d.tipo === 'egreso' ? (d.porcentaje ?? 100) : null },
    });
    res.status(201).json({ success: true, data: concepto });
  } catch (error) {
    next(error);
  }
});

router.put('/conceptos/:id', authorize('fondo', 'update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const d = cuerpo(conceptoSchema.omit({ tipo: true }).partial(), req);
    const previo = await prisma.fondoConcepto.findUnique({ where: { id } });
    if (!previo) throw new NotFoundError('Concepto no encontrado');
    const concepto = await prisma.$transaction(async (tx) => {
      const c = await tx.fondoConcepto.update({
        where: { id },
        data: {
          ...(d.nombre !== undefined ? { nombre: d.nombre } : {}),
          ...(d.activo !== undefined ? { activo: d.activo } : {}),
          ...(previo.tipo === 'egreso' && d.porcentaje !== undefined ? { porcentaje: d.porcentaje } : {}),
        },
      });
      await registrarAuditoria(tx, { req, accion: 'ACTUALIZAR', modulo: 'fondo', registro_id: id, antes: previo, despues: c });
      return c;
    });
    res.json({ success: true, data: concepto });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------- Beneficiarios

/** Familiares de un trabajador (o de todos, con ?q=) */
router.get('/beneficiarios', authorize('fondo', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const socioId = Number(req.query.socio_id) || undefined;
    if (!socioId) throw new BadRequestError('Indique el socio');
    const beneficiarios = await prisma.fondoBeneficiario.findMany({
      where: { socio_id: socioId, ...(req.query.todos === '1' ? {} : { activo: true }) },
      orderBy: [{ parentesco: 'asc' }, { apellido: 'asc' }],
    });
    res.json({ success: true, data: beneficiarios });
  } catch (error) {
    next(error);
  }
});

const beneficiarioSchema = z.object({
  socio_id: z.number().int().positive(),
  cedula: z.string().trim().regex(/^\d*$/, 'La cédula sólo lleva números').max(11).optional().nullable(),
  nombre: z.string().trim().min(1, 'Escriba el nombre').max(100),
  apellido: z.string().trim().min(1, 'Escriba el apellido').max(100),
  parentesco: z.enum(['padre', 'madre', 'conyuge', 'hijo'], { errorMap: () => ({ message: 'Parentesco: padre, madre, cónyuge o hijo' }) }),
  fecha_nacimiento: z.string().optional().nullable(),
  telefono: textoOpcional(100),
});

const datosBeneficiario = (d: Partial<z.infer<typeof beneficiarioSchema>>) => ({
  ...(d.cedula !== undefined ? { cedula: d.cedula || null } : {}),
  ...(d.nombre !== undefined ? { nombre: d.nombre } : {}),
  ...(d.apellido !== undefined ? { apellido: d.apellido } : {}),
  ...(d.parentesco !== undefined ? { parentesco: d.parentesco } : {}),
  ...(d.fecha_nacimiento !== undefined
    ? { fecha_nacimiento: d.fecha_nacimiento ? fechaDia(d.fecha_nacimiento, 'Fecha de nacimiento') : null }
    : {}),
  ...(d.telefono !== undefined ? { telefono: d.telefono || null } : {}),
});

router.post('/beneficiarios', authorize('fondo', 'create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = cuerpo(beneficiarioSchema, req);
    const socio = await prisma.socio.findUnique({ where: { id: d.socio_id }, select: { id: true } });
    if (!socio) throw new NotFoundError('Socio no encontrado');
    // Un mismo familiar puede estar en el fondo de dos trabajadores, pero no dos veces en el mismo
    if (d.cedula) {
      const repetido = await prisma.fondoBeneficiario.findFirst({ where: { socio_id: d.socio_id, cedula: d.cedula, activo: true } });
      if (repetido) throw new BadRequestError('Ese familiar ya está registrado en el fondo de este trabajador');
    }
    const b = await prisma.$transaction(async (tx) => {
      const creado = await tx.fondoBeneficiario.create({
        data: { socio_id: d.socio_id, ...datosBeneficiario(d), nombre: d.nombre, apellido: d.apellido, parentesco: d.parentesco },
      });
      await registrarAuditoria(tx, { req, accion: 'CREAR', modulo: 'fondo_beneficiarios', registro_id: creado.id, despues: creado });
      return creado;
    });
    res.status(201).json({ success: true, data: b });
  } catch (error) {
    next(error);
  }
});

router.put('/beneficiarios/:id', authorize('fondo', 'update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const d = cuerpo(beneficiarioSchema.omit({ socio_id: true }).partial(), req);
    const previo = await prisma.fondoBeneficiario.findUnique({ where: { id } });
    if (!previo) throw new NotFoundError('Familiar no encontrado');
    const b = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.fondoBeneficiario.update({ where: { id }, data: datosBeneficiario(d) });
      await registrarAuditoria(tx, { req, accion: 'ACTUALIZAR', modulo: 'fondo_beneficiarios', registro_id: id, antes: previo, despues: actualizado });
      return actualizado;
    });
    res.json({ success: true, data: b });
  } catch (error) {
    next(error);
  }
});

/** Se da de baja, no se borra: puede tener ayudas registradas */
router.delete('/beneficiarios/:id', authorize('fondo', 'delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const previo = await prisma.fondoBeneficiario.findUnique({ where: { id } });
    if (!previo) throw new NotFoundError('Familiar no encontrado');
    await prisma.$transaction(async (tx) => {
      await tx.fondoBeneficiario.update({ where: { id }, data: { activo: false } });
      await registrarAuditoria(tx, { req, accion: 'ELIMINAR', modulo: 'fondo_beneficiarios', registro_id: id, antes: previo });
    });
    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- Movimientos

const incluirMovimiento = {
  concepto: { select: { nombre: true, tipo: true } },
  socio: { select: { id: true, codigo_socio: true, cedula: true, nombre: true, apellido: true } },
  beneficiario: { select: { nombre: true, apellido: true, parentesco: true, cedula: true } },
} as const;

/** Movimientos por fechas, tipo y socio, con sus totales */
router.get('/movimientos', authorize('fondo', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const hoyTexto = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const socioId = Number(req.query.socio_id) || undefined;
    // Con un socio se ve todo su historial; si no, por defecto el mes en curso
    const desdeTexto = String(req.query.desde || (socioId ? '2000-01-01' : `${hoyTexto.slice(0, 8)}01`));
    const hastaTexto = String(req.query.hasta || hoyTexto);
    fechaDia(desdeTexto, 'Desde');
    fechaDia(hastaTexto, 'Hasta');
    const tipo = req.query.tipo === 'ingreso' || req.query.tipo === 'egreso' ? req.query.tipo : undefined;

    const movimientos = await prisma.fondoMovimiento.findMany({
      where: {
        fecha: { gte: new Date(`${desdeTexto}T00:00:00`), lte: new Date(`${hastaTexto}T23:59:59.999`) },
        ...(tipo ? { tipo } : {}),
        ...(socioId ? { socio_id: socioId } : {}),
      },
      orderBy: { fecha: 'desc' },
      take: 5000,
      include: incluirMovimiento,
    });
    const vigentes = movimientos.filter((m) => !m.reversado);
    const suma = (t: 'ingreso' | 'egreso') =>
      Math.round(vigentes.filter((m) => m.tipo === t).reduce((a, m) => a + Number(m.monto_bs), 0) * 100) / 100;
    res.json({
      success: true,
      data: { movimientos, desde: desdeTexto, hasta: hastaTexto, ingresos_bs: suma('ingreso'), egresos_bs: suma('egreso') },
    });
  } catch (error) {
    next(error);
  }
});

const ingresoSchema = z.object({
  concepto_id: z.number().int().positive(),
  monto_bs: z.number().positive('El monto debe ser mayor que cero'),
  descripcion: textoOpcional(1000),
  entregado_por: textoOpcional(100),
  referencia: textoOpcional(50),
});

router.post('/ingresos', authorize('fondo', 'create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = cuerpo(ingresoSchema, req);
    const m = await prisma.$transaction(async (tx) => {
      const creado = await registrarIngreso(tx, {
        conceptoId: d.concepto_id,
        montoBs: d.monto_bs,
        descripcion: d.descripcion,
        entregadoPor: d.entregado_por,
        referencia: d.referencia,
        usuarioId: req.user!.userId,
      });
      await registrarAuditoria(tx, { req, accion: 'INGRESO_FONDO', modulo: 'fondo', registro_id: creado.id, despues: creado });
      return creado;
    });
    res.status(201).json({ success: true, data: m });
  } catch (error) {
    next(error);
  }
});

const egresoSchema = z.object({
  concepto_id: z.number().int().positive(),
  socio_id: z.number().int().positive(),
  beneficiario_id: z.number().int().positive().optional().nullable(),
  gasto_total_bs: z.number().positive('El monto del gasto debe ser mayor que cero'),
  porcentaje: z.number().min(1).max(100).optional().nullable(),
  descripcion: z.string().trim().min(3, 'Escriba el motivo de la ayuda').max(1000),
});

router.post('/egresos', authorize('fondo', 'create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = cuerpo(egresoSchema, req);
    const m = await prisma.$transaction(async (tx) => {
      const creado = await registrarEgreso(tx, {
        conceptoId: d.concepto_id,
        socioId: d.socio_id,
        beneficiarioId: d.beneficiario_id,
        gastoTotalBs: d.gasto_total_bs,
        porcentaje: d.porcentaje,
        descripcion: d.descripcion,
        usuarioId: req.user!.userId,
      });
      await registrarAuditoria(tx, { req, accion: 'EGRESO_FONDO', modulo: 'fondo', registro_id: creado.id, despues: creado });
      return creado;
    });
    res.status(201).json({ success: true, data: m });
  } catch (error) {
    next(error);
  }
});

/** Reversar: los del día cualquier cajero con permiso; los de otro día, la caja 99 */
router.post('/movimientos/:id/reversar', authorize('fondo', 'delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { motivo } = cuerpo(z.object({ motivo: z.string().trim().min(5, 'Escriba el motivo del reverso').max(500) }), req);
    const m = await prisma.fondoMovimiento.findUnique({ where: { id }, select: { fecha: true } });
    if (!m) throw new NotFoundError('Movimiento no encontrado');
    await exigirPermisoSiEsDeDiaAnterior(req, 'fondo', m.fecha);
    const r = await prisma.$transaction(async (tx) => {
      const rev = await reversarMovimiento(tx, id, motivo, req.user!.userId);
      await registrarAuditoria(tx, { req, accion: 'REVERSAR_FONDO', modulo: 'fondo', registro_id: id, despues: { motivo } });
      return rev;
    });
    res.json({ success: true, data: r });
  } catch (error) {
    next(error);
  }
});

export default router;
