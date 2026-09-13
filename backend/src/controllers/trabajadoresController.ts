// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Socios trabajadores y su feria (HU-03, HU-04, HU-06)
// ============================================
//
// El trabajador es un expediente de la PERSONA, separado del de ahorrista:
// darlo de alta no crea un socio ahorrista (HU-03, criterio 6), y ser
// ahorrista no lo convierte en trabajador.
//
// La feria no es un campo del trabajador sino un historial: cambiar de feria
// cierra la asociación actual y abre otra (RF-FER-04/05). Así un pago
// histórico conserva la feria que había en su momento.

import type { Request, Response } from 'express';
import { PrismaClient, Prisma, type EstadoTrabajador } from '@prisma/client';
import { z } from 'zod';
import { BadRequestError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { normalizarIdentificacion } from '../services/personasService';
import { formatearTrabajador, includeTrabajador, mesesDePrueba } from '../services/trabajadoresService';
import { datosPersona, personaSchema } from './personasController';
import { bloquearTrabajador } from '../utils/bloqueos';
import { fechaDia, hoyDia, textoDia } from '../utils/fechaDia';
import { responderError, responderInvalido } from '../utils/responderError';

const prisma = new PrismaClient();

const ESTADOS: EstadoTrabajador[] = ['activo', 'suspendido', 'retirado', 'inactivo'];

// ============================================
// SCHEMAS
// ============================================

const crearTrabajadorSchema = z
  .object({
    /** Persona ya registrada (la que devolvió la búsqueda por identificación) */
    persona_id: z.number().int().positive().optional(),
    /** O los datos para registrarla; si la identificación ya existe se reutiliza */
    persona: personaSchema.optional(),
    /** Vacío: se genera T-000001, T-000002... */
    codigo_trabajador: z.string().trim().max(20).optional().nullable(),
    feria_id: z.number({ required_error: 'Seleccione la feria' }).int().positive(),
    fecha_ingreso: z.string().min(1, 'Indique la fecha de ingreso'),
    observaciones: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => d.persona_id !== undefined || d.persona !== undefined, {
    message: 'Indique la persona',
    path: ['persona'],
  });

const actualizarTrabajadorSchema = z.object({
  codigo_trabajador: z.string().trim().min(1).max(20).optional(),
  fecha_ingreso: z.string().optional(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
  /** Retirar tiene su propia operación: exige fecha y motivo, y cierra la feria */
  estado: z.enum(['activo', 'suspendido', 'inactivo']).optional(),
});

const trasladoSchema = z.object({
  feria_id: z.number({ required_error: 'Seleccione la nueva feria' }).int().positive(),
  fecha: z.string().min(1, 'Indique la fecha del traslado'),
  motivo: z.string().trim().min(5, 'Explique el motivo del traslado').max(500),
});

const retiroSchema = z.object({
  fecha_salida: z.string().min(1, 'Indique la fecha de salida'),
  motivo: z.string().trim().min(5, 'Explique el motivo del retiro').max(500),
});

// ============================================
// HELPERS
// ============================================

const idDeRuta = (req: Request): number => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) throw new BadRequestError('ID inválido');
  return id;
};

const noFutura = (fecha: Date, campo: string): void => {
  if (fecha > hoyDia()) throw new BadRequestError(`${campo} no puede ser posterior a hoy`);
};

const feriaActiva = async (tx: Prisma.TransactionClient, feriaId: number) => {
  const feria = await tx.ubicacion.findUnique({ where: { id: feriaId } });
  if (!feria) throw new NotFoundError('Feria no encontrada');
  if (!feria.estado) throw new BadRequestError(`La feria ${feria.codigo} está inactiva`);
  return feria;
};

/** T-000001. Un código manual con otro formato no interrumpe la secuencia. */
const siguienteCodigo = async (tx: Prisma.TransactionClient): Promise<string> => {
  const ultimo = await tx.$queryRaw<{ n: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(codigo_trabajador FROM 3) AS INTEGER))::int AS n
    FROM socios_trabajadores
    WHERE codigo_trabajador ~ '^T-[0-9]+$'
  `;
  return `T-${String((ultimo[0]?.n ?? 0) + 1).padStart(6, '0')}`;
};

const cargarDetalle = async (id: number) => {
  const [trabajador, meses] = await Promise.all([
    prisma.socioTrabajador.findUnique({
      where: { id },
      include: {
        ...includeTrabajador,
        persona: {
          include: {
            socios: {
              select: { id: true, codigo_socio: true, estado: true, fecha_inscripcion: true },
              orderBy: { fecha_inscripcion: 'desc' },
            },
          },
        },
      },
    }),
    mesesDePrueba(),
  ]);
  if (!trabajador) throw new NotFoundError('Trabajador no encontrado');

  const formateado = formatearTrabajador(trabajador, meses);
  const expedientes = trabajador.persona.socios;
  return {
    ...formateado,
    // HU-04: la ficha dice si ya puede inscribirse como ahorrista
    ahorrista: {
      expedientes,
      tiene_expediente_activo: expedientes.some((s) => s.estado === 'activo'),
      puede_inscribirse: formateado.prueba.cumplida,
    },
  };
};

// ============================================
// CONSULTAS
// ============================================

/**
 * GET /api/trabajadores?feria_id=&estado=&busqueda=&ingreso_desde=&ingreso_hasta=&page=&limit=
 * RF-FER-06: por feria, estado, nombre, identificación y fecha de ingreso
 */
export const listarTrabajadores = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query;
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.SocioTrabajadorWhereInput = {};

    if (q.estado) {
      const estado = String(q.estado) as EstadoTrabajador;
      if (!ESTADOS.includes(estado)) throw new BadRequestError(`Estado inválido: ${estado}`);
      where.estado = estado;
    }

    if (q.feria_id) {
      const feriaId = Number(q.feria_id);
      if (!Number.isInteger(feriaId) || feriaId <= 0) throw new BadRequestError('Feria inválida');
      // Por la feria ACTUAL: los que ya se fueron de esa feria no aparecen
      where.ferias = { some: { feria_id: feriaId, fecha_fin: null } };
    }

    const desde = q.ingreso_desde ? fechaDia(String(q.ingreso_desde), 'Ingreso desde') : null;
    const hasta = q.ingreso_hasta ? fechaDia(String(q.ingreso_hasta), 'Ingreso hasta') : null;
    if (desde || hasta) where.fecha_ingreso = { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) };

    const busqueda = String(q.busqueda ?? '').trim();
    if (busqueda) {
      const digitos = busqueda.replace(/\D/g, '');
      const insensible = Prisma.QueryMode.insensitive;
      where.OR = [
        { codigo_trabajador: { contains: busqueda, mode: insensible } },
        ...(digitos.length >= 3 ? [{ persona: { numero_identificacion: { contains: digitos } } }] : []),
        {
          AND: busqueda.split(/\s+/).map((palabra) => ({
            persona: {
              OR: [
                { nombres: { contains: palabra, mode: insensible } },
                { apellidos: { contains: palabra, mode: insensible } },
              ],
            },
          })),
        },
      ];
    }

    const [total, filas, meses] = await Promise.all([
      prisma.socioTrabajador.count({ where }),
      prisma.socioTrabajador.findMany({
        where,
        include: includeTrabajador,
        orderBy: [{ persona: { apellidos: 'asc' } }, { persona: { nombres: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      mesesDePrueba(),
    ]);

    res.json({
      success: true,
      data: filas.map((t) => formatearTrabajador(t, meses)),
      meta: { total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    responderError(res, error, 'Error al listar los trabajadores');
  }
};

/** GET /api/trabajadores/:id — ficha con historial de ferias, prueba y expedientes ahorristas */
export const obtenerTrabajador = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await cargarDetalle(idDeRuta(req)) });
  } catch (error) {
    responderError(res, error, 'Error al obtener el trabajador');
  }
};

// ============================================
// OPERACIONES
// ============================================

/**
 * POST /api/trabajadores
 *
 * Reutiliza la persona si la identificación ya existe (HU-01, criterio 4) y
 * rechaza a quien ya tiene un expediente de trabajador sin retirar. Queda
 * activo, en su feria, con salud asignada por derivación; no se crea ningún
 * expediente de ahorrista.
 */
export const crearTrabajador = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = crearTrabajadorSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    const ingreso = fechaDia(d.fecha_ingreso, 'La fecha de ingreso');
    noFutura(ingreso, 'La fecha de ingreso');

    const id = await prisma.$transaction(async (tx) => {
      const feria = await feriaActiva(tx, d.feria_id);

      // --- Persona: la indicada, la de esa identificación, o una nueva ---
      let persona;
      if (d.persona_id !== undefined) {
        persona = await tx.persona.findUnique({ where: { id: d.persona_id } });
        if (!persona) throw new NotFoundError('Persona no encontrada');
      } else {
        const datos = d.persona!;
        const numero = normalizarIdentificacion(datos.tipo_identificacion, datos.numero_identificacion);
        persona =
          (await tx.persona.findUnique({ where: { numero_identificacion: numero } })) ??
          (await tx.persona.create({
            data: {
              ...datosPersona(datos),
              nombres: datos.nombres,
              apellidos: datos.apellidos,
              numero_identificacion: numero,
              created_by: req.user?.userId ?? null,
            },
          }));
      }

      const vigente = await tx.socioTrabajador.findFirst({
        where: { persona_id: persona.id, estado: { not: 'retirado' } },
      });
      if (vigente) {
        throw new ConflictError(
          `${persona.nombres} ${persona.apellidos} ya es trabajador (${vigente.codigo_trabajador}, ${vigente.estado}). ` +
            'Para cambiarlo de feria use Trasladar.',
          { trabajador_id: vigente.id }
        );
      }

      const codigo = d.codigo_trabajador || (await siguienteCodigo(tx));
      const existeCodigo = await tx.socioTrabajador.findUnique({ where: { codigo_trabajador: codigo } });
      if (existeCodigo) throw new ConflictError(`El código ${codigo} ya está en uso`);

      const trabajador = await tx.socioTrabajador.create({
        data: {
          persona_id: persona.id,
          codigo_trabajador: codigo,
          fecha_ingreso: ingreso,
          observaciones: d.observaciones || null,
          created_by: req.user?.userId ?? null,
        },
      });

      await tx.trabajadorFeria.create({
        data: {
          trabajador_id: trabajador.id,
          feria_id: feria.id,
          fecha_inicio: ingreso,
          motivo_cambio: 'Ingreso',
          created_by: req.user?.userId ?? null,
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'CREAR',
        modulo: 'trabajadores',
        registro_id: trabajador.id,
        despues: { trabajador, persona_id: persona.id, feria: feria.codigo },
      });

      return trabajador.id;
    });

    res.status(201).json({ success: true, data: await cargarDetalle(id), message: 'Trabajador registrado' });
  } catch (error) {
    responderError(res, error, 'Error al registrar el trabajador');
  }
};

/** PUT /api/trabajadores/:id — código, fecha de ingreso, observaciones y estado (no el retiro) */
export const actualizarTrabajador = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idDeRuta(req);
    const validacion = actualizarTrabajadorSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    await prisma.$transaction(async (tx) => {
      await bloquearTrabajador(tx, id);
      const actual = await tx.socioTrabajador.findUniqueOrThrow({
        where: { id },
        include: { ferias: { orderBy: { fecha_inicio: 'asc' } } },
      });
      if (actual.estado === 'retirado') {
        throw new ConflictError('El trabajador está retirado. Si vuelve a trabajar, regístrelo de nuevo.');
      }

      let ingreso: Date | undefined;
      if (d.fecha_ingreso !== undefined) {
        ingreso = fechaDia(d.fecha_ingreso, 'La fecha de ingreso');
        noFutura(ingreso, 'La fecha de ingreso');
        const primera = actual.ferias[0];
        const segunda = actual.ferias[1];
        // La primera asociación nace con el ingreso: se corrige junto con él,
        // siempre que no quede después del traslado siguiente
        if (segunda && ingreso > segunda.fecha_inicio) {
          throw new BadRequestError(
            `La fecha de ingreso no puede ser posterior al primer traslado (${textoDia(segunda.fecha_inicio)})`
          );
        }
        if (primera && primera.fecha_inicio.getTime() === actual.fecha_ingreso.getTime()) {
          await tx.trabajadorFeria.update({ where: { id: primera.id }, data: { fecha_inicio: ingreso } });
        }
      }

      if (d.codigo_trabajador && d.codigo_trabajador !== actual.codigo_trabajador) {
        const otro = await tx.socioTrabajador.findUnique({ where: { codigo_trabajador: d.codigo_trabajador } });
        if (otro) throw new ConflictError(`El código ${d.codigo_trabajador} ya está en uso`);
      }

      const actualizado = await tx.socioTrabajador.update({
        where: { id },
        data: {
          ...(d.codigo_trabajador ? { codigo_trabajador: d.codigo_trabajador } : {}),
          ...(ingreso ? { fecha_ingreso: ingreso } : {}),
          ...(d.observaciones !== undefined ? { observaciones: d.observaciones || null } : {}),
          ...(d.estado ? { estado: d.estado } : {}),
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'ACTUALIZAR',
        modulo: 'trabajadores',
        registro_id: id,
        antes: { ...actual, ferias: undefined },
        despues: actualizado,
      });
    });

    res.json({ success: true, data: await cargarDetalle(id), message: 'Trabajador actualizado' });
  } catch (error) {
    responderError(res, error, 'Error al actualizar el trabajador');
  }
};

/**
 * POST /api/trabajadores/:id/traslado-feria
 *
 * HU-06: cierra la asociación actual en la fecha del traslado y abre la nueva
 * desde esa fecha, con el motivo. Nada se modifica hacia atrás.
 */
export const trasladarTrabajador = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idDeRuta(req);
    const validacion = trasladoSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    const fecha = fechaDia(d.fecha, 'La fecha del traslado');
    noFutura(fecha, 'La fecha del traslado');

    await prisma.$transaction(async (tx) => {
      // Dos traslados a la vez leían la misma asociación abierta
      await bloquearTrabajador(tx, id);

      const trabajador = await tx.socioTrabajador.findUniqueOrThrow({ where: { id } });
      if (trabajador.estado === 'retirado' || trabajador.estado === 'inactivo') {
        throw new ConflictError(`No se puede trasladar a un trabajador ${trabajador.estado}`);
      }

      const destino = await feriaActiva(tx, d.feria_id);
      const actual = await tx.trabajadorFeria.findFirst({
        where: { trabajador_id: id, fecha_fin: null },
        include: { feria: true },
      });

      if (actual?.feria_id === destino.id) {
        throw new BadRequestError(`El trabajador ya está en la feria ${destino.codigo}`);
      }
      if (actual && fecha < actual.fecha_inicio) {
        throw new BadRequestError(
          `La fecha del traslado no puede ser anterior a su ingreso en ${actual.feria.codigo} ` +
            `(${textoDia(actual.fecha_inicio)})`
        );
      }

      if (actual) {
        await tx.trabajadorFeria.update({ where: { id: actual.id }, data: { fecha_fin: fecha } });
      }
      await tx.trabajadorFeria.create({
        data: {
          trabajador_id: id,
          feria_id: destino.id,
          fecha_inicio: fecha,
          motivo_cambio: d.motivo,
          created_by: req.user?.userId ?? null,
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'TRASLADO_FERIA',
        modulo: 'trabajadores',
        registro_id: id,
        antes: { feria: actual?.feria.codigo ?? null, desde: actual ? textoDia(actual.fecha_inicio) : null },
        despues: { feria: destino.codigo, desde: d.fecha, motivo: d.motivo },
      });
    });

    res.json({ success: true, data: await cargarDetalle(id), message: 'Traslado registrado' });
  } catch (error) {
    responderError(res, error, 'Error al trasladar el trabajador');
  }
};

/**
 * POST /api/trabajadores/:id/retiro
 *
 * Cierra la feria en la fecha de salida: desde ese día deja de tener salud por
 * la feria y de aparecer en su cálculo. El expediente se conserva.
 */
export const retirarTrabajador = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idDeRuta(req);
    const validacion = retiroSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    const salida = fechaDia(d.fecha_salida, 'La fecha de salida');
    noFutura(salida, 'La fecha de salida');

    await prisma.$transaction(async (tx) => {
      await bloquearTrabajador(tx, id);

      const trabajador = await tx.socioTrabajador.findUniqueOrThrow({ where: { id } });
      if (trabajador.estado === 'retirado') throw new ConflictError('El trabajador ya está retirado');
      if (salida < trabajador.fecha_ingreso) {
        throw new BadRequestError(
          `La fecha de salida no puede ser anterior al ingreso (${textoDia(trabajador.fecha_ingreso)})`
        );
      }

      const abierta = await tx.trabajadorFeria.findFirst({ where: { trabajador_id: id, fecha_fin: null } });
      if (abierta) {
        if (salida < abierta.fecha_inicio) {
          throw new BadRequestError(
            `La fecha de salida no puede ser anterior a su ingreso en la feria actual (${textoDia(abierta.fecha_inicio)})`
          );
        }
        await tx.trabajadorFeria.update({ where: { id: abierta.id }, data: { fecha_fin: salida } });
      }

      const retirado = await tx.socioTrabajador.update({
        where: { id },
        data: { estado: 'retirado', fecha_salida: salida, motivo_salida: d.motivo },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'RETIRAR',
        modulo: 'trabajadores',
        registro_id: id,
        antes: { estado: trabajador.estado },
        despues: { estado: retirado.estado, fecha_salida: d.fecha_salida, motivo: d.motivo },
      });
    });

    res.json({ success: true, data: await cargarDetalle(id), message: 'Retiro registrado' });
  } catch (error) {
    responderError(res, error, 'Error al retirar el trabajador');
  }
};
