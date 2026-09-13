// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Personas (HU-01)
// ============================================
//
// La persona es la identidad; los expedientes (ahorrista, trabajador) cuelgan
// de ella. Toda alta empieza por "¿esta identificación ya existe?": si existe
// se muestra su registro y se le agrega el rol, nunca se duplica (RF-SOC-04).

import type { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { ConflictError, NotFoundError, BadRequestError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../services/auditoriaService';
import { normalizarIdentificacion, propagarPersonaASocios } from '../services/personasService';
import {
  advertenciasParaAhorrista,
  formatearTrabajador,
  includeFerias,
  mesesDePrueba,
} from '../services/trabajadoresService';
import { fichaPersona } from '../services/fichaPersonaService';
import { responderError, responderInvalido } from '../utils/responderError';
import { fechaDia } from '../utils/fechaDia';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS
// ============================================

export const personaSchema = z.object({
  tipo_identificacion: z.enum(['V', 'E', 'J', 'P']).default('V'),
  numero_identificacion: z.string().trim().min(1, 'La identificación es obligatoria').max(20),
  nombres: z.string().trim().min(2, 'Escriba al menos 2 letras').max(100),
  apellidos: z.string().trim().min(2, 'Escriba al menos 2 letras').max(100),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable().or(z.literal('')),
  telefono: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Correo inválido').max(100).optional().nullable().or(z.literal('')),
  direccion: z.string().trim().max(500).optional().nullable(),
});

const actualizarPersonaSchema = personaSchema.partial().extend({
  estado: z.enum(['activo', 'inactivo', 'fallecido']).optional(),
});

type DatosPersona = z.infer<typeof actualizarPersonaSchema>;

/** Campos del formulario a columnas; sólo los que vinieron */
export const datosPersona = (d: DatosPersona) => ({
  ...(d.tipo_identificacion !== undefined ? { tipo_identificacion: d.tipo_identificacion } : {}),
  ...(d.nombres !== undefined ? { nombres: d.nombres } : {}),
  ...(d.apellidos !== undefined ? { apellidos: d.apellidos } : {}),
  ...(d.sexo !== undefined ? { sexo: d.sexo } : {}),
  ...(d.fecha_nacimiento !== undefined
    ? { fecha_nacimiento: d.fecha_nacimiento ? fechaDia(d.fecha_nacimiento, 'Fecha de nacimiento') : null }
    : {}),
  ...(d.telefono !== undefined ? { telefono: d.telefono || null } : {}),
  ...(d.email !== undefined ? { email: d.email || null } : {}),
  ...(d.direccion !== undefined ? { direccion: d.direccion || null } : {}),
  ...(d.estado !== undefined ? { estado: d.estado } : {}),
});

const includeExpedientes = {
  socios: {
    select: {
      id: true,
      codigo_socio: true,
      estado: true,
      fecha_inscripcion: true,
      ubicacion: { select: { codigo: true, nombre: true } },
    },
    orderBy: { fecha_inscripcion: 'desc' },
  },
  trabajadores: { include: { ferias: includeFerias }, orderBy: { fecha_ingreso: 'desc' } },
} satisfies Prisma.PersonaInclude;

type PersonaConExpedientes = Prisma.PersonaGetPayload<{ include: typeof includeExpedientes }>;

const formatearPersona = (p: PersonaConExpedientes, meses: number) => ({
  ...p,
  trabajadores: p.trabajadores.map((t) => formatearTrabajador(t, meses)),
});

const idDeRuta = (req: Request): number => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) throw new BadRequestError('ID inválido');
  return id;
};

// ============================================
// CONSULTAS
// ============================================

/** GET /api/personas?busqueda=&page=&limit= */
export const listarPersonas = async (req: Request, res: Response): Promise<void> => {
  try {
    const busqueda = String(req.query.busqueda ?? '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const identificacion = busqueda.replace(/[^\dA-Za-z]/g, '');
    const where: Prisma.PersonaWhereInput = busqueda
      ? {
          OR: [
            ...(identificacion ? [{ numero_identificacion: { contains: identificacion.toUpperCase() } }] : []),
            {
              AND: busqueda.split(/\s+/).map((palabra) => ({
                OR: [
                  { nombres: { contains: palabra, mode: Prisma.QueryMode.insensitive } },
                  { apellidos: { contains: palabra, mode: Prisma.QueryMode.insensitive } },
                ],
              })),
            },
          ],
        }
      : {};

    const [total, personas] = await Promise.all([
      prisma.persona.count({ where }),
      prisma.persona.findMany({
        where,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { socios: true, trabajadores: true } } },
      }),
    ]);

    res.json({ success: true, data: personas, meta: { total, page, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    responderError(res, error, 'Error al listar las personas');
  }
};

/**
 * GET /api/personas/identificacion/:numero?tipo=V
 *
 * La consulta que hace todo formulario de alta al salir del campo de
 * identificación (FE-002). Devuelve la persona con sus expedientes y, para
 * los socios anteriores a la fase 2 que todavía no tienen persona, sus
 * expedientes sueltos: así tampoco se duplica a quien sólo existe como socio.
 */
export const buscarPorIdentificacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const tipo = z.enum(['V', 'E', 'J', 'P']).catch('V').parse(req.query.tipo);
    const numero = normalizarIdentificacion(tipo, String(req.params.numero ?? ''));

    const [persona, sociosSinPersona, meses] = await Promise.all([
      prisma.persona.findUnique({ where: { numero_identificacion: numero }, include: includeExpedientes }),
      prisma.socio.findMany({
        where: { cedula: numero, persona_id: null },
        select: {
          id: true,
          codigo_socio: true,
          nombre: true,
          apellido: true,
          sexo: true,
          fecha_nacimiento: true,
          telefono: true,
          email: true,
          direccion: true,
          estado: true,
          fecha_inscripcion: true,
        },
        orderBy: { fecha_inscripcion: 'desc' },
      }),
      mesesDePrueba(),
    ]);

    res.json({
      success: true,
      data: {
        numero_identificacion: numero,
        persona: persona ? formatearPersona(persona, meses) : null,
        socios_sin_persona: sociosSinPersona,
        advertencias_ahorrista: persona ? await advertenciasParaAhorrista(prisma, persona.id) : [],
      },
    });
  } catch (error) {
    responderError(res, error, 'Error al buscar la identificación');
  }
};

/** GET /api/personas/:id */
export const obtenerPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idDeRuta(req);
    const [persona, meses] = await Promise.all([
      prisma.persona.findUnique({ where: { id }, include: includeExpedientes }),
      mesesDePrueba(),
    ]);
    if (!persona) throw new NotFoundError('Persona no encontrada');
    res.json({ success: true, data: formatearPersona(persona, meses) });
  } catch (error) {
    responderError(res, error, 'Error al obtener la persona');
  }
};

/**
 * GET /api/personas/:id/resumen — ficha integral (HU-20): datos personales,
 * expedientes de trabajador y de ahorrista por separado, préstamos,
 * suspensiones e historial de cambios
 */
export const resumenPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const ficha = await fichaPersona(idDeRuta(req));
    if (!ficha) throw new NotFoundError('Persona no encontrada');
    res.json({ success: true, data: ficha });
  } catch (error) {
    responderError(res, error, 'Error al armar la ficha de la persona');
  }
};

// ============================================
// OPERACIONES
// ============================================

/** POST /api/personas */
export const crearPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = personaSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    const numero = normalizarIdentificacion(d.tipo_identificacion, d.numero_identificacion);
    const existente = await prisma.persona.findUnique({ where: { numero_identificacion: numero } });
    if (existente) {
      throw new ConflictError(
        `La identificación ${numero} ya está registrada a nombre de ${existente.nombres} ${existente.apellidos}. ` +
          'Agréguele el rol desde su registro en vez de crear otra persona.',
        { persona_id: existente.id }
      );
    }

    const persona = await prisma.$transaction(async (tx) => {
      const creada = await tx.persona.create({
        data: {
          ...datosPersona(d),
          nombres: d.nombres,
          apellidos: d.apellidos,
          numero_identificacion: numero,
          created_by: req.user?.userId ?? null,
        },
      });
      await registrarAuditoria(tx, { req, accion: 'CREAR', modulo: 'personas', registro_id: creada.id, despues: creada });
      return creada;
    });

    res.status(201).json({ success: true, data: persona, message: 'Persona registrada' });
  } catch (error) {
    responderError(res, error, 'Error al registrar la persona');
  }
};

/** PUT /api/personas/:id — los datos personales pasan también a sus expedientes ahorristas */
export const actualizarPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = idDeRuta(req);
    const validacion = actualizarPersonaSchema.safeParse(req.body);
    if (!validacion.success) return responderInvalido(res, validacion.error);
    const d = validacion.data;

    const actual = await prisma.persona.findUnique({
      where: { id },
      include: { _count: { select: { socios: true } } },
    });
    if (!actual) throw new NotFoundError('Persona no encontrada');

    let numero = actual.numero_identificacion;
    if (d.numero_identificacion !== undefined) {
      numero = normalizarIdentificacion(d.tipo_identificacion ?? actual.tipo_identificacion, d.numero_identificacion);
      if (numero !== actual.numero_identificacion) {
        if (actual._count.socios > 0) {
          throw new BadRequestError(
            'Esta persona tiene expedientes de ahorrista: corrija la cédula desde Socios, ' +
              'que es donde vive el número que usan la colecta y los reportes.'
          );
        }
        const otra = await prisma.persona.findUnique({ where: { numero_identificacion: numero } });
        if (otra) throw new ConflictError(`La identificación ${numero} ya pertenece a ${otra.nombres} ${otra.apellidos}`);
      }
    }

    const persona = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.persona.update({
        where: { id },
        data: { ...datosPersona(d), numero_identificacion: numero },
      });
      if (actual._count.socios > 0) await propagarPersonaASocios(tx, id);
      await registrarAuditoria(tx, {
        req,
        accion: 'ACTUALIZAR',
        modulo: 'personas',
        registro_id: id,
        antes: actual,
        despues: actualizada,
      });
      return actualizada;
    });

    res.json({ success: true, data: persona, message: 'Datos actualizados' });
  } catch (error) {
    responderError(res, error, 'Error al actualizar la persona');
  }
};
