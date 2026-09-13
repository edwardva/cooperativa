import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { validarCedula } from '../utils/cedula';
import { registrarAuditoria } from '../services/auditoriaService';

const prisma = new PrismaClient();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const crearSocioSchema = z.object({
  codigo_socio: z.string().min(1, 'Código de socio requerido').max(20),
  // El formato lo valida revisarCedula(): acepta 'V-12.345.678' y normaliza a dígitos
  cedula: z.string().min(1, 'Cédula requerida').max(20),
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
  apellido: z.string().min(2, 'Apellido debe tener al menos 2 caracteres').max(100),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email('Email inválido').max(100).optional().nullable().or(z.literal('')),
  fecha_inscripcion: z.string(),
  ubicacion_id: z.number().int().positive().optional().nullable(),
  autorizado_nombre: z.string().max(100).optional().nullable(),
  autorizado_cedula: z.string().max(11).regex(/^\d*$/, 'Cédula solo debe contener números').optional().nullable().or(z.literal('')),
  notas: z.string().optional().nullable(),
  foto_url: z.string().max(255).optional().nullable(),
  foto: z.string().optional(), // Base64 de la foto
  es_delegado: z.boolean().optional(),
});

const actualizarSocioSchema = z.object({
  codigo_socio: z.string().min(1).max(20).optional(),
  cedula: z.string().min(1).max(20).optional(),
  nombre: z.string().min(2).max(100).optional(),
  apellido: z.string().min(2).max(100).optional(),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email('Email inválido').max(100).optional().nullable().or(z.literal('')),
  fecha_inscripcion: z.string().optional(),
  ubicacion_id: z.number().int().positive().optional().nullable(),
  autorizado_nombre: z.string().max(100).optional().nullable(),
  autorizado_cedula: z.string().max(11).regex(/^\d*$/).optional().nullable().or(z.literal('')),
  notas: z.string().optional().nullable(),
  foto_url: z.string().max(255).optional().nullable(),
  foto: z.string().optional(), // Base64 de la foto
  es_delegado: z.boolean().optional(),
  estado: z.enum(['activo', 'retirado', 'invalido']).optional(),
});

const actualizarCodigoSocialSchema = z.object({
  codigo_social: z.string().max(30).nullable().or(z.literal('')),
});

const PARENTESCOS_BENEFICIARIO = [
  'No tiene',
  'Esposo',
  'Esposa',
  'Hijo',
  'Hija',
  'Padre',
  'Madre',
  'Abuelo',
  'Abuela',
  'Hermano',
  'Hermana',
  'Nieto',
  'Nieta',
  'Bisnieto',
  'Cuñado',
  'Cuñada',
  'Suegro',
  'Suegra',
  'Sobrino',
  'Tio',
  'Tia',
  'Primo',
  'Prima',
  'Yerno',
  'Yerna',
  'Ahijado',
  'Otro',
] as const;

const agregarBeneficiarioSchema = z.object({
  cedula: z.string().min(7).max(11).regex(/^\d+$/, 'Cédula solo debe contener números'),
  nombre: z.string().min(2).max(100),
  apellido: z.string().min(2).max(100),
  fecha_nacimiento: z.string().min(1, 'La fecha de nacimiento es requerida'),
  fecha_ingreso: z.string().min(1, 'La fecha de ingreso es requerida'),
  parentesco: z.enum(PARENTESCOS_BENEFICIARIO, { errorMap: () => ({ message: 'Selecciona un parentesco válido' }) }),
  telefono: z.string().max(20).optional().nullable(),
});

const actualizarBeneficiarioSchema = agregarBeneficiarioSchema.extend({
  estado: z.enum(['activo', 'inactivo', 'retirado', 'fallecido']).optional(),
  fecha_fallecimiento: z.string().optional().nullable(),
}).partial();

const retiroSocioSchema = z.object({
  fecha_retiro: z.string().min(1, 'Fecha de retiro requerida'),
  motivo_retiro: z.enum(['Fallecimiento', 'Renuncia', 'Pasividad']),
});

// ============================================
// HELPERS
// ============================================

/**
 * Valida y normaliza la cédula. Devuelve el mensaje de error si no es válida.
 * La validación es de formato/rango: confirma que el número sea plausible,
 * no que exista en el registro del CNE.
 */
const revisarCedula = (entrada: string): { cedula: string; error: string | null } => {
  const resultado = validarCedula(entrada);
  return { cedula: resultado.cedula, error: resultado.valida ? null : resultado.error ?? 'Cédula inválida' };
};

/**
 * Busca expedientes ACTIVOS con la misma cédula.
 *
 * No se bloquean los retirados a propósito: reingresar a un socio retirado con
 * un expediente nuevo es una operación legítima. Dos expedientes ACTIVOS para
 * la misma persona, en cambio, son casi siempre un alta duplicada por error.
 */
const buscarExpedientesActivosConCedula = async (cedula: string, excluirSocioId?: number) => {
  return prisma.socio.findMany({
    where: {
      cedula,
      estado: 'activo',
      ...(excluirSocioId ? { id: { not: excluirSocioId } } : {}),
    },
    select: { id: true, codigo_socio: true, nombre: true, apellido: true, fecha_inscripcion: true },
  });
};


/**
 * Convertir base64 a Buffer para almacenar en DB
 */
const convertirBase64ABuffer = (base64String: string): Buffer | null => {
  if (!base64String) {
    return null;
  }
  
  try {
    // Remover el prefijo data:image/...;base64, si existe
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    logger.error('Error convirtiendo base64 a Buffer:', error);
    return null;
  }
};

/**
 * Convertir Buffer a base64 para enviar al frontend
 */
const convertirBufferABase64 = (buffer: Buffer | null): string | null => {
  if (!buffer) {
    return null;
  }
  
  try {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    logger.error('Error convirtiendo Buffer a base64:', error);
    return null;
  }
};

/**
 * Preparar un socio para respuesta API (convertir foto Buffer a base64)
 */
const prepararSocioParaRespuesta = (socio: any) => {
  return {
    ...socio,
    foto: socio.foto ? convertirBufferABase64(socio.foto) : null,
  };
};

// Parentescos aceptados para un traspaso de socio (familiar directo únicamente)
const PARENTESCOS_TRASPASO_DIRECTO = [
  'Esposo',
  'Esposa',
  'Hijo',
  'Hija',
  'Padre',
  'Madre',
  'Hermano',
  'Hermana',
] as const;

const EDAD_MINIMA_TRASPASO = 60;

const traspasoSocioSchema = z.object({
  nueva_cedula: z.string().min(7, 'Cédula debe tener al menos 7 dígitos').max(11).regex(/^\d+$/, 'Cédula solo debe contener números'),
  nuevo_nombre: z.string().min(2).max(100),
  nuevo_apellido: z.string().min(2).max(100),
  nueva_fecha_nacimiento: z.string().min(1, 'La fecha de nacimiento del nuevo titular es requerida'),
  parentesco: z.enum(PARENTESCOS_TRASPASO_DIRECTO, {
    errorMap: () => ({ message: 'El traspaso solo se permite a un familiar directo (esposo/a, hijo/a, padre, madre, hermano/a)' }),
  }),
  nuevo_telefono: z.string().max(20).optional().nullable(),
  nuevo_email: z.string().email('Email inválido').max(100).optional().nullable().or(z.literal('')),
  nueva_direccion: z.string().max(500).optional().nullable(),
  motivo: z.string().min(10, 'Describe el motivo del traspaso (mínimo 10 caracteres)'),
  confirma_acuerdo_titular: z.boolean(),
  confirma_problemas_medicos: z.boolean(),
});

const calcularEdadDesde = (fechaNacimiento: Date): number => {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
    edad--;
  }
  return edad;
};

// ============================================
// CONTROLADORES - SOCIOS
// ============================================

/**
 * Obtener todos los socios con paginación y búsqueda optimizada
 * Query params: page, limit, search, estado, ubicacion_id
 * Búsqueda por: codigo_socio, cedula, nombre, apellido
 */
export const obtenerSocios = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || '';
    const estado = req.query.estado as string | undefined;
    const ubicacionId = req.query.ubicacion_id ? parseInt(req.query.ubicacion_id as string, 10) : undefined;

    const skip = (page - 1) * limit;

    // Construir filtros dinámicamente
    const where: any = {};

    // Filtro de búsqueda (codigo_socio, cedula, nombre, apellido)
    if (search) {
      where.OR = [
        { codigo_socio: { contains: search, mode: 'insensitive' } },
        { cedula: { contains: search } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por estado
    if (estado) {
      where.estado = estado;
    }

    // Filtro por ubicación
    if (ubicacionId) {
      where.ubicacion_id = ubicacionId;
    }

    // Obtener socios y conteo total
    const [socios, total] = await Promise.all([
      prisma.socio.findMany({
        where,
        skip,
        take: limit,
        include: {
          ubicacion: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              direccion: true,
            },
          },
          _count: {
            select: {
              beneficiarios: true,
              cuentas_ahorro: true,
              prestamos: true,
            },
          },
        },
        orderBy: [
          { estado: 'asc' }, // activo primero
          { apellido: 'asc' },
          { nombre: 'asc' },
        ],
      }),
      prisma.socio.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: socios.map(prepararSocioParaRespuesta),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Error al obtener socios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener socios',
      },
    });
  }
};

/**
 * Obtener un socio por ID
 */
export const obtenerSocioPorId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID inválido',
        },
      });
      return;
    }

    const socioId = parseInt(id, 10);

    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      include: {
        ubicacion: true,
        beneficiarios: {
          where: { estado: { not: 'retirado' } },
          orderBy: { created_at: 'asc' },
        },
        cuentas_ahorro: {
          include: {
            tipo_cuenta: true,
          },
        },
        _count: {
          select: {
            prestamos: true,
            prestamos_como_fiador: true,
          },
        },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: prepararSocioParaRespuesta(socio),
    });
  } catch (error) {
    logger.error('Error al obtener socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener socio',
      },
    });
  }
};

/**
 * Buscar socio(s) por cédula
 * GET /api/socios/buscar/:cedula
 * NOTA: Retorna array porque una cédula puede tener múltiples expedientes
 */
export const buscarSocioPorCedula = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cedula } = req.params;

    if (!cedula) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CEDULA',
          message: 'Cédula inválida',
        },
      });
      return;
    }

    // Buscar TODOS los socios con esta cédula (pueden haber múltiples expedientes)
    const socios = await prisma.socio.findMany({
      where: { cedula },
      orderBy: [
        { estado: 'asc' }, // Activos primero
        { codigo_socio: 'asc' }, // Luego por expediente
      ],
      include: {
        ubicacion: {
          select: {
            codigo: true,
            nombre: true,
            direccion: true,
          },
        },
        cuentas_ahorro: {
          where: { estado: true },
          include: {
            tipo_cuenta: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (socios.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    // Retornar todos los socios encontrados
    // El frontend decidirá qué hacer si hay múltiples expedientes
    res.status(200).json({
      success: true,
      data: socios,
      meta: {
        total: socios.length,
        multipleExpedientes: socios.length > 1,
      },
    });
  } catch (error) {
    logger.error('Error al buscar socio por cédula:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al buscar socio',
      },
    });
  }
};

/**
 * Crear un nuevo socio
 */
export const crearSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const validacion = crearSocioSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const datos = validacion.data;

    // Validar y normalizar la cédula antes de cualquier consulta
    const { cedula, error: errorCedula } = revisarCedula(datos.cedula);
    if (errorCedula) {
      res.status(400).json({
        success: false,
        error: { code: 'CEDULA_INVALIDA', message: errorCedula },
      });
      return;
    }
    datos.cedula = cedula;

    // Un socio activo no puede tener dos expedientes abiertos con la misma cédula
    const expedientesActivos = await buscarExpedientesActivosConCedula(cedula);
    if (expedientesActivos.length > 0) {
      const listado = expedientesActivos.map((s) => s.codigo_socio).join(', ');
      res.status(409).json({
        success: false,
        error: {
          code: 'CEDULA_DUPLICADA',
          message: `La cédula ${cedula} ya tiene expediente activo: ${listado}`,
          details: expedientesActivos,
        },
      });
      return;
    }

    // Validar código de socio único
    const codigoExistente = await prisma.socio.findUnique({
      where: { codigo_socio: datos.codigo_socio },
    });

    if (codigoExistente) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CODIGO_DUPLICADO',
          message: `El código de socio ${datos.codigo_socio} ya existe`,
        },
      });
      return;
    }

    // Validar ubicación si se proporciona
    if (datos.ubicacion_id) {
      const ubicacion = await prisma.ubicacion.findUnique({
        where: { id: datos.ubicacion_id },
      });

      if (!ubicacion) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UBICACION_NOT_FOUND',
            message: 'Ubicación no encontrada',
          },
        });
        return;
      }
    }

    // Convertir foto de base64 a Buffer si se proporciona
    const fotoBuffer = datos.foto ? convertirBase64ABuffer(datos.foto) : null;

    // Crear socio
    const socio = await prisma.socio.create({
      data: {
        codigo_socio: datos.codigo_socio,
        cedula: datos.cedula,
        nombre: datos.nombre,
        apellido: datos.apellido,
        sexo: datos.sexo,
        fecha_nacimiento: datos.fecha_nacimiento ? new Date(datos.fecha_nacimiento) : null,
        direccion: datos.direccion,
        telefono: datos.telefono,
        email: datos.email || null,
        fecha_inscripcion: new Date(datos.fecha_inscripcion),
        ubicacion_id: datos.ubicacion_id,
        autorizado_nombre: datos.autorizado_nombre,
        autorizado_cedula: datos.autorizado_cedula || null,
        notas: datos.notas,
        foto_url: datos.foto_url,
        foto: fotoBuffer,
        es_delegado: datos.es_delegado || false,
      },
      include: {
        ubicacion: true,
      },
    });

    // Audit log
    await registrarAuditoria(prisma, {
      req,
      accion: 'CREAR',
      modulo: 'socios',
      registro_id: socio.id,
      despues: socio,
    });

    logger.info(`Socio creado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.status(201).json({
      success: true,
      data: prepararSocioParaRespuesta(socio),
    });
  } catch (error) {
    logger.error('Error al crear socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al crear socio',
      },
    });
  }
};

/**
 * Actualizar un socio
 */
export const actualizarSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID inválido',
        },
      });
      return;
    }

    const socioId = parseInt(id, 10);

    const validacion = actualizarSocioSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const datos = validacion.data;

    // Verificar que el socio existe
    const socioExistente = await prisma.socio.findUnique({
      where: { id: socioId },
    });

    if (!socioExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    // La cédula solo se valida SI CAMBIA. Hay 215 registros heredados de la
    // migración con cédulas inválidas (placeholders TEMP######, valores fuera de
    // rango); exigirles formato válido impediría editarles el teléfono o la feria.
    if (datos.cedula !== undefined) {
      // Se compara el valor CRUDO contra el guardado: si el formulario devuelve
      // el mismo texto que cargó, no hay edición de cédula aunque el valor
      // almacenado no supere la validación actual.
      const cambia = datos.cedula !== socioExistente.cedula;

      if (cambia) {
        const { cedula, error: errorCedula } = revisarCedula(datos.cedula);

        if (errorCedula) {
          res.status(400).json({
            success: false,
            error: { code: 'CEDULA_INVALIDA', message: errorCedula },
          });
          return;
        }

        const expedientesActivos = await buscarExpedientesActivosConCedula(cedula, socioId);
        if (expedientesActivos.length > 0) {
          const listado = expedientesActivos.map((s) => s.codigo_socio).join(', ');
          res.status(409).json({
            success: false,
            error: {
              code: 'CEDULA_DUPLICADA',
              message: `La cédula ${cedula} ya tiene expediente activo: ${listado}`,
              details: expedientesActivos,
            },
          });
          return;
        }

        datos.cedula = cedula;
      } else {
        // Sin cambio real: se conserva el valor existente tal cual está guardado
        datos.cedula = socioExistente.cedula;
      }
    }

    // Validar código de socio único si se está cambiando
    if (datos.codigo_socio && datos.codigo_socio !== socioExistente.codigo_socio) {
      const codigoExistente = await prisma.socio.findUnique({
        where: { codigo_socio: datos.codigo_socio },
      });

      if (codigoExistente) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CODIGO_DUPLICADO',
            message: `El código de socio ${datos.codigo_socio} ya existe`,
          },
        });
        return;
      }
    }

    // Validar ubicación si se proporciona
    if (datos.ubicacion_id) {
      const ubicacion = await prisma.ubicacion.findUnique({
        where: { id: datos.ubicacion_id },
      });

      if (!ubicacion) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UBICACION_NOT_FOUND',
            message: 'Ubicación no encontrada',
          },
        });
        return;
      }
    }

    // Preparar datos de actualización
    const datosActualizacion: any = { ...datos };
    if (datos.fecha_nacimiento) {
      datosActualizacion.fecha_nacimiento = new Date(datos.fecha_nacimiento);
    }
    if (datos.fecha_inscripcion) {
      datosActualizacion.fecha_inscripcion = new Date(datos.fecha_inscripcion);
    }
    if (datos.email === '') {
      datosActualizacion.email = null;
    }
    if (datos.autorizado_cedula === '') {
      datosActualizacion.autorizado_cedula = null;
    }
    // Convertir foto de base64 a Buffer si se proporciona
    if (datos.foto) {
      datosActualizacion.foto = convertirBase64ABuffer(datos.foto);
    }

    // Actualizar socio
    const socio = await prisma.socio.update({
      where: { id: socioId },
      data: datosActualizacion,
      include: {
        ubicacion: true,
      },
    });

    // Audit log
    await registrarAuditoria(prisma, {
      req,
      accion: 'ACTUALIZAR',
      modulo: 'socios',
      registro_id: socio.id,
      antes: socioExistente,
      despues: socio,
    });

    logger.info(`Socio actualizado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.json({
      success: true,
      data: prepararSocioParaRespuesta(socio),
    });
  } catch (error) {
    logger.error('Error al actualizar socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar socio',
      },
    });
  }
};

/**
 * Actualizar únicamente el código de programas sociales de un socio.
 * Endpoint dedicado y acotado a este único campo (usado desde el botón
 * "Sociales" del listado de Funeraria).
 * PATCH /api/socios/:id/codigo-social
 */
export const actualizarCodigoSocial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    const socioId = parseInt(id, 10);
    const validacion = actualizarCodigoSocialSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const socioExistente = await prisma.socio.findUnique({ where: { id: socioId } });

    if (!socioExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    const codigoSocial = validacion.data.codigo_social || null;

    const socio = await prisma.socio.update({
      where: { id: socioId },
      data: { codigo_social: codigoSocial },
    });

    await registrarAuditoria(prisma, {
      req,
      accion: 'ACTUALIZAR_COD_SOCIAL',
      modulo: 'socios',
      registro_id: socio.id,
      antes: { codigo_social: socioExistente.codigo_social },
      despues: { codigo_social: socio.codigo_social },
    });

    logger.info(`Código social actualizado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.json({
      success: true,
      data: socio,
    });
  } catch (error) {
    logger.error('Error al actualizar código social:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar código social',
      },
    });
  }
};

/**
 * Retirar un socio con fecha y motivo
 */
export const retirarSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID inválido',
        },
      });
      return;
    }

    const socioId = parseInt(id, 10);
    const datos = retiroSocioSchema.parse(req.body);

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    if (socio.estado === 'retirado') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SOCIO_YA_RETIRADO',
          message: 'El socio ya está retirado',
        },
      });
      return;
    }

    const prestamosActivos = await prisma.prestamo.count({
      where: {
        socio_id: socioId,
        estado: { in: ['activo', 'moroso'] },
      },
    });

    if (prestamosActivos > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIENE_PRESTAMOS_ACTIVOS',
          message: `El socio tiene ${prestamosActivos} préstamo(s) activo(s)`,
        },
      });
      return;
    }

    const cuentasConSaldo = await prisma.cuentaAhorro.count({
      where: {
        socio_id: socioId,
        OR: [{ saldo_bs: { gt: 0 } }, { saldo_usd: { gt: 0 } }],
      },
    });

    if (cuentasConSaldo > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIENE_SALDO',
          message: `El socio tiene ${cuentasConSaldo} cuenta(s) con saldo`,
        },
      });
      return;
    }

    const notaRetiro = `[RETIRO] Fecha: ${datos.fecha_retiro} | Motivo: ${datos.motivo_retiro} | Usuario: ${req.user!.userId}`;
    const notasActualizadas = [socio.notas?.trim(), notaRetiro].filter(Boolean).join('\n');

    const socioActualizado = await prisma.socio.update({
      where: { id: socioId },
      data: {
        estado: 'retirado',
        notas: notasActualizadas,
      },
    });

    await registrarAuditoria(prisma, {
      req,
      accion: 'RETIRAR',
      modulo: 'socios',
      registro_id: socio.id,
      antes: socio,
      despues: socioActualizado,
    });

    logger.info(`Socio retirado: ${socio.codigo_socio} - ${socio.nombre} ${socio.apellido}`);

    res.json({
      success: true,
      data: prepararSocioParaRespuesta(socioActualizado),
    });
  } catch (error) {
    logger.error('Error al retirar socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al retirar socio',
      },
    });
  }
};

/**
 * Buscar socio por número de expediente (código de socio) exacto
 * GET /api/socios/expediente/:codigo
 */
export const buscarSocioPorExpediente = async (req: Request, res: Response): Promise<void> => {
  try {
    const { codigo } = req.params;

    if (!codigo) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EXPEDIENTE',
          message: 'Número de expediente inválido',
        },
      });
      return;
    }

    const socio = await prisma.socio.findUnique({
      where: { codigo_socio: codigo },
      include: {
        ubicacion: { select: { nombre: true } },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: `No se encontró ningún socio con el expediente ${codigo}`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: socio,
    });
  } catch (error) {
    logger.error('Error al buscar socio por expediente:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al buscar socio por expediente',
      },
    });
  }
};

/**
 * Traspasar la titularidad de un socio a un familiar directo.
 * Requiere: un acuerdo de funeraria activo, socio con 60 años o más,
 * conformidad del titular y problemas médicos que motiven el traspaso. El
 * expediente (codigo_socio) y todo su historial (acuerdos, beneficiarios,
 * cuentas, préstamos) se mantienen; solo cambian los datos de identidad del
 * titular.
 * POST /api/socios/:id/traspaso
 */
export const traspasarSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    const socioId = parseInt(id, 10);
    const validacion = traspasoSocioSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const datos = validacion.data;

    if (!datos.confirma_acuerdo_titular) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CONFIRMACION_REQUERIDA',
          message: 'Debe confirmar que el titular está de acuerdo con el traspaso',
        },
      });
      return;
    }

    if (!datos.confirma_problemas_medicos) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CONFIRMACION_REQUERIDA',
          message: 'El traspaso solo procede si el titular presenta problemas médicos que lo motiven',
        },
      });
      return;
    }

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    if (socio.estado === 'retirado') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SOCIO_RETIRADO',
          message: 'No se puede traspasar un socio retirado',
        },
      });
      return;
    }

    const acuerdoFunerariaActivo = await prisma.acuerdoFuneraria.findFirst({
      where: { beneficiario: { socio_id: socioId }, estado: 'activo' },
    });

    if (!acuerdoFunerariaActivo) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ACUERDO_NO_ACTIVO',
          message: 'El traspaso solo puede realizarse si el socio tiene un acuerdo de funeraria activo',
        },
      });
      return;
    }

    if (!socio.fecha_nacimiento) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FECHA_NACIMIENTO_REQUERIDA',
          message: 'El socio no tiene fecha de nacimiento registrada; no es posible validar la edad mínima para el traspaso',
        },
      });
      return;
    }

    const edad = calcularEdadDesde(socio.fecha_nacimiento);
    if (edad < EDAD_MINIMA_TRASPASO) {
      res.status(400).json({
        success: false,
        error: {
          code: 'EDAD_INSUFICIENTE',
          message: `El traspaso solo procede si el titular tiene ${EDAD_MINIMA_TRASPASO} años o más (edad actual: ${edad})`,
        },
      });
      return;
    }

    if (datos.nueva_cedula === socio.cedula) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CEDULA_INVALIDA',
          message: 'La cédula del nuevo titular debe ser diferente a la del titular actual',
        },
      });
      return;
    }

    // Socio.cedula no es única (una cédula puede tener varios expedientes),
    // por eso la búsqueda es findFirst y no findUnique.
    const cedulaEnUso = await prisma.socio.findFirst({ where: { cedula: datos.nueva_cedula } });
    if (cedulaEnUso) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CEDULA_DUPLICADA',
          message: `La cédula ${datos.nueva_cedula} ya pertenece a otro socio`,
        },
      });
      return;
    }

    // La cédula de Beneficiario también es única a nivel de base de datos, así
    // que no puede coincidir con ninguna fila existente (ni de este socio ni de
    // otro): la fila "titular" quedará con esta cédula al finalizar el traspaso.
    const cedulaEnUsoBeneficiario = await prisma.beneficiario.findFirst({
      where: { cedula: datos.nueva_cedula, NOT: { parentesco: { equals: 'titular', mode: 'insensitive' } } },
    });
    if (cedulaEnUsoBeneficiario) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CEDULA_DUPLICADA',
          message:
            cedulaEnUsoBeneficiario.socio_id === socioId
              ? `La cédula ${datos.nueva_cedula} ya está registrada como beneficiario (${cedulaEnUsoBeneficiario.parentesco}) de este mismo socio. Retire ese beneficiario antes de continuar con el traspaso.`
              : `La cédula ${datos.nueva_cedula} ya está registrada como beneficiario de otro socio`,
        },
      });
      return;
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const notaTraspaso = `[TRASPASO ${fechaHoy}] Titular anterior: ${socio.nombre} ${socio.apellido} (C.I. ${socio.cedula}) -> Nuevo titular: ${datos.nuevo_nombre} ${datos.nuevo_apellido} (C.I. ${datos.nueva_cedula}), parentesco: ${datos.parentesco}. Motivo: ${datos.motivo}. Usuario: ${req.user!.userId}`;
    const notasActualizadas = [socio.notas?.trim(), notaTraspaso].filter(Boolean).join('\n');

    const socioActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.socio.update({
        where: { id: socioId },
        data: {
          cedula: datos.nueva_cedula,
          nombre: datos.nuevo_nombre,
          apellido: datos.nuevo_apellido,
          fecha_nacimiento: new Date(datos.nueva_fecha_nacimiento),
          telefono: datos.nuevo_telefono || socio.telefono,
          email: datos.nuevo_email || socio.email,
          direccion: datos.nueva_direccion || socio.direccion,
          notas: notasActualizadas,
        },
      });

      // Mantener sincronizada la fila "titular" autogenerada de Beneficiario
      // (se usa para imprimir la ficha del acuerdo de funeraria).
      await tx.beneficiario.updateMany({
        where: { socio_id: socioId, parentesco: { equals: 'titular', mode: 'insensitive' } },
        data: {
          cedula: datos.nueva_cedula,
          nombre: datos.nuevo_nombre,
          apellido: datos.nuevo_apellido,
          fecha_nacimiento: new Date(datos.nueva_fecha_nacimiento),
        },
      });

      return actualizado;
    });

    await registrarAuditoria(prisma, {
      req,
      accion: 'TRASPASO',
      modulo: 'socios',
      registro_id: socio.id,
      antes: socio,
      despues: socioActualizado,
    });

    logger.info(
      `Socio traspasado: expediente ${socio.codigo_socio} de ${socio.nombre} ${socio.apellido} a ${datos.nuevo_nombre} ${datos.nuevo_apellido}`
    );

    res.json({
      success: true,
      data: socioActualizado,
    });
  } catch (error) {
    logger.error('Error al traspasar socio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al traspasar socio',
      },
    });
  }
};

// ============================================
// CONTROLADORES - BENEFICIARIOS
// ============================================

/**
 * Obtener beneficiarios de un socio
 */
export const obtenerBeneficiarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId } = req.params;

    if (!socioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    const id = parseInt(socioId, 10);
    const incluirRetirados = req.query.incluirRetirados === 'true';

    const beneficiarios = await prisma.beneficiario.findMany({
      where: {
        socio_id: id,
        ...(incluirRetirados ? {} : { estado: { not: 'retirado' } }),
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    res.json({
      success: true,
      data: beneficiarios,
    });
  } catch (error) {
    logger.error('Error al obtener beneficiarios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener beneficiarios',
      },
    });
  }
};

/**
 * Agregar beneficiario a un socio
 */
export const agregarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId } = req.params;

    if (!socioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de socio inválido',
        },
      });
      return;
    }

    const id = parseInt(socioId, 10);

    const validacion = agregarBeneficiarioSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const datos = validacion.data;

    // Verificar que el socio existe
    const socio = await prisma.socio.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            beneficiarios: true,
          },
        },
      },
    });

    if (!socio) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SOCIO_NOT_FOUND',
          message: 'Socio no encontrado',
        },
      });
      return;
    }

    // Validar límite de 8 beneficiarios activos (sumando al titular, 9 personas en total).
    // Los que pasaron a 'fallecido' o 'retirado' liberan su cupo. La fila de
    // Beneficiario con parentesco 'titular' (creada por la migración para
    // representar al propio socio) no cuenta como cupo de familia.
    const beneficiariosActivos = await prisma.beneficiario.count({
      where: {
        socio_id: id,
        estado: 'activo',
        NOT: { parentesco: { equals: 'titular', mode: 'insensitive' } },
      },
    });

    if (beneficiariosActivos >= 8) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LIMITE_BENEFICIARIOS',
          message: 'Un socio no puede tener más de 8 beneficiarios activos (9 personas en total, incluyendo al titular)',
        },
      });
      return;
    }

    // Validar cédula única
    const cedulaExistente = await prisma.beneficiario.findUnique({
      where: { cedula: datos.cedula },
    });

    if (cedulaExistente) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CEDULA_DUPLICADA',
          message: `La cédula ${datos.cedula} ya está registrada como beneficiario`,
        },
      });
      return;
    }

    // Crear beneficiario
    const beneficiario = await prisma.beneficiario.create({
      data: {
        socio_id: id,
        cedula: datos.cedula,
        nombre: datos.nombre,
        apellido: datos.apellido,
        fecha_nacimiento: new Date(datos.fecha_nacimiento),
        fecha_ingreso: new Date(datos.fecha_ingreso),
        parentesco: datos.parentesco,
        telefono: datos.telefono,
      },
    });

    // Audit log
    await registrarAuditoria(prisma, {
      req,
      accion: 'CREAR',
      modulo: 'beneficiarios',
      registro_id: beneficiario.id,
      despues: beneficiario,
    });

    logger.info(`Beneficiario agregado: ${beneficiario.nombre} ${beneficiario.apellido} al socio ${socio.codigo_socio}`);

    res.status(201).json({
      success: true,
      data: beneficiario,
    });
  } catch (error) {
    logger.error('Error al agregar beneficiario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al agregar beneficiario',
      },
    });
  }
};

/**
 * Actualizar beneficiario
 */
export const actualizarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId, beneficiarioId } = req.params;

    if (!socioId || !beneficiarioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'IDs inválidos',
        },
      });
      return;
    }

    const validacion = actualizarBeneficiarioSchema.safeParse(req.body);

    if (!validacion.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: validacion.error.errors,
        },
      });
      return;
    }

    const datos = validacion.data;
    const id = parseInt(beneficiarioId, 10);

    // Verificar que el beneficiario existe y pertenece al socio
    const beneficiarioExistente = await prisma.beneficiario.findFirst({
      where: {
        id,
        socio_id: parseInt(socioId, 10),
      },
    });

    if (!beneficiarioExistente) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BENEFICIARIO_NOT_FOUND',
          message: 'Beneficiario no encontrado',
        },
      });
      return;
    }

    // Validar cédula única si se está cambiando
    if (datos.cedula && datos.cedula !== beneficiarioExistente.cedula) {
      const cedulaExistente = await prisma.beneficiario.findUnique({
        where: { cedula: datos.cedula },
      });

      if (cedulaExistente) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CEDULA_DUPLICADA',
            message: `La cédula ${datos.cedula} ya está registrada como beneficiario`,
          },
        });
        return;
      }
    }

    // Preparar datos de actualización
    const datosActualizacion: any = { ...datos };
    if (datos.fecha_nacimiento) {
      datosActualizacion.fecha_nacimiento = new Date(datos.fecha_nacimiento);
    }
    if (datos.fecha_ingreso) {
      datosActualizacion.fecha_ingreso = new Date(datos.fecha_ingreso);
    }
    if (datos.fecha_fallecimiento) {
      datosActualizacion.fecha_fallecimiento = new Date(datos.fecha_fallecimiento);
    }

    // Actualizar beneficiario
    const beneficiario = await prisma.beneficiario.update({
      where: { id },
      data: datosActualizacion,
    });

    // Audit log
    await registrarAuditoria(prisma, {
      req,
      accion: 'ACTUALIZAR',
      modulo: 'beneficiarios',
      registro_id: beneficiario.id,
      antes: beneficiarioExistente,
      despues: beneficiario,
    });

    logger.info(`Beneficiario actualizado: ${beneficiario.nombre} ${beneficiario.apellido}`);

    res.json({
      success: true,
      data: beneficiario,
    });
  } catch (error) {
    logger.error('Error al actualizar beneficiario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar beneficiario',
      },
    });
  }
};

/**
 * Eliminar beneficiario (soft delete)
 */
export const eliminarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { socioId, beneficiarioId } = req.params;

    if (!socioId || !beneficiarioId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'IDs inválidos',
        },
      });
      return;
    }

    const id = parseInt(beneficiarioId, 10);

    // Verificar que el beneficiario existe y pertenece al socio
    const beneficiario = await prisma.beneficiario.findFirst({
      where: {
        id,
        socio_id: parseInt(socioId, 10),
      },
    });

    if (!beneficiario) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BENEFICIARIO_NOT_FOUND',
          message: 'Beneficiario no encontrado',
        },
      });
      return;
    }

    // Validar que no tenga acuerdos activos
    const [acuerdosFunerariaActivos, acuerdosSaludActivos] = await Promise.all([
      prisma.acuerdoFuneraria.count({
        where: {
          beneficiario_id: id,
          estado: { in: ['activo', 'suspendido'] },
        },
      }),
      prisma.acuerdoSalud.count({
        where: {
          beneficiario_id: id,
          estado: { in: ['activo', 'suspendido'] },
        },
      }),
    ]);

    if (acuerdosFunerariaActivos > 0 || acuerdosSaludActivos > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TIENE_ACUERDOS_ACTIVOS',
          message: `El beneficiario tiene acuerdos activos (Funeraria: ${acuerdosFunerariaActivos}, Salud: ${acuerdosSaludActivos})`,
        },
      });
      return;
    }

    // Soft delete
    const beneficiarioActualizado = await prisma.beneficiario.update({
      where: { id },
      data: {
        estado: 'retirado',
      },
    });

    // Audit log
    await registrarAuditoria(prisma, {
      req,
      accion: 'ELIMINAR',
      modulo: 'beneficiarios',
      registro_id: beneficiario.id,
      antes: beneficiario,
      despues: beneficiarioActualizado,
    });

    logger.info(`Beneficiario eliminado (soft delete): ${beneficiario.nombre} ${beneficiario.apellido}`);

    res.json({
      success: true,
      data: beneficiarioActualizado,
    });
  } catch (error) {
    logger.error('Error al eliminar beneficiario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al eliminar beneficiario',
      },
    });
  }
};

// ============================================
// REPORTES Y ESTADÍSTICAS
// ============================================

/**
 * Obtener estadísticas generales de socios
 */
export const obtenerEstadisticasSocios = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalSocios,
      sociosActivos,
      sociosRetirados,
      sociosPorUbicacion,
      totalBeneficiarios,
    ] = await Promise.all([
      prisma.socio.count(),
      prisma.socio.count({ where: { estado: 'activo' } }),
      prisma.socio.count({ where: { estado: 'retirado' } }),
      prisma.socio.groupBy({
        by: ['ubicacion_id'],
        _count: true,
      }),
      prisma.beneficiario.count({ where: { estado: 'activo' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalSocios,
        sociosActivos,
        sociosRetirados,
        sociosPorUbicacion,
        totalBeneficiarios,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de socios:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estadísticas',
      },
    });
  }
};
