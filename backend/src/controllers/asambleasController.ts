// ============================================
// COOPERATIVA EL TRIUNFO - CONTROLLER
// Asambleas y asistencia de socios
// ============================================
//
// Regla de negocio: en el año se realizan varias asambleas y se necesita saber
// si cada socio asistió AL MENOS A UNA. El reporte anual de inasistentes lista
// a los socios activos sin ninguna asistencia registrada en el año.

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logger } from '@/utils/logger';

// ============================================
// SCHEMAS DE VALIDACIÓN ZOD
// ============================================

const crearAsambleaSchema = z.object({
  titulo: z.string().min(3, 'El título es obligatorio').max(150),
  tipo: z.enum(['ordinaria', 'extraordinaria', 'sectorial']).default('ordinaria'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  ubicacion_id: z.number().int().positive().nullable().optional(),
  descripcion: z.string().max(2000).nullable().optional(),
});

const actualizarAsambleaSchema = crearAsambleaSchema.partial().extend({
  estado: z.boolean().optional(),
});

const registrarAsistenciaSchema = z.object({
  socio_id: z.number().int().positive(),
  observacion: z.string().max(500).nullable().optional(),
});

const registrarAsistenciaLoteSchema = z.object({
  socio_ids: z.array(z.number().int().positive()).min(1, 'Indique al menos un socio'),
});

// ============================================
// HELPERS
// ============================================

const anoDeFecha = (fecha: Date): number => fecha.getUTCFullYear();

/** Las asambleas sectoriales pertenecen a una feria; las demás son generales. */
const validarUbicacion = (tipo: string, ubicacionId: number | null | undefined): string | null => {
  if (tipo === 'sectorial' && !ubicacionId) {
    return 'Una asamblea sectorial debe indicar la feria a la que pertenece';
  }
  return null;
};

const errorInterno = (res: Response, error: unknown, mensaje: string): void => {
  logger.error(`${mensaje}:`, error);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: mensaje },
  });
};

// ============================================
// CONTROLADORES - ASAMBLEAS
// ============================================

/**
 * Listar asambleas. Filtros: ano, tipo, ubicacion_id.
 * Por defecto muestra el año en curso.
 */
export const obtenerAsambleas = async (req: Request, res: Response): Promise<void> => {
  try {
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : new Date().getFullYear();
    const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
    const ubicacionId = req.query.ubicacion_id ? parseInt(String(req.query.ubicacion_id), 10) : undefined;

    const where: Prisma.AsambleaWhereInput = { ano };
    if (tipo && tipo !== 'todos') {
      where.tipo = tipo as Prisma.EnumTipoAsambleaFilter['equals'];
    }
    if (ubicacionId) {
      where.ubicacion_id = ubicacionId;
    }

    const asambleas = await prisma.asamblea.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        ubicacion: { select: { id: true, codigo: true, nombre: true, direccion: true } },
        _count: { select: { asistencias: true } },
      },
    });

    res.json({ success: true, data: asambleas });
  } catch (error) {
    errorInterno(res, error, 'Error al obtener asambleas');
  }
};

/** Años que tienen al menos una asamblea registrada, para poblar el selector. */
export const obtenerAnosConAsambleas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const filas = await prisma.asamblea.findMany({
      distinct: ['ano'],
      select: { ano: true },
      orderBy: { ano: 'desc' },
    });

    const anos = filas.map((fila) => fila.ano);
    const anoActual = new Date().getFullYear();
    if (!anos.includes(anoActual)) {
      anos.unshift(anoActual);
    }

    res.json({ success: true, data: anos });
  } catch (error) {
    errorInterno(res, error, 'Error al obtener los años con asambleas');
  }
};

export const obtenerAsambleaPorId = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID inválido' } });
      return;
    }

    const asamblea = await prisma.asamblea.findUnique({
      where: { id },
      include: {
        ubicacion: { select: { id: true, codigo: true, nombre: true, direccion: true } },
        asistencias: {
          orderBy: { created_at: 'desc' },
          include: {
            socio: {
              select: {
                id: true,
                codigo_socio: true,
                cedula: true,
                nombre: true,
                apellido: true,
                estado: true,
                ubicacion: { select: { id: true, codigo: true, direccion: true } },
              },
            },
          },
        },
        _count: { select: { asistencias: true } },
      },
    });

    if (!asamblea) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asamblea no encontrada' } });
      return;
    }

    res.json({ success: true, data: asamblea });
  } catch (error) {
    errorInterno(res, error, 'Error al obtener la asamblea');
  }
};

export const crearAsamblea = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = crearAsambleaSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const datos = validacion.data;
    const errorUbicacion = validarUbicacion(datos.tipo, datos.ubicacion_id);
    if (errorUbicacion) {
      res.status(400).json({
        success: false,
        error: { code: 'UBICACION_REQUERIDA', message: errorUbicacion },
      });
      return;
    }

    const fecha = new Date(datos.fecha);
    if (isNaN(fecha.getTime())) {
      res.status(400).json({ success: false, error: { code: 'FECHA_INVALIDA', message: 'Fecha inválida' } });
      return;
    }

    const asamblea = await prisma.asamblea.create({
      data: {
        titulo: datos.titulo,
        tipo: datos.tipo,
        fecha,
        ano: anoDeFecha(fecha),
        ubicacion_id: datos.ubicacion_id ?? null,
        descripcion: datos.descripcion ?? null,
        creado_por: req.user?.userId ?? null,
      },
      include: { ubicacion: { select: { id: true, codigo: true, direccion: true } } },
    });

    logger.info(`Asamblea creada: ${asamblea.titulo} (${asamblea.fecha.toISOString().slice(0, 10)})`);
    res.status(201).json({ success: true, data: asamblea });
  } catch (error) {
    errorInterno(res, error, 'Error al crear la asamblea');
  }
};

export const actualizarAsamblea = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID inválido' } });
      return;
    }

    const validacion = actualizarAsambleaSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const existente = await prisma.asamblea.findUnique({ where: { id } });
    if (!existente) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asamblea no encontrada' } });
      return;
    }

    const datos = validacion.data;
    const tipoFinal = datos.tipo ?? existente.tipo;
    const ubicacionFinal = datos.ubicacion_id !== undefined ? datos.ubicacion_id : existente.ubicacion_id;

    const errorUbicacion = validarUbicacion(tipoFinal, ubicacionFinal);
    if (errorUbicacion) {
      res.status(400).json({
        success: false,
        error: { code: 'UBICACION_REQUERIDA', message: errorUbicacion },
      });
      return;
    }

    const cambios: Prisma.AsambleaUpdateInput = {};
    if (datos.titulo !== undefined) cambios.titulo = datos.titulo;
    if (datos.tipo !== undefined) cambios.tipo = datos.tipo;
    if (datos.descripcion !== undefined) cambios.descripcion = datos.descripcion;
    if (datos.estado !== undefined) cambios.estado = datos.estado;
    if (datos.ubicacion_id !== undefined) {
      cambios.ubicacion = datos.ubicacion_id
        ? { connect: { id: datos.ubicacion_id } }
        : { disconnect: true };
    }
    if (datos.fecha !== undefined) {
      const fecha = new Date(datos.fecha);
      if (isNaN(fecha.getTime())) {
        res.status(400).json({ success: false, error: { code: 'FECHA_INVALIDA', message: 'Fecha inválida' } });
        return;
      }
      cambios.fecha = fecha;
      // El año se mantiene sincronizado con la fecha: de él depende el reporte anual
      cambios.ano = anoDeFecha(fecha);
    }

    const asamblea = await prisma.asamblea.update({
      where: { id },
      data: cambios,
      include: { ubicacion: { select: { id: true, codigo: true, direccion: true } } },
    });

    res.json({ success: true, data: asamblea });
  } catch (error) {
    errorInterno(res, error, 'Error al actualizar la asamblea');
  }
};

/** Solo se elimina una asamblea sin asistencias; con asistencias se anula (estado=false). */
export const eliminarAsamblea = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID inválido' } });
      return;
    }

    const asamblea = await prisma.asamblea.findUnique({
      where: { id },
      include: { _count: { select: { asistencias: true } } },
    });

    if (!asamblea) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asamblea no encontrada' } });
      return;
    }

    if (asamblea._count.asistencias > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ASAMBLEA_CON_ASISTENCIAS',
          message: `La asamblea tiene ${asamblea._count.asistencias} asistencia(s) registrada(s). Desactívela en lugar de eliminarla.`,
        },
      });
      return;
    }

    await prisma.asamblea.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error) {
    errorInterno(res, error, 'Error al eliminar la asamblea');
  }
};

// ============================================
// CONTROLADORES - ASISTENCIA
// ============================================

export const registrarAsistencia = async (req: Request, res: Response): Promise<void> => {
  try {
    const asambleaId = parseInt(String(req.params.id), 10);
    if (isNaN(asambleaId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID inválido' } });
      return;
    }

    const validacion = registrarAsistenciaSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const asamblea = await prisma.asamblea.findUnique({ where: { id: asambleaId } });
    if (!asamblea) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asamblea no encontrada' } });
      return;
    }

    const socio = await prisma.socio.findUnique({ where: { id: validacion.data.socio_id } });
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }

    try {
      const asistencia = await prisma.asistenciaAsamblea.create({
        data: {
          asamblea_id: asambleaId,
          socio_id: socio.id,
          observacion: validacion.data.observacion ?? null,
          registrado_por: req.user?.userId ?? null,
        },
        include: {
          socio: {
            select: { id: true, codigo_socio: true, cedula: true, nombre: true, apellido: true, estado: true },
          },
        },
      });

      res.status(201).json({ success: true, data: asistencia });
    } catch (error) {
      // El índice único (asamblea_id, socio_id) evita el doble registro
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: { code: 'ASISTENCIA_DUPLICADA', message: 'El socio ya tiene asistencia registrada en esta asamblea' },
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    errorInterno(res, error, 'Error al registrar la asistencia');
  }
};

/** Registro por lote: ignora silenciosamente a los ya registrados. */
export const registrarAsistenciaLote = async (req: Request, res: Response): Promise<void> => {
  try {
    const asambleaId = parseInt(String(req.params.id), 10);
    if (isNaN(asambleaId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID inválido' } });
      return;
    }

    const validacion = registrarAsistenciaLoteSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validacion.error.errors },
      });
      return;
    }

    const asamblea = await prisma.asamblea.findUnique({ where: { id: asambleaId } });
    if (!asamblea) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asamblea no encontrada' } });
      return;
    }

    const resultado = await prisma.asistenciaAsamblea.createMany({
      data: validacion.data.socio_ids.map((socioId) => ({
        asamblea_id: asambleaId,
        socio_id: socioId,
        registrado_por: req.user?.userId ?? null,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({
      success: true,
      data: {
        registrados: resultado.count,
        omitidos: validacion.data.socio_ids.length - resultado.count,
      },
    });
  } catch (error) {
    errorInterno(res, error, 'Error al registrar las asistencias');
  }
};

export const eliminarAsistencia = async (req: Request, res: Response): Promise<void> => {
  try {
    const asambleaId = parseInt(String(req.params.id), 10);
    const socioId = parseInt(String(req.params.socioId), 10);
    if (isNaN(asambleaId) || isNaN(socioId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID inválido' } });
      return;
    }

    const asistencia = await prisma.asistenciaAsamblea.findUnique({
      where: { asamblea_id_socio_id: { asamblea_id: asambleaId, socio_id: socioId } },
    });

    if (!asistencia) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Asistencia no encontrada' } });
      return;
    }

    await prisma.asistenciaAsamblea.delete({ where: { id: asistencia.id } });
    res.json({ success: true, data: { asamblea_id: asambleaId, socio_id: socioId } });
  } catch (error) {
    errorInterno(res, error, 'Error al eliminar la asistencia');
  }
};

// ============================================
// CONSULTAS DE LA REGLA DE NEGOCIO
// ============================================

/**
 * ¿El socio asistió al menos a una asamblea en el año?
 * Devuelve además el detalle de a cuáles asistió.
 */
export const obtenerAsistenciaAnualDeSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(String(req.params.socioId), 10);
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : new Date().getFullYear();

    if (isNaN(socioId) || isNaN(ano)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Parámetros inválidos' } });
      return;
    }

    const [totalAsambleas, asistencias] = await Promise.all([
      prisma.asamblea.count({ where: { ano, estado: true } }),
      prisma.asistenciaAsamblea.findMany({
        where: { socio_id: socioId, asamblea: { ano, estado: true } },
        include: {
          asamblea: { select: { id: true, titulo: true, fecha: true, tipo: true } },
        },
        orderBy: { asamblea: { fecha: 'asc' } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        ano,
        total_asambleas: totalAsambleas,
        total_asistencias: asistencias.length,
        cumple: asistencias.length > 0, // La regla: al menos una asamblea en el año
        asambleas_asistidas: asistencias.map((a) => a.asamblea),
      },
    });
  } catch (error) {
    errorInterno(res, error, 'Error al consultar la asistencia del socio');
  }
};

/**
 * REPORTE ANUAL DE INASISTENTES.
 *
 * Socios activos que no registraron NINGUNA asistencia en el año indicado.
 * Filtros opcionales: ubicacion_id (feria) y excluir_nuevos.
 *
 * excluir_nuevos deja fuera a quienes se inscribieron después de la última
 * asamblea del año: no tuvieron ocasión de asistir y contarlos distorsiona
 * el indicador de participación.
 */
export const obtenerReporteInasistentes = async (req: Request, res: Response): Promise<void> => {
  try {
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : new Date().getFullYear();
    if (isNaN(ano)) {
      res.status(400).json({ success: false, error: { code: 'ANO_INVALIDO', message: 'Año inválido' } });
      return;
    }

    const ubicacionId = req.query.ubicacion_id ? parseInt(String(req.query.ubicacion_id), 10) : undefined;
    const excluirNuevos = String(req.query.excluir_nuevos ?? '') === 'true';

    const asambleasDelAno = await prisma.asamblea.findMany({
      where: { ano, estado: true },
      orderBy: { fecha: 'asc' },
      select: { id: true, titulo: true, fecha: true, tipo: true },
    });

    // Sin asambleas cargadas el reporte no significa nada: nadie pudo asistir.
    if (asambleasDelAno.length === 0) {
      res.json({
        success: true,
        data: {
          ano,
          sin_asambleas: true,
          asambleas: [],
          resumen: {
            total_socios_activos: 0,
            asistieron: 0,
            no_asistieron: 0,
            porcentaje_participacion: 0,
          },
          inasistentes: [],
        },
      });
      return;
    }

    const ultimaAsamblea = asambleasDelAno[asambleasDelAno.length - 1]!;

    const whereBase: Prisma.SocioWhereInput = { estado: 'activo' };
    if (ubicacionId) {
      whereBase.ubicacion_id = ubicacionId;
    }
    if (excluirNuevos) {
      whereBase.fecha_inscripcion = { lte: ultimaAsamblea.fecha };
    }

    const [totalActivos, inasistentes] = await Promise.all([
      prisma.socio.count({ where: whereBase }),
      prisma.socio.findMany({
        where: {
          ...whereBase,
          // El corazón de la regla: ninguna asistencia en asambleas del año
          asistencias_asamblea: { none: { asamblea: { ano, estado: true } } },
        },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        select: {
          id: true,
          codigo_socio: true,
          cedula: true,
          nombre: true,
          apellido: true,
          telefono: true,
          estado: true,
          fecha_inscripcion: true,
          ubicacion: { select: { id: true, codigo: true, nombre: true, direccion: true } },
        },
      }),
    ]);

    const asistieron = totalActivos - inasistentes.length;

    res.json({
      success: true,
      data: {
        ano,
        sin_asambleas: false,
        asambleas: asambleasDelAno,
        filtros: { ubicacion_id: ubicacionId ?? null, excluir_nuevos: excluirNuevos },
        resumen: {
          total_socios_activos: totalActivos,
          asistieron,
          no_asistieron: inasistentes.length,
          porcentaje_participacion:
            totalActivos > 0 ? Math.round((asistieron / totalActivos) * 1000) / 10 : 0,
        },
        inasistentes,
      },
    });
  } catch (error) {
    errorInterno(res, error, 'Error al generar el reporte de inasistentes');
  }
};

/** Resumen del año para las tarjetas de estadísticas. */
export const obtenerResumenAnual = async (req: Request, res: Response): Promise<void> => {
  try {
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : new Date().getFullYear();
    if (isNaN(ano)) {
      res.status(400).json({ success: false, error: { code: 'ANO_INVALIDO', message: 'Año inválido' } });
      return;
    }

    const [totalAsambleas, totalActivos, asistieron] = await Promise.all([
      prisma.asamblea.count({ where: { ano, estado: true } }),
      prisma.socio.count({ where: { estado: 'activo' } }),
      prisma.socio.count({
        where: {
          estado: 'activo',
          asistencias_asamblea: { some: { asamblea: { ano, estado: true } } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        ano,
        total_asambleas: totalAsambleas,
        total_socios_activos: totalActivos,
        asistieron,
        no_asistieron: totalActivos - asistieron,
        porcentaje_participacion:
          totalActivos > 0 ? Math.round((asistieron / totalActivos) * 1000) / 10 : 0,
      },
    });
  } catch (error) {
    errorInterno(res, error, 'Error al obtener el resumen anual');
  }
};
