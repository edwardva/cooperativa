/**
 * ============================================
 * CONTROLLER: SALUD
 * ============================================
 * Gestión de acuerdos de servicio de salud.
 *
 * A diferencia de Funeraria (un acuerdo independiente por beneficiario), en
 * Salud el titular y todos sus beneficiarios (sin límite de cantidad) comparten UN mismo
 * "número de acuerdo" con una sola cuota familiar: cada persona sigue
 * teniendo su propia fila en AcuerdoSalud (una por beneficiario), pero todas
 * comparten el mismo valor de numero_acuerdo, y la suspensión/reactivación
 * por falta de pago se aplica a todo el grupo a la vez.
 */

import type { Request, Response } from 'express';
import { Prisma, type AcuerdoFuneraria, type AcuerdoSalud, type Beneficiario } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { registrarAuditoria } from '../services/auditoriaService';
import { bloquearSocios } from '../utils/bloqueos';
import { motivoNoHabilitado, RESPUESTA_NO_HABILITADO } from '../utils/socioHabilitado';
import { cedulaParaGuardar, esPedidoDeMenor } from '../utils/cedulaMenor';
import { obtenerOCrearFichaTitular } from '../utils/fichaTitular';
import { leerParametroNumerico } from '../services/tarifasService';

// REGLA DE NEGOCIO: Suspensión automática a las 11 semanas sin pago
const SEMANAS_LIMITE_SUSPENSION = 11;
const SEMANAS_ALERTA_PROXIMO_SUSPENDER = 10;
// REGLA DE NEGOCIO: los acuerdos de salud NO tienen tope de beneficiarios; el
// límite de 8 por acuerdo aplica únicamente a Funeraria.

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
  // Misma regla que en Funeraria (sociosController): números, letras y guión,
  // para menores sin cédula propia como "12345678-1" (confirmado el 30/10)
  cedula: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'La cédula debe tener al menos 3 caracteres')
    .max(20, 'La cédula admite hasta 20 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'La cédula solo admite números, letras y guión (-)'),
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
    // Salud tiene un solo tipo de acuerdo: el wizard ya no lo pide y se usa
    // el tipo activo vigente (de él sale el monto de la cuota)
    tipo_acuerdo_id: z.number().int().positive().optional(),
    numero_acuerdo: z.string().trim().min(1, 'El número de acuerdo es requerido').max(20),
    fecha_inicio: z.string().optional(),
    beneficiarios: z.array(beneficiarioGrupoSchema).default([]),
  })
  .refine(
    // Varios "MENOR" en la lista son niños distintos: cada uno recibe su MENOR-N
    (data) => {
      const cedulas = data.beneficiarios.map((b) => b.cedula).filter((c) => !esPedidoDeMenor(c));
      return new Set(cedulas).size === cedulas.length;
    },
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

const importarFunerariaSchema = z
  .object({
    // Vacío solo si se crea el acuerdo de funeraria (queda con el titular)
    beneficiario_ids: z.array(z.number().int().positive()),
    // Acuerdo de funeraria del mismo titular al que se copian...
    acuerdo_funeraria_id: z.number().int().positive().optional(),
    // ...o, si el titular no tiene ninguno vigente, el que se le crea aquí
    acuerdo_nuevo: z
      .object({
        numero_acuerdo: z.string().trim().min(1, 'El número de acuerdo es requerido').max(20),
        fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de inicio inválida').optional(),
      })
      .optional(),
    // Si no caben todos (máx. 8), los que sobran van a un acuerdo nuevo del mismo
    // titular con este número. Solo se envía después de que la pantalla avisó.
    acuerdo_adicional: z.object({ numero_acuerdo: z.string().trim().min(1, 'El número de acuerdo es requerido').max(20) }).optional(),
  })
  .refine((d) => !!d.acuerdo_funeraria_id !== !!d.acuerdo_nuevo, {
    message: 'Indica el acuerdo de funeraria destino o el que se va a crear',
  })
  .refine((d) => d.acuerdo_nuevo || d.beneficiario_ids.length > 0, {
    message: 'Selecciona al menos una persona a copiar',
  });

const importarDesdeFunerariaSchema = z.object({
  beneficiario_ids: z.array(z.number().int().positive()).min(1, 'Selecciona al menos una persona a copiar'),
  // Acuerdo de funeraria de donde vienen (deben estar vigentes en él)
  acuerdo_funeraria_id: z.number().int().positive(),
});

// Mismo import creando un acuerdo de salud nuevo a nombre del titular con este
// número y copiando ahí a los seleccionados. La lista puede ir vacía (acuerdo
// de funeraria sin beneficiarios): entonces se abre solo con el titular.
const importarDesdeFunerariaNuevoSchema = importarDesdeFunerariaSchema.extend({
  beneficiario_ids: z.array(z.number().int().positive()),
  numero_acuerdo: z.string().trim().min(1, 'El número de acuerdo es requerido').max(20),
  // Fecha de inicio del acuerdo nuevo (AAAA-MM-DD); si no viene, hoy
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de inicio inválida').optional(),
  // El titular ya tiene acuerdo de salud y el usuario confirmó abrirle otro
  abrir_otro: z.boolean().optional(),
});

const MAX_BENEFICIARIOS_FUNERARIA = 8;

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
 * La fila TITULAR de un acuerdo de salud: la persona es titular (el propio
 * socio) y no trae parentesco en el acuerdo. Un socio que es beneficiario del
 * acuerdo de otro socio también tiene su fila de Beneficiario "titular", pero
 * en ese acuerdo lleva acuerdo.parentesco (Hermano, Otro…), y no cuenta.
 */
const FILA_TITULAR_SALUD = {
  parentesco: null,
  beneficiario: { parentesco: { equals: 'titular', mode: 'insensitive' as const } },
} satisfies Prisma.AcuerdoSaludWhereInput;

const esFilaTitular = (fila: { parentesco: string | null; beneficiario: { parentesco: string } }) =>
  fila.parentesco === null && esTitular(fila.beneficiario.parentesco);

/** Años cumplidos a una fecha (columnas DATE: se comparan en UTC). Igual que en Funeraria. */
const edadA = (nacimiento: Date, fecha: Date): number => {
  const edad = fecha.getUTCFullYear() - nacimiento.getUTCFullYear();
  const antesDelCumple =
    fecha.getUTCMonth() < nacimiento.getUTCMonth() ||
    (fecha.getUTCMonth() === nacimiento.getUTCMonth() && fecha.getUTCDate() < nacimiento.getUTCDate());
  return antesDelCumple ? edad - 1 : edad;
};

/**
 * Número para un acuerdo de funeraria nuevo del socio, con el formato que
 * propone la pantalla de Funeraria: "expediente-N", el siguiente N libre.
 */
async function sugerirNumeroAcuerdoFuneraria(codigoSocio: string): Promise<string> {
  const existentes = await prisma.acuerdoFuneraria.findMany({
    where: { numero_acuerdo: { startsWith: `${codigoSocio}-` } },
    select: { numero_acuerdo: true },
  });
  const usados = new Set(existentes.map((a) => a.numero_acuerdo));
  const sufijos = existentes
    .map((a) => Number(a.numero_acuerdo!.slice(codigoSocio.length + 1)))
    .filter((n) => Number.isInteger(n) && n >= 0);
  let n = sufijos.length > 0 ? Math.max(...sufijos) + 1 : 0;
  while (usados.has(`${codigoSocio}-${n}`)) n++;
  return `${codigoSocio}-${n}`;
}

/**
 * Número para un acuerdo de salud nuevo del socio: su expediente (como los
 * acuerdos de salud reales, p. ej. 250626) o, si ya está usado,
 * "expediente-N" con el siguiente N libre.
 */
async function sugerirNumeroAcuerdoSalud(codigoSocio: string): Promise<string> {
  const existentes = await prisma.acuerdoSalud.findMany({
    where: { OR: [{ numero_acuerdo: codigoSocio }, { numero_acuerdo: { startsWith: `${codigoSocio}-` } }] },
    select: { numero_acuerdo: true },
  });
  const usados = new Set(existentes.map((a) => a.numero_acuerdo));
  if (!usados.has(codigoSocio)) return codigoSocio;
  let n = 1;
  while (usados.has(`${codigoSocio}-${n}`)) n++;
  return `${codigoSocio}-${n}`;
}

/** Parentesco que se muestra en el acuerdo: el propio del acuerdo, si lo tiene. */
const parentescoEnAcuerdo = (fila: { parentesco: string | null; beneficiario: { parentesco: string } }) =>
  fila.parentesco ?? fila.beneficiario.parentesco;

/** Fila "titular" del expediente (el propio socio) para enlazarla a un acuerdo. */
const obtenerOCrearBeneficiario = obtenerOCrearFichaTitular;

/**
 * Encuentra (por cédula) o crea un beneficiario del socio.
 *
 * Los acuerdos de salud no tienen tope de beneficiarios.
 *
 * Si la persona ya existe (en esta familia o en otro expediente, p. ej. es
 * socio de la cooperativa) se reutiliza su ficha. Si es de otro expediente, el
 * parentesco con ESTE titular se devuelve aparte para guardarlo en la fila del
 * acuerdo.
 */
async function encontrarOCrearBeneficiarioFamiliar(
  tx: TxClient,
  socioId: number,
  datos: z.infer<typeof beneficiarioGrupoSchema>
): Promise<{ beneficiario: Beneficiario; parentescoEnAcuerdo: string | null }> {
  // "MENOR" nunca se busca: es un menor sin cédula, siempre una persona nueva
  // (si no, se enlazaría al menor de otra familia)
  if (!esPedidoDeMenor(datos.cedula)) {
    // El titular no puede ser beneficiario de su propio acuerdo, aunque su
    // cédula figure en otro de sus expedientes
    const titular = await tx.socio.findUnique({ where: { id: socioId }, select: { cedula: true } });
    if (titular?.cedula === datos.cedula) {
      const err: any = new Error('Esa cédula es la del socio titular: ya forma parte del acuerdo como titular');
      err.code = 'TITULAR_COMO_BENEFICIARIO';
      throw err;
    }

    // La cédula es única por expediente: puede haber varias fichas de la misma
    // persona. Primero la de esta familia; si no, la de su expediente activo.
    const existentes = await tx.beneficiario.findMany({
      where: { cedula: datos.cedula },
      include: { socio: { select: { estado: true } } },
      orderBy: { id: 'asc' },
    });
    const deEstaFamilia = existentes.find((b) => b.socio_id === socioId);
    if (deEstaFamilia) {
      return { beneficiario: deEstaFamilia, parentescoEnAcuerdo: esTitular(deEstaFamilia.parentesco) ? datos.parentesco : null };
    }
    const deOtroExpediente =
      existentes.find((b) => esTitular(b.parentesco) && b.socio.estado === 'activo') ??
      existentes.find((b) => esTitular(b.parentesco)) ??
      existentes[0];
    if (deOtroExpediente) {
      const { socio: _socio, ...beneficiario } = deOtroExpediente;
      return { beneficiario, parentescoEnAcuerdo: datos.parentesco };
    }
  }

  const beneficiario = await tx.beneficiario.create({
    data: {
      socio_id: socioId,
      cedula: await cedulaParaGuardar(tx, datos.cedula),
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
  return { beneficiario, parentescoEnAcuerdo: null };
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
    parentesco: parentescoEnAcuerdo(row),
    // Persona de otro expediente (socio u otra familia): sus datos personales
    // se modifican allá; en este acuerdo solo se cambia su parentesco
    expediente_propio: row.parentesco !== null ? row.beneficiario.socio?.codigo_socio ?? null : null,
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
  const titularRow = rows.find(esFilaTitular) || rows[0];
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
    const [totalAcuerdos, porEstado, porTipo, proximosSuspender, sinDerecho] = await Promise.all([
      prisma.acuerdoSalud.count({ where: FILA_TITULAR_SALUD }),

      prisma.$queryRaw<Array<{ estado: string; cantidad: bigint }>>`
        SELECT a.estado, COUNT(*)::int as cantidad
        FROM acuerdos_salud a
        JOIN beneficiarios b ON b.id = a.beneficiario_id
        WHERE LOWER(b.parentesco) = 'titular' AND a.parentesco IS NULL
        GROUP BY a.estado
        ORDER BY cantidad DESC
      `,

      prisma.$queryRaw<Array<{ tipo_nombre: string; cantidad: bigint }>>`
        SELECT tas.nombre as tipo_nombre, COUNT(as2.id)::int as cantidad
        FROM acuerdos_salud as2
        JOIN tipos_acuerdo_salud tas ON as2.tipo_acuerdo_id = tas.id
        JOIN beneficiarios b ON b.id = as2.beneficiario_id
        WHERE LOWER(b.parentesco) = 'titular' AND as2.parentesco IS NULL
        GROUP BY tas.nombre
        ORDER BY cantidad DESC
      `,

      prisma.acuerdoSalud.count({
        where: {
          estado: 'activo',
          semanas_sin_pago: { gte: SEMANAS_ALERTA_PROXIMO_SUSPENDER, lt: SEMANAS_LIMITE_SUSPENSION },
          ...FILA_TITULAR_SALUD,
        },
      }),

      prisma.acuerdoSalud.count({
        where: { estado: 'activo', semanas_sin_pago: { gt: 0 }, ...FILA_TITULAR_SALUD },
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

    const where: Prisma.AcuerdoSaludWhereInput = { ...FILA_TITULAR_SALUD };

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

    // Personas de los acuerdos donde este socio es el titular (incluye a
    // beneficiarios de otro expediente), más las filas sin número de su
    // familia. No incluye acuerdos ajenos donde él es solo beneficiario.
    const gruposDelTitular = await prisma.acuerdoSalud.findMany({
      where: { ...FILA_TITULAR_SALUD, beneficiario: { ...FILA_TITULAR_SALUD.beneficiario, socio_id: socioId }, numero_acuerdo: { not: null } },
      select: { numero_acuerdo: true },
    });
    const numerosDelTitular = gruposDelTitular.map((g) => g.numero_acuerdo!);

    const acuerdos = await prisma.acuerdoSalud.findMany({
      where: {
        OR: [
          { numero_acuerdo: { in: numerosDelTitular } },
          { numero_acuerdo: null, parentesco: null, beneficiario: { socio_id: socioId } },
        ],
      },
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
          parentesco: parentescoEnAcuerdo(acuerdo),
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
      where: { estado: 'suspendido', ...FILA_TITULAR_SALUD },
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
  switch (tipo) {
    case 'activos':
      return { estado: 'activo', ...FILA_TITULAR_SALUD };
    case 'suspendidos':
      return { estado: 'suspendido', ...FILA_TITULAR_SALUD };
    case 'proximos_suspender':
      return {
        estado: 'activo',
        semanas_sin_pago: { gte: SEMANAS_ALERTA_PROXIMO_SUSPENDER, lt: SEMANAS_LIMITE_SUSPENSION },
        ...FILA_TITULAR_SALUD,
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

    const tipoAcuerdo = data.tipo_acuerdo_id
      ? await prisma.tipoAcuerdoSalud.findUnique({ where: { id: data.tipo_acuerdo_id } })
      : await prisma.tipoAcuerdoSalud.findFirst({ where: { estado: true }, orderBy: { id: 'asc' } });
    if (!tipoAcuerdo || !tipoAcuerdo.estado) {
      res.status(404).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'No hay un tipo de acuerdo de salud activo configurado' } });
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
            tipo_acuerdo_id: tipoAcuerdo.id,
            numero_acuerdo: data.numero_acuerdo,
            estado: 'activo',
            semanas_sin_pago: 0,
            fecha_inicio: fechaInicio,
          },
        })
      );

      for (const b of data.beneficiarios) {
        const { beneficiario, parentescoEnAcuerdo } = await encontrarOCrearBeneficiarioFamiliar(tx, data.socio_id, b);

        filasCreadas.push(
          await tx.acuerdoSalud.create({
            data: {
              beneficiario_id: beneficiario.id,
              tipo_acuerdo_id: tipoAcuerdo.id,
              numero_acuerdo: data.numero_acuerdo,
              parentesco: parentescoEnAcuerdo,
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

    if (['CEDULA_DUPLICADA', 'TITULAR_COMO_BENEFICIARIO'].includes(error.code)) {
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

    // La fila del titular: de ella salen el socio y los datos del acuerdo
    const filaReferencia =
      (await prisma.acuerdoSalud.findFirst({
        where: { numero_acuerdo: numeroAcuerdo, ...FILA_TITULAR_SALUD },
        include: { beneficiario: true },
      })) ??
      (await prisma.acuerdoSalud.findFirst({
        where: { numero_acuerdo: numeroAcuerdo },
        include: { beneficiario: true },
        orderBy: { id: 'asc' },
      }));

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
      const { beneficiario, parentescoEnAcuerdo } = await encontrarOCrearBeneficiarioFamiliar(tx, socioId, datos);

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
          parentesco: parentescoEnAcuerdo,
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

    if (['BENEFICIARIO_YA_EN_GRUPO', 'TITULAR_COMO_BENEFICIARIO'].includes(error.code)) {
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

    // La fecha de inicio del acuerdo es la del titular. Al cambiarla se mueven
    // también quienes empezaron junto con él; los que se sumaron después
    // conservan su propia fecha.
    const filaTitular = data.fecha_inicio
      ? await prisma.acuerdoSalud.findFirst({ where: { numero_acuerdo: numeroAcuerdo, ...FILA_TITULAR_SALUD } })
      : null;

    await prisma.$transaction(async (tx) => {
      if (data.fecha_inicio !== undefined) {
        await tx.acuerdoSalud.updateMany({
          where: { numero_acuerdo: numeroAcuerdo, ...(filaTitular && { fecha_inicio: filaTitular.fecha_inicio }) },
          data: { fecha_inicio: new Date(data.fecha_inicio) },
        });
      }
      await tx.acuerdoSalud.updateMany({
        where: { numero_acuerdo: numeroAcuerdo },
        data: {
          ...(data.numero_acuerdo_nuevo !== undefined && { numero_acuerdo: data.numero_acuerdo_nuevo }),
          ...(data.numero_contrato !== undefined && { numero_contrato: data.numero_contrato || null }),
          ...(data.tipo_acuerdo_id !== undefined && { tipo_acuerdo_id: data.tipo_acuerdo_id }),
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

    if (esFilaTitular(acuerdo)) {
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
 * Suspende o reactiva TODO el grupo (una sola cuota familiar cubre a todas
 * sus personas), sin afectar a miembros ya retirados individualmente.
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
 * PATCH /api/salud/acuerdos/:id/parentesco
 * Cambia el parentesco de una persona de OTRO expediente (p. ej. un socio que
 * es beneficiario de este acuerdo) dentro de este acuerdo. Sus datos
 * personales no se tocan: se modifican en su propio expediente.
 */
export const actualizarParentescoEnAcuerdo = async (req: Request, res: Response): Promise<void> => {
  try {
    const acuerdoId = parseInt(req.params.id!);
    if (isNaN(acuerdoId)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID de acuerdo inválido' } });
      return;
    }
    const { parentesco } = z
      .object({ parentesco: z.enum(PARENTESCOS_BENEFICIARIO, { errorMap: () => ({ message: 'Selecciona un parentesco válido' }) }) })
      .parse(req.body);

    const acuerdo = await prisma.acuerdoSalud.findUnique({ where: { id: acuerdoId }, include: { beneficiario: true } });
    if (!acuerdo) {
      res.status(404).json({ success: false, error: { code: 'ACUERDO_NOT_FOUND', message: 'Acuerdo no encontrado' } });
      return;
    }
    if (acuerdo.parentesco === null) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PARENTESCO_DE_LA_PERSONA',
          message: esFilaTitular(acuerdo)
            ? 'Los datos del socio titular no se modifican desde Salud. Hazlo desde el módulo de Socios.'
            : 'Esta persona es beneficiaria del titular: su parentesco se modifica con "Editar".',
        },
      });
      return;
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const fila = await tx.acuerdoSalud.update({ where: { id: acuerdoId }, data: { parentesco } });
      await registrarAuditoria(tx, {
        req,
        accion: 'UPDATE',
        modulo: 'salud',
        registro_id: acuerdoId,
        antes: { parentesco: acuerdo.parentesco },
        despues: { parentesco },
      });
      return fila;
    });

    res.json({ success: true, data: { id: actualizado.id, parentesco: actualizado.parentesco } });
  } catch (error: any) {
    logger.error('Error al cambiar el parentesco en el acuerdo de salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: error.errors } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al cambiar el parentesco' } });
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

    if (esFilaTitular(acuerdo)) {
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
 * Copia a los beneficiarios seleccionados del grupo de salud a UNO de los
 * acuerdos de funeraria del mismo titular (un socio puede tener varios; la
 * pantalla pregunta a cuál). Solo copia: en Salud nada cambia ni se borra, y
 * quien ya está en otro acuerdo de funeraria no se mueve de allí.
 * Si el titular no tiene ningún acuerdo de funeraria vigente, `acuerdo_nuevo`
 * se lo crea en la misma operación (aunque no se elija a nadie: queda con el titular).
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

    // El dueño es el titular del acuerdo de salud, no la primera persona marcada
    const filaTitular = await prisma.acuerdoSalud.findFirst({
      where: { numero_acuerdo: numeroAcuerdo, ...FILA_TITULAR_SALUD },
      include: { beneficiario: { select: { socio_id: true } } },
    });
    if (!filaTitular || filaTitular.estado === 'retirado') {
      res.status(404).json({ success: false, error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró el acuerdo de salud ${numeroAcuerdo} o está retirado` } });
      return;
    }

    // Un acuerdo suspendido no debe poder traspasarse a Funeraria: primero
    // hay que reactivarlo (o el traspaso terminaría copiando personas de un
    // grupo que en teoría no tiene derecho al servicio en este momento).
    if (filaTitular.estado === 'suspendido' || filas.some((f) => f.estado === 'suspendido')) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ACUERDO_SUSPENDIDO',
          message: `El acuerdo de salud ${numeroAcuerdo} está suspendido; reactívelo antes de traspasar personas a Funeraria.`,
        },
      });
      return;
    }

    const socioId = filaTitular.beneficiario.socio_id;
    const socio = await prisma.socio.findUnique({ where: { id: socioId } });
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }

    /**
     * Mismas reglas que al crear un acuerdo desde Funeraria (socio habilitado,
     * número libre, edad del titular, tarifa). Devuelve el tipo a usar o
     * responde el error y devuelve null.
     */
    const validarAcuerdoNuevo = async (numero: string, inicio: Date, cual: string): Promise<number | null> => {
      const noHabilitado = motivoNoHabilitado(socio, 'inscribir un acuerdo de funeraria');
      if (noHabilitado) {
        res.status(400).json(RESPUESTA_NO_HABILITADO(noHabilitado));
        return null;
      }
      if (await prisma.acuerdoFuneraria.findUnique({ where: { numero_acuerdo: numero } })) {
        res.status(409).json({
          success: false,
          error: { code: 'NUMERO_ACUERDO_EN_USO', message: `El número de acuerdo de funeraria ${numero} ya está registrado. Escribe otro.` },
        });
        return null;
      }
      const edadMaxima = await leerParametroNumerico('EDAD_MAXIMA_TITULAR_FUNERARIA');
      if (socio.fecha_nacimiento && edadA(socio.fecha_nacimiento, inicio) > edadMaxima) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EDAD_TITULAR_EXCEDIDA',
            message: `No se puede crear ${cual}: el titular tiene ${edadA(socio.fecha_nacimiento, inicio)} años y la funeraria admite hasta los ${edadMaxima}. No se copió a nadie.`,
          },
        });
        return null;
      }
      const tipo = await prisma.tipoAcuerdoFuneraria.findFirst({ where: { estado: true }, orderBy: { id: 'asc' } });
      if (!tipo) {
        res.status(500).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'No hay una tarifa de funeraria activa configurada' } });
        return null;
      }
      return tipo.id;
    };

    // Destino: un acuerdo de funeraria existente del titular, o uno que se crea
    // aquí porque no tiene ninguno vigente
    let acuerdoFuneraria: AcuerdoFuneraria | null = null;
    let tipoNuevoId: number | null = null;
    const fechaNuevo = data.acuerdo_nuevo?.fecha_inicio ? new Date(data.acuerdo_nuevo.fecha_inicio) : new Date();
    if (data.acuerdo_funeraria_id) {
      acuerdoFuneraria = await prisma.acuerdoFuneraria.findFirst({
        where: { id: data.acuerdo_funeraria_id, beneficiario: { socio_id: socioId } },
      });
      if (!acuerdoFuneraria || acuerdoFuneraria.estado === 'retirado') {
        res.status(404).json({ success: false, error: { code: 'ACUERDO_FUNERARIA_NOT_FOUND', message: 'El acuerdo de funeraria elegido no existe, está retirado o no es de este titular' } });
        return;
      }
    } else {
      // Solo se crea si de verdad no tiene uno vigente: si lo tiene, se copia ahí
      const vigente = await prisma.acuerdoFuneraria.findFirst({
        where: { beneficiario: { socio_id: socioId }, estado: { not: 'retirado' } },
      });
      if (vigente) {
        res.status(409).json({
          success: false,
          error: {
            code: 'YA_TIENE_ACUERDO_FUNERARIA',
            message: `El socio ${socio.codigo_socio} ya tiene el acuerdo de funeraria ${vigente.numero_acuerdo || `#${vigente.id}`}: los beneficiarios se copian a ese acuerdo.`,
          },
        });
        return;
      }
      tipoNuevoId = await validarAcuerdoNuevo(data.acuerdo_nuevo!.numero_acuerdo, fechaNuevo, 'el acuerdo de funeraria');
      if (tipoNuevoId === null) return;
    }
    const destinoId = acuerdoFuneraria?.id ?? null;
    const numeroFuneraria = acuerdoFuneraria
      ? acuerdoFuneraria.numero_acuerdo || `#${acuerdoFuneraria.id}`
      : data.acuerdo_nuevo!.numero_acuerdo;

    // El titular ya es el dueño del acuerdo de funeraria y quien no está activo
    // (fallecido, retirado) no ocupa cupo: ninguno de los dos se copia. Tampoco
    // quien es de otro expediente (p. ej. otro socio): su ficha es de allá.
    const nombre = (b: { nombre: string; apellido: string }) => `${b.nombre} ${b.apellido}`;
    const personas = filas.map((f) => f.beneficiario);
    const deOtroExpediente = new Set(filas.filter((f) => f.parentesco !== null).map((f) => f.beneficiario_id));
    const omitidos = personas.filter(
      (b) => b.parentesco.trim().toLowerCase() === 'titular' || b.estado !== 'activo' || deOtroExpediente.has(b.id)
    );
    const candidatos = personas.filter((b) => !omitidos.includes(b));
    // Quien fue retirado de funeraria quedó libre y puede copiarse de nuevo
    const vigenteEnFuneraria = (b: (typeof personas)[number]) =>
      b.acuerdo_funeraria_id !== null && b.fecha_retiro_funeraria === null;
    const yaEstaban = candidatos.filter((b) => vigenteEnFuneraria(b) && b.acuerdo_funeraria_id === destinoId);
    const aCopiar = candidatos.filter((b) => !vigenteEnFuneraria(b));

    // Quien ya figura en OTRO acuerdo de funeraria no se mueve: eso lo quitaría de allá
    const enOtroAcuerdo = candidatos.filter((b) => vigenteEnFuneraria(b) && b.acuerdo_funeraria_id !== destinoId);
    if (enOtroAcuerdo.length > 0) {
      const otros = await prisma.acuerdoFuneraria.findMany({
        where: { id: { in: enOtroAcuerdo.map((b) => b.acuerdo_funeraria_id!) } },
        select: { id: true, numero_acuerdo: true },
      });
      const numeroDe = (id: number) => otros.find((o) => o.id === id)?.numero_acuerdo || `#${id}`;
      res.status(409).json({
        success: false,
        error: {
          code: 'EN_OTRO_ACUERDO_FUNERARIA',
          message: `Ya están en otro acuerdo de funeraria y no se pueden copiar a ${numeroFuneraria}: ${enOtroAcuerdo
            .map((b) => `${nombre(b)} (acuerdo ${numeroDe(b.acuerdo_funeraria_id!)})`)
            .join(', ')}. Desmárcalos para continuar.`,
        },
      });
      return;
    }

    // Se eligieron personas pero ninguna se puede copiar: no se abre un acuerdo por nada
    if (!acuerdoFuneraria && data.beneficiario_ids.length > 0 && aCopiar.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'NADA_QUE_COPIAR', message: 'Ninguna de las personas seleccionadas se puede copiar: no se creó el acuerdo de funeraria.' },
      });
      return;
    }

    const activosEnAcuerdo = acuerdoFuneraria
      ? await prisma.beneficiario.count({
          where: {
            acuerdo_funeraria_id: acuerdoFuneraria.id,
            fecha_retiro_funeraria: null,
            estado: 'activo',
            NOT: { parentesco: { equals: 'titular', mode: 'insensitive' } },
          },
        })
      : 0;
    // Tope de 8 por acuerdo: los que caben van al elegido y el resto, si la
    // pantalla ya lo confirmó, a un acuerdo adicional del mismo titular
    const cupos = Math.max(0, MAX_BENEFICIARIOS_FUNERARIA - activosEnAcuerdo);
    const alElegido = aCopiar.slice(0, cupos);
    const sobrantes = aCopiar.slice(cupos);

    if (sobrantes.length > 0 && !data.acuerdo_adicional) {
      let numeroSugerido = await sugerirNumeroAcuerdoFuneraria(socio.codigo_socio);
      // El acuerdo nuevo todavía no existe: que la sugerencia no repita su número
      if (numeroSugerido === data.acuerdo_nuevo?.numero_acuerdo) {
        const n = Number(numeroSugerido.slice(socio.codigo_socio.length + 1));
        numeroSugerido = `${socio.codigo_socio}-${Number.isInteger(n) ? n + 1 : 1}`;
      }
      res.status(409).json({
        success: false,
        error: {
          code: 'LIMITE_BENEFICIARIOS',
          message:
            `Se superó el límite de ${MAX_BENEFICIARIOS_FUNERARIA} beneficiarios del acuerdo de funeraria ${numeroFuneraria}: ` +
            `tiene ${activosEnAcuerdo} y quedan ${cupos} cupo(s) para los ${aCopiar.length} seleccionados.`,
          detalles: {
            cupos,
            al_elegido: alElegido.map(nombre),
            sobrantes: sobrantes.map(nombre),
            numero_sugerido: numeroSugerido,
          },
        },
      });
      return;
    }

    // El acuerdo adicional es un acuerdo nuevo como cualquiera: mismas reglas
    let tipoAdicionalId: number | null = null;
    if (sobrantes.length > 0) {
      const numeroAdicional = data.acuerdo_adicional!.numero_acuerdo;
      if (numeroAdicional === data.acuerdo_nuevo?.numero_acuerdo) {
        res.status(409).json({
          success: false,
          error: { code: 'NUMERO_ACUERDO_EN_USO', message: `El acuerdo adicional no puede tener el mismo número (${numeroAdicional}) que el acuerdo nuevo.` },
        });
        return;
      }
      tipoAdicionalId = await validarAcuerdoNuevo(numeroAdicional, new Date(), 'el acuerdo adicional');
      if (tipoAdicionalId === null) return;
    }

    // Todo o nada: si falla algún acuerdo nuevo no queda nadie copiado a medias
    const { destino, adicional } = await prisma.$transaction(async (tx) => {
      const enlazar = async (ids: number[], acuerdoId: number) =>
        tx.beneficiario.updateMany({
          where: { id: { in: ids }, OR: [{ acuerdo_funeraria_id: null }, { fecha_retiro_funeraria: { not: null } }] },
          data: { acuerdo_funeraria_id: acuerdoId, fecha_retiro_funeraria: null },
        });

      let destino = acuerdoFuneraria;
      if (!destino) {
        // Titular sin acuerdo de funeraria: se crea a su nombre, igual que desde Funeraria
        const fichaTitular = await obtenerOCrearBeneficiario(tx, socioId);
        destino = await tx.acuerdoFuneraria.create({
          data: {
            beneficiario_id: fichaTitular.id,
            tipo_acuerdo_id: tipoNuevoId!,
            numero_acuerdo: data.acuerdo_nuevo!.numero_acuerdo,
            estado: 'activo',
            semanas_sin_pago: 0,
            fecha_inicio: fechaNuevo,
          },
        });
        await registrarAuditoria(tx, {
          req,
          accion: 'CREATE',
          modulo: 'funeraria',
          registro_id: destino.id,
          despues: { origen: 'salud', numero_acuerdo_salud: numeroAcuerdo, numero_acuerdo_funeraria: destino.numero_acuerdo, socio_id: socioId },
        });
      }

      if (alElegido.length > 0) {
        await enlazar(alElegido.map((b) => b.id), destino.id);
        await registrarAuditoria(tx, {
          req,
          accion: 'UPDATE',
          modulo: 'funeraria',
          registro_id: destino.id,
          despues: {
            origen: 'salud',
            numero_acuerdo_salud: numeroAcuerdo,
            numero_acuerdo_funeraria: destino.numero_acuerdo,
            beneficiarios_copiados: alElegido.map((b) => b.id),
          },
        });
      }

      if (sobrantes.length === 0) return { destino, adicional: null };

      const nuevo = await tx.acuerdoFuneraria.create({
        data: {
          beneficiario_id: destino.beneficiario_id,
          tipo_acuerdo_id: tipoAdicionalId!,
          numero_acuerdo: data.acuerdo_adicional!.numero_acuerdo,
          estado: 'activo',
          semanas_sin_pago: 0,
          fecha_inicio: new Date(),
        },
      });
      await enlazar(sobrantes.map((b) => b.id), nuevo.id);
      await registrarAuditoria(tx, {
        req,
        accion: 'CREATE',
        modulo: 'funeraria',
        registro_id: nuevo.id,
        despues: {
          origen: 'salud',
          motivo: `Acuerdo adicional: el acuerdo ${numeroFuneraria} llegó a ${MAX_BENEFICIARIOS_FUNERARIA} beneficiarios`,
          numero_acuerdo_salud: numeroAcuerdo,
          numero_acuerdo_funeraria: nuevo.numero_acuerdo,
          beneficiarios_copiados: sobrantes.map((b) => b.id),
        },
      });
      return { destino, adicional: nuevo };
    });

    logger.info(
      `Copiadas ${aCopiar.length} persona(s) del acuerdo de salud ${numeroAcuerdo} a funeraria ${numeroFuneraria}` +
        (acuerdoFuneraria ? '' : ' (acuerdo creado)') +
        (adicional ? ` y al acuerdo adicional ${adicional.numero_acuerdo}` : '')
    );

    res.status(201).json({
      success: true,
      data: {
        numero_acuerdo_funeraria: destino.numero_acuerdo,
        acuerdo_creado: !acuerdoFuneraria,
        copiados: alElegido.map(nombre),
        ya_estaban: yaEstaban.map(nombre),
        omitidos: omitidos.map(nombre),
        acuerdo_adicional: adicional
          ? { id: adicional.id, numero_acuerdo: adicional.numero_acuerdo, copiados: sobrantes.map(nombre) }
          : null,
      },
    });
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
 * GET /api/salud/socios/:socioId/numero-sugerido-funeraria
 * Número que se propone para el acuerdo de funeraria que "Importar a
 * Funeraria" crea cuando el titular no tiene uno (editable).
 */
export const obtenerNumeroSugeridoFuneraria = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(req.params.socioId!, 10);
    const socio = Number.isInteger(socioId)
      ? await prisma.socio.findUnique({ where: { id: socioId }, select: { codigo_socio: true } })
      : null;
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }
    res.json({ success: true, data: { numero_sugerido: await sugerirNumeroAcuerdoFuneraria(socio.codigo_socio) } });
  } catch (error) {
    logger.error('Error al sugerir número de acuerdo de funeraria:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al sugerir el número de acuerdo' } });
  }
};

/**
 * GET /api/salud/socios/:socioId/numero-sugerido
 * Número que se propone para un acuerdo de salud nuevo del socio (editable).
 */
export const obtenerNumeroSugeridoSalud = async (req: Request, res: Response): Promise<void> => {
  try {
    const socioId = parseInt(req.params.socioId!, 10);
    const socio = Number.isInteger(socioId)
      ? await prisma.socio.findUnique({ where: { id: socioId }, select: { codigo_socio: true } })
      : null;
    if (!socio) {
      res.status(404).json({ success: false, error: { code: 'SOCIO_NOT_FOUND', message: 'Socio no encontrado' } });
      return;
    }
    res.json({ success: true, data: { numero_sugerido: await sugerirNumeroAcuerdoSalud(socio.codigo_socio) } });
  } catch (error) {
    logger.error('Error al sugerir número de acuerdo de salud:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al sugerir el número de acuerdo' } });
  }
};

/**
 * POST /api/salud/grupos/:numeroAcuerdo/importar-desde-funeraria
 * "Importar a Salud" desde el detalle de un acuerdo de funeraria: COPIA a los
 * beneficiarios seleccionados al acuerdo de salud del mismo titular (si tiene
 * varios, la pantalla pregunta a cuál). En Funeraria nada cambia ni se borra.
 *
 * POST /api/salud/importar-desde-funeraria/nuevo-acuerdo
 * Lo mismo cuando el titular todavía no tiene acuerdo de salud: en una sola
 * operación se crea su acuerdo (con el número enviado) y se copian ahí.
 */
export const importarDesdeFuneraria = async (req: Request, res: Response): Promise<void> => {
  try {
    const crearAcuerdo = !req.params.numeroAcuerdo;
    const data = crearAcuerdo
      ? importarDesdeFunerariaNuevoSchema.parse(req.body)
      : importarDesdeFunerariaSchema.parse(req.body);
    const numeroAcuerdo = crearAcuerdo ? (data as z.infer<typeof importarDesdeFunerariaNuevoSchema>).numero_acuerdo : req.params.numeroAcuerdo!;

    // Acuerdo de funeraria de origen, con su titular
    const acuerdoFuneraria = await prisma.acuerdoFuneraria.findUnique({
      where: { id: data.acuerdo_funeraria_id },
      include: { beneficiario: { include: { socio: true } } },
    });
    const socio = acuerdoFuneraria?.beneficiario?.socio;
    if (!acuerdoFuneraria || !socio) {
      res.status(404).json({ success: false, error: { code: 'ACUERDO_FUNERARIA_NOT_FOUND', message: 'El acuerdo de funeraria no existe' } });
      return;
    }

    // Acuerdo de salud existente al que se copia (null si se va a crear)
    let filaTitular: AcuerdoSalud | null = null;
    let tipoAcuerdoNuevoId = 0;
    if (!crearAcuerdo) {
      filaTitular = await prisma.acuerdoSalud.findFirst({
        where: { numero_acuerdo: numeroAcuerdo, ...FILA_TITULAR_SALUD },
        include: { beneficiario: { select: { socio_id: true } } },
      });
      if (!filaTitular || filaTitular.estado === 'retirado') {
        res.status(404).json({ success: false, error: { code: 'GRUPO_NOT_FOUND', message: `No se encontró el acuerdo de salud ${numeroAcuerdo} o está retirado` } });
        return;
      }
      // El acuerdo de funeraria de origen tiene que ser del mismo titular
      if ((filaTitular as AcuerdoSalud & { beneficiario: { socio_id: number } }).beneficiario.socio_id !== socio.id) {
        res.status(404).json({ success: false, error: { code: 'ACUERDO_FUNERARIA_NOT_FOUND', message: 'El acuerdo de funeraria no es del titular de este acuerdo de salud' } });
        return;
      }
    }

    const noHabilitado = motivoNoHabilitado(socio, crearAcuerdo ? 'inscribir un acuerdo de salud' : 'sumar beneficiarios al acuerdo');
    if (noHabilitado) {
      res.status(400).json(RESPUESTA_NO_HABILITADO(noHabilitado));
      return;
    }

    const datosNuevo = crearAcuerdo ? (data as z.infer<typeof importarDesdeFunerariaNuevoSchema>) : null;
    if (crearAcuerdo) {
      // Si ya tiene un acuerdo de salud vigente se copia ahí, salvo que el
      // usuario haya confirmado abrirle otro
      const vigente = datosNuevo!.abrir_otro ? null : await prisma.acuerdoSalud.findFirst({
        where: {
          parentesco: null,
          beneficiario: { socio_id: socio.id, parentesco: { equals: 'titular', mode: 'insensitive' } },
          estado: { not: 'retirado' },
          numero_acuerdo: { not: null },
        },
      });
      if (vigente) {
        res.status(409).json({
          success: false,
          error: { code: 'YA_TIENE_ACUERDO_SALUD', message: `El socio ${socio.codigo_socio} ya tiene el acuerdo de salud ${vigente.numero_acuerdo}: los beneficiarios se copian a ese acuerdo.` },
        });
        return;
      }

      // Mismas reglas que al crear un acuerdo desde el módulo de Salud
      const numeroEnUso = await prisma.acuerdoSalud.findFirst({ where: { numero_acuerdo: numeroAcuerdo } });
      if (numeroEnUso) {
        res.status(409).json({ success: false, error: { code: 'NUMERO_ACUERDO_EN_USO', message: `El número de acuerdo de salud ${numeroAcuerdo} ya está registrado. Escribe otro.` } });
        return;
      }
      const cuentaAhorroActiva = await prisma.cuentaAhorro.findFirst({ where: { socio_id: socio.id, estado: true } });
      if (!cuentaAhorroActiva) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SIN_CUENTA_AHORRO_ACTIVA',
            message: `No se puede crear el acuerdo de salud: el socio con expediente ${socio.codigo_socio} no tiene ninguna cuenta de ahorro activa. Debe tener al menos una para acceder al beneficio de salud.`,
          },
        });
        return;
      }
      const tipoAcuerdo = await prisma.tipoAcuerdoSalud.findFirst({ where: { estado: true }, orderBy: { id: 'asc' } });
      if (!tipoAcuerdo) {
        res.status(404).json({ success: false, error: { code: 'TIPO_ACUERDO_NOT_FOUND', message: 'No hay un tipo de acuerdo de salud activo configurado' } });
        return;
      }
      tipoAcuerdoNuevoId = tipoAcuerdo.id;
    }

    // Solo personas vigentes en ese acuerdo de funeraria
    const personas = await prisma.beneficiario.findMany({
      where: { id: { in: data.beneficiario_ids }, acuerdo_funeraria_id: acuerdoFuneraria.id, fecha_retiro_funeraria: null },
      include: { acuerdos_salud: { where: { estado: { not: 'retirado' } }, select: { numero_acuerdo: true } } },
    });
    if (personas.length !== data.beneficiario_ids.length) {
      res.status(404).json({ success: false, error: { code: 'BENEFICIARIO_NOT_IN_ACUERDO', message: 'Alguna de las personas seleccionadas no pertenece a este acuerdo de funeraria' } });
      return;
    }

    const nombre = (b: { nombre: string; apellido: string }) => `${b.nombre} ${b.apellido}`;
    // El titular ya es el dueño del acuerdo de salud y quien no está activo
    // (fallecido, retirado) no ocupa cupo: ninguno de los dos se copia
    const omitidos = personas.filter((b) => esTitular(b.parentesco) || b.estado !== 'activo');
    const candidatos = personas.filter((b) => !omitidos.includes(b));

    const filasDelGrupo = await prisma.acuerdoSalud.findMany({ where: { numero_acuerdo: numeroAcuerdo } });
    const filaEnGrupo = (b: { id: number }) => filasDelGrupo.find((f) => f.beneficiario_id === b.id);
    const yaEstaban = candidatos.filter((b) => filaEnGrupo(b) && filaEnGrupo(b)!.estado !== 'retirado');
    // Quien fue retirado de este acuerdo de salud quedó libre: se vuelve a incluir
    const aReincorporar = candidatos.filter((b) => filaEnGrupo(b)?.estado === 'retirado');
    const aCrear = candidatos.filter((b) => !filaEnGrupo(b));

    // Quien está vigente en OTRO acuerdo de salud no se duplica
    const otroAcuerdo = (b: (typeof personas)[number]) => b.acuerdos_salud.find((a) => a.numero_acuerdo !== numeroAcuerdo);
    const enOtroAcuerdo = [...aReincorporar, ...aCrear].filter((b) => otroAcuerdo(b));
    if (enOtroAcuerdo.length > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EN_OTRO_ACUERDO_SALUD',
          message: `Ya están en otro acuerdo de salud y no se pueden copiar a ${numeroAcuerdo}: ${enOtroAcuerdo
            .map((b) => `${nombre(b)} (acuerdo ${otroAcuerdo(b)?.numero_acuerdo ?? 'sin número'})`)
            .join(', ')}. Desmárcalos para continuar.`,
        },
      });
      return;
    }

    // Salud no tiene tope de beneficiarios: se copian todos los seleccionados
    const nuevos = aReincorporar.length + aCrear.length;
    // Se puede abrir solo con el titular (no se envió a nadie), pero no si se
    // eligieron personas y ninguna se puede copiar
    if (crearAcuerdo && nuevos === 0 && data.beneficiario_ids.length > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'NADA_QUE_COPIAR', message: 'Ninguna de las personas seleccionadas se puede copiar (no están activas): no se creó el acuerdo de salud.' },
      });
      return;
    }

    // Acuerdo nuevo: todos empiezan en la fecha elegida (por defecto hoy).
    // Acuerdo existente: los que se suman empiezan hoy.
    const fechaNueva = datosNuevo?.fecha_inicio;
    const fechaInicio = fechaNueva ? new Date(fechaNueva) : new Date();

    if (nuevos > 0 || crearAcuerdo) {
      await prisma.$transaction(async (tx) => {
        let grupo: AcuerdoSalud;
        if (filaTitular) {
          grupo = filaTitular;
        } else {
          // Titular sin acuerdo de salud: se crea a su nombre, igual que desde el módulo de Salud
          const fichaTitular = await obtenerOCrearBeneficiario(tx, socio.id);
          grupo = await tx.acuerdoSalud.create({
            data: {
              beneficiario_id: fichaTitular.id,
              tipo_acuerdo_id: tipoAcuerdoNuevoId,
              numero_acuerdo: numeroAcuerdo,
              estado: 'activo',
              semanas_sin_pago: 0,
              fecha_inicio: fechaInicio,
            },
          });
          await registrarAuditoria(tx, {
            req,
            accion: 'CREATE',
            modulo: 'salud',
            registro_id: grupo.id,
            despues: { numero_acuerdo: numeroAcuerdo, socio_id: socio.id, origen: 'funeraria', numero_acuerdo_funeraria: acuerdoFuneraria.numero_acuerdo },
          });
        }
        if (nuevos === 0) return;
        // Igual que agregarBeneficiarioAGrupo: los nuevos siguen el estado del grupo
        const estadoGrupo = grupo.estado;
        for (const b of aCrear) {
          await tx.acuerdoSalud.create({
            data: {
              beneficiario_id: b.id,
              tipo_acuerdo_id: grupo.tipo_acuerdo_id,
              numero_acuerdo: numeroAcuerdo,
              numero_contrato: grupo.numero_contrato,
              estado: estadoGrupo,
              semanas_sin_pago: 0,
              fecha_inicio: fechaInicio,
            },
          });
        }
        for (const b of aReincorporar) {
          await tx.acuerdoSalud.update({
            where: { id: filaEnGrupo(b)!.id },
            data: { estado: estadoGrupo, fecha_retiro: null, motivo_retiro: null, semanas_sin_pago: 0 },
          });
        }
        await registrarAuditoria(tx, {
          req,
          accion: 'UPDATE',
          modulo: 'salud',
          registro_id: grupo.id,
          despues: {
            origen: 'funeraria',
            numero_acuerdo_funeraria: acuerdoFuneraria.numero_acuerdo,
            numero_acuerdo_salud: numeroAcuerdo,
            beneficiarios_copiados: [...aCrear, ...aReincorporar].map((b) => b.id),
          },
        });
      });
    }

    logger.info(`Copiadas ${nuevos} persona(s) del acuerdo de funeraria ${acuerdoFuneraria.numero_acuerdo ?? acuerdoFuneraria.id} al acuerdo de salud ${numeroAcuerdo}`);

    res.status(201).json({
      success: true,
      data: {
        numero_acuerdo_salud: numeroAcuerdo,
        acuerdo_creado: crearAcuerdo,
        copiados: [...aCrear, ...aReincorporar].map(nombre),
        ya_estaban: yaEstaban.map(nombre),
        omitidos: omitidos.map(nombre),
      },
    });
  } catch (error: any) {
    logger.error('Error al importar de funeraria a salud:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Errores de validación', details: error.errors } });
      return;
    }
    // Todo va en una transacción: si falla, no queda nada a medias
    const mensaje = req.params.numeroAcuerdo
      ? 'Ocurrió un error al copiar a Salud. No se copió ningún beneficiario; intenta de nuevo.'
      : 'Ocurrió un error al copiar a Salud. No se creó el acuerdo de salud ni se copió ningún beneficiario; intenta de nuevo.';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: mensaje } });
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
