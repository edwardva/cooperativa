/**
 * ============================================
 * CONTROLLER: REPORTES
 * ============================================
 * Controlador para generación y descarga de reportes
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  generarReporteSocios,
  generarReportePrestamos,
  generarReporteFunerariaSuspendidos,
  generarReporteSaludSuspendidos,
  generarReporteSaludAcuerdos,
  generarReporteSaludGrupos,
} from '../services/reportesService';

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const reporteSociosSchema = z.object({
  formato: z.enum(['pdf', 'excel']),
  ubicacion: z.string().optional(),
  estado: z.enum(['activo', 'inactivo', 'todos']).optional(),
});

const reportePrestamosSchema = z.object({
  formato: z.enum(['pdf', 'excel']),
  tipo: z.string().optional(),
  estado: z.enum(['activo', 'saldado', 'mora', 'todos']).optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
});

const reporteFunerariaSuspendidosSchema = z.object({
  formato: z.literal('excel').default('excel'),
});

const reporteSaludSuspendidosSchema = z.object({
  formato: z.enum(['pdf', 'excel']),
});

const reporteSaludAcuerdosSchema = z.object({
  formato: z.literal('excel').default('excel'),
});

const reporteSaludGruposSchema = z.object({
  formato: z.literal('excel').default('excel'),
  tipo: z.enum(['activos', 'suspendidos', 'proximos_suspender']),
});

// ============================================
// CONTROLADORES
// ============================================

/**
 * POST /api/reportes/socios
 * Generar reporte de socios
 */
export const reporteSocios = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSociosSchema.safeParse(req.body);

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

    const { formato, ...filtros } = validacion.data;

    const buffer = await generarReporteSocios(formato, filtros);

    // Configurar headers para descarga
    const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType =
      formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-socios-${fecha}.${extension}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/prestamos
 * Generar reporte de préstamos
 */
export const reportePrestamos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reportePrestamosSchema.safeParse(req.body);

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

    const { formato, ...filtros } = validacion.data;

    const buffer = await generarReportePrestamos(formato, filtros);

    // Configurar headers para descarga
    const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType =
      formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-prestamos-${fecha}.${extension}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/funeraria-suspendidos
 * Generar reporte de acuerdos de funeraria suspendidos
 */
export const reporteFunerariaSuspendidos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteFunerariaSuspendidosSchema.safeParse(req.body);

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

    const buffer = await generarReporteFunerariaSuspendidos(validacion.data.formato);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-funeraria-suspendidos-${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/salud-suspendidos
 * Generar reporte de acuerdos de salud suspendidos (PDF o Excel)
 */
export const reporteSaludSuspendidos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSaludSuspendidosSchema.safeParse(req.body);

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

    const { formato } = validacion.data;
    const buffer = await generarReporteSaludSuspendidos(formato);

    const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType =
      formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-salud-suspendidos-${fecha}.${extension}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/salud-acuerdos
 * Generar reporte con TODOS los acuerdos de salud (no solo suspendidos)
 */
export const reporteSaludAcuerdos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSaludAcuerdosSchema.safeParse(req.body);

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

    const buffer = await generarReporteSaludAcuerdos(validacion.data.formato);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-salud-acuerdos-${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reportes/salud-grupos
 * Generar reporte Excel de acuerdos de salud agrupados (titular +
 * beneficiarios), filtrado por tipo de listado.
 */
export const reporteSaludGrupos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validacion = reporteSaludGruposSchema.safeParse(req.body);

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

    const buffer = await generarReporteSaludGrupos(validacion.data.tipo);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `reporte-salud-${validacion.data.tipo}-${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reportes/tipos
 * Listar tipos de reportes disponibles
 */
export const listarTiposReportes = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  res.status(200).json({
    success: true,
    data: [
      {
        id: 'socios',
        nombre: 'Reporte de Socios',
        descripcion: 'Listado completo de socios con filtros',
        formatos: ['pdf', 'excel'],
        filtros: [
          { campo: 'ubicacion', tipo: 'select', opciones: [] },
          { campo: 'estado', tipo: 'select', opciones: ['activo', 'inactivo', 'todos'] },
        ],
      },
      {
        id: 'prestamos',
        nombre: 'Reporte de Préstamos',
        descripcion: 'Listado de préstamos con estado y filtros',
        formatos: ['pdf', 'excel'],
        filtros: [
          { campo: 'tipo', tipo: 'select', opciones: [] },
          { campo: 'estado', tipo: 'select', opciones: ['activo', 'saldado', 'mora', 'todos'] },
          { campo: 'fecha_desde', tipo: 'date' },
          { campo: 'fecha_hasta', tipo: 'date' },
        ],
      },
      {
        id: 'funeraria-suspendidos',
        nombre: 'Reporte de Acuerdos de Funeraria Suspendidos',
        descripcion: 'Listado de acuerdos suspendidos con semanas de atraso',
        formatos: ['excel'],
        filtros: [],
      },
      {
        id: 'salud-suspendidos',
        nombre: 'Reporte de Acuerdos de Salud Suspendidos',
        descripcion: 'Listado de acuerdos de salud suspendidos con semanas de atraso',
        formatos: ['pdf', 'excel'],
        filtros: [],
      },
      {
        id: 'salud-acuerdos',
        nombre: 'Reporte de Acuerdos de Salud',
        descripcion: 'Listado completo de todos los acuerdos de salud',
        formatos: ['excel'],
        filtros: [],
      },
      {
        id: 'salud-grupos',
        nombre: 'Reporte de Grupos de Salud',
        descripcion: 'Listado de acuerdos de salud (titular + beneficiarios) por tipo: activos, suspendidos o próximos a suspender',
        formatos: ['excel'],
        filtros: [{ campo: 'tipo', tipo: 'select', opciones: ['activos', 'suspendidos', 'proximos_suspender'] }],
      },
    ],
  });
};
