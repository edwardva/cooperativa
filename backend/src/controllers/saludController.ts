/**
 * ============================================
 * CONTROLLER: SALUD
 * ============================================
 * Gestión de acuerdos de servicio de salud.
 *
 * A diferencia de Funeraria (un acuerdo independiente por beneficiario), en
 * Salud hasta 9 personas (1 titular + 8 beneficiarios) comparten UN mismo
 * "número de acuerdo" con una sola cuota familiar: cada persona sigue
 * teniendo su propia fila en AcuerdoSalud (una por beneficiario), pero todas
 * comparten el mismo valor de numero_acuerdo, y la suspensión/reactivación
 * por falta de pago se aplica a todo el grupo a la vez.
 */

import type { Request, Response } from 'express';
import { Prisma, type AcuerdoSalud, type Beneficiario } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { registrarAuditoria } from '../services/auditoriaService';
import { bloquearSocios } from '../utils/bloqueos';
import { motivoNoHabilitado, RESPUESTA_NO_HABILITADO } from '../utils/socioHabilitado';

// REGLA DE NEGOCIO: Suspensión automática a las 11 semanas sin pago
const SEMANAS_LIMITE_SUSPENSION = 11;
const SEMANAS_ALERTA_PROXIMO_SUSPENDER = 10;
const MAX_BENEFICIARIOS_POR_GRUPO = 8; // + 1 titular = 9 personas máximo

// Mismo catálogo que sociosController.ts (duplicado intencionalmente: Salud
// crea filas de Beneficiario directamente al armar un grupo nuevo).
const PARENTESCOS_BENEFICIARIO = [
  'No tiene', 'Esposo', 'Esposa', 'Hijo', 'Hija', 'Padre', 'Madre', 'Abuelo', 'Abuela',
  'Hermano', 'Hermana', 'Nieto', 'Nieta', 'Bisnieto', 'Cuñado', 'Cuñada', 'Suegro', 'Suegra',
  'Sobrino', 'Tio', 'Tia', 'Primo', 'Prima', 'Yerno', 'Yerna', 'Ahijado', 'Otro',
] as const;

// Mismos motivos que sociosController.retiroSocioSchema
const MOTIVOS_RETIRO = ['Socio', 'Voluntario', 'Art. 5'] as const;

type TxClient = Prisma.TransactionClient;

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const beneficiarioGrupoSchema = z.object({
  cedula: z.string().trim().min(7, 'Cédula debe tener al menos 7 dígitos').max(11).regex(/^\d+$/, 'Cédula solo debe contener números'),
  nombre: z.string().trim().min(2).max(100),
  apellido: z.string().trim().min(2).max(100),
  fecha_nacimiento: z.string().min(1, 'La fecha de nacimiento es requerida'),
  fecha_ingreso: z.string().min(1, 'La fecha de ingreso es requerida'),
  parentesco: z.enum(PARENTESCOS_BENEFICIARIO, { errorMap: () => ({ message: 'Selecciona un parentesco válido' }) }),
  estado: z.enum(['activo', 'fallecido']).optional().default('activo'),
  telefono: z.string().max(20).optional().nullable(),
});

const crearGrupoAcuerdoSchema = z
  .object({
    socio_id: z.number().int().positive(),
    tipo_acuerdo_id: z.number().int().positive(),
    numero_acuerdo: z.string().trim().min(1, 'El número de acuerdo es requerido').max(20),
    numero_contrato: z.string().trim().max(20).optional(),
    fecha_inicio: z.string().optional(),
    beneficiarios: z.array(beneficiarioGrupoSchema).max(MAX_BENEFICIARIOS_POR_GRUPO).default([]),
  })
  .refine(
    (data) => new Set(data.beneficiarios.map((b) => b.cedula)).size === data.beneficiarios.length,
    { message: 'Hay cédulas duplicadas en la lista de beneficiarios', path: ['beneficiarios'] }
  );

const actualizarGrupoAcuerdoSchema = z.object({
  numero_acuerdo_nuevo: z.string().trim().min(1).max(20).optional(),
  numero_contrato: z.string().trim().max(20).optional().nullable(),
  tipo_acuerdo_id: z.number().int().positive().optional(),
  fecha_inicio: z.string().optional(),
});

const cambiarEstadoGrupoSchema = z.object({
  estado: z.enum(['activo', 'suspendido', 'retirado']),
  motivo: z.string().max(500).optional(),
  // Solo se usan (y se exigen) cuando estado === 'retirado'.
  fecha_retiro: z.string().optional(),
  motivo_retiro: z.enum(MOTIVOS_RETIRO).optional(),
});

const retirarBeneficiarioSchema = z.object({
  fecha_retiro: z.string().min(1, 'La fecha de retiro es requerida'),
  motivo_retiro: z.enum(MOTIVOS_RETIRO, { errorMap: () => ({ message: 'Selecciona un motivo válido' }) }),
});

const registrarPagoSchema = z.object({
  fecha_pago: z.string().min(1, 'La fecha de pago es requerida'),
  monto_usd: z.number().nonnegative(),
  monto_bs: z.number().nonnegative(),
  tasa_cambio: z.number().positive(),
  semanas: z.number().int().positive(),
  anio: z.number().int().min(2000).max(2100),
  numero_recibo: z.string().trim().min(1).max(30),
  ubicacion_id: z.number().int().positive(),
});

const importarFunerariaSchema = z.object({
  beneficiario_ids: z.array(z.number().int().positive()).min(1, 'Selecciona al menos una persona a transferir'),
  tipo_acuerdo_funeraria_id: z.number().int().positive(),
  numero_acuerdo_funeraria: z.string().trim().min(1, 'El número de acuerdo de funeraria es requerido').max(20),
  numero_contrato_funeraria: z.string().trim().max(20).optional(),
});

const listarAcuerdosSchema = z.object({
  estado: z.enum(['activo', 'suspendido', 'retirado']).optional(),
  tipo_acuerdo_id: z.number().int().positive().optional(),
  buscar: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(50),
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

const esTitular = (parentesco: string) => parentesco.trim().toLowerCase() === 'titular';

/**
 * Obtener o crear el beneficiario "titular" (el propio socio) para poder
 * enlazarlo a un acuerdo. Mismo patrón usado en Funeraria.
 */
async function obtenerOCrearBeneficiario(tx: TxClient, socioId: number): Promise<Beneficiario> {
  const socio = await tx.socio.findUnique({ where: { id: socioId } });

  if (!socio) {
    throw new Error('Socio no encontrado');
  }

  const existente = await tx.beneficiario.findUnique({ where: { cedula: socio.cedula } });
  if (existente) {
    return existente;
  }

  const nombrePartes = socio.nombre.trim().split(/\s+/);
  const apellidoPartes = socio.apellido.trim().split(/\s+/);

  return tx.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: socio.cedula,
      nombre: (nombrePartes[0] || 'Sin Nombre').substring(0, 100),
      apellido: apellidoPartes.join(' ').substring(0, 100),
      parentesco: 'titular',
      estado: 'activo',
    },
  });
}

/**
 * Encuentra (por cédula) o crea un beneficiario, respetando el tope familiar
 * de 8 beneficiarios activos por socio (excluyendo la fila sintética
 * "titular"), igual que sociosController.agregarBeneficiario.
 */
async function encontrarOCrearBeneficiarioFamiliar(
  tx: TxClient,
  socioId: number,
  datos: z.infer<typeof beneficiarioGrupoSchema>
): Promise<Beneficiario> {
  const existente = await tx.beneficiario.findUnique({ where: { cedula: datos.cedula } });
  if (existente) {
    return existente;
  }

  const beneficiariosActivos = await tx.beneficiario.count({
    where: {
      socio_id: socioId,
      estado: 'activo',
      NOT: { parentesco: { equals: 'titular', mode: 'insensitive' } },
    },
  });

  if (beneficiariosActivos >= MAX_BENEFICIARIOS_POR_GRUPO) {
    const err: any = new Error('Un socio no puede tener más de 8 beneficiarios activos (9 personas en total, incluyendo al titular)');
    err.code = 'LIMITE_BENEFICIARIOS';
    throw err;
  }

  return tx.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: datos.cedula,
      nombre: datos.nombre,
      apellido: datos.apellido,
      fecha_nacimiento: new Date(datos.fecha_nacimiento),
      fecha_ingreso: new Date(datos.fecha_ingreso),
      parentesco: datos.parentesco,
      telefono: datos.telefono || null,
      estado: datos.estado === 'fallecido' ? 'fallecido' : 'activo',
      fecha_fallecimiento: datos.estado === 'fallecido' ? new Date() : null,
    },
  });
}

/** Cuenta los miembros vigentes (no retirados) de un grupo por numero_acuerdo. */
async function contarMiembrosGrupo(tx: TxClient, numeroAcuerdo: string): Promise<number> {
  return tx.acuerdoSalud.count({
    where: { numero_acuerdo: numeroAcuerdo, estado: { not: 'retirado' } },
  });
}

type AcuerdoSaludCompleto = AcuerdoSalud & {
  beneficiario: Beneficiario & {
    socio: {
      id: number;
      codigo_socio: string;
      cedula: string;
      nombre: string;
      apellido: string;
      direccion: string | null;
      telefono: string | null;
      email: string | null;
      estado: string;
    } | null;
  };
  tipo_acuerdo: { id: number; codigo: string; nombre: string; monto_usd: Prisma.Decimal };
};

const includeGrupo = {
  beneficiario: {
    include: {
      socio: {
        select: {
          id: true,
          codigo_socio: true,
          cedula: true,
          nombre: true,
          apellido: true,
          direccion: true,
          telefono: true,
          email: true,
          estado: true,
        },
      },
    },
  },
  tipo_acuerdo: { select: { id: true, codigo: true, nombre: true, monto_usd: true } },
} satisfies Prisma.AcuerdoSaludInclude;

function formatearMiembro(row: AcuerdoSaludCompleto) {
  return {
    acuerdo_id: row.id,
    beneficiario_id: row.beneficiario.id,
    cedula: row.beneficiario.cedula,
    nombre: row.beneficiario.nombre,
    apellido: row.beneficiario.apellido,
    parentesco: row.beneficiario.parentesco,
    fecha_nacimiento: row.beneficiario.fecha_nacimiento,
    fecha_ingreso: row.beneficiario.fecha_ingreso,
    telefono: row.beneficiario.telefono,
    estado_persona: row.beneficiario.estado, // activo | inactivo | retirado | fallecido
    estado_acuerdo: row.estado, // activo | suspendido | retirado
    semanas_sin_pago: row.semanas_sin_pago,
    fecha_suspension: row.fecha_suspension,
    fecha_retiro: row.fecha_retiro,
    motivo_retiro: row.motivo_retiro,
  };
}

/** Arma la respuesta de "grupo" a partir de todas las filas que comparten numero_acuerdo. */
function formatearGrupo(rows: AcuerdoSaludCompleto[]) {
  const titularRow = rows.find((r) => esTitular(r.beneficiario.parentesco)) || rows[0];
  const beneficiarios = rows.filter((r) => r !== titularRow);

  return {
    numero_acuerdo: titularRow?.numero_acuerdo ?? null,
    numero_contrato: titularRow?.numero_contrato ?? null,
    tipo_acuerdo: titularRow
      ? {
          id: titularRow.tipo_acuerdo.id,
          codigo: titularRow.tipo_acuerdo.codigo,
          nombre: titularRow.tipo_acuerdo.nombre,
          monto_usd: Number(titularRow.tipo_acuerdo.monto_usd),
        }
      : null,
    estado: titularRow?.estado ?? null,
    semanas_sin_pago: titularRow?.semanas_sin_pago ?? 0,
    fecha_suspension: titularRow?.fecha_suspension ?? null,
    fecha_inicio: titularRow?.fecha_inicio ?? null,
    socio: titularRow?.beneficiario.socio
      ? {
          id: titularRow.beneficiario.socio.id,
          codigo_socio: titularRow.beneficiario.socio.codigo_socio,
          cedula: titularRow.beneficiario.socio.cedula,
          nombre_completo: `${titularRow.beneficiario.socio.nombre} ${titularRow.beneficiario.socio.apellido}`,
          direccion: titularRow.beneficiario.socio.direccion,
          telefono: titularRow.beneficiario.socio.telefono,
          email: titularRow.beneficiario.socio.email,
          estado: titularRow.beneficiario.socio.estado,
        }
      : null,
    titular: titularRow ? formatearMiembro(titularRow) : null,
    beneficiarios: beneficiarios.map(formatearMiembro),
    total_personas: rows.length,
  };
}

// ============================================
// ENDPOINTS: CATÁLOGO Y ESTADÍSTICAS
// ============================================

/**
 * GET /api/salud/tipos-acuerdo
 */
export const listarTiposAcuerdo = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tipos = await prisma.tipoAcuerdoSalud.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
    });

    res.json({
      success: true,
      data: tipos.map((tipo) => ({
        id: tipo.id,
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        monto_usd: Number(tipo.monto_usd),
      })),
    });
  } catch (error: any) {
    logger.error('Error al listar tipos de acuerdo salud:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al listar tipos de acuerdo' },
    });
  }
};

/**
 * GET /api/salud/estadisticas
 */
export const obtenerEstadisticas = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Todos los conteos son por GRUPO (titular), no por persona: un acuerdo
    // con 1 titular + 3 beneficiarios cuenta como 1, no como 4.
    const soloTitular = { parentesco: { equals: 'titular', mode: 'insensitive' as const } };

    const [totalAcuerdos, porEstado, porTipo, proximosSuspender, sinDerecho] = await Promise.all([
      prisma.acuerdoSalud.count({ where: { beneficiario: soloTitular } }),

      prisma.$queryRaw<Array<{ estado: string; cantidad: bigint }>>`
        SELECT a.estado, COUNT(*)::int as cantidad
        FROM acuerdos_salud a
        JOIN beneficiarios b ON b.id = a.beneficiario_id
        WHERE LOWER(b.parentesco) = 'titular'
        GROUP BY a.estado
        ORDER BY cantidad DESC
      `,

      prisma.$queryRaw<Array<{ tipo_nombre: string; cantidad: bigint }>>`
        SELECT tas.nombre as tipo_nombre, COUNT(as2.id)::int as cantidad
        FROM acuerdos_salud as2
        JOIN tipos_acuerdo_salud tas ON as2.tipo_acuerdo_id = tas.id
        JOIN beneficiarios b ON b.id = as2.beneficiario_id
        WHERE LOWER(b.parentesco) = 'titular'
        GROUP BY tas.nombre
        ORDER BY cantidad DESC
      `,

      prisma.acuerdoSalud.count({
        where: {
          estado: 'activo',
          semanas_sin_pago: { gte: SEMANAS_ALERTA_PROXIMO_SUSPENDER, lt: SEMANAS_LIMITE_SUSPENSION },
          beneficiario: soloTitular,
        },
      }),

      prisma.acuerdoSalud.count({
        where: { estado: 'activo', semanas_sin_pago: { gt: 0 }, beneficiario: soloTitular },
      }),
    ]);

    const estadoPorEstado = porEstado.reduce((acc, item) => {
      acc[item.estado] = Number(item.cantidad);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        total_acuerdos: totalAcuerdos,
        por_estado: {
          activos: estadoPorEstado['activo'] || 0,
          suspendidos: estadoPorEstado['suspendido'] || 0,
          retirados: estadoPorEstado['retirado'] || 0,
        },
        por_tipo: porTipo.map((item) => ({ tipo: item.tipo_nombre, cantidad: Number(item.cantidad) })),
        alertas: {
          proximos_suspender: proximosSuspender,
          sin_derecho_servicio: sinDerecho,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error al obtener estadísticas salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener estadísticas' } });
  }
};

// ============================================
// ENDPOINTS: LISTADO / CONSULTA
// ============================================

/**
 * GET /api/salud/acuerdos
 * Listado paginado, fila por GRUPO (una fila por titular). Los beneficiarios
 * viajan con su titular y solo se ven al abrir el detalle del acuerdo
 * (obtenerGrupoPorNumeroAcuerdo) — nunca como filas propias en este listado.
 */
export const listarAcuerdos = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = listarAcuerdosSchema.parse({
      estado: req.query.estado,
      tipo_acuerdo_id: req.query.tipo_acuerdo_id ? parseInt(req.query.tipo_acuerdo_id as string) : undefined,
      buscar: req.query.buscar,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    const where: Prisma.AcuerdoSaludWhereInput = {
      beneficiario: { parentesco: { equals: 'titular', mode: 'insensitive' } },
    };

    if (params.estado) where.estado = params.estado;
    if (params.tipo_acuerdo_id) where.tipo_acuerdo_id = params.tipo_acuerdo_id;

    if (params.buscar) {
      // La búsqueda debe encontrar el grupo aunque el término coincida con un
      // beneficiario (no con el titular), así que primero se resuelven los
      // números de acuerdo que coinciden en CUALQUIER persona del grupo, y
      // luego se filtra el listado (ya limitado a titulares) por esos números.
      const gruposCoincidentes = await prisma.acuerdoSalud.findMany({
        where: {
          numero_acuerdo: { not: null },
          OR: [
            { numero_acuerdo: { contains: params.buscar, mode: 'insensitive' } },
            { numero_contrato: { contains: params.buscar, mode: 'insensitive' } },
            {
              beneficiario: {
                OR: [
                  { nombre: { contains: params.buscar, mode: 'insensitive' } },
                  { apellido: { contains: params.buscar, mode: 'insensitive' } },
                  { cedula: { contains: params.buscar } },
                  { socio: { codigo_socio: { contains: params.buscar, mode: 'insensitive' } } },
                ],
              },
            },
          ],
        },
        select: { numero_acuerdo: true },
        distinct: ['numero_acuerdo'],
      });

      const numeros = gruposCoincidentes.map((g) => g.numero_acuerdo).filter((n): n is string => !!n);
      where.numero_acuerdo = { in: numeros };
    }

    const skip = (params.page - 1) * params.limit;

    const [acuerdos, total] = await Promise.all([
      prisma.acuerdoSalud.findMany({
        where,
        skip,
        take: params.limit,
        include: includeGrupo,
        orderBy: [{ estado: 'asc' }, { fecha_inicio: 'desc' }],
      }),
      prisma.acuerdoSalud.count({ where }),
    ]);

    res.json({
      success: true,
      data: (acuerdos as AcuerdoSaludCompleto[]).map((acuerdo) => ({
        id: acuerdo.id,
        numero_acuerdo: acuerdo.numero_acuerdo,
        numero_contrato: acuerdo.numero_contrato,
        beneficiario: {
          id: acuerdo.beneficiario.id,
          cedula: acuerdo.beneficiario.cedula,
          nombre_completo: `${acuerdo.beneficiario.nombre} ${acuerdo.beneficiario.apellido}`,
          parentesco: acuerdo.beneficiario.parentesco,
        },
        socio: acuerdo.beneficiario.socio
          ? {
              id: acuerdo.beneficiario.socio.id,
              codigo_socio: acuerdo.beneficiario.socio.codigo_socio,
              cedula: acuerdo.beneficiario.socio.cedula,
              nombre_completo: `${acuerdo.beneficiario.socio.nombre} ${acuerdo.beneficiario.socio.apellido}`,
              estado: acuerdo.beneficiario.socio.estado,
            }
          : null,
        tipo_acuerdo: {
          id: acuerdo.tipo_acuerdo.id,
          codigo: acuerdo.tipo_acuerdo.codigo,
          nombre: acuerdo.tipo_acuerdo.nombre,
          monto_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
        },
        estado: acuerdo.estado,
        semanas_sin_pago: acuerdo.semanas_sin_pago,
        derecho_al_servicio: acuerdo.estado === 'activo' && acuerdo.semanas_sin_pago === 0,
        fecha_suspension: acuerdo.fecha_suspension,
        fecha_retiro: acuerdo.fecha_retiro,
        motivo_retiro: acuerdo.motivo_retiro,
        fecha_inicio: acuerdo.fecha_inicio,
        created_at: acuerdo.created_at,
        updated_at: acuerdo.updated_at,
      })),
      meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) },
    });
  } catch (error: any) {
    logger.error('Error al listar acuerdos salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al listar acuerdos' } });
  }
};

/**
 * GET /api/salud/acuerdos/socio/:socioId
 */
export const obtenerAcuerdosPorSocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(req.params.socioId!);
    if (isNaN(socioId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID de socio inválido' } });
      return;
    }

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }

    const acuerdos = await prisma.acuerdoSalud.findMany({
      where: { beneficiario: { socio_id: socioId } },
      include: {
        beneficiario: { select: { id: true, cedula: true, nombre: true, apellido: true, parentesco: true } },
        tipo_acuerdo: { select: { id: true, codigo: true, nombre: true, monto_usd: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      data: acuerdos.map((acuerdo) => ({
        id: acuerdo.id,
        numero_acuerdo: acuerdo.numero_acuerdo,
        beneficiario: {
          id: acuerdo.beneficiario.id,
          cedula: acuerdo.beneficiario.cedula,
          nombre_completo: `${acuerdo.beneficiario.nombre} ${acuerdo.beneficiario.apellido}`,
          parentesco: acuerdo.beneficiario.parentesco,
        },
        tipo_acuerdo: {
          id: acuerdo.tipo_acuerdo.id,
          codigo: acuerdo.tipo_acuerdo.codigo,
          nombre: acuerdo.tipo_acuerdo.nombre,
          monto_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
        },
        estado: acuerdo.estado,
        semanas_sin_pago: acuerdo.semanas_sin_pago,
        derecho_al_servicio: acuerdo.estado === 'activo' && acuerdo.semanas_sin_pago === 0,
        fecha_suspension: acuerdo.fecha_suspension,
        fecha_inicio: acuerdo.fecha_inicio,
      })),
    });
  } catch (error: any) {
    logger.error('Error al obtener acuerdos por socio:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener acuerdos del socio' } });
  }
};

/**
 * GET /api/salud/acuerdos/grupo/:numeroAcuerdo
 * Titular + beneficiarios de un mismo número de acuerdo.
 */
export const obtenerGrupoPorNumeroAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;

    const rows = (await prisma.acuerdoSalud.findMany({
      where: { numero_acuerdo: numeroAcuerdo },
      include: includeGrupo,
      orderBy: { created_at: 'asc' },
    })) as AcuerdoSaludCompleto[];

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró ningún acuerdo de salud con número ${numeroAcuerdo}` },
      });
      return;
    }

    res.json({ success: true, data: formatearGrupo(rows) });
  } catch (error: any) {
    logger.error('Error al obtener grupo de salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener el acuerdo' } });
  }
};

/**
 * GET /api/salud/acuerdos/suspendidos/listado
 */
export const listarSuspendidosParaImpresion = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Una fila por grupo (titular): la suspensión aplica a todo el acuerdo
    // por igual, así que listar también a los beneficiarios sería repetir
    // la misma fila con distinto nombre.
    const acuerdos = await prisma.acuerdoSalud.findMany({
      where: { estado: 'suspendido', beneficiario: { parentesco: { equals: 'titular', mode: 'insensitive' } } },
      include: { beneficiario: { include: { socio: true } } },
      orderBy: { semanas_sin_pago: 'desc' },
    });

    res.json({
      success: true,
      data: acuerdos.map((acuerdo) => ({
        expediente: acuerdo.beneficiario.socio?.codigo_socio || 'N/D',
        numero_acuerdo: acuerdo.numero_acuerdo || 'N/D',
        numero_contrato: acuerdo.numero_contrato || 'N/D',
        apellidos: acuerdo.beneficiario.socio?.apellido || acuerdo.beneficiario.apellido,
        nombres: acuerdo.beneficiario.socio?.nombre || acuerdo.beneficiario.nombre,
        cedula: acuerdo.beneficiario.socio?.cedula || acuerdo.beneficiario.cedula,
        telefono: acuerdo.beneficiario.socio?.telefono || acuerdo.beneficiario.telefono || 'N/D',
        semanas_atraso: acuerdo.semanas_sin_pago,
        estado: acuerdo.estado,
      })),
    });
  } catch (error: any) {
    logger.error('Error al listar suspendidos de salud para impresión:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al listar acuerdos suspendidos' } });
  }
};

const tipoListadoGruposSchema = z.enum(['activos', 'suspendidos', 'proximos_suspender']);

/** Condición sobre la fila TITULAR que define cada tipo de listado imprimible. */
function whereTitularPorTipoListado(tipo: z.infer<typeof tipoListadoGruposSchema>): Prisma.AcuerdoSaludWhereInput {
  const soloTitular = { parentesco: { equals: 'titular', mode: 'insensitive' as const } };
  switch (tipo) {
    case 'activos':
      return { estado: 'activo', beneficiario: soloTitular };
    case 'suspendidos':
      return { estado: 'suspendido', beneficiario: soloTitular };
    case 'proximos_suspender':
      return {
        estado: 'activo',
        semanas_sin_pago: { gte: SEMANAS_ALERTA_PROXIMO_SUSPENDER, lt: SEMANAS_LIMITE_SUSPENSION },
        beneficiario: soloTitular,
      };
  }
}

/**
 * GET /api/salud/acuerdos/grupos?tipo=activos|suspendidos|proximos_suspender
 * Grupos completos (titular + beneficiarios) que cumplen el tipo de listado
 * pedido, pensado para imprimir una ficha por grupo (no una fila plana por
 * persona). Sin paginar: estos listados se generan para imprimir de una vez.
 */
export const listarGruposParaImpresion = async (req: Request, res: Response): Promise<void> => {
  try {
    const tipo = tipoListadoGruposSchema.parse(req.query.tipo);

    const titulares = await prisma.acuerdoSalud.findMany({
      where: whereTitularPorTipoListado(tipo),
      select: { numero_acuerdo: true },
      orderBy: { beneficiario: { socio: { apellido: 'asc' } } },
    });

    const numeros = titulares.map((t) => t.numero_acuerdo).filter((n): n is string => !!n);

    if (numeros.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const rows = (await prisma.acuerdoSalud.findMany({
      where: { numero_acuerdo: { in: numeros } },
      include: includeGrupo,
      orderBy: { created_at: 'asc' },
    })) as AcuerdoSaludCompleto[];

    const porNumero = new Map<string, AcuerdoSaludCompleto[]>();
    for (const row of rows) {
      if (!row.numero_acuerdo) continue;
      const grupo = porNumero.get(row.numero_acuerdo) ?? [];
      grupo.push(row);
      porNumero.set(row.numero_acuerdo, grupo);
    }

    // El orden de `numeros` ya viene por apellido del titular; se preserva al armar los grupos.
    const grupos = numeros
      .map((numero) => porNumero.get(numero))
      .filter((grupo): grupo is AcuerdoSaludCompleto[] => !!grupo && grupo.length > 0)
      .map(formatearGrupo);

    res.json({ success: true, data: grupos });
  } catch (error: any) {
    logger.error('Error al listar grupos de salud para impresión:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tipo de listado inválido' } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al listar los grupos' } });
  }
};

/**
 * GET /api/salud/acuerdos/:id
 */
export const obtenerAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);
    if (isNaN(acuerdoId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID de acuerdo inválido' } });
      return;
    }

    const acuerdo = (await prisma.acuerdoSalud.findUnique({
      where: { id: acuerdoId },
      include: { ...includeGrupo, movimientos: { orderBy: { fecha_movimiento: 'desc' }, take: 10 } },
    })) as (AcuerdoSaludCompleto & { movimientos: any[] }) | null;

    if (!acuerdo) {
      res.status(404).json({ success: false, error: { code: 'ACUERDO_NOT_FOUND', message: 'Acuerdo no encontrado' } });
      return;
    }

    res.json({
      success: true,
      data: {
        ...formatearMiembro(acuerdo),
        numero_acuerdo: acuerdo.numero_acuerdo,
        numero_contrato: acuerdo.numero_contrato,
        socio: acuerdo.beneficiario.socio
          ? {
              id: acuerdo.beneficiario.socio.id,
              codigo_socio: acuerdo.beneficiario.socio.codigo_socio,
              cedula: acuerdo.beneficiario.socio.cedula,
              nombre_completo: `${acuerdo.beneficiario.socio.nombre} ${acuerdo.beneficiario.socio.apellido}`,
              telefono: acuerdo.beneficiario.socio.telefono,
              email: acuerdo.beneficiario.socio.email,
              estado: acuerdo.beneficiario.socio.estado,
            }
          : null,
        tipo_acuerdo: {
          id: acuerdo.tipo_acuerdo.id,
          codigo: acuerdo.tipo_acuerdo.codigo,
          nombre: acuerdo.tipo_acuerdo.nombre,
          monto_usd: Number(acuerdo.tipo_acuerdo.monto_usd),
        },
        fecha_inicio: acuerdo.fecha_inicio,
        movimientos: acuerdo.movimientos.map((mov) => ({
          id: mov.id,
          fecha_movimiento: mov.fecha_movimiento,
          monto_usd: Number(mov.monto_usd),
          monto_bs: Number(mov.monto_bs),
          semanas_pagadas: mov.semanas_pagadas,
          numero_recibo: mov.numero_recibo,
        })),
        created_at: acuerdo.created_at,
        updated_at: acuerdo.updated_at,
      },
    });
  } catch (error: any) {
    logger.error('Error al obtener acuerdo salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener acuerdo' } });
  }
};

// ============================================
// ENDPOINTS: ALTA / MODIFICACIÓN / BAJA DE GRUPO
// ============================================

/**
 * POST /api/salud/grupos
 * Crea un acuerdo de salud nuevo: titular + hasta 8 beneficiarios, todos
 * compartiendo el mismo número de acuerdo, en una sola transacción.
 */
export const crearGrupoAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = crearGrupoAcuerdoSchema.parse(req.body);

    const socio = await prisma.socio.findUnique({ where: { id: data.socio_id } });
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }

    const noHabilitado = motivoNoHabilitado(socio, 'inscribir un acuerdo de salud');
    if (noHabilitado) {
      res.status(400).json(RESPUESTA_NO_HABILITADO(noHabilitado));
      return;
    }

    // Regla de negocio: solo socios con un acuerdo de ahorro activo pueden
    // disfrutar del beneficio de salud.
    const cuentaAhorroActiva = await prisma.cuentaAhorro.findFirst({
      where: { socio_id: data.socio_id, estado: true },
    });
    if (!cuentaAhorroActiva) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SIN_CUENTA_AHORRO_ACTIVA',
          message: `El socio con expediente ${socio.codigo_socio} (cédula ${socio.cedula}) no tiene ninguna cuenta de ahorro activa registrada. Debe tener al menos una cuenta de ahorro activa para acceder al beneficio de salud; verifique en el módulo de Ahorro si existe una cuenta a nombre de este expediente y si está activa.`,
        },
      });
      return;
    }

    const tipoAcuerdo = await prisma.tipoAcuerdoSalud.findUnique({ where: { id: data.tipo_acuerdo_id } });
    if (!tipoAcuerdo || !tipoAcuerdo.estado) {
      res.status(404).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'Tipo de acuerdo no encontrado o inactivo' } });
      return;
    }

    const numeroAcuerdoExistente = await prisma.acuerdoSalud.findFirst({ where: { numero_acuerdo: data.numero_acuerdo } });
    if (numeroAcuerdoExistente) {
      res.status(409).json({
        success: false,
        error: { code: 'NUMERO_ACUERDO_EN_USO', message: `El número de acuerdo ${data.numero_acuerdo} ya está registrado` },
      });
      return;
    }

    const fechaInicio = data.fecha_inicio ? new Date(data.fecha_inicio) : new Date();

    const rows = await prisma.$transaction(async (tx) => {
      const titular = await obtenerOCrearBeneficiario(tx, data.socio_id);

      const filasCreadas: AcuerdoSalud[] = [];

      filasCreadas.push(
        await tx.acuerdoSalud.create({
          data: {
            beneficiario_id: titular.id,
            tipo_acuerdo_id: data.tipo_acuerdo_id,
            numero_acuerdo: data.numero_acuerdo,
            numero_contrato: data.numero_contrato || null,
            estado: 'activo',
            semanas_sin_pago: 0,
            fecha_inicio: fechaInicio,
          },
        })
      );

      for (const b of data.beneficiarios) {
        const beneficiario = await encontrarOCrearBeneficiarioFamiliar(tx, data.socio_id, b);

        filasCreadas.push(
          await tx.acuerdoSalud.create({
            data: {
              beneficiario_id: beneficiario.id,
              tipo_acuerdo_id: data.tipo_acuerdo_id,
              numero_acuerdo: data.numero_acuerdo,
              numero_contrato: data.numero_contrato || null,
              estado: 'activo',
              semanas_sin_pago: 0,
              fecha_inicio: fechaInicio,
            },
          })
        );
      }

      await registrarAuditoria(tx, {
        req,
        accion: 'CREATE',
        modulo: 'salud',
        despues: { numero_acuerdo: data.numero_acuerdo, socio_id: data.socio_id, personas: filasCreadas.length },
      });

      return filasCreadas;
    });

    const rowsCompletos = (await prisma.acuerdoSalud.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: includeGrupo,
    })) as AcuerdoSaludCompleto[];

    logger.info(`Acuerdo de salud ${data.numero_acuerdo} creado para socio ${data.socio_id} con ${rows.length} persona(s)`);

    res.status(201).json({ success: true, data: formatearGrupo(rowsCompletos) });
  } catch (error: any) {
    logger.error('Error al crear grupo de salud:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }

    if (error.code === 'LIMITE_BENEFICIARIOS' || error.code === 'CEDULA_DUPLICADA') {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }

    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al crear el acuerdo' } });
  }
};

/**
 * POST /api/salud/grupos/:numeroAcuerdo/beneficiarios
 * Agrega una persona más a un grupo ya existente (usado desde "Modificar").
 */
export const agregarBeneficiarioAGrupo = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;
    const datos = beneficiarioGrupoSchema.parse(req.body);

    const filaReferencia = await prisma.acuerdoSalud.findFirst({
      where: { numero_acuerdo: numeroAcuerdo },
      include: { beneficiario: true },
    });

    if (!filaReferencia) {
      res.status(404).json({ success: false, error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró el acuerdo ${numeroAcuerdo}` } });
      return;
    }

    const socioId = filaReferencia.beneficiario.socio_id;

    const titular = await prisma.socio.findUnique({ where: { id: socioId }, select: { estado: true, codigo_socio: true } });
    const noHabilitado = titular ? motivoNoHabilitado(titular, 'sumar beneficiarios al acuerdo') : null;
    if (noHabilitado) {
      res.status(400).json(RESPUESTA_NO_HABILITADO(noHabilitado));
      return;
    }

    const nuevaFila = await prisma.$transaction(async (tx) => {
      const totalMiembros = await contarMiembrosGrupo(tx, numeroAcuerdo);
      if (totalMiembros >= MAX_BENEFICIARIOS_POR_GRUPO + 1) {
        const err: any = new Error('Este acuerdo ya tiene el máximo de 9 personas (1 titular + 8 beneficiarios)');
        err.code = 'LIMITE_GRUPO_SALUD';
        throw err;
      }

      const beneficiario = await encontrarOCrearBeneficiarioFamiliar(tx, socioId, datos);

      const yaEnGrupo = await tx.acuerdoSalud.findFirst({
        where: { numero_acuerdo: numeroAcuerdo, beneficiario_id: beneficiario.id },
      });
      if (yaEnGrupo) {
        const err: any = new Error('Esta persona ya forma parte de este acuerdo de salud');
        err.code = 'BENEFICIARIO_YA_EN_GRUPO';
        throw err;
      }

      const creada = await tx.acuerdoSalud.create({
        data: {
          beneficiario_id: beneficiario.id,
          tipo_acuerdo_id: filaReferencia.tipo_acuerdo_id,
          numero_acuerdo: numeroAcuerdo,
          numero_contrato: filaReferencia.numero_contrato,
          estado: filaReferencia.estado === 'retirado' ? 'activo' : filaReferencia.estado,
          semanas_sin_pago: 0,
          fecha_inicio: new Date(datos.fecha_ingreso),
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'CREATE',
        modulo: 'salud',
        registro_id: creada.id,
        despues: creada,
      });

      return creada;
    });

    logger.info(`Beneficiario agregado al acuerdo de salud ${numeroAcuerdo}`);

    res.status(201).json({ success: true, data: { id: nuevaFila.id } });
  } catch (error: any) {
    logger.error('Error al agregar beneficiario al grupo de salud:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }

    if (['LIMITE_GRUPO_SALUD', 'LIMITE_BENEFICIARIOS', 'BENEFICIARIO_YA_EN_GRUPO'].includes(error.code)) {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }

    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al agregar beneficiario' } });
  }
};

/**
 * PUT /api/salud/grupos/:numeroAcuerdo
 * Edita los datos compartidos del grupo (tipo de acuerdo, número de
 * contrato, fecha de inicio, o renombra el número de acuerdo).
 */
export const actualizarGrupoAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;
    const data = actualizarGrupoAcuerdoSchema.parse(req.body);

    const filas = await prisma.acuerdoSalud.findMany({ where: { numero_acuerdo: numeroAcuerdo } });
    if (filas.length === 0) {
      res.status(404).json({ success: false, error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró el acuerdo ${numeroAcuerdo}` } });
      return;
    }

    if (data.tipo_acuerdo_id) {
      const tipoAcuerdo = await prisma.tipoAcuerdoSalud.findUnique({ where: { id: data.tipo_acuerdo_id } });
      if (!tipoAcuerdo || !tipoAcuerdo.estado) {
        res.status(404).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'Tipo de acuerdo no encontrado o inactivo' } });
        return;
      }
    }

    if (data.numero_acuerdo_nuevo && data.numero_acuerdo_nuevo !== numeroAcuerdo) {
      const colision = await prisma.acuerdoSalud.findFirst({ where: { numero_acuerdo: data.numero_acuerdo_nuevo } });
      if (colision) {
        res.status(409).json({
          success: false,
          error: { code: 'NUMERO_ACUERDO_EN_USO', message: `El número de acuerdo ${data.numero_acuerdo_nuevo} ya está registrado` },
        });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.acuerdoSalud.updateMany({
        where: { numero_acuerdo: numeroAcuerdo },
        data: {
          ...(data.numero_acuerdo_nuevo !== undefined && { numero_acuerdo: data.numero_acuerdo_nuevo }),
          ...(data.numero_contrato !== undefined && { numero_contrato: data.numero_contrato || null }),
          ...(data.tipo_acuerdo_id !== undefined && { tipo_acuerdo_id: data.tipo_acuerdo_id }),
          ...(data.fecha_inicio !== undefined && { fecha_inicio: new Date(data.fecha_inicio) }),
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'UPDATE',
        modulo: 'salud',
        antes: { numero_acuerdo: numeroAcuerdo },
        despues: data,
      });
    });

    const numeroFinal = data.numero_acuerdo_nuevo || numeroAcuerdo;
    const rowsCompletos = (await prisma.acuerdoSalud.findMany({
      where: { numero_acuerdo: numeroFinal },
      include: includeGrupo,
    })) as AcuerdoSaludCompleto[];

    logger.info(`Acuerdo de salud ${numeroAcuerdo} actualizado`);
    res.json({ success: true, data: formatearGrupo(rowsCompletos) });
  } catch (error: any) {
    logger.error('Error al actualizar grupo de salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al actualizar el acuerdo' } });
  }
};

/**
 * DELETE /api/salud/grupos/:numeroAcuerdo
 * Elimina el acuerdo completo (todas las personas del grupo), solo si
 * ninguna fila tiene movimientos registrados.
 */
export const eliminarGrupoAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;

    const filas = await prisma.acuerdoSalud.findMany({
      where: { numero_acuerdo: numeroAcuerdo },
      include: { _count: { select: { movimientos: true } } },
    });

    if (filas.length === 0) {
      res.status(404).json({ success: false, error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró el acuerdo ${numeroAcuerdo}` } });
      return;
    }

    const conMovimientos = filas.filter((f) => f._count.movimientos > 0);
    if (conMovimientos.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ACUERDO_CON_MOVIMIENTOS',
          message: 'El acuerdo no puede eliminarse porque tiene pagos registrados; use "Retirar acuerdos" en su lugar',
        },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.acuerdoSalud.deleteMany({ where: { numero_acuerdo: numeroAcuerdo } });

      await registrarAuditoria(tx, {
        req,
        accion: 'DELETE',
        modulo: 'salud',
        antes: { numero_acuerdo: numeroAcuerdo, personas: filas.length },
      });
    });

    logger.info(`Acuerdo de salud ${numeroAcuerdo} eliminado (${filas.length} persona(s))`);
    res.json({ success: true, data: { numero_acuerdo: numeroAcuerdo, eliminados: filas.length } });
  } catch (error: any) {
    logger.error('Error al eliminar grupo de salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al eliminar el acuerdo' } });
  }
};

/**
 * DELETE /api/salud/acuerdos/:id
 * Elimina a una sola persona del acuerdo (no al titular; para eso se usa
 * eliminar el acuerdo completo).
 */
export const eliminarAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);
    if (isNaN(acuerdoId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID de acuerdo inválido' } });
      return;
    }

    const acuerdo = await prisma.acuerdoSalud.findUnique({
      where: { id: acuerdoId },
      include: { beneficiario: true, _count: { select: { movimientos: true } } },
    });

    if (!acuerdo) {
      res.status(404).json({ success: false, error: { code: 'ACUERDO_NOT_FOUND', message: 'Acuerdo no encontrado' } });
      return;
    }

    if (esTitular(acuerdo.beneficiario.parentesco)) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ELIMINAR_TITULAR', message: 'No se puede eliminar al titular individualmente; elimine el acuerdo completo' },
      });
      return;
    }

    if (acuerdo._count.movimientos > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'ACUERDO_CON_MOVIMIENTOS', message: 'No puede eliminarse: ya tiene pagos registrados. Use "Retirar" en su lugar' },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.acuerdoSalud.delete({ where: { id: acuerdoId } });

      await registrarAuditoria(tx, {
        req,
        accion: 'DELETE',
        modulo: 'salud',
        registro_id: acuerdoId,
        antes: acuerdo,
      });
    });

    logger.info(`Acuerdo de salud ${acuerdoId} eliminado`);
    res.json({ success: true, data: { id: acuerdoId } });
  } catch (error: any) {
    logger.error('Error al eliminar acuerdo salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al eliminar acuerdo' } });
  }
};

// ============================================
// ENDPOINTS: SUSPENSIÓN / REACTIVACIÓN / RETIRO
// ============================================

/**
 * PATCH /api/salud/acuerdos/:id/estado
 * Suspende o reactiva TODO el grupo (una sola cuota familiar cubre a las
 * hasta 9 personas), sin afectar a miembros ya retirados individualmente.
 */
export const cambiarEstado = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);
    const data = cambiarEstadoGrupoSchema.parse(req.body);

    if (isNaN(acuerdoId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID de acuerdo inválido' } });
      return;
    }

    const acuerdo = await prisma.acuerdoSalud.findUnique({
      where: { id: acuerdoId },
      include: { beneficiario: { select: { socio_id: true } } },
    });
    if (!acuerdo) {
      res.status(404).json({ success: false, error: { code: 'ACUERDO_NOT_FOUND', message: 'Acuerdo no encontrado' } });
      return;
    }

    if (acuerdo.estado === 'retirado') {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATE_TRANSITION', message: 'No se puede cambiar el estado de un acuerdo retirado' } });
      return;
    }

    if (data.estado === 'retirado' && (!data.fecha_retiro || !data.motivo_retiro)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'fecha_retiro y motivo_retiro son requeridos para retirar el acuerdo' },
      });
      return;
    }

    // El retiro es definitivo (ver guard de arriba: un acuerdo retirado no
    // vuelve a cambiar de estado), así que no se permite si el socio tiene
    // cuentas pendientes: semanas sin pagar en este mismo acuerdo de salud,
    // préstamos activos/en mora, o deuda en su acuerdo de funeraria.
    if (data.estado === 'retirado') {
      const socioId = acuerdo.beneficiario.socio_id;

      if (acuerdo.semanas_sin_pago > 0) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DEUDA_SALUD',
            message: `No se puede retirar: el acuerdo de salud tiene ${acuerdo.semanas_sin_pago} semana(s) sin pagar.`,
          },
        });
        return;
      }

      const prestamoPendiente = await prisma.prestamo.findFirst({
        where: { socio_id: socioId, estado: { in: ['activo', 'moroso'] } },
      });
      if (prestamoPendiente) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PRESTAMO_PENDIENTE',
            message: `No se puede retirar: el socio tiene un préstamo (${prestamoPendiente.numero_prestamo}) pendiente de pago.`,
          },
        });
        return;
      }

      const deudaFuneraria = await prisma.acuerdoFuneraria.findFirst({
        where: { beneficiario: { socio_id: socioId }, estado: { not: 'retirado' }, semanas_sin_pago: { gt: 0 } },
      });
      if (deudaFuneraria) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DEUDA_FUNERARIA',
            message: `No se puede retirar: el socio tiene ${deudaFuneraria.semanas_sin_pago} semana(s) sin pagar en el acuerdo de funeraria ${deudaFuneraria.numero_acuerdo || ''}.`,
          },
        });
        return;
      }
    }

    // Al retirar al titular, todo el grupo (titular + beneficiarios vigentes)
    // pasa a retirado junto con él: es la misma condición que ya usan
    // suspender/reactivar, así que se reutiliza el mismo mecanismo de
    // cascada por numero_acuerdo.
    const grupoWhere: Prisma.AcuerdoSaludWhereInput = acuerdo.numero_acuerdo
      ? { numero_acuerdo: acuerdo.numero_acuerdo, estado: { not: 'retirado' } }
      : { id: acuerdoId };

    const updateData: Prisma.AcuerdoSaludUpdateManyMutationInput = { estado: data.estado };
    if (data.estado === 'suspendido') updateData.fecha_suspension = new Date();
    if (data.estado === 'activo') {
      updateData.fecha_suspension = null;
      updateData.semanas_sin_pago = 0;
    }
    if (data.estado === 'retirado') {
      updateData.fecha_retiro = new Date(data.fecha_retiro!);
      updateData.motivo_retiro = data.motivo_retiro!;
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const resultado = await tx.acuerdoSalud.updateMany({ where: grupoWhere, data: updateData });

      await registrarAuditoria(tx, {
        req,
        accion: 'UPDATE',
        modulo: 'salud',
        registro_id: acuerdoId,
        antes: { numero_acuerdo: acuerdo.numero_acuerdo, estado: acuerdo.estado },
        despues: { estado: data.estado, motivo: data.motivo || null, personas_afectadas: resultado.count },
      });

      return resultado;
    });

    logger.info(`Acuerdo de salud ${acuerdo.numero_acuerdo || acuerdoId}: estado ${acuerdo.estado} → ${data.estado} (${resultado.count} persona(s))`);

    res.json({ success: true, data: { numero_acuerdo: acuerdo.numero_acuerdo, estado_nuevo: data.estado, personas_afectadas: resultado.count } });
  } catch (error: any) {
    logger.error('Error al cambiar estado de acuerdo salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al cambiar estado' } });
  }
};

/**
 * PATCH /api/salud/acuerdos/:id/retirar
 * Retira a UNA persona del acuerdo (no a todo el grupo), con fecha y motivo.
 */
export const retirarBeneficiario = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);
    const data = retirarBeneficiarioSchema.parse(req.body);

    if (isNaN(acuerdoId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID de acuerdo inválido' } });
      return;
    }

    const acuerdo = await prisma.acuerdoSalud.findUnique({ where: { id: acuerdoId }, include: { beneficiario: true } });
    if (!acuerdo) {
      res.status(404).json({ success: false, error: { code: 'ACUERDO_NOT_FOUND', message: 'Acuerdo no encontrado' } });
      return;
    }

    if (esTitular(acuerdo.beneficiario.parentesco)) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_RETIRAR_TITULAR', message: 'No se puede retirar solo al titular; use eliminar el acuerdo completo' },
      });
      return;
    }

    if (acuerdo.estado === 'retirado') {
      res.status(400).json({ success: false, error: { code: 'YA_RETIRADO', message: 'Este beneficiario ya está retirado' } });
      return;
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.acuerdoSalud.update({
        where: { id: acuerdoId },
        data: {
          estado: 'retirado',
          fecha_retiro: new Date(data.fecha_retiro),
          motivo_retiro: data.motivo_retiro,
        },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'UPDATE',
        modulo: 'salud',
        registro_id: acuerdoId,
        antes: acuerdo,
        despues: actualizado,
      });

      return actualizado;
    });

    logger.info(`Beneficiario retirado del acuerdo de salud ${acuerdoId} (motivo: ${data.motivo_retiro})`);
    res.json({ success: true, data: { id: actualizado.id, estado: actualizado.estado, fecha_retiro: actualizado.fecha_retiro, motivo_retiro: actualizado.motivo_retiro } });
  } catch (error: any) {
    logger.error('Error al retirar beneficiario de salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al retirar beneficiario' } });
  }
};

// ============================================
// ENDPOINTS: PAGOS
// ============================================

/**
 * POST /api/salud/grupos/:numeroAcuerdo/pagos
 * Registra un pago único que cubre a todo el grupo: crea un movimiento por
 * cada persona vigente y reduce sus semanas sin pago por igual. Si el grupo
 * estaba suspendido, el pago lo reactiva.
 */
export const registrarPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;
    const data = registrarPagoSchema.parse(req.body);

    const ubicacion = await prisma.ubicacion.findUnique({ where: { id: data.ubicacion_id } });
    if (!ubicacion) {
      res.status(404).json({ success: false, error: { code: 'UBICACION_NOT_FOUND', message: 'Feria/ubicación no encontrada' } });
      return;
    }

    const filas = await prisma.acuerdoSalud.findMany({
      where: { numero_acuerdo: numeroAcuerdo, estado: { not: 'retirado' } },
    });

    if (filas.length === 0) {
      res.status(404).json({ success: false, error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró el acuerdo ${numeroAcuerdo}` } });
      return;
    }

    const fechaPago = new Date(data.fecha_pago);
    const estabaSuspendido = filas.some((f) => f.estado === 'suspendido');
    const concepto = `Pago salud - Año ${data.anio}, ${data.semanas} semana(s) - Recibo ${data.numero_recibo}`;

    await prisma.$transaction(async (tx) => {
      // El pago descuenta semanas sobre lo leído. Con los titulares bloqueados
      // se relee, para que dos pagos simultáneos del mismo grupo no partan del
      // mismo atraso (ver utils/bloqueos.ts)
      const titulares = await tx.beneficiario.findMany({
        where: { id: { in: filas.map((f) => f.beneficiario_id) } },
        select: { socio_id: true },
      });
      await bloquearSocios(tx, titulares.map((t) => t.socio_id));

      const vigentes = await tx.acuerdoSalud.findMany({ where: { id: { in: filas.map((f) => f.id) } } });

      for (const fila of vigentes) {
        await tx.movimientoSalud.create({
          data: {
            acuerdo_id: fila.id,
            tipo_movimiento: 'pago',
            monto_usd: data.monto_usd,
            monto_bs: data.monto_bs,
            tasa_cambio: data.tasa_cambio,
            semanas_pagadas: data.semanas,
            numero_recibo: data.numero_recibo,
            ubicacion_id: data.ubicacion_id,
            concepto,
            fecha_movimiento: fechaPago,
          },
        });

        await tx.acuerdoSalud.update({
          where: { id: fila.id },
          data: {
            semanas_sin_pago: Math.max(0, fila.semanas_sin_pago - data.semanas),
            ...(estabaSuspendido && { estado: 'activo', fecha_suspension: null }),
          },
        });
      }

      await registrarAuditoria(tx, {
        req,
        accion: 'CREATE',
        modulo: 'salud',
        despues: { numero_acuerdo: numeroAcuerdo, ...data, personas_afectadas: vigentes.length },
      });
    });

    logger.info(`Pago de salud registrado para acuerdo ${numeroAcuerdo}: ${filas.length} persona(s), ${data.semanas} semana(s)`);

    res.status(201).json({
      success: true,
      data: { numero_acuerdo: numeroAcuerdo, personas_afectadas: filas.length, reactivado: estabaSuspendido },
    });
  } catch (error: any) {
    logger.error('Error al registrar pago de salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al registrar el pago' } });
  }
};

// ============================================
// ENDPOINT: IMPORTAR A FUNERARIA
// ============================================

/**
 * POST /api/salud/grupos/:numeroAcuerdo/importar-funeraria
 * Copia a las personas seleccionadas del grupo de salud al servicio de
 * funeraria, en una sola transacción (a diferencia del "Importar a Salud"
 * de Funeraria, que hace un loop de peticiones HTTP desde el frontend).
 */
export const importarGrupoAFuneraria = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroAcuerdo = req.params.numeroAcuerdo!;
    const data = importarFunerariaSchema.parse(req.body);

    const filas = await prisma.acuerdoSalud.findMany({
      where: { numero_acuerdo: numeroAcuerdo, beneficiario_id: { in: data.beneficiario_ids } },
      include: { beneficiario: true },
    });

    if (filas.length !== data.beneficiario_ids.length) {
      res.status(404).json({ success: false, error: { code: 'BENEFICIARIO_NOT_IN_GROUP', message: 'Alguna de las personas seleccionadas no pertenece a este acuerdo de salud' } });
      return;
    }

    // Un acuerdo suspendido no debe poder traspasarse a Funeraria: primero
    // hay que reactivarlo (o el traspaso terminaría copiando personas de un
    // grupo que en teoría no tiene derecho al servicio en este momento).
    const suspendidos = filas.filter((f) => f.estado === 'suspendido');
    if (suspendidos.length > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ACUERDO_SUSPENDIDO',
          message: `El acuerdo de salud ${numeroAcuerdo} está suspendido; reactívelo antes de traspasar personas a Funeraria.`,
        },
      });
      return;
    }

    const tipoAcuerdoFuneraria = await prisma.tipoAcuerdoFuneraria.findUnique({ where: { id: data.tipo_acuerdo_funeraria_id } });
    if (!tipoAcuerdoFuneraria || !tipoAcuerdoFuneraria.estado) {
      res.status(404).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'Tipo de acuerdo de funeraria no encontrado o inactivo' } });
      return;
    }

    const yaTienenFuneraria = await prisma.acuerdoFuneraria.findMany({
      where: { beneficiario_id: { in: data.beneficiario_ids }, estado: { in: ['activo', 'suspendido'] } },
      include: { beneficiario: true },
    });

    if (yaTienenFuneraria.length > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'YA_TIENE_FUNERARIA',
          message: `Ya tienen un acuerdo de funeraria activo: ${yaTienenFuneraria.map((a) => `${a.beneficiario.nombre} ${a.beneficiario.apellido}`).join(', ')}`,
        },
      });
      return;
    }

    const creados = await prisma.$transaction(async (tx) => {
      const resultados = [];
      let intento = 1;
      for (const fila of filas) {
        let numeroFinal = `${data.numero_acuerdo_funeraria}-${intento}`;
        // Garantizar unicidad ante colisiones improbables (grupo de hasta 9 personas)
        while (await tx.acuerdoFuneraria.findUnique({ where: { numero_acuerdo: numeroFinal } })) {
          numeroFinal = `${numeroFinal}B`;
        }

        resultados.push(
          await tx.acuerdoFuneraria.create({
            data: {
              beneficiario_id: fila.beneficiario_id,
              tipo_acuerdo_id: data.tipo_acuerdo_funeraria_id,
              numero_acuerdo: numeroFinal,
              numero_contrato: data.numero_contrato_funeraria || null,
              estado: 'activo',
              semanas_sin_pago: 0,
              fecha_inicio: new Date(),
            },
          })
        );
        intento += 1;
      }
      await registrarAuditoria(tx, {
        req,
        accion: 'CREATE',
        modulo: 'funeraria',
        despues: { origen: 'salud', numero_acuerdo_salud: numeroAcuerdo, personas: resultados.length },
      });

      return resultados;
    });

    logger.info(`Transferidas ${creados.length} persona(s) del acuerdo de salud ${numeroAcuerdo} a funeraria`);

    res.status(201).json({ success: true, data: { transferidos: creados.length, numeros_acuerdo_funeraria: creados.map((c) => c.numero_acuerdo) } });
  } catch (error: any) {
    logger.error('Error al importar grupo de salud a funeraria:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al transferir a funeraria' } });
  }
};

/**
 * POST /api/salud/acuerdos
 * Alta de UN acuerdo para un beneficiario ya existente, sin número de
 * acuerdo. Se conserva exclusivamente para el flujo "Importar a Salud" que
 * ya usa el módulo de Funeraria (FunerariaPage.tsx) — no usar para nada más.
 */
export const crearAcuerdo = async (req: Request, res: Response): Promise<void> => {
  const crearAcuerdoSchema = z.object({
    socio_id: z.number().int().positive(),
    tipo_acuerdo_id: z.number().int().positive(),
    beneficiario_id: z.number().int().positive().optional(),
    fecha_inicio: z.string().optional(),
  });

  try {
    const data = crearAcuerdoSchema.parse(req.body);

    const socio = await prisma.socio.findUnique({ where: { id: data.socio_id } });
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }

    const noHabilitado = motivoNoHabilitado(socio, 'inscribir un acuerdo de salud');
    if (noHabilitado) {
      res.status(400).json(RESPUESTA_NO_HABILITADO(noHabilitado));
      return;
    }

    const tipoAcuerdo = await prisma.tipoAcuerdoSalud.findUnique({ where: { id: data.tipo_acuerdo_id } });
    if (!tipoAcuerdo || !tipoAcuerdo.estado) {
      res.status(404).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'Tipo de acuerdo no encontrado o inactivo' } });
      return;
    }

    const beneficiarioId = data.beneficiario_id || (await prisma.$transaction((tx) => obtenerOCrearBeneficiario(tx, data.socio_id))).id;

    const acuerdoExistente = await prisma.acuerdoSalud.findFirst({
      where: { beneficiario_id: beneficiarioId, estado: { in: ['activo', 'suspendido'] } },
    });

    if (acuerdoExistente) {
      res.status(409).json({ success: false, error: { code: 'ACUERDO_ALREADY_EXISTS', message: 'El beneficiario ya tiene un acuerdo activo' } });
      return;
    }

    const nuevoAcuerdo = await prisma.$transaction(async (tx) => {
      const nuevoAcuerdo = await tx.acuerdoSalud.create({
        data: {
          beneficiario_id: beneficiarioId,
          tipo_acuerdo_id: data.tipo_acuerdo_id,
          estado: 'activo',
          semanas_sin_pago: 0,
          fecha_inicio: data.fecha_inicio ? new Date(data.fecha_inicio) : new Date(),
        },
        include: { beneficiario: { include: { socio: true } }, tipo_acuerdo: true },
      });

      await registrarAuditoria(tx, {
        req,
        accion: 'CREATE',
        modulo: 'salud',
        registro_id: nuevoAcuerdo.id,
        despues: { origen: 'funeraria', acuerdo_id: nuevoAcuerdo.id, socio_id: data.socio_id },
      });

      return nuevoAcuerdo;
    });

    res.status(201).json({
      success: true,
      data: {
        id: nuevoAcuerdo.id,
        beneficiario: { id: nuevoAcuerdo.beneficiario.id, nombre_completo: `${nuevoAcuerdo.beneficiario.nombre} ${nuevoAcuerdo.beneficiario.apellido}` },
        socio: nuevoAcuerdo.beneficiario.socio ? { id: nuevoAcuerdo.beneficiario.socio.id, nombre_completo: `${nuevoAcuerdo.beneficiario.socio.nombre} ${nuevoAcuerdo.beneficiario.socio.apellido}` } : null,
        tipo_acuerdo: { nombre: nuevoAcuerdo.tipo_acuerdo.nombre, monto_usd: Number(nuevoAcuerdo.tipo_acuerdo.monto_usd) },
        estado: nuevoAcuerdo.estado,
        fecha_inicio: nuevoAcuerdo.fecha_inicio,
      },
    });

    logger.info(`Acuerdo salud ${nuevoAcuerdo.id} creado para socio ${data.socio_id} (origen: importación externa)`);
  } catch (error: any) {
    logger.error('Error al crear acuerdo salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al crear acuerdo' } });
  }
};

// ============================================
// SUSPENSIÓN AUTOMÁTICA (endpoint + lógica reutilizable para el cron job)
// ============================================

/**
 * Suspende (en cascada, por grupo) los acuerdos activos con
 * SEMANAS_LIMITE_SUSPENSION o más semanas sin pago. Reutilizada tanto por el
 * endpoint manual como por el job semanal (backend/src/jobs/saludSuspension.ts).
 */
export async function suspenderGruposVencidos(usuarioId: number | null): Promise<{ gruposSuspendidos: number; personasSuspendidas: number }> {
  const candidatos = await prisma.acuerdoSalud.findMany({
    where: { estado: 'activo', semanas_sin_pago: { gte: SEMANAS_LIMITE_SUSPENSION } },
  });

  const numerosAcuerdo = new Set<string>();
  const idsSinGrupo: number[] = [];
  for (const c of candidatos) {
    if (c.numero_acuerdo) numerosAcuerdo.add(c.numero_acuerdo);
    else idsSinGrupo.push(c.id);
  }

  let personasSuspendidas = 0;

  for (const numeroAcuerdo of numerosAcuerdo) {
    const resultado = await prisma.$transaction(async (tx) => {
      const r = await tx.acuerdoSalud.updateMany({
        where: { numero_acuerdo: numeroAcuerdo, estado: 'activo' },
        data: { estado: 'suspendido', fecha_suspension: new Date() },
      });

      await registrarAuditoria(tx, {
        usuarioId,
        accion: 'UPDATE',
        modulo: 'salud',
        despues: { tipo: 'suspension_automatica', numero_acuerdo: numeroAcuerdo, personas: r.count },
      });

      return r;
    });
    personasSuspendidas += resultado.count;
  }

  if (idsSinGrupo.length > 0) {
    const resultado = await prisma.acuerdoSalud.updateMany({
      where: { id: { in: idsSinGrupo } },
      data: { estado: 'suspendido', fecha_suspension: new Date() },
    });
    personasSuspendidas += resultado.count;
  }

  logger.info(`Suspensión automática salud: ${numerosAcuerdo.size} grupo(s), ${personasSuspendidas} persona(s) suspendida(s)`);

  return { gruposSuspendidos: numerosAcuerdo.size, personasSuspendidas };
}

/**
 * POST /api/salud/verificar-suspensiones
 */
export const verificarSuspensionesAutomaticas = async (req: Request, res: Response): Promise<void> => {
  try {
    const resultado = await suspenderGruposVencidos(req.user?.userId ?? null);
    res.json({ success: true, data: resultado });
  } catch (error: any) {
    logger.error('Error en verificación de suspensiones salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al verificar suspensiones' } });
  }
};

/**
 * `incrementarSemanasSinPago` se elimino.
 *
 * Subia en 1 el contador de cada acuerdo activo todos los lunes. Con la
 * cobertura por (ano, semana) como fuente de verdad ese incremento pasa a ser
 * incorrecto: el atraso ya sale de comparar la cobertura con la semana en
 * curso, asi que sumarle uno lo contaba dos veces y dejaba como atrasado a
 * quien habia pagado por adelantado.
 *
 * Lo reemplaza `recalcularEstados` en services/estadoServiciosService.ts, que
 * recalcula en vez de acumular y cubre tambien funeraria.
 */
